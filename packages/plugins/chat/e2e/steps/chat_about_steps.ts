/**
 * A CHAT ABOUT A NOTE — the surface a conversation that belongs to a `.md`
 * file is read and started through.
 *
 * Four faces, one reading ("the chat of this note"), and they are all here
 * because they are one surface: the SEAT at the foot of the note's page, the
 * DOOR that starts a chat about it (the box in the seat, the **This page**
 * block over the side panel's picker, the palette's row), the NAME a note's
 * chat is listed under wherever it is listed, and what the FILE holds once a
 * door was used — the tie lives in the note's own front matter and nowhere
 * else. A step that drives the conversation itself is the panel's
 * (`./chat_steps.ts`): once a note's chat is named here, `this.activeAgent` is
 * set, so the fold, the page and the dock are addressed by the ordinary chat
 * vocabulary. The seat is NOT one of the harness's conversation hosts — a
 * note's chat is drawn in the seat AND in the dock at the same time on a
 * desktop, and a locator matching both would be a strict-mode failure in
 * every step that types — so the seat's own assertions live here.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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
  CHAT_FILE_MARK,
  CHAT_NAME,
  CHAT_SEAT,
  CHAT_SEAT_LINE,
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
const MARK = selector(TESTID.agentStanding);
/** The palette row's second line — navigation's id, through the harness's
 *  combined table, because a plugin may not import the registry. */
const PALETTE_PLACE = selector(PLUGIN_TESTID.paletteItemPlace);

/** THE KEY A NOTE'S CHAT IS LISTED UNDER — `/` and the note's root-relative
 *  path (`@olai/format`'s `itemKey`). Spelled rather than imported for the
 *  reason `ABOUT_ROW` is: it is one character of grammar, and the step process
 *  has no bundle in it. */
const keyOf = (note: string): string => `/${note}`;

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

// ── the note, as the disk holds it ─────────────────────────────────────

const noteText = (world: OlaiWorld, note: string): string => {
  try {
    return fs.readFileSync(path.join(world.scratch(), note), "utf8");
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw cause;
  }
};

/**
 * THE NOTE'S FRONT MATTER, as these steps read it back — the top-level keys of
 * a leading `---` block and nothing else.
 *
 * A reader of its own rather than the format's, deliberately: what these
 * scenarios claim is that a PERSON opening the file sees the tie on it, so the
 * claim has to be made against the bytes rather than against the same parser
 * that wrote them. It is as small as that claim: plain `key: value` lines,
 * which is what the writer promises to leave (`@olai/format`'s `matterWith`).
 */
const matterOf = (world: OlaiWorld, note: string): Record<string, string> => {
  const text = noteText(world, note);
  if (!text.startsWith("---\n")) return {};
  const end = text.indexOf("\n---", 3);
  if (end === -1) return {};
  const entries: Record<string, string> = {};
  for (const line of text.slice(4, end + 1).split("\n")) {
    const at = line.indexOf(":");
    if (at <= 0) continue;
    entries[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^"(.*)"$/, "$1");
  }
  return entries;
};

/** A file in the served directory, written as a person (or a `git pull`)
 *  would leave it. The store notices on its own. */
Given("the vault holds {string} saying {string}", function (this: OlaiWorld, file: string, body: string) {
  this.writeServed(file, body.replace(/\\n/g, "\n"));
});

/**
 * ANOTHER WRITER TIES A CHAT TO A NOTE — a second tab, a `git pull`, the same
 * door pressed on another machine. The front matter carries the binding with a
 * session on it, which is a chat a person could go on reading: that is what
 * closes this page's doors, where a note whose start was refused (an engine
 * and no session) is still its own door.
 */
Given("another writer ties a chat to the note {string} as {string}", function (this: OlaiWorld, note: string, name: string) {
  const held = noteText(this, note);
  this.writeServed(note, `---\nchat-agent-session: claude:fake-session-1\n---\n${held}`);
  this.nodeNames.set(name, keyOf(note));
});

/** Renaming on disk, which is what a chat tied to the FILE has to survive. */
When("the file {string} is renamed to {string}", function (this: OlaiWorld, from: string, to: string) {
  const target = path.join(this.scratch(), to);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(path.join(this.scratch(), from), target);
});

// ── the seat ───────────────────────────────────────────────────────────

/** WHICH NOTE the page in front says it is, as data. Only a note has a seat,
 *  so this is also the claim that this page is one. */
Then("the page seat is about the note {string}", async function (this: OlaiWorld, note: string) {
  await this.frontLane().locator(`${CHAT_SEAT}${attr("data-note", note)}`)
    .first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the page has no chat seat", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => await this.frontLane().locator(CHAT_SEAT).count() === 0,
    "the page to draw no seat",
  );
});

