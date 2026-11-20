import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { selector } from "@olai/web/testlib";
import {
  attr,
  CHAT_PANEL,
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
  CHAT_BESIDE,
  CHAT_FILE_MARK,
  CHAT_LINE,
  CHAT_LINE_OPEN,
  CHAT_LINE_STANDING,
  CHAT_NAME,
} from "../selectors.ts";

const ABOUT_ROW = "chat-about-page";

const ROW = selector(TESTID.agentRow);
const ROSTER = selector(TESTID.agentRoster);
const PALETTE_PLACE = selector(PLUGIN_TESTID.paletteItemPlace);

const keyOf = (note: string): string => `/${note}`;

const line = (world: OlaiWorld): Locator => world.frontLane().locator(CHAT_LINE).first();

const box = (world: OlaiWorld, where: string): Locator =>
  world.page.locator(`${CHAT_ABOUT}${attr("data-where", where)}`);

const chatsRow = (world: OlaiWorld, name: string): Locator =>
  world.page.locator(`${ROSTER} ${ROW}${attr("data-agent", world.nodeId(name))}`);

const askFrom = async (world: OlaiWorld, where: string, text: string): Promise<void> => {
  const door = box(world, where);
  await door.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await door.locator(ASK_INPUT).fill(text);
  await sendBox(world, where);
};

const sendBox = async (world: OlaiWorld, where: string): Promise<void> => {
  const door = box(world, where);
  if (await door.locator(ASK_SEND).count() > 0) { await door.locator(ASK_SEND).click(); return }
  await door.locator(ASK_INPUT).press("Enter");
};

const noteText = (world: OlaiWorld, note: string): string => {
  try {
    return fs.readFileSync(path.join(world.scratch(), note), "utf8");
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw cause;
  }
};

export const matterOf = (world: OlaiWorld, note: string): Record<string, string> => {
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

Given("the vault holds {string} saying {string}", function (this: OlaiWorld, file: string, body: string) {
  this.writeServed(file, body.replace(/\\n/g, "\n"));
});

const FIXTURES = path.resolve(import.meta.dirname, "..", "..", "..", "..", "tests", "fixtures", "good");

Given("the vault holds the fixture file {string}", function (this: OlaiWorld, file: string) {
  const target = path.join(this.scratch(), file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(FIXTURES, file), target);
});

Given("another writer ties a chat to the note {string} as {string}", function (this: OlaiWorld, note: string, name: string) {
  const held = noteText(this, note);
  this.writeServed(note, `---\nchat-agent-session: claude:fake-session-1\n---\n${held}`);
  this.nodeNames.set(name, keyOf(note));
});

When("the file {string} is renamed to {string}", function (this: OlaiWorld, from: string, to: string) {
  const target = path.join(this.scratch(), to);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(path.join(this.scratch(), from), target);
});

Then("the note line is about the note {string}", async function (this: OlaiWorld, note: string) {
  await this.frontLane().locator(`${CHAT_LINE}${attr("data-note", note)}`)
    .first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the page has no chat line", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => await this.frontLane().locator(CHAT_LINE).count() === 0,
    "the page to draw no line",
  );
});

Then("the line offers to chat about {string}", async function (this: OlaiWorld, name: string) {
  const here = line(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const input = here.locator(ASK_INPUT);
  await input.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.equal(await input.getAttribute("placeholder"), `Ask about ${name}…`);
  assert.equal(await input.getAttribute("aria-label"), `Ask about ${name}`);
});

Then("the line never says {string}", async function (this: OlaiWorld, words: string) {
  const here = line(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.ok(!(await here.innerText()).includes(words), `the line said ${JSON.stringify(words)}`);
});

Then("the line box offers the agents {string}", async function (this: OlaiWorld, agents: string) {
  const wanted = agents.split(",").map((one) => one.trim()).filter(Boolean);
  const picker = line(this).locator(ASK_ENGINE);
  if (wanted.length < 2) {
    await line(this).locator(ASK_INPUT).waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.equal(await picker.count(), 0, "the line offered a picker for one engine");
    return;
  }
  await picker.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const options = await picker.locator("option").evaluateAll((all) => all.map((one) => (one as HTMLOptionElement).value));
  assert.deepEqual(options, wanted);
});

Then("the line offers no chat box", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => await this.frontLane().locator(`${CHAT_ABOUT}${attr("data-where", "line")}`).count() === 0,
    "the line to offer no box",
  );
});

When("I ask about this page {string}", async function (this: OlaiWorld, text: string) {
  await askFrom(this, "line", text);
});

When("I open the Chats row {string} beside", async function (this: OlaiWorld, name: string) {
  await this.showSidebar();
  const row = chatsRow(this, name);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  this.activeAgent = name;
  await this.press(this.page.locator(`${ROSTER} ${CHAT_BESIDE}${attr("data-agent", this.nodeId(name))}`));
});

