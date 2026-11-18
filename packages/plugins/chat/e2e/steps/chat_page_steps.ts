/**
 * A CHAT'S OWN PAGE — `/chat/<item>`, what it says about the item it belongs
 * to, and the two verbs on it.
 *
 * The CONVERSATION on this page is addressed by the ordinary chat vocabulary
 * (`./chat_steps.ts`): the page draws the same `agentPageHead`/`agentPageFoot`
 * a node's page does, under the same `data-agent`, so `world.chat(…)` finds it
 * with no special case. What is here is what the PAGE adds — its head, the
 * switch saying where a note's chat opens, and *Open <name> beside*.
 */
import assert from "node:assert/strict";
import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { selector } from "@olai/web/testlib";
import {
  APP_HEADER,
  attr,
  BREADCRUMBS,
  CHAT_PANEL,
  CHAT_SAID,
  HYDRATION_TIMEOUT,
  PANE_TABS,
  POLL_TIMEOUT,
  ZOOM_TITLE,
} from "@olai/tests/harness/world.ts";
import type { Locator } from "@olai/tests/harness/playwright.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

import { TESTID } from "../../src/testids.ts";
import {
  ASK_INPUT,
  ASK_SEND,
  CHAT_ABOUT,
  CHAT_FILE_MARK,
  CHAT_OPEN_BESIDE,
  CHAT_OPENS,
  CHAT_OPENS_SWITCH,
  CHAT_PAGE,
  CHAT_PAGE_GONE,
  CHAT_PAGE_HEAD,
  CHAT_PAGE_STANDING,
  CHAT_PAGE_TITLE,
  CHAT_PAGE_UNTIED,
  CHAT_PAGE_WHERE,
  CHAT_RETIE,
  CHAT_SEND,
  CHAT_TRANSCRIPT,
} from "../selectors.ts";
import { matterOf } from "./chat_about_steps.ts";

/** The chat page in front, whatever it is about. */
const page = (world: OlaiWorld): Locator => world.frontLane().locator(CHAT_PAGE);

/** ...and the page about one item, by the key its address names. */
const pageOf = (world: OlaiWorld, item: string): Locator =>
  world.frontLane().locator(`${CHAT_PAGE}${attr("data-item", item)}`);

/** WHERE A CHAT'S DOOR LANDED: the item's own page, or the chat's. One step
 *  for the two because a door that opens a conversation is allowed to land on
 *  either — the node's zoom page draws the conversation at its foot, and the
 *  chat page draws it whole. */
Then("the page is the agent {string}", async function (this: OlaiWorld, node: string) {
  const id = this.nodeId(node);
  await this.frontLane()
    .locator(`${ZOOM_TITLE}${attr("data-node-id", id)}, ${CHAT_PAGE}${attr("data-item", id)}`)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/** The head's three facts: what kind of item, what it is called, and where it
 *  is. Asserted together because they are one line a person reads. */
const heads = async (world: OlaiWorld, item: string, kind: string, name: string, where: string): Promise<void> => {
  const here = pageOf(world, item);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await here.getAttribute("data-kind"), kind, `the chat page of ${item} is not about a ${kind}`);
  await world.waitUntil(async () => (await here.locator(CHAT_PAGE_TITLE).innerText()).trim() === name,
    `the chat page to be titled ${JSON.stringify(name)}`, HYDRATION_TIMEOUT);
  await world.waitUntil(async () => (await here.locator(CHAT_PAGE_WHERE).innerText()).trim() === where,
    `the chat page to say it is at ${JSON.stringify(where)}`, HYDRATION_TIMEOUT);
};

Then("the chat page is about the note {string} named {string}", async function (this: OlaiWorld, note: string, name: string) {
  await heads(this, `/${note}`, "note", name, note);
  // A NOTE'S CHAT WEARS ITS FILE'S MARK, as every list of chats draws it.
  assert.equal(await pageOf(this, `/${note}`).locator(CHAT_FILE_MARK).count(), 1, "the chat page wears no file mark");
});

Then("the chat page is about the node {string} named {string} in {string}", async function (this: OlaiWorld, node: string, name: string, file: string) {
  await heads(this, this.nodeId(node), "node", name, file);
});

/** THE PAGE DRAWS NO BREADCRUMB. A chat is not inside anything — it belongs to
 *  one item, and that item is the title. */
Then("the chat page shows no breadcrumb", async function (this: OlaiWorld) {
  await page(this).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await this.frontLane().locator(BREADCRUMBS).count(), 0, "the chat page drew a breadcrumb");
});

