/**
 * NEW CHAT, through the palette's two levels: which node or note, then the
 * message.
 *
 * An item row is named the way a person names it here — a node by its scenario
 * name, a note by its path — and found by the row id chat gives it
 * (`new-chat-at-<item key>`, where a node's key is its id and a note's is `/`
 * and its path). NOTHING IS MINTED: the chat is started on the item that was
 * chosen, so every assertion about what a send left is about THAT node's row
 * or THAT note's front matter. The levels themselves are navigation's, so
 * crumbs, options, the submit and the refusal line are read through its steps
 * (`palette_level_steps.ts`); this file adds what only chat knows: which item
 * each row means, and what a submit left in the vault.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";
import { attr, PALETTE, PALETTE_INPUT, PALETTE_ITEM, POLL_TIMEOUT, HYDRATION_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const fresh = selector(PLUGIN_TESTID.chatNew);
const OPTION = attr("data-testid", "palette-option");
/** A scenario's word for an item, as its KEY: a document is written as its
 *  PATH — a word with a folder in it — and a node by its scenario name. No
 *  suffix is spelled here: which suffix is which kind is the claiming row's
 *  to say (`packages/tests/kinds.test.ts`), and a path says enough. */
const itemKey = (world: OlaiWorld, name: string) => name.includes("/") ? `/${name}` : world.nodeId(name);
const itemId = (world: OlaiWorld, name: string) => `new-chat-at-${itemKey(world, name)}`;
const itemRows = (world: OlaiWorld) => world.page.locator(`${PALETTE_ITEM}${attr("data-id", "new-chat-", "^=")}`);
const itemIds = (world: OlaiWorld) => itemRows(world).evaluateAll(all => all.map(one => one.getAttribute("data-id") ?? ""));
const sessionOf = (node: { custom?: unknown }) => {
  const custom = node.custom as Record<string, unknown> | undefined;
  return custom?.["chat-agent-session"] ?? custom?.["agent-session"];
};

/** EVERY FILE THE SCENARIO IS SERVED, root-relative — a chat belongs to a node
 *  of any outline or to any note's front matter, so "what the vault holds" is
 *  asked of the whole directory. By WALK and not by suffix: which suffix is
 *  which kind is the claiming row's to say (`packages/tests/kinds.test.ts`),
 *  and these readings need no opinion about it — a file is read for what is
 *  IN it. */
const servedFiles = (world: OlaiWorld): string[] => {
  const root = world.scratch();
  const found: string[] = [];
  const walk = (at: string) => {
    for (const entry of fs.readdirSync(path.join(root, at), { withFileTypes: true })) {
      const next = at === "" ? entry.name : `${at}/${entry.name}`;
      if (entry.isDirectory()) { if (!entry.name.startsWith(".")) walk(next); } else found.push(next);
    }
  };
  walk("");
  return found;
};

/** The text of one served file, or `null` for bytes that are not text. */
const textOf = (world: OlaiWorld, file: string): string | null => {
  const text = fs.readFileSync(path.join(world.scratch(), file), "utf8");
  return text.includes("\u0000") ? null : text;
};

/** EVERY ROW OF EVERY SERVED OUTLINE, with the file it came from — an outline
 *  is a file whose every line is a record, which is what reading one means
 *  (`@olai/format`'s own writer), so nothing here has to name a suffix. */
const servedRows = (world: OlaiWorld): ReadonlyArray<{ readonly file: string; readonly node: Record<string, unknown> }> =>
  servedFiles(world).flatMap(file => {
    const text = textOf(world, file);
    const lines = text === null ? [] : text.split("\n").filter(line => line.trim() !== "");
    if (lines.length === 0 || !lines.every(line => line.startsWith("{") && line.endsWith("}"))) return [];
    return world.servedNodesSoFar(file).map(node => ({ file, node }));
  });

/** A note's front matter, read the plain way the vault writes it. */
const matterOf = (world: OlaiWorld, file: string): Record<string, string> => {
  const text = textOf(world, file) ?? "";
  if (!text.startsWith("---\n")) return {};
  const end = text.indexOf("\n---", 3);
  if (end === -1) return {};
  const entries: Record<string, string> = {};
  for (const line of text.slice(4, end + 1).split("\n")) {
    const at = line.indexOf(":");
    if (at > 0) entries[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^"(.*)"$/, "$1");
  }
  return entries;
};

/** The tie an item carries, wherever that item keeps one: a row's property or
 *  a note's front matter. `undefined` for an item with no chat at all. */
const tieOf = (world: OlaiWorld, name: string): string | undefined => {
  const key = itemKey(world, name);
  if (key.startsWith("/")) return matterOf(world, key.slice(1))["chat-agent-session"];
  const row = servedRows(world).find(({ node }) => node.id === key);
  const tie = row === undefined ? undefined : sessionOf(row.node);
  return typeof tie === "string" ? tie : undefined;
};

/** THE TAB'S OPENING QUESTION, ANSWERED — as it mounts, the roster asks each
 *  engine for the conversations it has stored, and that question costs one
 *  short-lived process (`../../src/chat.ts`'s `session list` probe). It is not
 *  a chat and nothing the palette does, so a scenario counting what the
 *  palette started waits for it first; otherwise the count races a boot that
 *  was already on its way. */
When("the stored chats have been listed", async function(this: OlaiWorld) {
  await this.waitUntil(async () => this.serverLog.text.includes("session list complete"), "the opening listing of stored chats to finish");
});

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

// ── the item level ─────────────────────────────────────────────────────

