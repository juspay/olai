/**
 * THE PLACES A VAULT PLUGIN DRAWS OUTSIDE AN OUTLINE — the reading
 * companion's sidebar section, its chord and its palette row, and the catalog
 * an agent reads to learn they exist.
 *
 * The faces are found by the `data-plugin` the sidebar stamps on a section and
 * by the attributes the fixture's own source writes, because a plugin a vault
 * defines is by definition not in this build's testid table.
 */

import * as assert from "node:assert/strict"

import { Then, When } from "@olai/tests/harness/runner.ts"
import { attr, HYDRATION_TIMEOUT, POLL_TIMEOUT, SIDEBAR } from "@olai/tests/harness/world.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"

/** One entry of `vault-plugins_inspect`'s slot list. */
interface Slot {
  readonly name: string
  readonly keyedBy: string
  readonly handed: string
}

const catalog = async (world: OlaiWorld): Promise<ReadonlyArray<Slot>> => {
  // Loaded on first use, as every MCP step in this row loads it: a scenario
  // with no agent in it never opens the client.
  const { callTool, connectTerminalAgent } = await import("@olai/tests/harness/mcp.ts")
  world.terminalAgent ??= await connectTerminalAgent(`${world.baseUrl}/mcp`)
  const answer = await callTool(world.terminalAgent, "vault-plugins_inspect", {})
  return (answer["structuredContent"] as { slots: ReadonlyArray<Slot> }).slots
}

Then("the slot catalog lists {string}", async function (this: OlaiWorld, names: string) {
  const listed = (await catalog(this)).map((one) => one.name)
  const missing = names.split(",").map((one) => one.trim()).filter((one) => !listed.includes(one))
  assert.deepEqual(missing, [], `the catalog lists ${listed.join(", ")}`)
})

Then("every slot in the catalog says what its face is handed", async function (this: OlaiWorld) {
  const slots = await catalog(this)
  assert.ok(slots.length > 0, "the catalog lists no slot at all")
  const silent = slots.filter((one) => typeof one.handed !== "string" || one.handed.trim() === "").map((one) => one.name)
  assert.deepEqual(silent, [], "these slots do not say what their face is handed")
})

/** The section the reader draws, inside the wrapper the sidebar stamps with
 *  the contributing plugin's word. The plugin's own rows in the Plugins section
 *  carry that word too, so the fixture's attribute is what tells them apart. */
const section = (world: OlaiWorld) =>
  world.page.locator(`${SIDEBAR} ${attr("data-plugin", "reader")} ${attr("data-reader", "section")}`)

Then("the sidebar draws the reading section", async function (this: OlaiWorld) {
  await section(this).first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
})

Then("the sidebar draws no reading section", async function (this: OlaiWorld) {
  await this.waitUntil(async () => (await section(this).count()) === 0, "the sidebar to draw no reading section")
})

When("I follow {string} in the reading section", async function (this: OlaiWorld, label: string) {
  const link = section(this).locator("a").filter({ hasText: label }).first()
  await link.waitFor({ state: "visible", timeout: POLL_TIMEOUT })
  await this.press(link)
})

/** A chord nobody answers moves nothing: the page in front of the reader is
 *  the page that was there before the press. Read after two frames, because
 *  the absence has to be true now. */
Then("pressing {string} leaves this page where it is", async function (this: OlaiWorld, chord: string) {
  const was = this.place()
  await this.page.keyboard.press(chord)
  await this.waitForFrame()
  await this.waitForFrame()
  assert.equal(this.place(), was, `pressing ${chord} moved the page`)
})
