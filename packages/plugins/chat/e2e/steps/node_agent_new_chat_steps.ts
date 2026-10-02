import assert from "node:assert/strict";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";
import { attr, PALETTE_ITEM, POLL_TIMEOUT, HYDRATION_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";
const fresh = selector(PLUGIN_TESTID.chatNew);
const input = selector(PLUGIN_TESTID.newChatInput);
const picker = selector(PLUGIN_TESTID.newChatPicker);
When("I press new chat in Chats", async function(this: OlaiWorld) {
  await this.showSidebar();
  await this.press(this.page.locator(fresh));
});
When("I press {string} on new chat in Chats", async function(this: OlaiWorld, key: string) {
  await this.showSidebar();
  const plus = this.page.locator(fresh);
  await plus.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await plus.focus();
  await this.page.keyboard.press(key);
});
When("I pick new chat in the Agents palette", async function(this: OlaiWorld) {
  await this.page.locator(`${PALETTE_ITEM}${attr("data-id", "new-chat")}`).click();
});
When("I choose new chat engine {string}", async function(this: OlaiWorld, engine: string) {
  await this.page.locator(selector(PLUGIN_TESTID.newChatEngine)).selectOption({ label: engine });
});
When("I choose agent menu engine {string}", async function(this: OlaiWorld, engine: string) {
  await this.page.locator(selector(PLUGIN_TESTID.agentEngineMenu)).getByRole("menuitem", { name: engine, exact: true }).click();
});
When("I type new chat draft {string}", async function(this: OlaiWorld, text: string) {
  await this.page.locator(input).fill(text.replaceAll("\\n", "\n"));
});
When("I send the new chat draft", async function(this: OlaiWorld) {
  await this.page.locator(selector(PLUGIN_TESTID.newChatSend)).click();
});
Then("the new chat composer is focused", async function(this: OlaiWorld) {
  await this.page.locator(input).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await this.page.locator(input).evaluate(el => document.activeElement === el), "new chat focus");
});
Then("the new chat draft is {string}", async function(this: OlaiWorld, text: string) {
  await this.waitUntil(async () => await this.page.locator(input).inputValue() === text.replaceAll("\\n", "\n"), "the kept draft");
});
Then("the new chat location contains {string}", async function(this: OlaiWorld, text: string) {
  assert.ok((await this.page.locator(selector(PLUGIN_TESTID.newChatLocation)).innerText()).includes(text));
});
Then("the new chat offers engines {string}", async function(this: OlaiWorld, text: string) {
  await this.waitUntil(async () => (await this.page.locator(`${selector(PLUGIN_TESTID.newChatEngine)} option`).allTextContents()).join("|") === text, "the available engines");
});
Then("new chat shows the no-agent face", async function(this: OlaiWorld) {
  await this.page.locator(selector(PLUGIN_TESTID.newChatPage)).locator(selector(PLUGIN_TESTID.chatNoAgent)).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
When("I open the new chat location picker", async function(this: OlaiWorld) {
  await this.page.locator(selector(PLUGIN_TESTID.newChatLocation)).click();
});
When("I choose new chat {word} node {string}", async function(this: OlaiWorld, mode: string, name: string) {
  const id = this.nodeId(name);
  const title = this.servedNodesSoFar("house.olai").find(node => node.id === id)?.title;
  if (typeof title === "string") await this.page.getByRole("combobox", { name: "Find a chat location" }).fill(title);
  const row = this.page.locator(`${picker} ${attr("data-location", id)}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await row.getByRole("button").nth(mode === "on" ? 1 : 0).click();
});
When("I filter chat locations by {string}", async function(this: OlaiWorld, text: string) {
  await this.page.getByRole("combobox", { name: "Find a chat location" }).fill(text);
  await this.page.locator(`${picker} [data-location]`).first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
Then("the chat location picker has section {string}", async function(this: OlaiWorld, section: string) {
  await this.page.locator(picker).getByRole("heading", { name: section, exact: true }).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
Then("the chat location picker omits section {string}", async function(this: OlaiWorld, section: string) {
  assert.equal(await this.page.locator(picker).getByRole("heading", { name: section, exact: true }).count(), 0);
});
Then("chat on node {string} itself is not offered", async function(this: OlaiWorld, name: string) {
  const id = this.nodeId(name);
  const title = this.servedNodesSoFar("house.olai").find(node => node.id === id)?.title;
  if (typeof title === "string") await this.page.getByRole("combobox", { name: "Find a chat location" }).fill(title);
  const row = this.page.locator(`${picker} ${attr("data-location", id)}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await row.getByRole("button").count(), 1);
});
Then("the new Inbox conversation is unfolded as {string} with engine {string}", async function(this: OlaiWorld, name: string, engine: string) {
  let id: string | undefined;
  await this.waitUntil(async () => {
    id = this.servedNodesSoFar("_olai/Inbox.olai").find(node => node.parent === "chats" && (this.nodeNames.get(name) === undefined || node.id === this.nodeNames.get(name)) && String((node.custom as Record<string, unknown> | undefined)?.["chat-agent-session"] ?? (node.custom as Record<string, unknown> | undefined)?.["agent-session"]).startsWith(`${engine}:`))?.id as string | undefined;
    return id !== undefined;
  }, "the new node's session binding", HYDRATION_TIMEOUT);
  assert.ok(id);
  this.nodeNames.set(name, id);
  this.activeAgent = name;
  await this.page.locator(`${selector(PLUGIN_TESTID.agentPageHead)}${attr("data-agent", id)}`).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
Then("the chat child under {string} in {string} is titled {string}", async function(this: OlaiWorld, parent: string, file: string, title: string) {
  let id: string | undefined;
  await this.waitUntil(async () => {
    id = this.servedNodesSoFar(file).find(node => node.parent === this.nodeId(parent) && node.title === title)?.id as string | undefined;
    return id !== undefined;
  }, "the titled child", HYDRATION_TIMEOUT);
  assert.ok(id);
  this.nodeNames.set("new-chat", id); this.activeAgent = "new-chat";
  await this.page.locator(`${selector(PLUGIN_TESTID.agentPageFoot)}${attr("data-agent", id)}`).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
Then("new chat says {string}", async function(this: OlaiWorld, message: string) {
  await this.page.getByRole("alert").filter({ hasText: message }).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
Then("new chat in Chats is starting", async function(this: OlaiWorld) {
  await this.page.locator(selector(PLUGIN_TESTID.newChatSend)).filter({ hasText: "Starting…" }).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
Then("the Inbox contains no chat children", function(this: OlaiWorld) {
  assert.equal(this.servedNodesSoFar("_olai/Inbox.olai").filter(node => node.parent === "chats").length, 0);
});
Then("the refused new chat leaves a plain Inbox node as {string}", async function(this: OlaiWorld, name: string) {
  await this.page.locator(selector(PLUGIN_TESTID.agentPlainComposer)).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const rows = this.servedNodes("_olai/Inbox.olai").filter(node => node.parent === "chats");
  assert.equal(rows.length, 1);
  assert.equal((rows[0]!.custom as Record<string, unknown> | undefined)?.["chat-agent-session"], undefined);
  this.nodeNames.set(name, rows[0]!.id as string); this.activeAgent = name;
});
Then("the plain retry draft is {string}", async function(this: OlaiWorld, text: string) {
  assert.equal(await this.page.locator(selector(PLUGIN_TESTID.agentPlainInput)).inputValue(), text);
});
When("I retry the plain chat draft", async function(this: OlaiWorld) {
  await this.page.locator(selector(PLUGIN_TESTID.agentPlainSend)).click();
});
Then("the new chat receives the ordinary node contract", async function(this: OlaiWorld) {
  const text = await this.chatRoot().innerText();
  assert.ok(text.includes("This conversation is the node agent for"));
  assert.ok(!text.includes("This conversation has been ASSIGNED to the node agent"));
});
Then("node {string} keeps title {string} and has no new chat child", function(this: OlaiWorld, id: string, title: string) {
  const nodes = this.servedNodes("house.olai");
  assert.equal(nodes.find(node => node.id === this.nodeId(id))?.title, title);
  assert.equal(nodes.filter(node => node.parent === this.nodeId(id) && String((node.custom as Record<string, unknown> | undefined)?.["chat-agent-session"] ?? "").includes(":" )).length, 0);
});

Then("the plain retry engine is {string}", async function(this: OlaiWorld, engine: string) {
  assert.equal(await this.page.locator(selector(PLUGIN_TESTID.agentPlainEngine)).inputValue(), engine);
});

Then("the new chat page has no refusal", async function(this: OlaiWorld) {
  await this.page.locator(selector(PLUGIN_TESTID.newChatPage)).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await this.page.locator(selector(PLUGIN_TESTID.newChatPage)).getByRole("alert").count(), 0);
});

Then("new chat is ready to send", async function(this: OlaiWorld) {
  await this.page.locator(selector(PLUGIN_TESTID.newChatSend)).filter({ hasText: /^Send$/ }).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
Then("the selected new chat engine is {string}", async function(this: OlaiWorld, engine: string) {
  await this.waitUntil(async () => await this.page.locator(selector(PLUGIN_TESTID.newChatEngine)).inputValue() === engine, "live engine fallback");
});
Then("the chat location selection is accessible", async function(this: OlaiWorld) {
  const box = this.page.getByRole("combobox", { name: "Find a chat location" });
  const selected = await box.getAttribute("aria-activedescendant");
  assert.ok(selected);
  const row = this.page.locator(attr("id", selected));
  assert.equal(await row.getAttribute("role"), "option");
  assert.equal(await row.getAttribute("aria-selected"), "true");
  assert.ok(await row.isVisible());
});
Then("the chat location picker is closed", async function(this: OlaiWorld) {
  await this.page.locator(picker).waitFor({ state: "hidden", timeout: POLL_TIMEOUT });
});
Then("the new chat location picker excludes the default container", async function(this: OlaiWorld) {
  assert.equal(await this.page.locator(`${picker} ${attr("data-location", "chats")}`).count(), 0);
});

When("I press outside the chat location picker", async function(this: OlaiWorld) {
  await this.page.locator(input).click();
});