/** The seat with nothing in it yet: its header says there is no chat, and the
 *  box is addressed to this note by name. */
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
 *  chat is kept. Read off the seat so a note that moved to the wrong face
 *  fails. */
Then("the seat says {string}", async function (this: OlaiWorld, words: string) {
  const here = seat(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await here.innerText()).includes(words), `the seat to say ${JSON.stringify(words)}`);
});

/** ...and the words it NEVER says: the Inbox is not where a chat goes any more,
 *  and a sentence that said so would be the one lie this surface can tell. */
Then("the seat never says {string}", async function (this: OlaiWorld, words: string) {
  const here = seat(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.ok(!(await here.innerText()).includes(words), `the seat said ${JSON.stringify(words)}`);
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

/** No door here: the note has a chat already, or chat is not running. */
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
  const line = seat(this).locator(`${CHAT_SEAT_LINE}${attr("data-chat", this.nodeId(name))}${attr("data-folded", "true")}`);
  await line.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await seat(this).locator(CHAT_PANEL).count(), 0, "the seat read a conversation while folded");
});

Then("the seat is not folded", async function (this: OlaiWorld) {
  await seat(this).locator(`${CHAT_SEAT_LINE}${attr("data-folded", "false")}`)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

/** ...and the press that opens it, which is the standing itself. */
When("I open the seat's chat", async function (this: OlaiWorld) {
  const line = seat(this).locator(`${CHAT_SEAT_LINE}${attr("data-folded", "true")}`);
  await line.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(line.locator(MARK).first());
});

/** ...and the same press again, which puts it away. */
When("I fold the seat's chat", async function (this: OlaiWorld) {
  const line = seat(this).locator(`${CHAT_SEAT_LINE}${attr("data-folded", "false")}`);
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
 *  chat's key, whatever page it is drawn under. The head line above it names
 *  the same chat, so it is passed over. */
Then("the seat holds the conversation {string}", async function (this: OlaiWorld, name: string) {
  const conversation = seat(this).locator(`${attr("data-chat", this.nodeId(name))}:not(${CHAT_SEAT_LINE})`);
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

/** WHICH NOTE THE AGENT WAS TOLD IT BELONGS TO, read where a person reads it:
 *  in the transcript, under their own words. The sentence is the server's
 *  (`../../src/teaching.ts`); what this holds is that the PATH is in it. */
Then("the seat's first message names the note {string}", async function (this: OlaiWorld, note: string) {
  await this.waitUntil(async () => (await seat(this).innerText()).includes(`\`${note}\``),
    `the first message to name the note ${note}`, HYDRATION_TIMEOUT);
});

// ── what the door wrote, which is the note itself ──────────────────────

/** THE TIE ON DISK: the note's own front matter, carrying a started chat.
 *  Named for the scenario and made this scenario's active conversation, so the
 *  ordinary chat steps can address it. */
Then("the note {string} carries a chat as {string}", async function (this: OlaiWorld, note: string, name: string) {
  await this.waitUntil(async () => {
    const session = matterOf(this, note)["chat-agent-session"];
    return typeof session === "string" && session.includes(":");
  }, `a started chat in ${note}'s front matter`, HYDRATION_TIMEOUT);
  this.nodeNames.set(name, keyOf(note));
  this.activeAgent = name;
});

/** ...and the tie a refused start left: an engine and no session at all, which
 *  is the note a retry starts on. Named for the scenario. */
Then("the note {string} waits for a chat as {string}", async function (this: OlaiWorld, note: string, name: string) {
  await this.waitUntil(async () => {
    const session = matterOf(this, note)["chat-agent-session"];
    return typeof session === "string" && !session.includes(":");
  }, `an engine and no session in ${note}'s front matter`, HYDRATION_TIMEOUT);
  this.nodeNames.set(name, keyOf(note));
});

Then("the note {string} has no chat", function (this: OlaiWorld, note: string) {
  const matter = matterOf(this, note);
  assert.equal(matter["chat-agent-session"], undefined, `${note} carries a chat it was never given`);
});

/** ...and the note is the ONLY place it is: nothing is filed anywhere, so an
 *  Inbox either has no chats container at all or has nothing under one. */
Then("no chat is filed under the Inbox", function (this: OlaiWorld) {
  const rows = this.servedNodesSoFar("_olai/Inbox.olai");
  const filed = rows.filter((node) => {
    const custom = (node.custom ?? {}) as Record<string, unknown>;
    return custom["chat-agent-session"] !== undefined;
  });
  assert.deepEqual(filed.map((node) => node.id), [], "the Inbox holds chat rows");
  assert.deepEqual(rows.filter((node) => node.title === "Chats").map((node) => node.id), [],
    "the Inbox holds a Chats container");
});

// ── how big a note's mark is, which is a claim about one row's HEIGHT ──
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

Then("the side panel offers This page the note {string} named {string}", async function (this: OlaiWorld, note: string, name: string) {
  const block = this.page.locator(`${CHAT_THIS_PAGE}${attr("data-note", note)}`);
  await block.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const words = await block.innerText();
  assert.ok(words.includes(name), `**This page** names ${name}, and read ${JSON.stringify(words)}`);
  assert.ok(words.includes(note), `**This page** says where the note is (${note})`);
  assert.ok(words.includes("No chat yet"), "**This page** says there is no chat yet");
  // The kind's own mark, beside the name.
  assert.equal(await block.locator("p svg").count() > 0, true, "**This page** draws no mark for the note");
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

/** THE NAME AND THE MARK, in the sidebar's Chats: a note's chat is its note's
 *  name, wearing the mark that kind of file wears. */
Then("the Chats row {string} reads {string} with a file mark", async function (this: OlaiWorld, name: string, reads: string) {
  await this.showSidebar();
  const row = chatsRow(this, name);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await row.locator(CHAT_NAME).innerText()).trim() === reads,
    `the Chats row to read ${JSON.stringify(reads)}`);
  assert.equal(await row.locator(CHAT_FILE_MARK).count(), 1, "the row wears no file mark");
});

/** A node's chat reads its row's title and wears no file mark, which is the
 *  other half of the same promise. */
Then("the Chats row {string} reads {string} with no file mark", async function (this: OlaiWorld, name: string, reads: string) {
  await this.showSidebar();
  const row = chatsRow(this, name);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () =>
    (await row.locator(CHAT_NAME).innerText()).trim() === reads && await row.locator(CHAT_FILE_MARK).count() === 0,
    `the Chats row to read ${JSON.stringify(reads)} with no file mark`, HYDRATION_TIMEOUT);
});

Then("there is no Chats row for the note {string}", async function (this: OlaiWorld, note: string) {
  await this.showSidebar();
  await this.waitUntil(async () =>
    await this.page.locator(`${ROSTER} ${ROW}${attr("data-agent", keyOf(note))}`).count() === 0,
    `the Chats list to drop the note ${note}`, HYDRATION_TIMEOUT);
});

When("I press the Chats row {string}", async function (this: OlaiWorld, name: string) {
  await this.showSidebar();
  const row = chatsRow(this, name);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  this.activeAgent = name;
  await this.press(row);
});

Then("the Chats row {string} is current", async function (this: OlaiWorld, name: string) {
  await this.showSidebar();
  const row = chatsRow(this, name);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await row.getAttribute("aria-current") === "page",
    `the Chats row for ${name} to be the current page`);
});

Then("the Chats row {string} is not current", async function (this: OlaiWorld, name: string) {
  await this.showSidebar();
  const row = chatsRow(this, name);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await row.getAttribute("aria-current") === null,
    `the Chats row for ${name} to stop being the current page`);
});

/** The docked conversation's title — the note's name and its mark. */
Then("the agent panel title reads {string} with a file mark", async function (this: OlaiWorld, reads: string) {
  const title = this.page.locator(`${CHAT_DOCK} ${DOCK_TITLE}`);
  await title.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await title.innerText()).trim() === reads, `the panel title to read ${JSON.stringify(reads)}`);
  assert.equal(await this.page.locator(`${CHAT_DOCK} ${CHAT_FILE_MARK}`).count(), 1, "the panel title wears no file mark");
});

/** ...and one row of the panel's picker, which is the third list. */
Then("the panel picker row {string} reads {string} with a file mark", async function (this: OlaiWorld, name: string, reads: string) {
  const row = this.page.locator(`${CHAT_DOCK} ${DOCK_PICK}${attr("data-agent", this.nodeId(name))}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await row.locator(CHAT_NAME).innerText()).trim() === reads,
    `the picker row to read ${JSON.stringify(reads)}`);
  assert.equal(await row.locator(CHAT_FILE_MARK).count(), 1, "the picker row wears no file mark");
});

/** ...and the palette's, whose second line says where the note is. */
Then("the Agents palette row {string} reads {string} placed {string}", async function (this: OlaiWorld, name: string, reads: string, place: string) {
  const row = this.page.locator(`${PALETTE_ITEM}${attr("data-id", `agent-${this.nodeId(name)}`)}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const words = await row.innerText();
  assert.ok(words.includes(reads), `the palette row reads ${JSON.stringify(reads)}, and read ${JSON.stringify(words)}`);
  await this.waitUntil(async () => (await row.locator(PALETTE_PLACE).innerText()).trim() === place,
    `the palette row's second line to read ${JSON.stringify(place)}`);
});
