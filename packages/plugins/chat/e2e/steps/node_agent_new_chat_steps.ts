/**
 * NEW CHAT, through the palette's two levels: where, then the message.
 *
 * A place row is named the way a person names it here — a node by its scenario
 * name — and found by the row id chat gives it (`new-chat-at-<node id>`).
 * There is no default place: a chat is minted under a node somebody picked, so
 * every assertion about what a send left is about THAT node's file rather than
 * about a container olai chose. The levels themselves are navigation's, so
 * crumbs, options, the submit and the refusal line are read through its steps
 * (`palette_level_steps.ts`); this file adds what only chat knows: which node
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
const placeId = (world: OlaiWorld, name: string) => `new-chat-at-${world.nodeId(name)}`;
const placeRows = (world: OlaiWorld) => world.page.locator(`${PALETTE_ITEM}${attr("data-id", "new-chat-", "^=")}`);
const placeIds = (world: OlaiWorld) => placeRows(world).evaluateAll(all => all.map(one => one.getAttribute("data-id") ?? ""));
const sessionOf = (node: { custom?: unknown }) => {
  const custom = node.custom as Record<string, unknown> | undefined;
  return custom?.["chat-agent-session"] ?? custom?.["agent-session"];
};

/** EVERY FILE THE SCENARIO IS SERVED, root-relative — a chat can now be
 *  minted under any node of any outline, or written into any note, so "what
 *  the vault holds" is asked of the whole directory rather than of one
 *  well-known file. By WALK and not by suffix: which suffix is which kind is
 *  the claiming row's to say (`packages/tests/kinds.test.ts`), and these
 *  readings need no opinion about it — a file is read for what is IN it. */
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

// ── the where level ────────────────────────────────────────────────────

/** The place rows, in order, by scenario name. Waits for the list to settle,
 *  since the server answers after the level opens. */
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

/** THE CONVERSATION THE SEND LEFT ON SCREEN — the page a new chat took this
 *  tab to, and the row that page is about, carrying a session on the engine
 *  that was chosen. Read off the PAGE rather than off the vault, since the
 *  vault may hold other chats this scenario started earlier. */
Then("the new conversation is unfolded as {string} with engine {string}", async function(this: OlaiWorld, name: string, engine: string) {
  const head = this.page.locator(selector(PLUGIN_TESTID.agentPageHead)).first();
  await head.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const known = this.nodeNames.get(name);
  let id: string | null = null;
  await this.waitUntil(async () => {
    id = await head.getAttribute("data-agent");
    if (id === null || (known !== undefined && id !== known)) return false;
    const row = servedRows(this).find(({ node }) => node.id === id);
    return row !== undefined && String(sessionOf(row.node)).startsWith(`${engine}:`);
  }, "the new conversation's page, with its session binding", HYDRATION_TIMEOUT);
  assert.ok(id);
  this.nodeNames.set(name, id);
  this.activeAgent = name;
});
/** ...under the node a person picked, and landed on its page. */
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
/** ...without landing anywhere: the row exists, once, named for the scenario. */
Then("the vault holds one chat titled {string} as {string}", async function(this: OlaiWorld, title: string, name: string) {
  let rows: ReadonlyArray<{ readonly node: Record<string, unknown> }> = [];
  await this.waitUntil(async () => {
    rows = servedRows(this).filter(({ node }) => node.title === title);
    return rows.length > 0;
  }, "the titled chat row", HYDRATION_TIMEOUT);
  assert.equal(rows.length, 1, `the vault holds ${rows.length} rows titled ${JSON.stringify(title)}`);
  this.nodeNames.set(name, rows[0]!.node.id as string); this.activeAgent = name;
});
Then("no page shows node {string}", async function(this: OlaiWorld, name: string) {
  await this.page.waitForTimeout(500);
  assert.equal(await this.page.locator(`${selector(PLUGIN_TESTID.agentPageFoot)}${attr("data-agent", this.nodeId(name))}`).count(), 0);
});
/** In-app, so this tab's memory (an unsent draft) survives the trip: the
 *  palette reveals the row, whose bullet opens its own page. */
When("I go to node {string} from the palette", async function(this: OlaiWorld, name: string) {
  const id = this.nodeId(name);
  await this.page.keyboard.press("ControlOrMeta+k");
  const title = servedRows(this).find(({ node }) => node.id === id)?.node.title;
  assert.ok(typeof title === "string", `a title for ${name}`);
  await this.page.locator(PALETTE_INPUT).fill(title);
  const hit = this.page.locator(`${PALETTE_ITEM}${attr("data-id", `hit-#${id}`)}`);
  await hit.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(hit);
  await this.page.locator(`a${attr("href", `/zoom/#${id}`)}`).first().click();
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
/** NOTHING WAS CREATED ANYWHERE — the whole served directory, since a chat
 *  belongs to a node of any outline or to a note's own front matter, and
 *  nothing is filed in a container of olai's choosing. */
Then("nothing in the vault has a chat", function(this: OlaiWorld) {
  const tied = servedRows(this).filter(({ node }) => sessionOf(node) !== undefined).map(({ file, node }) => `${file}#${String(node.id)}`);
  const notes = servedFiles(this).filter(file => matterOf(this, file)["chat-agent-session"] !== undefined);
  assert.deepEqual([...tied, ...notes], [], "the vault holds a chat nobody asked for");
});
Then("node {string} has no chat children", function(this: OlaiWorld, name: string) {
  assert.equal(this.servedNodesSoFar("house.olai").filter(node => node.parent === this.nodeId(name) && sessionOf(node) !== undefined).length, 0);
});
/** THE ROW A REFUSED START LEFT BEHIND: the one child of the chosen parent,
 *  with no tie on it at all — the engine said no, so nothing was seated, and
 *  the row is the plain node a retry is pressed on. */
Then("the refused new chat leaves a plain node under {string} as {string}", async function(this: OlaiWorld, parent: string, name: string) {
  await this.page.locator(selector(PLUGIN_TESTID.agentPlainComposer)).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const rows = servedRows(this).filter(({ node }) => node.parent === this.nodeId(parent));
  assert.equal(rows.length, 1);
  assert.equal(sessionOf(rows[0]!.node), undefined);
  this.nodeNames.set(name, rows[0]!.node.id as string); this.activeAgent = name;
});
// SCOPED TO THE ROW PAGE'S BOX: its fields are the same component's as a
// page's *Ask about …* door (`agents/AskBox.tsx`), so an id of its own is not
// one — a seat drawn beside it would make every one of these two elements.
const plainBox = `${selector(PLUGIN_TESTID.agentPlainComposer)} `;
Then("the plain retry draft is {string}", async function(this: OlaiWorld, text: string) {
  await this.waitUntil(async () => await this.page.locator(`${plainBox}${selector(PLUGIN_TESTID.agentPlainInput)}`).inputValue() === text, "the plain draft");
});
Then("the plain retry engine is {string}", async function(this: OlaiWorld, engine: string) {
  assert.equal(await this.page.locator(`${plainBox}${selector(PLUGIN_TESTID.agentPlainEngine)}`).inputValue(), engine);
});
When("I retry the plain chat draft", async function(this: OlaiWorld) {
  await this.page.locator(`${plainBox}${selector(PLUGIN_TESTID.agentPlainSend)}`).click();
});
Then("the new chat receives the ordinary node contract", async function(this: OlaiWorld) {
  const text = await this.chatRoot().innerText();
  assert.ok(text.includes("This conversation is the node agent for"));
  assert.ok(!text.includes("This conversation has been ASSIGNED to the node agent"));
});
