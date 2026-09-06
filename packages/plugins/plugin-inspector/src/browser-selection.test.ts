import { expect, test } from "bun:test"
import { browserHint, pluginHint } from "./rows.ts"

test("a selected browser-only row does not claim successful browser activation", () => {
  expect(pluginHint({ name: "shell", running: true, browserOnly: true })).toBe(null)
  expect(browserHint("shell", new Map(), true)).toBe("Browser: awaiting activation.")
  expect(browserHint("shell", new Map([["shell", { state: "waiting", missing: ["renderer.slots"] }]]), true)).toContain("renderer.slots")
  expect(browserHint("shell", new Map([["shell", { state: "failed", fault: "could not render" }]]), true)).toContain("could not render")
  expect(browserHint("shell", new Map([["shell", { state: "running" }]]), true)).toBeNull()
  expect(browserHint("server", new Map())).toBeNull()
})
