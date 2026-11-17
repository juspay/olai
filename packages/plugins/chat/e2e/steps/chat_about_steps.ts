/**
 * A CHAT ABOUT A PLACE — the surface a conversation that stands for somewhere
 * else is read and started through.
 *
 * Four faces, one reading ("the chat at this address"), and they are all here
 * because they are one surface: the SEAT at the foot of a page, the DOOR that
 * starts a chat about that page (the box in the seat, the **This page** block
 * over the side panel's picker, the palette's row), the NAME a stand-in is
 * listed under wherever it is listed, and what the disk holds once a door was
 * used. A step that drives the conversation itself is the panel's
 * (`./chat_steps.ts`): once a chat row is named here, `this.activeAgent` is
 * set, so the fold, the page and the dock are addressed by the ordinary chat
 * vocabulary. The seat is NOT one of the harness's conversation hosts — a
 * chat about this page is drawn in the seat AND in the dock at the same time
 * on a desktop, and a locator matching both would be a strict-mode failure in
 * every step that types — so the seat's own three assertions live here.
 */
import assert from "node:assert/strict";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { selector } from "@olai/web/testlib";
import {
  attr,
  CHAT_DOCK,
  CHAT_INPUT,
  CHAT_PANEL,
  CHAT_SAID,
  HYDRATION_TIMEOUT,
  PALETTE_ITEM,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts";
import type { Locator } from "@olai/tests/harness/playwright.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { TESTID } from "../../src/testids.ts";
import {
  ASK_ENGINE,
  ASK_INPUT,
  ASK_REFUSED,
  ASK_SEND,
  CHAT_ABOUT,
  CHAT_NAME,
  CHAT_PLACE_MARK,
  CHAT_SEAT,
  CHAT_SEAT_FOLDED,
  CHAT_SEND,
  CHAT_SIGN_IN,
  CHAT_SIGN_IN_INPUT,
  CHAT_SIGN_IN_METHOD,
  CHAT_THIS_PAGE,
} from "../selectors.ts";

/** The palette's row for the door, by the id the adapter gives it
 *  (`../../src/browser/agents/AgentPalette.ts`'s `ABOUT_ROW`). Spelled rather
 *  than imported: that module is a component's, and a step file that imported
 *  it would pull SolidJS — and, one hop on, the client's wire — into a
 *  cucumber process with no browser in it. */
const ABOUT_ROW = "chat-about-page";

const ROW = selector(TESTID.agentRow);
const ROSTER = selector(TESTID.agentRoster);
const DOCK_TITLE = selector(TESTID.chatDockTitle);
const DOCK_PICK = selector(TESTID.chatDockPick);
const FOLD = selector(TESTID.agentFold);
const MARK = selector(TESTID.agentStanding);
/** The palette row's second line — navigation's id, through the harness's
 *  combined table, because a plugin may not import the registry. */
const PALETTE_PLACE = selector(PLUGIN_TESTID.paletteItemPlace);

/** The seat the page in front placed, wherever it is on the page. */
const seat = (world: OlaiWorld): Locator => world.frontLane().locator(CHAT_SEAT).first();

/** The box that starts a chat, in the seat or in the side panel. */
const box = (world: OlaiWorld, where: string): Locator =>
  world.page.locator(`${CHAT_ABOUT}${attr("data-where", where)}`);

const chatsRow = (world: OlaiWorld, name: string): Locator =>
  world.page.locator(`${ROSTER} ${ROW}${attr("data-agent", world.nodeId(name))}`);

/** Type into one of the door's two boxes and press Send. The box keeps its own
 *  draft, so the words are read back off it rather than off a shared composer. */
const askFrom = async (world: OlaiWorld, where: string, text: string): Promise<void> => {
  const door = box(world, where);
  await door.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await door.locator(ASK_INPUT).fill(text);
  await door.locator(ASK_SEND).click();
};

// ── the files a scenario is about ──────────────────────────────────────

/** A file in the served directory, written as a person (or a `git pull`)
 *  would leave it. The store notices on its own. */
Given("the vault holds {string} saying {string}", function (this: OlaiWorld, file: string, body: string) {
  this.writeServed(file, body.replace(/\\n/g, "\n"));
});

/** Taking one away again — which is what turns a chat about it back into an
 *  ordinary chat row — is `the file "…" is deleted`, the vault surface's own
 *  step (`olai-plugin-vault-plugins`' `dynamic_plugin_steps.ts`). */

/**
 * ANOTHER WRITER FILES A CHAT AT AN ADDRESS — a second tab, a `git pull`, the
 * same door pressed on another machine. The row carries the binding property
 * with a session on it, which is a chat a person could go on reading: that is
 * what closes this page's doors, where a row whose start was refused (no
 * session) is still the place's door.
 */
Given("another writer files a chat about {string} in {string} as {string}", function (this: OlaiWorld, address: string, file: string, name: string) {
  const id = `hand-${name}`;
  this.appendServed(file, { id, ord: "z0", title: address, custom: { "chat-agent-session": "claude:fake-session-1" } });
  this.nodeNames.set(name, id);
});

// ── the seat ───────────────────────────────────────────────────────────

/** WHICH PLACE the page in front says it is, as data — `file:notes/plan.md`,
 *  `page:/plugins/swatch`. The front page and a row landing are their outline's
 *  FILE, which is the claim this reads. */
Then("the page seat is about {string}", async function (this: OlaiWorld, place: string) {
  await this.frontLane().locator(`${CHAT_SEAT}${attr("data-place", place)}`)
    .first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the page has no chat seat", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => await this.frontLane().locator(CHAT_SEAT).count() === 0,
    "the page to draw no seat",
  );
});

