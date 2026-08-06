// The agent panel: its open bit, the room it makes, and what a turn draws.
//
// Every wait here is a wait on the DOM. Frames arrive over SSE and a turn is
// drawn as they land, so a step that slept would either be racing the agent or
// pretending to test something slower than it is.

import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";

import { SLOW_PROMPT } from "../support/server.js";

// Before the page is opened, not after: a panel catches up on whatever the
// agent has already said (that is the stream's job, and the last scenario in
// features/sessions.feature is about it), but the PICKER asks the agent
// itself, and there is nothing to ask until it is up (world.waitForAgent).
Given("the agent has woken up", async function () {
  await this.waitForAgent();
});

// The panel's own state, as a selector: matched means open, no match means
// closed. `detached` is how playwright spells "nothing matches this", which is
// what makes the closed assertions auto-wait like the open ones.
const OPEN = "#ol-chat.is-open";
const BUSY = "#ol-chat.is-busy";

// Two buttons toggle the panel and only one of them is ever reachable: the
// floating one is taken away while the panel is open (it sits under it), and
// the header's × is inside the panel it closes.
const TOGGLE = ".ol-chat-open[data-chat-toggle]";
const CLOSE = "#ol-chat [data-chat-toggle]";

When("I press the agent toggle", async function () {
  await this.page.locator(TOGGLE).click();
});

When("I close the chat panel", async function () {
  await this.page.locator(CLOSE).click();
});

When("I send {string} to the agent", async function (text) {
  await send(this.page, text);
});

// A turn that dawdles, so "working" is a state to look at rather than a frame
// to catch. The prompt that asks for one is support/server.js's to spell.
When("I send a slow prompt to the agent", async function () {
  await send(this.page, SLOW_PROMPT);
});

async function send(page, text) {
  await page.locator("#ol-chat-form .ol-chat-input").fill(text);
  await page.locator("#ol-chat-form .ol-chat-send").click();
}

Then("the chat panel is open", async function () {
  await this.page.locator(OPEN).waitFor({ state: "visible" });
});

// The panel carries no is-open on the way out of the renderer, so a page where
// chat.js never ran would pass this for the wrong reason. The popover the
// script builds at init is the proof it ran.
Then("the chat panel is closed", async function () {
  await this.page.locator("#ol-chat-pop").waitFor({ state: "attached" });
  await this.page.locator(OPEN).waitFor({ state: "detached" });
});

Then("the chat panel is busy", async function () {
  await this.page.locator(BUSY).waitFor({ state: "visible" });
});

Then("the chat panel is idle", async function () {
  await this.page.locator(BUSY).waitFor({ state: "detached" });
});

// ---- past conversations ---------------------------------------------------
//
// The picker is drawn by chat.js from what the server asks the agent, every
// time it is opened — a cached list would be wrong the moment another client
// wrote a session. Rows are .ol-chat-cmd, the same shape the slash-command
// popover uses; the title is the name a conversation goes by.

const PICKER = "#ol-chat-spop";
const PICKER_ROW = `${PICKER} .ol-chat-cmd`;

When("I press the sessions button", async function () {
  await this.page.locator("#ol-chat [data-chat-sessions]").click();
  await this.page.locator(PICKER).waitFor({ state: "visible" });
});

When("I pick the conversation {string}", async function (title) {
  await this.page
    .locator(PICKER_ROW, { hasText: title })
    .first()
    .click();
});

Then("the picker offers {string}", async function (title) {
  await this.page
    .locator(PICKER_ROW, { hasText: title })
    .first()
    .waitFor({ state: "visible" });
});

// The picker is open and drawn by the time this runs (pressing the button
// waits for it), so a row that is not there now is not coming.
Then("the picker does not offer {string}", async function (title) {
  assert.equal(
    await this.page.locator(PICKER_ROW, { hasText: title }).count(),
    0,
    `${title} is in the picker`,
  );
});

Then("the picker says there are no past chats here", async function () {
  await this.page
    .locator(PICKER)
    .getByText("no past chats here")
    .waitFor({ state: "visible" });
});

// Which conversation the panel is in. The agent is what knows its name, so it
// arrives as a frame — and an unnamed conversation is an empty line, which the
// sheet takes away entirely (so it is read, not waited for as a visible thing).
Then("the chat is titled {string}", async function (title) {
  await this.page
    .locator("#ol-chat-session")
    .filter({ hasText: title })
    .waitFor();
});

Then("the chat is not titled {string}", async function (title) {
  const line = this.page.locator("#ol-chat-session");
  await line.waitFor({ state: "attached" });
  assert.notEqual((await line.textContent()).trim(), title);
});

