import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";
import { PLUGIN_TESTID } from "@olai/bundle/testids";
import { selector } from "@olai/web/testlib";
import { attr, PALETTE_ITEM, POLL_TIMEOUT, HYDRATION_TIMEOUT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";
const fresh = selector(PLUGIN_TESTID.chatNew);
When("I press new chat in Chats", async function(this: OlaiWorld) {
  await this.showSidebar();
  await this.press(this.page.locator(fresh));
});
When("I pick new chat in the Agents palette", async function(this: OlaiWorld) {
  await this.page.locator(`${PALETTE_ITEM}${attr("data-id", "new-chat")}`).click();
});
When("I choose palette new chat engine {string}", async function(this: OlaiWorld, engine: string) {
  await this.page.locator(`${PALETTE_ITEM}${attr("data-id", `new-chat-engine-${engine}`)}`).click();
});
When("I choose new chat engine {string}", async function(this: OlaiWorld, engine: string) {
  await this.page.locator(selector(PLUGIN_TESTID.agentEngineMenu)).getByRole("menuitem", { name: engine, exact: true }).click();
});
Then("the new chat palette offers engines {string}", async function(this: OlaiWorld, names: string) {
  const rows = this.page.locator(`${PALETTE_ITEM}${attr("data-id", "new-chat-engine-", "^=")}`);
  await this.waitUntil(async () => (await rows.allTextContents()).map(x => x.trim()).join("|") === names, "the palette's engine names");
});
Then("the new Inbox conversation is unfolded as {string} with engine {string}", async function(this: OlaiWorld, name: string, engine: string) {
  let id: string | undefined;
  await this.waitUntil(async () => {
    const found = this.servedNodesSoFar("_olai/Inbox.olai").find(node => node.parent === "chats" && node.title === "new conversation" && String((node.custom as Record<string, unknown> | undefined)?.["chat-agent-session"]).startsWith(`${engine}:`));
    id = found?.id as string | undefined;
    return id !== undefined;
  }, "the new node's session binding", HYDRATION_TIMEOUT);
  assert.ok(id);
  this.nodeNames.set(name, id);
  this.activeAgent = name;
  await this.page.locator(`${selector(PLUGIN_TESTID.agentFold)}${attr("data-agent", id)}`).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await this.node(name).getAttribute("data-file"), "_olai/Inbox.olai");
});
Then("new chat says {string}", async function(this: OlaiWorld, message: string) {
  await this.page.locator(selector(PLUGIN_TESTID.agentRoster)).getByText(message, { exact: true }).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
Then("new chat in Chats is starting", async function(this: OlaiWorld) {
  await this.waitUntil(async () => await this.page.locator(fresh).getAttribute("aria-busy") === "true", "creation to stay pending");
  assert.ok(await this.page.locator(fresh).isDisabled());
});
Then("new chat in Chats is unavailable", async function(this: OlaiWorld) {
  await this.showSidebar();
  await this.waitUntil(async () => await this.page.locator(fresh).isDisabled(), "no engine to disable creation");
});
Then("the Inbox contains no chat children", function(this: OlaiWorld) {
  assert.equal(this.servedNodesSoFar("_olai/Inbox.olai").filter(node => node.parent === "chats").length, 0);
});
Then("the palette says a new conversation is already starting", async function(this: OlaiWorld) {
  await this.page.getByText("a new conversation is already starting", { exact: true }).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
Then("the palette says no agent engine is available", async function(this: OlaiWorld) {
  await this.page.getByText("no agent engine is available", { exact: true }).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
Then("the refused new chat leaves a plain Inbox node as {string}", async function(this: OlaiWorld, name: string) {
  await this.waitUntil(async () => await this.page.locator(fresh).isEnabled(), "the refused creation to become retryable");
  await this.waitUntil(async () => (await this.page.locator(selector(PLUGIN_TESTID.agentRoster)).innerText()).includes("will not start a conversation"), "the start refusal to remain visible");
  const rows = this.servedNodes("_olai/Inbox.olai").filter(node => node.parent === "chats");
  assert.equal(rows.length, 1);
  assert.equal((rows[0]!.custom as Record<string, unknown> | undefined)?.["chat-agent-session"], undefined);
  this.nodeNames.set(name, rows[0]!.id as string);
});
Then("the new chat receives the ordinary node contract", async function(this: OlaiWorld) {
  const text = await this.chatRoot().innerText();
  assert.ok(text.includes("This conversation is the node agent for"));
  assert.ok(!text.includes("This conversation has been ASSIGNED to the node agent"));
});