/** The seat with nothing in it yet: its header says there is no chat, and the
 *  box is addressed to this page by name. */
Then("the seat offers to chat about {string}", async function (this: OlaiWorld, name: string) {
  const here = seat(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  // The header is set in capitals by the stylesheet, so `innerText` reads it
  // that way: what is asserted is the words, not the casing a theme chose.
  const words = (await here.innerText()).toLowerCase();
  assert.ok(words.includes("chat about this page"), `the seat's header, which read ${JSON.stringify(words)}`);
  assert.ok(words.includes("no chat yet"), "the seat says there is no chat yet");
  const input = here.locator(ASK_INPUT);
  await input.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.equal(await input.getAttribute("placeholder"), `Ask about ${name}…`);
  assert.equal(await input.getAttribute("aria-label"), `Ask about ${name}`);
});

/** The words under the box, which say what pressing Send does and where the
 *  chat lands. Read off the seat so a note that moved to the wrong face fails. */
Then("the seat says {string}", async function (this: OlaiWorld, words: string) {
  const here = seat(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await here.innerText()).includes(words), `the seat to say ${JSON.stringify(words)}`);
});

/** ... and the words it STOPS saying — "No chat yet" above all, which is how a
 *  scenario waits for a chat that arrived from somewhere else before pressing
 *  something that depends on it being there. */
Then("the seat stops saying {string}", async function (this: OlaiWorld, words: string) {
  const here = seat(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => !(await here.innerText()).includes(words),
    `the seat to stop saying ${JSON.stringify(words)}`, HYDRATION_TIMEOUT);
});

/** The agents the box can start a chat with — the picker beside Send. */
Then("the seat box offers the agents {string}", async function (this: OlaiWorld, agents: string) {
  const picker = seat(this).locator(ASK_ENGINE);
  await picker.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const options = await picker.locator("option").evaluateAll((all) => all.map((one) => (one as HTMLOptionElement).value));
  assert.deepEqual(options, agents.split(",").map((one) => one.trim()).filter(Boolean));
});

/** No door here: the page has a chat already, or chat is not running. */
Then("the seat offers no chat box", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => await this.frontLane().locator(`${CHAT_ABOUT}${attr("data-where", "seat")}`).count() === 0,
    "the seat to offer no box",
  );
});