// Nothing was replayed into it: this conversation is new, not one adopted from
// somewhere else.
Then("the transcript is empty", async function () {
  assert.equal(await this.page.locator(TURNS).count(), 0);
});

// ---- geometry -------------------------------------------------------------
//
// Measured in the page, off the boxes the browser actually laid out: a
// stylesheet assertion would only say what the CSS claims, and the bug this
// guards was the cascade doing exactly what it was told.

/** .ol-main's content width, its right edge, the panel's left edge, and what a
 *  rem is worth here (the floor is written in rem, and the root font size is
 *  the reader's). */
async function measure(page) {
  await page.locator(OPEN).waitFor({ state: "visible" });
  return await page.evaluate(() => {
    const main = document.querySelector(".ol-main");
    const style = getComputedStyle(main);
    const box = main.getBoundingClientRect();
    return {
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
      // border box minus its own gutters: what a line of text has to sit in
      content:
        box.width -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight),
      right: box.right,
      chatLeft: document.querySelector("#ol-chat").getBoundingClientRect().left,
    };
  });
}

Then("the outline column is at least {int} rem wide", async function (rems) {
  const m = await measure(this.page);
  const floor = rems * m.rem;
  assert.ok(
    m.content >= floor,
    `the outline column is ${m.content}px, under the ${floor}px floor`,
  );
});

Then("the outline column stops before the chat panel", async function () {
  const m = await measure(this.page);
  assert.ok(
    m.right <= m.chatLeft,
    `the outline runs to ${m.right}px, under the panel's edge at ${m.chatLeft}px`,
  );
});

// ---- the same panel, on a phone -------------------------------------------
//
// Below phone-max the panel is a sheet OVER the outline, so the desktop
// geometry above reads the other way: it takes the whole width, and the
// reading column it used to make room for is covered rather than narrowed.

Then("the chat panel is as wide as the screen", async function () {
  const m = await sheet(this.page);
  assert.equal(Math.round(m.width), Math.round(m.screen),
    `the panel is ${m.width}px on a ${m.screen}px screen`);
});

Then("the outline reserves no gutter for the chat panel", async function () {
  const gutter = await this.page.evaluate(
    () => getComputedStyle(document.querySelector(".ol-main")).marginRight);
  assert.equal(gutter, "0px", `the outline still gives up ${gutter} to a sheet that covers it`);
});

// Every control the sheet actually shows — a stop button that is hidden while
// the panel is idle is not something anyone has to hit.
Then("every chat control is at least {int} pixels tall", async function (px) {
  const small = await this.page.evaluate(() =>
    [...document.querySelectorAll("#ol-chat button, #ol-chat input")]
      .map((el) => ({ what: (el.textContent || el.placeholder || "").trim(),
                      h: Math.round(el.getBoundingClientRect().height) }))
      .filter((c) => c.h > 0));
  const under = small.filter((c) => c.h < px);
  assert.deepEqual(under, [], `${under.map((c) => `"${c.what}" is ${c.h}px`).join(", ")}`);
});

Then("the chat input is at least {int} pixels of type", async function (px) {
  const size = await this.page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector("#ol-chat-form .ol-chat-input")).fontSize));
  assert.ok(size >= px, `the input's type is ${size}px, under the ${px}px iOS zooms at`);
});

// What a keyboard IS, to a page: the visual viewport shrinks and the layout
// viewport does not. Chromium has no on-screen keyboard to raise, so the
// scenario says that in the only place it is observable — and a page that
// listens to visualViewport (static/chat.js) cannot tell the difference, which
// is the point. A page that does not listen fails the two assertions after it,
// exactly as an iPhone did.
When("the on-screen keyboard covers the bottom of the screen", async function () {
  await this.page.evaluate(() => {
    const vv = window.visualViewport;
    Object.defineProperty(vv, "height", {
      value: Math.round(vv.height * 0.55), configurable: true,
    });
    document.querySelector("#ol-chat-form .ol-chat-input").focus();
    vv.dispatchEvent(new Event("resize"));
  });
});

Then("the chat input is on screen", async function () {
  const m = await sheet(this.page);
  assert.ok(m.input.bottom <= m.visible + 1,
    `the input row ends ${Math.round(m.input.bottom - m.visible)}px below the visible screen`);
  assert.ok(m.input.top >= -1, `the input row starts ${Math.round(m.input.top)}px above it`);
});

Then("the chat panel stops above the keyboard", async function () {
  const m = await sheet(this.page);
  assert.ok(m.bottom <= m.visible + 1,
    `the sheet ends ${Math.round(m.bottom - m.visible)}px below the visible screen`);
});

