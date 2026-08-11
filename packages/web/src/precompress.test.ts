/**
 * Precompressed siblings land next to the identity bytes, and only when they
 * actually win. The static layer's negotiation is tested in kolu; this file
 * is the build half of the contract.
 */

import { afterEach, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { precompressAssets } from "./precompress.ts"

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs.length = 0
})

const scratch = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "olai-precompress-"))
  dirs.push(dir)
  return dir
}

test("writes .br and .gz siblings that are smaller than the identity bytes", async () => {
  const dir = scratch()
  // Highly compressible — real bundles are text, not random.
  const raw = Buffer.alloc(50_000, "a")
  writeFileSync(join(dir, "main-abc123.js"), raw)

  const rows = await precompressAssets(dir)
  expect(rows).toEqual([
    {
      file: "main-abc123.js",
      raw: raw.byteLength,
      br: expect.any(Number),
      gz: expect.any(Number),
    },
  ])
  const row = rows[0]!
  expect(row.br!).toBeLessThan(raw.byteLength)
  expect(row.gz!).toBeLessThan(raw.byteLength)
  expect(row.br!).toBeLessThanOrEqual(row.gz!)

  expect(readFileSync(join(dir, "main-abc123.js.br")).byteLength).toBe(row.br!)
  expect(readFileSync(join(dir, "main-abc123.js.gz")).byteLength).toBe(row.gz!)
  // Identity bytes are left alone for clients that decline compression.
  expect(readFileSync(join(dir, "main-abc123.js")).equals(raw)).toBe(true)
})

test("skips binary / non-text extensions even when large", async () => {
  const dir = scratch()
  writeFileSync(join(dir, "logo-abc.png"), Buffer.alloc(10_000, 0xff))
  const rows = await precompressAssets(dir)
  expect(rows).toEqual([])
  expect(await Bun.file(join(dir, "logo-abc.png.br")).exists()).toBe(false)
  expect(await Bun.file(join(dir, "logo-abc.png.gz")).exists()).toBe(false)
})

test("skips tiny files where headers would dominate", async () => {
  const dir = scratch()
  writeFileSync(join(dir, "tiny.js"), "console.log(1)\n")
  const rows = await precompressAssets(dir)
  expect(rows).toEqual([{ file: "tiny.js", raw: 15, br: null, gz: null }])
  expect(await Bun.file(join(dir, "tiny.js.br")).exists()).toBe(false)
})

test("does not re-encode existing siblings as primaries", async () => {
  const dir = scratch()
  const raw = Buffer.alloc(5_000, "x")
  writeFileSync(join(dir, "main.js"), raw)
  writeFileSync(join(dir, "main.js.br"), "already")
  // A second pass after a build re-run must not treat .br as a primary.
  const first = await precompressAssets(dir)
  expect(first).toHaveLength(1)
  const second = await precompressAssets(dir)
  expect(second).toHaveLength(1)
  // Still one primary row, not three (js + br + gz).
  expect(second.map((r) => r.file)).toEqual(["main.js"])
})