/** HOW IT STANDS, at the right of the head. */
Then("the chat page stands {string}", async function (this: OlaiWorld, standing: string) {
  const mark = page(this).locator(CHAT_PAGE_STANDING);
  await mark.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await mark.getAttribute("data-standing") === standing,
    `the chat page to stand ${standing}`, HYDRATION_TIMEOUT);
});

/** A NODE'S SLEEP LINE is on its chat page exactly as it is on the node's own
 *  page — and a NOTE'S chat has none at all, with no *Tidy memory* beside it:
 *  the note IS the memory of its chat. */
Then("the chat page offers to put the chat to sleep", async function (this: OlaiWorld) {
  await page(this).locator(selector(TESTID.chatSleeping)).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then("the chat page never offers sleep or tidying", async function (this: OlaiWorld) {
  const here = page(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  // The agent line is on screen, so a conversation HAS been drawn — an absence
  // read before that would pass on every page.
  await here.locator(selector(TESTID.agentPageHead)).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await here.locator(selector(TESTID.chatSleeping)).count(), 0, "a note's chat page offered sleep");
  assert.equal(await here.locator(selector(TESTID.chatTidyMemory)).count(), 0, "a note's chat page offered tidying");
  assert.ok(!(await here.innerText()).includes("Memory"), "a note's chat page says Memory");
});

Then("the chat page conversation is ready", async function (this: OlaiWorld) {
  const here = page(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const item = await here.getAttribute("data-item");
  assert.ok(item, "the chat page names no item");
  await here.locator(`${selector(TESTID.agentPageFoot)}${attr("data-agent", item)}`)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  // SCOPED TO THE PAGE, not to the harness's conversation hosts: the same
  // chat can be drawn under its row's fold at the same time, and a locator
  // matching both is a strict-mode failure rather than an answer.
  const panel = here.locator(`${selector(TESTID.agentPageFoot)}${attr("data-agent", item)} ${CHAT_PANEL}`);
  await this.waitUntil(async () => await panel.getAttribute("data-session-id") !== null,
    "the chat page's conversation identity", HYDRATION_TIMEOUT);
});

// ── the door on a page whose item has no chat yet ──────────────────────

Then("the chat page offers to chat about {string}", async function (this: OlaiWorld, name: string) {
  const door = page(this).locator(`${CHAT_ABOUT}${attr("data-where", "page")}`);
  await door.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await door.locator(ASK_INPUT).getAttribute("placeholder"), `Ask about ${name}…`);
});

Then("the chat page offers no chat box", async function (this: OlaiWorld) {
  await this.waitUntil(async () => await page(this).locator(CHAT_ABOUT).count() === 0,
    "the chat page to stop offering a box", HYDRATION_TIMEOUT);
});

// ── a note that went, and a note that stopped naming its chat ──────────

/** THE NOTE IS GONE — renamed or deleted under the open page. The page says
 *  so where the conversation was, and `the chat page offers no chat box` is
 *  what the scenario asserts beside it: there is nothing here to start. */
Then("the chat page says the note is gone", async function (this: OlaiWorld) {
  const said = page(this).locator(CHAT_PAGE_GONE);
  await said.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.ok((await said.innerText()).includes("This note is gone"),
    `the chat page did not say the note is gone: ${JSON.stringify(await said.innerText())}`);
});

/** THE NOTE IS THERE AND NO LONGER NAMES THIS CONVERSATION. The page says
 *  which note, and never that the conversation ended — it has not. */
Then("the chat page says {string} no longer names this conversation", async function (this: OlaiWorld, name: string) {
  const said = page(this).locator(CHAT_PAGE_UNTIED);
  await said.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const words = await said.innerText();
  assert.ok(words.includes(`${name} no longer names this conversation`),
    `the chat page did not say ${JSON.stringify(name)} lost the tie: ${JSON.stringify(words)}`);
  await said.locator(CHAT_RETIE).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

When("I press tie it again", async function (this: OlaiWorld) {
  const button = page(this).locator(CHAT_RETIE);
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(button);
});

/** THE PERSON'S OWN CLOSE, pressed where the conversation is drawn whole.
 *  Scoped to the page rather than to `world.chat(…)` so that it is this
 *  page's control and not a fold's somewhere behind it. */
When("I close the chat from the chat page", async function (this: OlaiWorld) {
  const close = page(this).locator(selector(TESTID.chatCloseAgent));
  await close.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(close);
});

/** ...AND WHAT THE PAGE MUST NOT SAY AFTERWARDS. A close the person made is
 *  not a tie an outside writer took away: no untied face, no press offering
 *  the conversation back, and nothing saying the note stopped naming it. (The
 *  door it falls back to names the front matter itself, truthfully — that is
 *  where a chat about a note is kept — so the words held here are the untied
 *  face's own.) */
Then("the chat page never offers to tie it again", async function (this: OlaiWorld) {
  const here = page(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await here.locator(CHAT_RETIE).count() === 0,
    "the chat page to offer no way back", HYDRATION_TIMEOUT);
  assert.equal(await here.locator(CHAT_PAGE_UNTIED).count(), 0, "the chat page drew the untied face");
  const words = await here.innerText();
  assert.ok(!words.includes("no longer names this conversation") && !words.includes("the tie has gone"),
    `the chat page said an outside writer took the tie: ${JSON.stringify(words)}`);
});

When("I ask from the chat page {string}", async function (this: OlaiWorld, text: string) {
  const door = page(this).locator(`${CHAT_ABOUT}${attr("data-where", "page")}`);
  await door.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await door.locator(ASK_INPUT).fill(text);
  await door.locator(ASK_SEND).click();
});

/** WHICH NOTE THE AGENT WAS TOLD IT BELONGS TO, read where a person reads it:
 *  in the transcript, under their own words. The sentence is the server's
 *  (`../../src/teaching.ts`); what this holds is that the PATH is in it. */
Then("the chat page's first message names the note {string}", async function (this: OlaiWorld, note: string) {
  await this.waitUntil(async () => (await page(this).innerText()).includes(`\`${note}\``),
    `the first message to name the note ${note}`, HYDRATION_TIMEOUT);
});

/** NOTHING HAS BEEN ANSWERED in the conversation on this page — the half of
 *  "the words waited" that says they were not sent on somebody's behalf. */
Then("the agent has said nothing yet", async function (this: OlaiWorld) {
  assert.equal(await page(this).locator(CHAT_SAID).count(), 0, "the agent answered something nobody sent");
});

// ── where a note's chat opens ──────────────────────────────────────────

Then("the chat page says it opens {string}", async function (this: OlaiWorld, words: string) {
  const line = page(this).locator(CHAT_OPENS);
  await line.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await line.locator(CHAT_OPENS_SWITCH).innerText()).trim() === words,
    `the switch to read ${JSON.stringify(words)}`, HYDRATION_TIMEOUT);
  assert.equal(await line.getAttribute("data-beside"), String(words !== "alone"));
});

Then("the chat page has no opens switch", async function (this: OlaiWorld) {
  const here = page(this);
  await here.locator(selector(TESTID.agentPageHead)).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  assert.equal(await here.locator(CHAT_OPENS).count(), 0, "a node's chat page drew an opens switch");
});

When("I press the opens switch", async function (this: OlaiWorld) {
  const control = page(this).locator(CHAT_OPENS_SWITCH);
  await control.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(control);
});

/** WHAT THE NOTE ITSELF SAYS, which is where the answer lives: `chat-opens` in
 *  its own front matter, readable by a person and carried by a `git pull`. */
Then("the note {string} says it opens {string}", async function (this: OlaiWorld, note: string, answer: string) {
  await this.waitUntil(async () => matterOf(this, note)["chat-opens"] === answer,
    `${note} to say \`chat-opens: ${answer}\``, POLL_TIMEOUT);
});

// ── the item, beside its chat ──────────────────────────────────────────

When("I press Open beside on the chat page", async function (this: OlaiWorld) {
  const button = page(this).locator(CHAT_OPEN_BESIDE);
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.press(button);
});

Then("the chat page offers to open {string} beside", async function (this: OlaiWorld, name: string) {
  const button = page(this).locator(CHAT_OPEN_BESIDE);
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await button.innerText()).trim() === `Open ${name} beside ›`,
    `the button to offer to open ${name} beside`, HYDRATION_TIMEOUT);
});