/** The sheet's box, its input row, and the strip of screen the browser is
 *  actually showing (which an on-screen keyboard is what shrinks). */
async function sheet(page) {
  await page.locator(OPEN).waitFor({ state: "visible" });
  return await page.evaluate(() => {
    const box = document.querySelector("#ol-chat").getBoundingClientRect();
    const input = document.querySelector("#ol-chat-form .ol-chat-input").getBoundingClientRect();
    const vv = window.visualViewport;
    return {
      width: box.width, bottom: box.bottom,
      input: { top: input.top - vv.offsetTop, bottom: input.bottom },
      screen: vv.width,
      visible: vv.offsetTop + vv.height,
    };
  });
}

// ---- the conversation -----------------------------------------------------

/** The turn being drawn. A turn owns its user bubble, the agent's text and its
 *  tool lines, so everything asserted about one is looked up inside it. */
const TURNS = "#ol-chat-body .ol-chat-turn";

function lastTurn(page) {
  return page.locator(TURNS).last();
}

Then("the last turn quotes me {string}", async function (text) {
  const el = lastTurn(this.page).locator(".ol-chat-msg.is-user");
  await el.waitFor({ state: "visible" });
  assert.equal((await el.innerText()).trim(), text);
});

// The agent's text arrives in chunks and is replaced wholesale by the server's
// Markdown when the turn ends, so this waits for the finished sentence rather
// than reading whatever is there when it looks.
Then("the last turn reads {string}", async function (text) {
  await lastTurn(this.page)
    .locator(".ol-chat-msg.is-agent")
    .filter({ hasText: text })
    .waitFor({ state: "visible" });
});

Then("the last turn ran the tool {string}", async function (title) {
  await lastTurn(this.page)
    .locator(".ol-chat-tool .ol-chat-tool-title", { hasText: title })
    .first()
    .waitFor({ state: "visible" });
});

// ---- folding the chatter ----------------------------------------------------
//
// A tool call is a disclosure, and the fake agent runs exactly one per turn,
// so "the turn's tool call" is unambiguous. The button's aria-expanded IS the
// fold — there is no class saying it a second time — so the state goes in the
// SELECTOR, which is what makes these wait for it rather than read whatever is
// there when they look.

/** A turn's tool call: any of them, or the one in a given ARIA state. */
function toolCall(turn, expanded) {
  const state = expanded === undefined ? "" : `[aria-expanded="${expanded}"]`;
  return turn.locator(`.ol-chat-tool${state}`).first();
}

function firstTurn(page) {
  return page.locator(TURNS).first();
}

When("I unfold the last turn's tool call", async function () {
  const tool = toolCall(lastTurn(this.page), "false");
  // What the fold is holding down, read before the click: after it there is
  // nothing left to compare against.
  this.foldedToolBox = await tool.boundingBox();
  await tool.click();
});

Then("the last turn's tool call is folded", async function () {
  await toolCall(lastTurn(this.page), "false").waitFor({ state: "visible" });
});

Then("the last turn's tool call is unfolded", async function () {
  await toolCall(lastTurn(this.page), "true").waitFor({ state: "visible" });
});

Then("the first turn's tool call is unfolded", async function () {
  await toolCall(firstTurn(this.page), "true").waitFor({ state: "visible" });
});

// The clamp, as the browser laid it out rather than as the sheet claims it:
// a title with more to say than the line has room for is cut off, and the
// element knows it.
Then("the tool call's title is cut off", async function () {
  assert.ok(await clipped(this.page), "the title fits its line — nothing is held back");
});

// The other half: the whole title is out, and the line grew to hold it.
Then("unfolding put the whole title on screen", async function () {
  const tool = toolCall(lastTurn(this.page), "true");
  const box = await tool.boundingBox();
  assert.ok(
    box.height > this.foldedToolBox.height,
    `the tool call is still ${box.height}px tall — the title never left its one line`,
  );
  assert.equal(await clipped(this.page), false, "the title is still cut off");
});

async function clipped(page) {
  return await toolCall(lastTurn(page))
    .locator(".ol-chat-tool-title")
    .evaluate((el) => el.scrollWidth > el.clientWidth);
}

// The prose the panel is actually for. Nothing in it is pressable, and its
// text is there to read rather than to ask for.
Then("the agent's words have nothing to unfold", async function () {
  const said = lastTurn(this.page).locator(".ol-chat-msg.is-agent");
  await said.waitFor({ state: "visible" });
  assert.equal(
    await said.locator("button, [aria-expanded]").count(),
    0,
    "the agent's own words carry a fold",
  );
});