/** The item rows, in order, by scenario name. Waits for the list to settle,
 *  since the server answers after the level opens. */
Then("the new chat items are {string}", async function(this: OlaiWorld, names: string) {
  await this.page.locator(PALETTE).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const wanted = names.trim() === "" ? [] : names.split(",").map(name => itemId(this, name.trim()));
  await this.waitUntil(async () => JSON.stringify(await itemIds(this)) === JSON.stringify(wanted), `the items to be ${wanted.join(",")}`)
    .catch(() => undefined);
  assert.deepEqual(await itemIds(this), wanted, "the new chat items");
});
Then("the new chat items include {string}", async function(this: OlaiWorld, name: string) {
  await this.page.locator(`${PALETTE_ITEM}${attr("data-id", itemId(this, name))}`).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
Then("the new chat items do not include {string}", async function(this: OlaiWorld, name: string) {
  await this.page.locator(PALETTE).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  // A beat for the server's answer, then the absence must hold NOW.
  await this.page.waitForTimeout(700);
  assert.equal(await this.page.locator(`${PALETTE_ITEM}${attr("data-id", itemId(this, name))}`).count(), 0);
});
/** No row draws an item that lives in `file`. */
Then("the new chat items name nothing in {string}", async function(this: OlaiWorld, file: string) {
  await this.page.locator(PALETTE).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.waitForTimeout(700);
  const texts = await itemRows(this).allTextContents();
  assert.ok(texts.every(text => !text.includes(file)), `an item names ${file}: ${texts.join(" | ")}`);
});
/** The row of an item that already has one says so, and its press opens that
 *  conversation rather than asking for a message. */
Then("the new chat item {string} says it has a chat", async function(this: OlaiWorld, name: string) {
  const row = this.page.locator(`${PALETTE_ITEM}${attr("data-id", itemId(this, name))}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await row.innerText()).includes("has a chat"), `the row for ${name} to say it has a chat`);
});
Then("the new chat item {string} does not say it has a chat", async function(this: OlaiWorld, name: string) {
  const row = this.page.locator(`${PALETTE_ITEM}${attr("data-id", itemId(this, name))}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.ok(!(await row.innerText()).includes("has a chat"));
});
Then("the new chat item {string} is named {string}", async function(this: OlaiWorld, name: string, label: string) {
  const row = this.page.locator(`${PALETTE_ITEM}${attr("data-id", itemId(this, name))}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await row.innerText()).includes(label), `the row for ${name} to read ${label}`);
});
When("I choose the new chat item {string}", async function(this: OlaiWorld, name: string) {
  const row = this.page.locator(`${PALETTE_ITEM}${attr("data-id", itemId(this, name))}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(row);
});
/** From the root list: the palette row, then the item level. */
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

// ── what it started ────────────────────────────────────────────────────

/** THE CONVERSATION THE SEND LEFT ON SCREEN — the chat page of the item that
 *  was chosen, with that item's tie naming the engine that was chosen.
 *
 *  The scenario's word for the item is bound to its KEY, so every step after
 *  this one that scopes itself to "the chat in front" finds this item's faces
 *  — a note's key is `/` and its path, which is what the roster, the page and
 *  every `data-agent` carry. */
Then("the new conversation is unfolded as {string} with engine {string}", async function(this: OlaiWorld, name: string, engine: string) {
  const key = itemKey(this, name);
  const head = this.page.locator(`${selector(PLUGIN_TESTID.agentPageHead)}${attr("data-agent", key)}`).first();
  await head.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => String(tieOf(this, name) ?? "").startsWith(`${engine}:`),
    `${name} to carry a ${engine} session`, HYDRATION_TIMEOUT);
  this.nodeNames.set(name, key);
  this.activeAgent = name;
});
/** ...and the vault's own half of it, for a scenario that is about the file. */
Then("the item {string} carries a chat on {string}", async function(this: OlaiWorld, name: string, engine: string) {
  const key = itemKey(this, name);
  await this.waitUntil(async () => String(tieOf(this, name) ?? "").startsWith(`${engine}:`),
    `${name} to carry a ${engine} session`, HYDRATION_TIMEOUT);
  this.nodeNames.set(name, key);
  this.activeAgent = name;
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
/** NOTHING WAS STARTED ANYWHERE — the whole served directory, since a chat
 *  belongs to a node of any outline or to a note's own front matter. */
Then("nothing in the vault has a chat", function(this: OlaiWorld) {
  const tied = servedRows(this).filter(({ node }) => sessionOf(node) !== undefined).map(({ file, node }) => `${file}#${String(node.id)}`);
  const notes = servedFiles(this).filter(file => matterOf(this, file)["chat-agent-session"] !== undefined);
  assert.deepEqual([...tied, ...notes], [], "the vault holds a chat nobody asked for");
});
/** NOTHING WAS MINTED under the item either: a chat is the item's own, so a
 *  send must leave the outline the size it was. */
Then("node {string} has no chat children", function(this: OlaiWorld, name: string) {
  assert.equal(this.servedNodesSoFar("house.olai").filter(node => node.parent === this.nodeId(name) && sessionOf(node) !== undefined).length, 0);
});
Then("the node {string} has no children", function(this: OlaiWorld, name: string) {
  assert.equal(servedRows(this).filter(({ node }) => node.parent === this.nodeId(name)).length, 0);
});
Then("the new chat receives the ordinary node contract", async function(this: OlaiWorld) {
  const text = await this.chatRoot().innerText();
  assert.ok(text.includes("This conversation is the node agent for"));
  assert.ok(!text.includes("This conversation has been ASSIGNED to the node agent"));
});
