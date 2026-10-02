/**
 * NEW CHAT, through the palette's two levels: where, then the message.
 *
 * A place row is named the way a person names it here — `default`, or a node
 * by its scenario name — and found by the row id chat gives it
 * (`new-chat-default`, `new-chat-at-<node id>`). The levels themselves are
 * navigation's, so crumbs, options, the submit and the refusal line are read
 * through its steps (`palette_level_steps.ts`); this file adds what only chat
 * knows: which node each row means, and what a submit left in the vault.
 */
import assert from "node:assert/strict";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";
import { attr, PALETTE, PALETTE_INPUT, PALETTE_ITEM, POLL_TIMEOUT, HYDRATION_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const fresh = selector(PLUGIN_TESTID.chatNew);
const OPTION = attr("data-testid", "palette-option");
const placeId = (world: OlaiWorld, name: string) => name === "default" ? "new-chat-default" : `new-chat-at-${world.nodeId(name)}`;
const placeRows = (world: OlaiWorld) => world.page.locator(`${PALETTE_ITEM}${attr("data-id", "new-chat-", "^=")}`);
const placeIds = (world: OlaiWorld) => placeRows(world).evaluateAll(all => all.map(one => one.getAttribute("data-id") ?? ""));
const sessionOf = (node: { custom?: unknown }) => {
  const custom = node.custom as Record<string, unknown> | undefined;
  return custom?.["chat-agent-session"] ?? custom?.["agent-session"];
};

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
When("I choose agent menu engine {string}", async function(this: OlaiWorld, engine: string) {
  await this.page.locator(selector(PLUGIN_TESTID.agentEngineMenu)).getByRole("menuitem", { name: engine, exact: true }).click();
});

// ── the where level ────────────────────────────────────────────────────

/** The place rows, in order, by scenario name (`default` or a node). Waits
 *  for the list to settle, since the server answers after the level opens. */
Then("the new chat places are {string}", async function(this: OlaiWorld, names: string) {
  await this.page.locator(PALETTE).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const wanted = names.trim() === "" ? [] : names.split(",").map(name => placeId(this, name.trim()));
  await this.waitUntil(async () => JSON.stringify(await placeIds(this)) === JSON.stringify(wanted), `the places to be ${wanted.join(",")}`)
    .catch(() => undefined);
  assert.deepEqual(await placeIds(this), wanted, "the new chat places");
});
Then("the new chat places include {string}", async function(this: OlaiWorld, name: string) {
  await this.page.locator(`${PALETTE_ITEM}${attr("data-id", placeId(this, name))}`).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
Then("the new chat places do not include {string}", async function(this: OlaiWorld, name: string) {
  await this.page.locator(PALETTE).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  // A beat for the server's answer, then the absence must hold NOW.
  await this.page.waitForTimeout(700);
  assert.equal(await this.page.locator(`${PALETTE_ITEM}${attr("data-id", placeId(this, name))}`).count(), 0);
});
/** No row draws a node that lives in `file`. */
Then("the new chat places name nothing in {string}", async function(this: OlaiWorld, file: string) {
  await this.page.locator(PALETTE).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.waitForTimeout(700);
  const texts = await placeRows(this).allTextContents();
  assert.ok(texts.every(text => !text.includes(file)), `a place names ${file}: ${texts.join(" | ")}`);
});
When("I choose the new chat place {string}", async function(this: OlaiWorld, name: string) {
  const row = this.page.locator(`${PALETTE_ITEM}${attr("data-id", placeId(this, name))}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(row);
});
/** From the root list: the palette row, then the where level. */
When("I open new chat from the palette", async function(this: OlaiWorld) {
  await this.page.locator(PALETTE_INPUT).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.locator(PALETTE_INPUT).fill("new chat");
  const row = this.page.locator(`${PALETTE_ITEM}${attr("data-id", "new-chat")}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(row);
});

/** Another writer (a `git pull`, a second tab) drops the node and what is
 *  under it while the palette is still up; waits until the page has seen it. */
When("another writer removes the node {string} from {string}", async function(this: OlaiWorld, name: string, file: string) {
  const id = this.nodeId(name);
  const nodes = this.servedNodes(file);
  const gone = new Set([id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const node of nodes) if (typeof node.parent === "string" && gone.has(node.parent) && !gone.has(node.id as string)) { gone.add(node.id as string); grew = true; }
  }
  this.writeServed(file, nodes.filter(node => !gone.has(node.id as string)).map(node => JSON.stringify(node)).join("\n"));
  await this.node(name).first().waitFor({ state: "detached", timeout: HYDRATION_TIMEOUT });
});

// ── the message level ──────────────────────────────────────────────────

When("I choose new chat engine {string}", async function(this: OlaiWorld, engine: string) {
  const option = this.page.locator(OPTION).filter({ hasText: engine });
  await option.first().waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.press(option.first());
});
When("I type new chat draft {string}", async function(this: OlaiWorld, text: string) {
  await this.page.locator(PALETTE_INPUT).fill(text);
});
When("I send the new chat draft", async function(this: OlaiWorld) {
  await this.page.locator(PALETTE_INPUT).press("Enter");
});
Then("the new chat draft is {string}", async function(this: OlaiWorld, text: string) {
  await this.waitUntil(async () => await this.page.locator(PALETTE_INPUT).inputValue() === text, "the words kept in the box");
});

// ── what it made ───────────────────────────────────────────────────────

Then("the new Inbox conversation is unfolded as {string} with engine {string}", async function(this: OlaiWorld, name: string, engine: string) {
  let id: string | undefined;
  await this.waitUntil(async () => {
    id = this.servedNodesSoFar("_olai/Inbox.olai").find(node => node.parent === "chats"
      && (this.nodeNames.get(name) === undefined || node.id === this.nodeNames.get(name))
      && String(sessionOf(node)).startsWith(`${engine}:`))?.id as string | undefined;
    return id !== undefined;
  }, "the new node's session binding", HYDRATION_TIMEOUT);
  assert.ok(id);
  this.nodeNames.set(name, id);
  this.activeAgent = name;
  await this.page.locator(`${selector(PLUGIN_TESTID.agentPageHead)}${attr("data-agent", id)}`).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
/** ...and landed on its page. */
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
/** ...without landing anywhere: the node exists, named for the scenario. */
Then("the Inbox holds a chat titled {string} as {string}", async function(this: OlaiWorld, title: string, name: string) {
  let id: string | undefined;
  await this.waitUntil(async () => {
    id = this.servedNodesSoFar("_olai/Inbox.olai").find(node => node.parent === "chats" && node.title === title)?.id as string | undefined;
    return id !== undefined;
  }, "the titled Inbox chat", HYDRATION_TIMEOUT);
  assert.ok(id);
  this.nodeNames.set(name, id); this.activeAgent = name;
});
Then("no page shows node {string}", async function(this: OlaiWorld, name: string) {
  await this.page.waitForTimeout(500);
  assert.equal(await this.page.locator(`${selector(PLUGIN_TESTID.agentPageFoot)}${attr("data-agent", this.nodeId(name))}`).count(), 0);
});
/** In-app, so this tab's memory (an unsent draft) survives the trip: the
 *  palette's node hit lands on the node's own page. */
When("I go to node {string} from the palette", async function(this: OlaiWorld, name: string) {
  const id = this.nodeId(name);
  await this.page.keyboard.press("ControlOrMeta+k");
  const title = [...this.servedNodesSoFar("_olai/Inbox.olai"), ...this.servedNodesSoFar("house.olai")].find(node => node.id === id)?.title;
  assert.ok(typeof title === "string", `a title for ${name}`);
  await this.page.locator(PALETTE_INPUT).fill(title);
  const hit = this.page.locator(`${PALETTE_ITEM}${attr("data-id", `hit-#${id}`)}`);
  await hit.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(hit);
  await this.page.locator(`${selector(PLUGIN_TESTID.agentPageFoot)}${attr("data-agent", id)}`).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
Then("new chat in Chats is starting", async function(this: OlaiWorld) {
  await this.waitUntil(async () => await this.page.locator(fresh).getAttribute("aria-busy") === "true", "creation to stay pending");
});
Then("new chat in Chats is not starting", async function(this: OlaiWorld) {
  await this.waitUntil(async () => await this.page.locator(fresh).getAttribute("aria-busy") !== "true", "creation to settle");
});
Then("new chat says {string}", async function(this: OlaiWorld, message: string) {
  await this.page.locator(selector(PLUGIN_TESTID.agentRoster)).getByText(message, { exact: true }).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});
Then("the Inbox contains no chat children", function(this: OlaiWorld) {
  assert.equal(this.servedNodesSoFar("_olai/Inbox.olai").filter(node => node.parent === "chats").length, 0);
});
Then("node {string} has no chat children", function(this: OlaiWorld, name: string) {
  assert.equal(this.servedNodesSoFar("house.olai").filter(node => node.parent === this.nodeId(name) && sessionOf(node) !== undefined).length, 0);
});
Then("the refused new chat leaves a plain Inbox node as {string}", async function(this: OlaiWorld, name: string) {
  await this.page.locator(selector(PLUGIN_TESTID.agentPlainComposer)).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const rows = this.servedNodes("_olai/Inbox.olai").filter(node => node.parent === "chats");
  assert.equal(rows.length, 1);
  assert.equal(sessionOf(rows[0]!), undefined);
  this.nodeNames.set(name, rows[0]!.id as string); this.activeAgent = name;
});
Then("the plain retry draft is {string}", async function(this: OlaiWorld, text: string) {
  await this.waitUntil(async () => await this.page.locator(selector(PLUGIN_TESTID.agentPlainInput)).inputValue() === text, "the plain draft");
});
Then("the plain retry engine is {string}", async function(this: OlaiWorld, engine: string) {
  assert.equal(await this.page.locator(selector(PLUGIN_TESTID.agentPlainEngine)).inputValue(), engine);
});
When("I retry the plain chat draft", async function(this: OlaiWorld) {
  await this.page.locator(selector(PLUGIN_TESTID.agentPlainSend)).click();
});
Then("the new chat receives the ordinary node contract", async function(this: OlaiWorld) {
  const text = await this.chatRoot().innerText();
  assert.ok(text.includes("This conversation is the node agent for"));
  assert.ok(!text.includes("This conversation has been ASSIGNED to the node agent"));
});