/** ...AND ON A PHONE IT IS THE SAME VERB WITHOUT THE COLUMN: the panes are a
 *  strip of tabs there, so the door reads *Open <name> ›* and the press puts
 *  the item in the next tab. */
Then("the chat page offers to open {string}", async function (this: OlaiWorld, name: string) {
  const button = page(this).locator(CHAT_OPEN_BESIDE);
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => (await button.innerText()).trim() === `Open ${name} ›`,
    `the button to offer to open ${name}`, HYDRATION_TIMEOUT);
});

Then("the chat page says the item is shown beside", async function (this: OlaiWorld) {
  const button = page(this).locator(CHAT_OPEN_BESIDE);
  await button.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await this.waitUntil(async () => await button.getAttribute("data-beside") === "true"
    && (await button.innerText()).trim() === "Shown beside",
    "the button to read Shown beside", HYDRATION_TIMEOUT);
});

/**
 * THE PHONE'S WHOLE SCREEN. One pane at a time there, so a chat opened on a
 * phone IS the screen: its head, the conversation and the composer are all
 * inside the viewport, with the composer in its bottom quarter where a thumb
 * is.
 *
 * EVERYTHING IS READ AT THE TOP OF THE SCROLL, in the same frame as the
 * scroll: the head is pinned under the app's chrome, so what it covers while
 * a reader is half-way down a long conversation is a different question
 * (`the chat page's head stays in view` below), and the transcript's own
 * stick-to-the-bottom would otherwise land between the scroll and the
 * reading. What is asserted here is the screen a person ARRIVES at.
 */