When("I ask about this page {string}", async function (this: OlaiWorld, text: string) {
  await askFrom(this, "seat", text);
});

When("I ask about this page in the panel {string}", async function (this: OlaiWorld, text: string) {
  await askFrom(this, "panel", text);
});

/** What the door said instead of starting one — a refused start, above all:
 *  the words stay in the box and the sentence is beside them. `data-where`
 *  keeps the two faces' refusals apart. */
Then("the chat box in the {word} is refused with {string}", async function (this: OlaiWorld, where: string, sentence: string) {
  const line = box(this, where).locator(ASK_REFUSED);
  await line.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  // What the AGENT said rides the sentence, so this reads the words rather
  // than the whole line a serve may have wrapped them in.
  const said = (await line.innerText()).trim();
  assert.ok(said.includes(sentence), `the box's refusal read ${JSON.stringify(said)}`);
});

/** ...and the words themselves, still where they were typed. */
Then("the chat box in the {word} holds {string}", async function (this: OlaiWorld, where: string, text: string) {
  const input = box(this, where).locator(ASK_INPUT);
  await input.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await input.inputValue(), text);
});

/** Press Send again without retyping — the retry a refused start asks for. */
When("I send the {word} box again", async function (this: OlaiWorld, where: string) {
  await box(this, where).locator(ASK_SEND).click();
});

// ── the seat folded, which is how a page meets a chat it did not wake ──

/** THE SEAT AS A PAGE FINDS IT: one line, the chat's standing, no
 *  conversation read and so no agent woken. */
Then("the seat is folded on the chat {string}", async function (this: OlaiWorld, name: string) {
  const line = seat(this).locator(`${CHAT_SEAT_FOLDED}${attr("data-chat", this.nodeId(name))}`);
  await line.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await seat(this).locator(CHAT_PANEL).count(), 0, "the seat read a conversation while folded");
});

Then("the seat is not folded", async function (this: OlaiWorld) {
  await this.waitUntil(async () => await seat(this).locator(CHAT_SEAT_FOLDED).count() === 0,
    "the seat's folded line to go", HYDRATION_TIMEOUT);
});

/** ...and the press that opens it, which is the standing itself. */
When("I open the seat's chat", async function (this: OlaiWorld) {
  const line = seat(this).locator(CHAT_SEAT_FOLDED);
  await line.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(line.locator(MARK).first());
});

// ── the conversation IN THE SEAT, which is the only face it has ───────
//
// A chat whose start stopped at sign-in is docked nowhere and has no page of
// its own a reader would go to: the seat is where it is read, so the few
// gestures that scenario needs are spelled against the seat here rather than
// taken from `./chat_steps.ts`, whose locators are the harness's `chat()` —
// the fold, the row page and the dock, by `data-agent`.

