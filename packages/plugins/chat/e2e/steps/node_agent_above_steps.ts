/**
 * THE AGENT ABOVE — the pill on a node's page, the mark on a bound ancestor's
 * crumb, and the two menu doors that reach the same conversation.
 *
 * What a scenario asserts is always the DOOR's identity (`data-agent` on the
 * pill and on the mark) and, where the words matter, the line a person reads.
 * Nothing here reads a colour or a mark's path: which engine drew which shape
 * is chat's, and `data-engine` is beside it where a scenario needs to name it.
 */
import assert from "node:assert/strict"
import { Then, When } from "@olai/tests/harness/runner.ts"
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts"
import { selector } from "@olai/web/testlib"
import {
  attr,
  BREADCRUMBS,
  HYDRATION_TIMEOUT,
  PALETTE_ITEM,
  POLL_TIMEOUT,
  ZOOM_TITLE,
} from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"

const above = selector(PLUGIN_TESTID.agentAbove)
const aboveLine = selector(PLUGIN_TESTID.agentAboveLine)
const crumbMark = selector(PLUGIN_TESTID.crumbMark)
const pageHead = selector(PLUGIN_TESTID.agentPageHead)
const dock = selector(PLUGIN_TESTID.chatDock)

const visiblePill = (world: OlaiWorld) => world.frontLane().locator(`${above}:visible`)

/** One search hit, by the words on it. The palette and the header box draw the
 *  same row (`olai-plugin-search/ui/Result.tsx`), and the mark is inside it. */
const hitRow = (world: OlaiWorld, label: string) =>
  world.page.locator(PALETTE_ITEM).filter({ hasText: label })

Then("the agent-above pill points at {string}", async function (this: OlaiWorld, node: string) {
  await this.frontLane().locator(`${above}${attr("data-agent", this.nodeId(node))}:visible`)
    .first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
})

Then("the agent-above pill reads {string} and {string}", async function (this: OlaiWorld, title: string, engine: string) {
  const text = await visiblePill(this).first().innerText()
  assert.ok(text.includes("↑"), `the pill has no arrow: ${JSON.stringify(text)}`)
  assert.ok(text.includes(title), `the pill does not name ${JSON.stringify(title)}: ${JSON.stringify(text)}`)
  assert.ok(text.includes(engine), `the pill does not name ${JSON.stringify(engine)}: ${JSON.stringify(text)}`)
})

Then("the agent-above pill is absent", async function (this: OlaiWorld) {
  await this.waitUntil(async () => (await visiblePill(this).count()) === 0, "the agent-above pill to leave")
})

When("I press the agent-above pill", async function (this: OlaiWorld) {
  const pill = visiblePill(this).first()
  await pill.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.press(pill)
})

Then("the page head is empty", async function (this: OlaiWorld) {
  assert.equal(await this.frontLane().locator(pageHead).count(), 0, "the page drew an agent head")
  assert.equal(await this.frontLane().locator(`${aboveLine}:visible`).count(), 0, "the page drew an agent-above line")
})

/** The pill is IN the line that means "this node has a conversation", rather
 *  than somewhere else on the page that happens to be visible. */
Then("the agent page's line wears the agent-above pill", async function (this: OlaiWorld) {
  await this.frontLane().locator(`${pageHead} ${above}`).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
})

Then("the agent panel's agent-above pill points at {string}", async function (this: OlaiWorld, node: string) {
  await this.page.locator(`${dock} ${above}${attr("data-agent", this.nodeId(node))}`)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
})

Then("the crumb on {string} wears the agent's mark", async function (this: OlaiWorld, node: string) {
  const mark = this.frontLane().locator(`${BREADCRUMBS} ${crumbMark}${attr("data-agent", this.nodeId(node))}`)
  await mark.first().waitFor({ state: "visible", timeout: POLL_TIMEOUT })
})

Then("no crumb wears an agent mark", async function (this: OlaiWorld) {
  assert.equal(await this.frontLane().locator(`${BREADCRUMBS} ${crumbMark}`).count(), 0, "a crumb wore a mark")
})

When("I press the crumb mark on {string}", async function (this: OlaiWorld, node: string) {
  const mark = this.frontLane().locator(`${BREADCRUMBS} ${crumbMark}${attr("data-agent", this.nodeId(node))}`).first()
  await mark.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.press(mark)
})

Then("the search hit {string} wears the mark of {string}", async function (this: OlaiWorld, label: string, node: string) {
  await hitRow(this, label).locator(`${crumbMark}${attr("data-agent", this.nodeId(node))}`)
    .first().waitFor({ state: "visible", timeout: POLL_TIMEOUT })
})

When("I press the crumb mark on {string} in the search hit {string}", async function (this: OlaiWorld, node: string, label: string) {
  const mark = hitRow(this, label).locator(`${crumbMark}${attr("data-agent", this.nodeId(node))}`).first()
  await mark.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.press(mark)
})

Then("the palette lists the row {string}", async function (this: OlaiWorld, id: string) {
  await this.page.locator(`${PALETTE_ITEM}${attr("data-id", id)}`).waitFor({ state: "visible", timeout: POLL_TIMEOUT })
})

Then("the palette lists no row {string}", async function (this: OlaiWorld, id: string) {
  await this.waitUntil(async () => (await this.page.locator(`${PALETTE_ITEM}${attr("data-id", id)}`).count()) === 0, `the palette to list no ${JSON.stringify(id)}`)
})

Then("pane {int} shows the node page {string}", async function (this: OlaiWorld, index: number, node: string) {
  await this.pane(index).locator(`${ZOOM_TITLE}${attr("data-node-id", this.nodeId(node))}`)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
})
