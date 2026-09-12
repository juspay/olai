import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";
import { PLUGIN_TESTID } from "@olai/bundle/testids";
import { selector } from "@olai/web/testlib";
import { attr, CHAT_INPUT, CHAT_SEND, CHAT_PANEL, CHAT_TRANSCRIPT, PROP, POLL_TIMEOUT, HYDRATION_TIMEOUT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const plain = selector(PLUGIN_TESTID.agentPlainComposer);
const input = selector(PLUGIN_TESTID.agentPlainInput);
const send = selector(PLUGIN_TESTID.agentPlainSend);
const head = selector(PLUGIN_TESTID.agentPageHead);
const foot = selector(PLUGIN_TESTID.agentPageFoot);

When("I follow the agent's open-page link", async function(this: OlaiWorld) {
  await this.chatRoot().getByRole("link", { name: "open the page ›" }).click();
});
Given("I open the plain node composer for {string}", async function(this: OlaiWorld, node: string) {
  await this.openNode(node);
  this.activeAgent = node;
  await this.page.locator(plain).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
Then("the node page conversation is ready for {string}", async function(this: OlaiWorld, node: string) {
  this.activeAgent = node;
  await this.page.locator(`${head}${attr("data-agent", this.nodeId(node))}`).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.chat(CHAT_INPUT).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await this.chat(CHAT_PANEL).getAttribute("data-session-id") !== null, "the page's conversation identity", HYDRATION_TIMEOUT);
});
Then("the agent page puts its line before properties and memory before conversation", async function(this: OlaiWorld) {
  assert.ok(this.activeAgent);
  const line = await this.box(this.page.locator(head), "the agent line");
  const properties = await this.box(this.node(this.activeAgent).locator(PROP).first(), "the property drawer");
  const memory = await this.box(this.node("hinges"), "the memory row");
  const conversation = await this.box(this.page.locator(foot), "the conversation");
  assert.ok(line.y < properties.y && properties.y < memory.y && memory.y < conversation.y);
  assert.equal(await this.page.getByRole("link", { name: "open the page ›" }).count(), 0);
  assert.equal(await this.chat(CHAT_PANEL).count(), 1);
});
Then("the plain node composer says {string} and {string}", async function(this: OlaiWorld, placeholder: string, notice: string) {
  assert.equal(await this.page.locator(input).getAttribute("placeholder"), placeholder);
  assert.ok((await this.page.locator(plain).innerText()).includes(notice));
});
When("I send {string} from the plain node composer", async function(this: OlaiWorld, text: string) {
  await this.page.locator(input).fill(text);
  await this.page.locator(send).click();
});
Then("the plain node composer is starting", async function(this: OlaiWorld) {
  await this.page.locator(send).filter({ hasText: "starting…" }).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.equal(await this.page.locator(send).isDisabled(), true);
});
When("I choose {string} in the plain node composer", async function(this: OlaiWorld, engine: string) {
  await this.page.locator(selector(PLUGIN_TESTID.agentPlainEngine)).selectOption(engine);
});
When("I ask for a tall page answer", async function(this: OlaiWorld) {
  await this.chat(CHAT_INPUT).fill(Array.from({ length: 80 }, (_, i) => `page line ${i}`).join("\n\n"));
  await this.chat(CHAT_SEND).click();
});
Then("the page transcript is unbounded and its composer is on screen", async function(this: OlaiWorld) {
  await this.waitUntil(async () => {
    const box = await this.chat(CHAT_TRANSCRIPT).boundingBox();
    const composer = await this.chat(CHAT_INPUT).boundingBox();
    return box !== null && composer !== null && box.height > 384 && composer.y >= 0 && composer.y + composer.height <= this.viewport().height;
  }, "the page to follow its unbounded answer", HYDRATION_TIMEOUT);
  assert.equal(await this.chat(CHAT_TRANSCRIPT).evaluate(el => getComputedStyle(el).maxHeight), "none");
});
Then("the plain node composer has no available engine", async function(this: OlaiWorld) {
  assert.ok((await this.page.locator(plain).innerText()).includes("No agent engine is available."));
  assert.equal(await this.page.locator(send).count(), 0);
});

Then("the page has fresh start above its fold history", async function(this: OlaiWorld) {
  const fresh = this.chat(selector(PLUGIN_TESTID.chatFreshSession));
  const history = this.chat(selector(PLUGIN_TESTID.chatSessions));
  assert.equal((await fresh.innerText()).trim(), "fresh start");
  assert.ok((await fresh.getAttribute("title"))?.includes("the transcript becomes history"));
  const top = await this.box(fresh, "fresh start");
  const line = await this.box(history, "the fold history");
  const transcript = await this.box(this.chat(CHAT_TRANSCRIPT), "the transcript");
  assert.ok(top.y < line.y && line.y < transcript.y);
  assert.equal(await this.chat(selector(PLUGIN_TESTID.chatSessionList)).count(), 0);
  assert.ok(!(await history.innerText()).includes("sessions ("));
});
