import { run } from "@kolu/child"
import { expect, test } from "bun:test"
import * as path from "node:path"

const MAIN = path.join(import.meta.dirname, "main.ts")

const olai = async (
  argv: ReadonlyArray<string>,
  env: Readonly<Record<string, string>> = {},
): Promise<{ readonly out: string; readonly err: string; readonly code: number }> => {
  const result = await run(process.execPath, [MAIN, ...argv], {
    env: { ...process.env, ...env },
    maxBuffer: 32 * 1024 * 1024,
    timeout: 10_000,
  })
  return { out: result.out, err: result.err, code: result.code ?? (result.ok ? 0 : 1) }
}

test("a capture's title is a POSITION, and a note is all else it takes", async () => {
  const { out } = await olai(["surface", "capture", "add", "--help"])
  expect(out).toContain("[<title>]")
  expect(out).not.toContain("--title")
  expect(out).toContain("--text")
  expect(out).not.toContain("--props")
}, 30_000)

test("every verb takes `--url`, and there is no socket anywhere", async () => {
  const { out } = await olai(["surface", "list", "--help"])
  expect(out).toContain("--url")
  expect(out).not.toContain("--socket")
}, 30_000)

test("naming no server is a usage error, and never a guess", async () => {
  const { code } = await olai(["surface", "outlines", "keys", "outlines"])
  expect(code).toBe(2)
}, 30_000)

test("nothing serving is exit 3, and it names the address it tried", async () => {
  const nowhere = "http://127.0.0.1:1"
  const { out, err, code } = await olai(["surface", "outlines", "keys", "outlines", "--url", nowhere])
  expect(code).toBe(3)
  expect(err).toContain(nowhere)
  expect(err).toContain("no surface at")
  expect(out.trim()).toBe("")
}, 30_000)

test("`olai surface --help` is a page, not a dump of every verb", async () => {
  const { out, code } = await olai(["surface", "--help"])
  expect(code).toBe(0)
  for (const said of [
    "Call any verb of a running olai from a terminal",
    "Capture",
    "Outlines and documents",
    "Search",
    'olai surface capture add "look into the new cabinets"',
    "--url <server>",
    "--json",
    "A write prints one line",
    "--json prints the whole",
  ]) expect(out).toContain(said)
  expect(out).not.toContain("SUBCOMMANDS")
}, 30_000)

test("no `watch`, and no `--follow`, because the door pushes nothing", async () => {
  const { code } = await olai(["surface", "outlines", "watch", "outlines", "--url", "http://127.0.0.1:1"])
  expect(code).toBe(2)
  const { out } = await olai(["surface", "outlines", "get", "--help"])
  expect(out).not.toContain("--follow")
}, 30_000)