Then("the seat offers a sign-in", async function (this: OlaiWorld) {
  await seat(this).locator(CHAT_SIGN_IN).first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

When("I press the seat's sign-in for {string}", async function (this: OlaiWorld, method: string) {
  await this.press(seat(this).locator(`${CHAT_SIGN_IN_METHOD}${attr("data-method", method)}`));
});

When("I type {string} into the seat's sign-in", async function (this: OlaiWorld, code: string) {
  const input = seat(this).locator(CHAT_SIGN_IN_INPUT);
  await input.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await input.fill(code);
  await input.press("Enter");
});

Then("the seat's composer reads {string}", async function (this: OlaiWorld, text: string) {
  const input = seat(this).locator(CHAT_INPUT);
  await input.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  try {
    await this.waitUntil(async () => await input.inputValue() === text,
      `the seat's composer to hold ${JSON.stringify(text)}`, HYDRATION_TIMEOUT);
  } catch {
    assert.fail(`the seat's composer holds ${JSON.stringify(await input.inputValue())} rather than ${JSON.stringify(text)}`);
  }
});

/** Nothing has been answered in the seat's conversation — the half of "the
 *  words waited" that says they were not sent on somebody's behalf. */
Then("the seat agent has said nothing yet", async function (this: OlaiWorld) {
  assert.equal(await seat(this).locator(CHAT_SAID).count(), 0, "the seat's agent answered something nobody sent");
});

When("I type {string} into the seat's composer", async function (this: OlaiWorld, text: string) {
  const input = seat(this).locator(CHAT_INPUT);
  await input.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await input.fill(text);
});

When("I send from the seat's composer", async function (this: OlaiWorld) {
  await seat(this).locator(CHAT_SEND).click();
});

/** THE CONVERSATION IN THE SEAT, settled — the seat's own `data-chat` is the
 *  chat row, whatever page it is drawn under. */
Then("the seat holds the conversation {string}", async function (this: OlaiWorld, name: string) {
  const conversation = seat(this).locator(attr("data-chat", this.nodeId(name)));
  await conversation.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => {
    const status = await conversation.locator(CHAT_PANEL).getAttribute("data-status");
    return status === "idle" || status === "thinking";
  }, "the seat's conversation to settle", HYDRATION_TIMEOUT);
});

/** ...and it answered, ONCE: the message the door sent is delivered by the
 *  server, and a second delivery would draw a second answer. */
Then("the seat agent has answered {string} exactly once", async function (this: OlaiWorld, text: string) {
  const said = seat(this).locator(CHAT_SAID).filter({ hasText: text });
  await said.first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  // A beat, so a second answer still on its way fails this rather than
  // arriving after it.
  await this.page.waitForTimeout(700);
  assert.equal(await said.count(), 1, `the agent answered "${text}" more than once — the message went out twice`);
});

/** The extra line a stand-in's agent is told in its first message, read where
 *  a person reads it: in the transcript, under their own words. */
Then("the seat's first message says it is about {string}", async function (this: OlaiWorld, address: string) {
  const sentence = `This conversation is about \`${address}\`: the person talks to you from that page, so read it before you answer.`;
  await this.waitUntil(async () => (await seat(this).innerText()).includes(sentence),
    `the first message to say it is about ${address}`, HYDRATION_TIMEOUT);
});

/** ...and WHOSE node agent it still is, which is where its memory goes: the
 *  chat row, not the place. */
Then("the seat's first message is the node agent for {string} in {string}", async function (this: OlaiWorld, name: string, file: string) {
  const sentence = `the node \`${this.nodeId(name)}\` in \`${file}\``;
  await this.waitUntil(async () => (await seat(this).innerText()).includes(sentence),
    `the first message to name the node ${name}`, HYDRATION_TIMEOUT);
});

/** The same reading on whichever face this scenario's conversation is drawn on
 *  (a fold, a node page, the dock) — the harness's `chatRoot`. */
Then("the conversation is the node agent for {string} in {string}", async function (this: OlaiWorld, name: string, file: string) {
  const sentence = `the node \`${this.nodeId(name)}\` in \`${file}\``;
  await this.waitUntil(async () => (await this.chatRoot().innerText()).includes(sentence),
    `the first message to name the node ${name}`, HYDRATION_TIMEOUT);
});

Then("the conversation says it is about {string}", async function (this: OlaiWorld, address: string) {
  const sentence = `This conversation is about \`${address}\``;
  await this.waitUntil(async () => (await this.chatRoot().innerText()).includes(sentence),
    `the first message to say it is about ${address}`, HYDRATION_TIMEOUT);
});

/** A plain chat row is told exactly what it was told before — no address line
 *  anywhere in its first message. */
Then("the conversation says it is about nothing", async function (this: OlaiWorld) {
  // The contract rides the first message, which is on screen a beat after the
  // send: wait for it, THEN read what else it says. Reading too early would
  // pass this step for a turn that had said nothing at all yet.
  await this.waitUntil(async () => (await this.chatRoot().innerText()).includes("This conversation is the node agent for"),
    "the first message's contract", HYDRATION_TIMEOUT);
  const words = await this.chatRoot().innerText();
  assert.ok(!words.includes("This conversation is about"),
    `a plain chat row was told it is about a place: ${JSON.stringify(words)}`);
});

// ── what the door filed ────────────────────────────────────────────────

/** THE ROW ON DISK: titled as a link around the address, under Inbox › Chats,
 *  carrying the binding property with a session on it. Named for the scenario
 *  and made this scenario's active conversation, so the ordinary chat steps
 *  can address it. */
Then("a chat titled {string} is filed under Inbox Chats as {string}", async function (this: OlaiWorld, title: string, name: string) {
  // The row and its binding are two writes, so this waits for BOTH: a row
  // titled for the place, and a session on it. Either spelling of the key, the
  // way `./node_agent_new_chat_steps.ts` reads one.
  let row: Record<string, unknown> | undefined;
  await this.waitUntil(async () => {
    row = this.servedNodesSoFar("_olai/Inbox.olai")
      .find((node) => node.parent === "chats" && node.title === title);
    const custom = (row?.custom ?? {}) as Record<string, unknown>;
    const session = custom["chat-agent-session"] ?? custom["agent-session"];
    return typeof session === "string" && session.includes(":");
  }, `a started chat row titled ${JSON.stringify(title)} under Inbox › Chats`, HYDRATION_TIMEOUT);
  const id = row?.id;
  assert.ok(typeof id === "string");
  this.nodeNames.set(name, id);
  this.activeAgent = name;
});

/** ONE ROW PER PLACE, however many times a refused start was retried: the
 *  server starts again on the row the last attempt left rather than minting
 *  another (`../../src/server/new-chat.ts`). */
Then("exactly {int} chat rows under Inbox Chats are titled {string}", async function (this: OlaiWorld, count: number, title: string) {
  const rows = this.servedNodesSoFar("_olai/Inbox.olai").filter((node) => node.parent === "chats" && node.title === title);
  assert.equal(rows.length, count, `the Inbox holds ${rows.length} rows titled ${JSON.stringify(title)}`);
});

/** ...and the row a refused start left: filed, titled for the place, and
 *  carrying no conversation at all. Named for the scenario. */
Then("a chat titled {string} waits under Inbox Chats as {string}", async function (this: OlaiWorld, title: string, name: string) {
  let row: Record<string, unknown> | undefined;
  await this.waitUntil(async () => {
    row = this.servedNodesSoFar("_olai/Inbox.olai").find((node) => node.parent === "chats" && node.title === title);
    return row !== undefined;
  }, `a chat row titled ${JSON.stringify(title)} under Inbox › Chats`, HYDRATION_TIMEOUT);
  const custom = (row?.custom ?? {}) as Record<string, unknown>;
  const session = custom["chat-agent-session"] ?? custom["agent-session"];
  assert.ok(session === undefined, `the row a refused start left carries a session (${JSON.stringify(session)})`);
  const id = row?.id;
  assert.ok(typeof id === "string");
  this.nodeNames.set(name, id);
});

// ── how big a place's mark is, which is a claim about one row's HEIGHT ──
//
// A kind's glyph draws itself into the box its caller gives it, so a mark
// drawn in no box at all takes the whole row — a palette row for a chat about
// a document was six hundred points tall. The claim is the only one that can
// go silently wrong: a row with a mark is the same height as one without.

const heightOf = async (world: OlaiWorld, locator: Locator, what: string): Promise<number> =>
  (await world.box(locator, what)).height;

Then("the Agents palette row {string} is no taller than the row {string}", async function (this: OlaiWorld, marked: string, plain: string) {
  const rowOf = (name: string) => this.page.locator(`${PALETTE_ITEM}${attr("data-id", `agent-${this.nodeId(name)}`)}`);
  const tall = await heightOf(this, rowOf(marked), `the palette row for ${marked}`);
  const flat = await heightOf(this, rowOf(plain), `the palette row for ${plain}`);
  assert.ok(tall <= flat + 1, `the palette row for ${marked} is ${tall}px tall beside ${flat}px for ${plain} — its mark is drawn in no box`);
});

Then("the Chats row {string} is no taller than the row {string}", async function (this: OlaiWorld, marked: string, plain: string) {
  await this.showSidebar();
  const tall = await heightOf(this, chatsRow(this, marked), `the Chats row for ${marked}`);
  const flat = await heightOf(this, chatsRow(this, plain), `the Chats row for ${plain}`);
  assert.ok(tall <= flat + 1, `the Chats row for ${marked} is ${tall}px tall beside ${flat}px for ${plain} — its mark is drawn in no box`);
});

// ── the side panel's **This page** ─────────────────────────────────────

Then("the side panel offers This page {string} named {string} at {string}", async function (this: OlaiWorld, place: string, name: string, path: string) {
  const block = this.page.locator(`${CHAT_THIS_PAGE}${attr("data-place", place)}`);
  await block.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const words = await block.innerText();
  assert.ok(words.includes(name), `**This page** names ${name}, and read ${JSON.stringify(words)}`);
  assert.ok(words.includes(path), `**This page** says where the page is (${path})`);
  assert.ok(words.includes("No chat yet"), "**This page** says there is no chat yet");
  // The kind's own mark, beside the name.
  assert.equal(await block.locator("p svg").count() > 0, true, "**This page** draws no mark for the place");
  await block.locator(`${CHAT_ABOUT}${attr("data-where", "panel")}`).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the side panel offers no This page", async function (this: OlaiWorld) {
  await this.waitUntil(async () => await this.page.locator(CHAT_THIS_PAGE).count() === 0,
    "the side panel to offer no **This page** block");
});

// ── the palette's door ─────────────────────────────────────────────────

Then("the palette offers a chat about this page", async function (this: OlaiWorld) {
  await this.page.locator(`${PALETTE_ITEM}${attr("data-id", ABOUT_ROW)}`)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the palette offers no chat about this page", async function (this: OlaiWorld) {
  // The list is answered as the palette opens; wait for SOMETHING to be in it
  // before reading an absence, or every page passes this.
  await this.page.locator(PALETTE_ITEM).first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await this.page.locator(`${PALETTE_ITEM}${attr("data-id", ABOUT_ROW)}`).count() === 0,
    "the palette to offer no chat about this page");
});

