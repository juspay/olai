// The agent panel: its open bit, the room it makes, and what a turn draws.
//
// Every wait here is a wait on the DOM. Frames arrive over SSE and a turn is
// drawn as they land, so a step that slept would either be racing the agent or
// pretending to test something slower than it is.

import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";

import { SLOW_PROMPT } from "../support/server.js";

// Before the page is opened, not after: what the panel comes up KNOWING is
// server-rendered, and a page opened mid-boot misses the frames that would
// have told it (world.waitForAgent).
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
  assert.equal(await this.page.locator("#ol-chat-body .ol-chat-turn").count(), 0);
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

// ---- the conversation -----------------------------------------------------

/** The turn being drawn. A turn owns its user bubble, the agent's text and its
 *  tool lines, so everything asserted about one is looked up inside it. */
function lastTurn(page) {
  return page.locator("#ol-chat-body .ol-chat-turn").last();
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
