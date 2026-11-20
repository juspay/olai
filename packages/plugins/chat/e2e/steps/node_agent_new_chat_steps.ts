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
const itemKey = (world: OlaiWorld, name: string) => name.includes("/") ? `/${name}` : world.nodeId(name);
const itemId = (world: OlaiWorld, name: string) => `new-chat-at-${itemKey(world, name)}`;
const itemRows = (world: OlaiWorld) => world.page.locator(`${PALETTE_ITEM}${attr("data-id", "new-chat-", "^=")}`);
const itemIds = (world: OlaiWorld) => itemRows(world).evaluateAll(all => all.map(one => one.getAttribute("data-id") ?? ""));
const sessionOf = (node: { custom?: unknown }) => {
  const custom = node.custom as Record<string, unknown> | undefined;
  return custom?.["chat-agent-session"] ?? custom?.["agent-session"];
};

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

const textOf = (world: OlaiWorld, file: string): string | null => {
  const text = fs.readFileSync(path.join(world.scratch(), file), "utf8");
  return text.includes("\u0000") ? null : text;
};

const servedRows = (world: OlaiWorld): ReadonlyArray<{ readonly file: string; readonly node: Record<string, unknown> }> =>
  servedFiles(world).flatMap(file => {
    const text = textOf(world, file);
    const lines = text === null ? [] : text.split("\n").filter(line => line.trim() !== "");
    if (lines.length === 0 || !lines.every(line => line.startsWith("{") && line.endsWith("}"))) return [];
    return world.servedNodesSoFar(file).map(node => ({ file, node }));
  });

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

const tieOf = (world: OlaiWorld, name: string): string | undefined => {
  const key = itemKey(world, name);
  if (key.startsWith("/")) return matterOf(world, key.slice(1))["chat-agent-session"];
  const row = servedRows(world).find(({ node }) => node.id === key);
  const tie = row === undefined ? undefined : sessionOf(row.node);
  return typeof tie === "string" ? tie : undefined;
};

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

Then("the new chat items are {string}", async function(this: OlaiWorld, names: string) {
  await this.page.locator(PALETTE).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const wanted = names.trim() === "" ? [] : names.split(",").map(name => itemId(this, name.trim()));
  await this.waitUntil(async () => JSON.stringify(await itemIds(this)) === JSON.stringify(wanted), `the items to be ${wanted.join(",")}`)
    .catch(() => undefined);
  assert.deepEqual(await itemIds(this), wanted,
    `the new chat items — the level reads ${JSON.stringify(await this.page.locator(PALETTE).innerText())}`);
});
Then("the new chat items include {string}", async function(this: OlaiWorld, name: string) {
  await this.page.locator(`${PALETTE_ITEM}${attr("data-id", itemId(this, name))}`).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
Then("the new chat items do not include {string}", async function(this: OlaiWorld, name: string) {
  await this.page.locator(PALETTE).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.waitForTimeout(700);
  assert.equal(await this.page.locator(`${PALETTE_ITEM}${attr("data-id", itemId(this, name))}`).count(), 0);
});
Then("the new chat items name nothing in {string}", async function(this: OlaiWorld, file: string) {
  await this.page.locator(PALETTE).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.waitForTimeout(700);
  const texts = await itemRows(this).allTextContents();
  assert.ok(texts.every(text => !text.includes(file)), `an item names ${file}: ${texts.join(" | ")}`);
});
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
When("I open new chat from the palette", async function(this: OlaiWorld) {
  await this.page.locator(PALETTE_INPUT).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await this.page.locator(PALETTE_INPUT).fill("new chat");
  const row = this.page.locator(`${PALETTE_ITEM}${attr("data-id", "new-chat")}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(row);
});

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

Then("the new conversation is unfolded as {string} with engine {string}", async function(this: OlaiWorld, name: string, engine: string) {
  const key = itemKey(this, name);
  const head = this.page.locator(`${selector(PLUGIN_TESTID.agentPageHead)}${attr("data-agent", key)}`).first();
  await head.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => String(tieOf(this, name) ?? "").startsWith(`${engine}:`),
    `${name} to carry a ${engine} session`, HYDRATION_TIMEOUT);
  this.nodeNames.set(name, key);
  this.activeAgent = name;
});
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
Then("nothing in the vault has a chat", function(this: OlaiWorld) {
  const tied = servedRows(this).filter(({ node }) => sessionOf(node) !== undefined).map(({ file, node }) => `${file}#${String(node.id)}`);
  const notes = servedFiles(this).filter(file => matterOf(this, file)["chat-agent-session"] !== undefined);
  assert.deepEqual([...tied, ...notes], [], "the vault holds a chat nobody asked for");
});
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