When("I open chat about this page from the palette", async function (this: OlaiWorld) {
  const row = this.page.locator(`${PALETTE_ITEM}${attr("data-id", ABOUT_ROW)}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(row);
});

// ── what every list calls a chat ───────────────────────────────────────

/** THE NAME AND THE MARK, in the sidebar's Chats — never the raw title. */
Then("the Chats row {string} reads {string} with a place mark", async function (this: OlaiWorld, name: string, reads: string) {
  await this.showSidebar();
  const row = chatsRow(this, name);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await row.locator(CHAT_NAME).innerText()).trim() === reads,
    `the Chats row to read ${JSON.stringify(reads)}`);
  assert.equal(await row.locator(CHAT_PLACE_MARK).count(), 1, "the row wears no place mark");
});

/** An ordinary chat row reads its own title and wears no place mark, which is
 *  the other half of the same promise. */
Then("the Chats row {string} reads {string} with no place mark", async function (this: OlaiWorld, name: string, reads: string) {
  await this.showSidebar();
  const row = chatsRow(this, name);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  // BOTH, WAITED FOR TOGETHER: a place that went away reaches this tab as a
  // served-directory frame, and the name a label gives the row is the same
  // before and after it — so reading the mark the instant the name matches
  // would be reading it one frame early.
  await this.waitUntil(async () =>
    (await row.locator(CHAT_NAME).innerText()).trim() === reads && await row.locator(CHAT_PLACE_MARK).count() === 0,
    `the Chats row to read ${JSON.stringify(reads)} with no place mark`, HYDRATION_TIMEOUT);
});

Then("the Chats row {string} never says {string}", async function (this: OlaiWorld, name: string, raw: string) {
  await this.showSidebar();
  const row = chatsRow(this, name);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.ok(!(await row.innerText()).includes(raw), `the Chats row drew the raw title ${JSON.stringify(raw)}`);
  assert.ok(!(await row.getAttribute("aria-label") ?? "").includes(raw), "the row's label drew the raw title");
});

When("I press the Chats row {string}", async function (this: OlaiWorld, name: string) {
  await this.showSidebar();
  const row = chatsRow(this, name);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  this.activeAgent = name;
  await this.press(row);
});

Then("the Chats row {string} is not current", async function (this: OlaiWorld, name: string) {
  await this.showSidebar();
  const row = chatsRow(this, name);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await row.getAttribute("aria-current") === null,
    `the Chats row for ${name} to stop being the current page`);
});

/** The docked conversation's title — the place's name and its mark, not the
 *  row's title. */
Then("the agent panel title reads {string} with a place mark", async function (this: OlaiWorld, reads: string) {
  const title = this.page.locator(`${CHAT_DOCK} ${DOCK_TITLE}`);
  await title.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await title.innerText()).trim() === reads, `the panel title to read ${JSON.stringify(reads)}`);
  assert.equal(await this.page.locator(`${CHAT_DOCK} ${CHAT_PLACE_MARK}`).count(), 1, "the panel title wears no place mark");
});

/** ...and one row of the panel's picker, which is the third list. */
Then("the panel picker row {string} reads {string} with a place mark", async function (this: OlaiWorld, name: string, reads: string) {
  const row = this.page.locator(`${CHAT_DOCK} ${DOCK_PICK}${attr("data-agent", this.nodeId(name))}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await row.locator(CHAT_NAME).innerText()).trim() === reads,
    `the picker row to read ${JSON.stringify(reads)}`);
  assert.equal(await row.locator(CHAT_PLACE_MARK).count(), 1, "the picker row wears no place mark");
  assert.ok(!(await row.innerText()).includes("]("), "the picker row drew the raw title");
});

