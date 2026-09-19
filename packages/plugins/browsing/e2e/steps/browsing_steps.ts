import assert from "node:assert/strict"
import { readFileSync, statSync, readdirSync, writeFileSync } from "node:fs"
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
  for (const call of calls) assert.deepEqual(call.args, ["--headless", "--isolated"])
})
const outputs = (world: OlaiWorld): string[] => readdirSync(runtime(world))
  .filter(name => name.startsWith("olai-browser-"))
  .flatMap(name => {
    const root = join(runtime(world), name)
    assert.equal(statSync(root).mode & 0o777, 0o700)
    return readdirSync(root).map(child => join(root, child))
  })
Then("two conversations have distinct private output directories", function (this: OlaiWorld) {
  const dirs = outputs(this)
  assert.equal(dirs.length, 2)
  assert.equal(new Set(dirs).size, 2)
  for (const dir of dirs) assert.equal(statSync(dir).mode & 0o777, 0o700)
})
Then("the browser MCP scratch has been removed", function (this: OlaiWorld) {
  assert.deepEqual(outputs(this), [])
})
Then("this conversation has no browser MCP server", async function (this: OlaiWorld) {
  const names = await this.chatRoot().getByTestId(TESTID.chatServer).evaluateAll(rows => rows.map(row => row.getAttribute("data-server")))
  assert.ok(!names.includes("browser"))
})
