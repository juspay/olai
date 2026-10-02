import assert from "node:assert/strict"
type ElementHandle = NonNullable<Awaited<ReturnType<ReturnType<OlaiWorld["pane"]>["elementHandle"]>>>
import { Then, When } from "@olai/tests/harness/runner.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"
import { selector } from "@olai/ui-primitives/testids.ts"
import { TESTID } from "olai-plugin-layout/testids"

const remembered = new WeakMap<OlaiWorld, Map<string, ElementHandle>>()
When("I remember pane {int} as {string}", async function (this: OlaiWorld, index: number, name: string) {
  const node = await this.pane(index).elementHandle()
  assert.ok(node)
  let panes = remembered.get(this)
  if (!panes) { panes = new Map(); remembered.set(this, panes) }
  panes.set(name, node)
})
Then("pane {int} is still {string}", async function (this: OlaiWorld, index: number, name: string) {
  const old = remembered.get(this)?.get(name)
  assert.ok(old)
  assert.equal(await this.pane(index).evaluate((node, old) => node === old, old), true)
})
Then("remembered pane {string} is {word}", async function (this: OlaiWorld, name: string, status: string) {
  const old = remembered.get(this)?.get(name)
  assert.ok(old)
  const connected = await old.evaluate(node => node.isConnected)
  assert.equal(connected, status === "mounted")
})
Then("there are {int} live lanes", async function (this: OlaiWorld, count: number) {
  await this.waitUntil(async () => await this.page.locator(selector(TESTID.lane)).count() === count, `${count} live lanes`)
})
