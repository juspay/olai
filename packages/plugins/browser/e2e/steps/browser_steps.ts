import assert from "node:assert/strict"
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Given, Then } from "@olai/tests/harness/runner.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
import { TESTID } from "olai-plugin-chat/testids"

// The harness places each scratch serve's XDG directories beside its vault.
const runtime = (world: OlaiWorld) => join(`${world.scratch()}.xdg`, "runtime")
const probes = (world: OlaiWorld): Array<{ args: string[]; pid: number }> =>
  readFileSync(join(runtime(world), "browser-probes.log"), "utf8").trim().split("\n").map(line => JSON.parse(line))
Given("the browser MCP fixture answers {string}", function (this: OlaiWorld, mode: string) {
  writeFileSync(join(runtime(this), "browser-mode"), mode)
})
Then(/^the browser MCP has been probed (\d+) times? with private scratch$/, function (this: OlaiWorld, count: string) {
  const calls = probes(this)
  assert.equal(calls.length, Number(count))
  const last = calls.at(-1)!
  assert.deepEqual(last.args.slice(0, 3), ["--headless", "--isolated", "--output-dir"])
  const output = last.args[3]!
  assert.ok(output.startsWith(join(runtime(this), "olai-browser-")))
  assert.equal(statSync(output).mode & 0o777, 0o700)
  assert.ok(!output.startsWith(this.scratch() + "/"))
})
Then("the browser MCP scratch has been removed", function (this: OlaiWorld) {
  for (const call of probes(this)) assert.equal(existsSync(call.args[3]!), false)
})
Then("this conversation has no browser MCP server", async function (this: OlaiWorld) {
  const names = await this.chatRoot().getByTestId(TESTID.chatServer).evaluateAll(rows => rows.map(row => row.getAttribute("data-server")))
  assert.ok(!names.includes("browser"))
})
