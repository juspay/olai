import { expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ROWS } from "./rows.ts"
import { writeFixturePolicy } from "./fixture.testlib.ts"

const bench = (use: (root: string, rows: () => Array<{ title: string; custom: Record<string, string> }>) => void) => {
  const root = mkdtempSync(join(tmpdir(), "olai-fixture-policy-"))
  try { use(root, () => readFileSync(join(root, "_olai/Settings.olai"), "utf8").trim().split("\n").map(line => JSON.parse(line))) }
  finally { rmSync(root, { recursive: true, force: true }) }
}
test("exact fixtures preserve every reader-profile row unless explicitly switched off", () => bench((root, read) => {
  writeFixturePolicy(root, { only: ["test-counter"] })
  const readers = ROWS.filter(row => row.disabled !== true && row.profiles?.includes("test-minimal"))
  expect(readers.length).toBeGreaterThan(0)
  for (const row of readers) expect(read().find(node => node.title === row.id)?.custom.on).toBe("yes")
  expect(read().find(node => node.title === "chat")?.custom.on).toBe("no")
  expect(read().find(node => node.title === "test-layout")?.custom.on).toBe("no")
  writeFixturePolicy(root, { without: "settings" })
  expect(read().find(node => node.title === "settings")?.custom.on).toBe("no")
}))
test("fixture process log format wins over copied pretty while authored policy siblings survive", () => bench((root, read) => {
  mkdirSync(join(root, "_olai"))
  writeFileSync(join(root, "_olai/Settings.olai"), '{"id":"own","ord":"a0","title":"olai","custom":{"log-format":"pretty","log-level":"debug"}}\n')
  writeFixturePolicy(root, { process: { "log-format": "logfmt", "log-level": "info" } })
  expect(read().find(row => row.title === "olai")?.custom).toEqual({ "log-format": "logfmt", "log-level": "debug" })
}))
