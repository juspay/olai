import assert from "node:assert/strict";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";
import { attr, PALETTE_ITEM, POLL_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";
const recent = selector(PLUGIN_TESTID.agentRoster);
const needs = selector(PLUGIN_TESTID.agentNeedsYou);
const row = selector(PLUGIN_TESTID.agentRow);
const need = selector(PLUGIN_TESTID.agentNeedRow);
Given("the sidebar has eleven agents with dated vault edits", function(this: OlaiWorld) {
  this.writeServed("recent.olai", Array.from({ length: 11 }, (_, i) => JSON.stringify({ id: `recent-${i}`, ord: `a${i.toString(36)}`, title: `Chats agent ${i}`, changed: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`, custom: { "chat-agent-session": i === 1 ? "claude" : `claude:fake-session-${i + 1}` } })).join("\n") + "\n");
});
Then("Chats lists {string}", async function(this: OlaiWorld, ids: string) {
  await this.showSidebar();
  await this.page.locator(recent).getByRole("heading", { name: "Chats", exact: true }).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.waitUntil(async () => (await this.page.locator(`${recent} ${row}`).evaluateAll(elements => elements.map(el => el.getAttribute("data-agent")))).join(" ") === ids, "Chats to be in activity order");
});
Then("Needs you lists {string}", async function(this: OlaiWorld, ids: string) {
  await this.showSidebar();
  await this.waitUntil(async () => (await this.page.locator(`${needs} ${need}`).evaluateAll(elements => elements.map(el => el.getAttribute("data-agent")))).join(" ") === ids, "Needs you to put waiting agents before stopped ones");
});
Then("Needs you is absent", async function(this: OlaiWorld) { await this.page.locator(needs).waitFor({ state: "detached", timeout: POLL_TIMEOUT }); });
Then("the agent sidebar regions are absent", async function(this: OlaiWorld) { await this.waitUntil(async () => await this.page.locator(`${needs}, ${recent}`).count() === 0, "both agent regions to withdraw"); });
Then("the Needs you row {string} has waiting questions", async function(this: OlaiWorld, id: string) {
  const count = this.page.locator(`${needs} ${need}${attr("data-agent", this.nodeId(id))} ${selector(PLUGIN_TESTID.agentWaiting)}`);
  assert.ok(Number(await count.innerText()) > 0);
});
Then("the Needs you row {string} says {string}", async function(this: OlaiWorld, id: string, words: string) {
  assert.ok((await this.page.locator(`${needs} ${need}${attr("data-agent", this.nodeId(id))}`).innerText()).includes(words));
});
Then("the Agents palette lists {int} agents", async function(this: OlaiWorld, count: number) {
  await this.waitUntil(async () => await this.page.locator(`${PALETTE_ITEM}${attr("data-id", "agent-", "^=")}`).count() === count, "the palette's complete agent list");
});
When("I pick the Agents palette row {string}", async function(this: OlaiWorld, id: string) {
  this.activeAgent = id;
  await this.page.locator(`${PALETTE_ITEM}${attr("data-id", `agent-${this.nodeId(id)}`)}`).click();
});
Then("the Chats row {string} is current", async function(this: OlaiWorld, id: string) {
  await this.waitUntil(async () => await this.page.locator(`${recent} ${row}${attr("data-agent", this.nodeId(id))}`).getAttribute("aria-current") === "page", "the opened agent to be the current row");
});