Then("the chat box in the {word} is refused with {string}", async function (this: OlaiWorld, where: string, sentence: string) {
  const said = box(this, where).locator(ASK_REFUSED);
  await said.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const words = (await said.innerText()).trim();
  assert.ok(words.includes(sentence), `the box's refusal read ${JSON.stringify(words)}`);
});

Then("the chat box in the {word} holds {string}", async function (this: OlaiWorld, where: string, text: string) {
  const input = box(this, where).locator(ASK_INPUT);
  await input.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await input.inputValue(), text);
});

When("I send the {word} box again", async function (this: OlaiWorld, where: string) {
  await sendBox(this, where);
});

Then("the line stands on the chat {string}", async function (this: OlaiWorld, name: string) {
  const here = line(this);
  await here.locator(`${CHAT_LINE_STANDING}${attr("data-agent", this.nodeId(name))}`)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await here.locator(CHAT_PANEL).count(), 0, "the line drew a conversation");
});

Then("the line stands {string}", async function (this: OlaiWorld, standing: string) {
  const mark = line(this).locator(CHAT_LINE_STANDING);
  await mark.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await mark.getAttribute("data-standing") === standing,
    `the line to stand ${standing}`, HYDRATION_TIMEOUT);
});

When("I open the chat from the line", async function (this: OlaiWorld) {
  const press = line(this).locator(CHAT_LINE_OPEN);
  await press.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(press);
});

Then("the line says the chat is shown beside", async function (this: OlaiWorld) {
  const button = line(this).locator(CHAT_BESIDE);
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await button.getAttribute("data-beside") === "true"
    && (await button.innerText()).trim() === "Shown beside",
    "the line's verb to read Shown beside", HYDRATION_TIMEOUT);
});

Then("the line offers to open the chat beside", async function (this: OlaiWorld) {
  const button = line(this).locator(CHAT_BESIDE);
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await button.getAttribute("data-beside") === "false"
    && (await button.innerText()).trim() === "Open beside ›",
    "the line's verb to offer the chat beside", HYDRATION_TIMEOUT);
});

When("I open the chat beside from the line", async function (this: OlaiWorld) {
  await this.press(line(this).locator(CHAT_BESIDE));
});

Then("the note {string} carries a chat as {string}", async function (this: OlaiWorld, note: string, name: string) {
  await this.waitUntil(async () => {
    const session = matterOf(this, note)["chat-agent-session"];
    return typeof session === "string" && session.includes(":");
  }, `a started chat in ${note}'s front matter`, HYDRATION_TIMEOUT);
  this.nodeNames.set(name, keyOf(note));
  this.activeAgent = name;
});

Then("the note {string} waits for a chat as {string}", async function (this: OlaiWorld, note: string, name: string) {
  await this.waitUntil(async () => {
    const session = matterOf(this, note)["chat-agent-session"];
    return typeof session === "string" && !session.includes(":");
  }, `an engine and no session in ${note}'s front matter`, HYDRATION_TIMEOUT);
  this.nodeNames.set(name, keyOf(note));
  this.activeAgent = name;
});

Then("the note {string} has no chat", function (this: OlaiWorld, note: string) {
  const matter = matterOf(this, note);
  assert.equal(matter["chat-agent-session"], undefined, `${note} carries a chat it was never given`);
});

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



Then("the palette offers a chat about this page", async function (this: OlaiWorld) {
  await this.page.locator(`${PALETTE_ITEM}${attr("data-id", ABOUT_ROW)}`)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the palette offers no chat about this page", async function (this: OlaiWorld) {
  await this.page.locator(PALETTE_ITEM).first().waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await this.page.locator(`${PALETTE_ITEM}${attr("data-id", ABOUT_ROW)}`).count() === 0,
    "the palette to offer no chat about this page");
});

When("I open chat about this page from the palette", async function (this: OlaiWorld) {
  const row = this.page.locator(`${PALETTE_ITEM}${attr("data-id", ABOUT_ROW)}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(row);
});

Then("the Chats row {string} reads {string} with a file mark", async function (this: OlaiWorld, name: string, reads: string) {
  await this.showSidebar();
  const row = chatsRow(this, name);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await row.locator(CHAT_NAME).innerText()).trim() === reads,
    `the Chats row to read ${JSON.stringify(reads)}`);
  assert.equal(await row.locator(CHAT_FILE_MARK).count(), 1, "the row wears no file mark");
});

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


Then("the Agents palette row {string} reads {string} placed {string}", async function (this: OlaiWorld, name: string, reads: string, place: string) {
  const row = this.page.locator(`${PALETTE_ITEM}${attr("data-id", `agent-${this.nodeId(name)}`)}`);
  await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const words = await row.innerText();
  assert.ok(words.includes(reads), `the palette row reads ${JSON.stringify(reads)}, and read ${JSON.stringify(words)}`);
  await this.waitUntil(async () => (await row.locator(PALETTE_PLACE).innerText()).trim() === place,
    `the palette row's second line to read ${JSON.stringify(place)}`);
});
