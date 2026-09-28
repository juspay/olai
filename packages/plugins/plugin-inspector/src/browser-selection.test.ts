import { expect, test } from "bun:test"
import type { BuiltPlugin } from "@olai/surface"
import type { RowReport } from "@olai/plugin-api"
import { conditionSaid, rowCondition } from "./rows.ts"

const said = (plugin: BuiltPlugin, reports: ReadonlyMap<string, RowReport> = new Map()): string | null => {
  const now = rowCondition(plugin, reports)
  return now === null ? null : conditionSaid(now)
}
const shell: BuiltPlugin = { name: "shell", running: true, browserOnly: true }

test("a selected browser-only row does not claim successful browser activation", () => {
  expect(said(shell)).toBe(null)
  expect(said(shell, new Map([["other", { state: "running" }]]))).toBe("Not started in this tab yet.")
  expect(said(shell, new Map([["shell", { state: "waiting", missing: ["renderer.slots"] }]]))).toContain("renderer.slots")
  expect(said(shell, new Map([["shell", { state: "failed", fault: "could not render" }]]))).toContain("could not render")
  expect(said(shell, new Map([["shell", { state: "running" }]]))).toBeNull()
  expect(said({ name: "server", running: true })).toBeNull()
})
