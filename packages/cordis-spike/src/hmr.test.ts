/**
 * HMR's cache clearing is Node's ESM loadCache + CJS require.cache.
 * This file asks whether that recipe works under Bun.
 */

import { createRequire } from "node:module"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { describe, expect, test } from "bun:test"

describe("HMR cache clearing under Bun", () => {
  test("require.cache exists (the CJS half of HMR's recipe)", () => {
    const require = createRequire(import.meta.url)
    expect(require.cache).toBeDefined()
    expect(typeof require.cache).toBe("object")
  })

  test("Bun does not expose Node's internal ESM ModuleLoader.loadCache", () => {
    const require = createRequire(import.meta.url)
    // HMR reaches this through loader.internal, which is ModuleLoader.fromInternal()
    // — process.binding / node:internal. Under Bun that path is not there.
    let internals: unknown
    try {
      internals = require("node:internal/modules/esm/loader")
    } catch (error) {
      internals = error
    }
    expect(internals).toBeInstanceOf(Error)
  })

  test("a rewritten ESM module is served stale on the second import()", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cordis-hmr-"))
    const file = join(dir, "mod.ts")
    writeFileSync(file, "export const n = 1\n")
    const url = pathToFileURL(file).href
    const first = (await import(url)) as { n: number }
    expect(first.n).toBe(1)
    writeFileSync(file, "export const n = 2\n")
    const second = (await import(url)) as { n: number }
    expect(second.n).toBe(1)
  })

  test("a query-string does not bust Bun's ESM cache either", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cordis-hmr-"))
    const file = join(dir, "mod.ts")
    writeFileSync(file, "export const n = 1\n")
    const url = pathToFileURL(file).href
    const first = (await import(url)) as { n: number }
    expect(first.n).toBe(1)
    writeFileSync(file, "export const n = 2\n")
    const busted = (await import(`${url}?t=${Date.now()}`)) as { n: number }
    // HMR's Node recipe is loadCache.delete + require.cache delete, then
    // import() of the SAME specifier. Under Bun even a query-string on the
    // same path is still the stale module — a different PATH is the only
    // thing that yields a new evaluation.
    expect(busted.n).toBe(1)
    const other = join(dir, "other.ts")
    writeFileSync(other, "export const n = 2\n")
    const fresh = (await import(pathToFileURL(other).href)) as { n: number }
    expect(fresh.n).toBe(2)
  })
})