/** ...and the palette's, whose second line says where the place is. */
Then("the Agents palette row {string} reads {string} placed {string}", async function (this: OlaiWorld, name: string, reads: string, place: string) {
  const row = this.page.locator(`${PALETTE_ITEM}${attr("data-id", `agent-${this.nodeId(name)}`)}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const words = await row.innerText();
  assert.ok(words.includes(reads), `the palette row reads ${JSON.stringify(reads)}, and read ${JSON.stringify(words)}`);
  assert.ok(!words.includes("]("), "the palette row drew the raw title");
  await this.waitUntil(async () => (await row.locator(PALETTE_PLACE).innerText()).trim() === place,
    `the palette row's second line to read ${JSON.stringify(place)}`);
});

// ── a chat row that stands for a ROW, on that row's own outline ────────
//
// The mark beside the row and the fold under it are the chat at that row,
// whichever row the chat itself lives on. Scoped to the ROW rather than to an
// id: that is the whole claim — the mark a person presses is beside `order`,
// and what opens under it is a conversation filed in the Inbox.

When("I unfold the chat on row {string}", async function (this: OlaiWorld, row: string) {
  const mark = this.node(row).locator(MARK).first();
  await mark.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  if (await mark.getAttribute("aria-expanded") !== "true") await this.press(mark);
  await this.frontLane().locator(`${FOLD}${attr("data-agent", this.nodeId(row))}`)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

/** The fold under a row, and WHICH conversation is in it: `data-agent` is the
 *  row it is drawn under and `data-chat` is the chat row, which for a stand-in
 *  are two different nodes. The scenario's conversation is addressed by the
 *  drawn row from here on, which is what the harness's `chat()` reads. */
Then("the fold on row {string} is the conversation {string}", async function (this: OlaiWorld, row: string, name: string) {
  const fold = this.frontLane().locator(
    `${FOLD}${attr("data-agent", this.nodeId(row))}${attr("data-chat", this.nodeId(name))}`,
  );
  await fold.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  this.activeAgent = row;
  await this.waitUntil(async () => {
    const status = await fold.locator(CHAT_PANEL).getAttribute("data-status");
    return status === "idle" || status === "thinking";
  }, "the row's fold to settle", HYDRATION_TIMEOUT);
});