Then("the chat page fills the phone screen", async function (this: OlaiWorld) {
  const here = page(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await here.locator(CHAT_SEND).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  await here.locator(CHAT_TRANSCRIPT).waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const { width, height } = this.viewport();
  const seen = await here.evaluate((root, ids) => {
    let host: HTMLElement | null = root as HTMLElement;
    while (host !== null && !/auto|scroll/.test(getComputedStyle(host).overflowY)) host = host.parentElement;
    if (host !== null) host.scrollTop = 0;
    window.scrollTo(0, 0);
    const box = (id: string) => {
      const rect = root.querySelector(id)?.getBoundingClientRect();
      return rect === undefined ? null : { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    return { head: box(ids.head), body: box(ids.body), composer: box(ids.composer) };
  }, { head: CHAT_PAGE_TITLE, body: CHAT_TRANSCRIPT, composer: CHAT_SEND });
  const said = JSON.stringify({ ...seen, screen: [width, height] });
  const inside = (box: { x: number; y: number; width: number; height: number } | null): boolean => box !== null
    && box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1;
  assert.ok(inside(seen.head), `the chat page's head is not on the phone's screen: ${said}`);
  assert.ok(inside(seen.body), `the conversation is not on the phone's screen: ${said}`);
  assert.ok(inside(seen.composer), `the composer is not on the phone's screen: ${said}`);
  // AT THE BOTTOM, under the conversation: a phone's chat with its composer
  // anywhere else is a page somebody has to scroll to type into.
  assert.ok(seen.composer !== null && seen.body !== null
    && seen.composer.y >= seen.body.y && seen.composer.y > height * 0.75,
    `the composer is not at the bottom of the phone's screen: ${said}`);
});

/**
 * THE WAY BACK, AFTER A SCROLL — the chat page's head, still pinned under
 * whatever the app has above it.
 *
 * WITH THE CHAT ALONE on a phone there is no tab strip, so this head IS the
 * way back to the note: the button on it reads *Open plan ›*. A reader
 * half-way down a long conversation who has to scroll to the top to find it
 * is the complaint this step exists for, so the scroll is asserted here too —
 * a head at the top of an unscrolled page says nothing.
 *
 * UNDER THE STRIP WHERE THERE IS ONE (the same page as a tab of two), and
 * under the bar where there is not: both are what `--height-chrome` is.
 */
Then("the chat page's head stays in view", async function (this: OlaiWorld) {
  const head = page(this).locator(CHAT_PAGE_HEAD);
  await head.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const scrolled = await this.page.evaluate(() => window.scrollY);
  assert.ok(scrolled > 0, "the page is not scrolled, so nothing here is about staying in view");
  const tabs = this.frontLane().locator(PANE_TABS);
  const above = (await tabs.count()) > 0
    ? await tabs.boundingBox()
    : await this.page.locator(APP_HEADER).boundingBox();
  const box = await head.boundingBox();
  assert.ok(above && box && Math.abs(box.y - above.y - above.height) <= 1,
    `the chat page's head scrolled away: ${JSON.stringify({ above, box, scrolled })}`);
});

// ── how much of the screen the conversation gets ───────────────────────

/**
 * THE SHARE OF THE SCREEN LEFT FOR THE CONVERSATION, measured between the
 * chrome pinned over the page and the box somebody types in, pinned under it.
 *
 * This is the complaint, as a number. With the whole head pinned, a portrait
 * handset spent 450 of its 844 pixels on chrome and a landscape one 310 of
 * 390 — the conversation was a slot, and on its side there was none at all.
 * What a scenario asserts is therefore not "the head is small" but what is
 * LEFT: the band from the lowest thing pinned at the top (the bar, the strip
 * of tabs where there is one, and the page's own pinned line) down to the TOP
 * OF THE TEXT BOX.
 *
 * THE TOP OF THE BOX, and not the *Send* button on the row under it: what a
 * person READS is the conversation, and a measure that stopped at the send
 * counted the box being typed into — two lines of transcript and a composer
 * reported as a third of the screen. Everything from the box down is the
 * writing half of the page.
 *
 * READ AFTER A SCROLL, by the scenario's own doing: a pinned band is only
 * pinned once the page has moved under it, and these numbers at the top of an
 * unscrolled page would be about nothing.
 */
Then("the conversation gets at least {int}% of the screen", async function (this: OlaiWorld, share: number) {
  const here = page(this);
  await here.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const box = here.locator(selector(TESTID.chatInput)).first();
  await box.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
  const { width, height } = this.viewport();
  const bottomOf = async (locator: Locator): Promise<number | null> => {
    if (await locator.count() === 0) return null;
    const box = await locator.first().boundingBox();
    return box === null ? null : box.y + box.height;
  };
  const chrome = Math.max(...[
    await bottomOf(this.page.locator(APP_HEADER)),
    await bottomOf(this.frontLane().locator(PANE_TABS)),
    await bottomOf(here.locator(CHAT_PAGE_HEAD)),
  ].filter((edge): edge is number => edge !== null));
  const typed = await box.boundingBox();
  assert.ok(typed !== null, "the chat page draws no box to measure against");
  const room = Math.min(typed.y, height) - Math.max(chrome, 0);
  const got = Math.round((room / height) * 100);
  const said = JSON.stringify({ chrome: Math.round(chrome), box: Math.round(typed.y), room: Math.round(room), screen: [width, height] });
  assert.ok(got >= share,
    `the conversation gets ${got}% of a ${width}×${height} screen (${Math.round(room)}px), under the ${share}% this asks for: ${said}`);
});

/**
 * THE SAME HANDSET, TURNED — 844×390, which is 390×844's other orientation
 * and the width at which this app stops being a phone (`md` is 48rem). One
 * rule at every width is what the head is written to, so a scenario measures
 * the same thing on both and this is how it gets there.
 */
When("I turn the phone on its side", async function (this: OlaiWorld) {
  const { width, height } = this.viewport();
  await this.page.setViewportSize({ width: height, height: width });
  await this.waitForFrame();
});

// ── a row whose title is a link, with no chat on it ────────────────────

/**
 * THE ROW THE ONE-TIME MOVE LEAVES BEHIND, in a corpus of its own: a row
 * titled as one markdown link and no longer carrying a chat. Written as its
 * own outline so the scenario names the file it is in, and with the id it is
 * asked for so the scenario can open `/chat/<id>` by hand — which is how a
 * person reaches the chat page of a row that is on no list of chats.
 */
Given("the vault holds the row {string} titled {string} with no chat", function (this: OlaiWorld, id: string, title: string) {
  this.writeServed(`${id}.olai`, `${JSON.stringify({ id, ord: "a0", title })}\n`);
});
