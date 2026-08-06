// The live view: what a swap must NOT disturb, and what the page says about
// the stream feeding it.
//
// Everything here is about the difference between morphing a region and
// replacing it. Replacing is invisible when you only look at the text — the
// same words come back — and the damage is in what the browser hung off the
// old nodes: where the page was scrolled, what was selected, which element the
// chat panel is. So these steps assert the things that survive, not the words.

import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";

// The two classes the framework's runtime writes on <html>, and neither of
// them is a healthy stream (live/client.rkt owns the names; the skin paints
// them). Spelled here because a browser cannot require a Racket module —
// live/tests/client.rkt is what keeps this end and that one the same words.
const CONNECTING = "live-connecting";
const STALE = "live-stale";

// An expando on a DOM node: it dies with the element and nothing else, which
// makes it the only honest answer to "is this the same element".
const NODE_MARK = "__olai_e2e_node";

// ---- what a swap must not disturb ------------------------------------------

// Enough nodes that the page is taller than the window. One write, and its own
// swap, before the scenario's real one.
When("the outline is long enough to scroll", async function () {
  const filler = Array.from({ length: 60 }, (_, i) => `Filler ${i}`).join("\n");
  await this.append(`${filler}\n`);
  await this.page.getByText("Filler 59", { exact: true }).waitFor();
});

When("I scroll the outline down", async function () {
  this.scrolledTo = await this.page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight / 2);
    return window.scrollY;
  });
  assert.ok(this.scrolledTo > 0, "the page did not scroll: nothing to preserve");
});

// Exact, not "close enough": a morph that touched nothing above the viewport
// moves the page by zero pixels, and a tolerance here would hide the bug this
// is for.
Then("the outline is where I scrolled it", async function () {
  assert.equal(
    await this.page.evaluate(() => window.scrollY),
    this.scrolledTo,
    "the swap moved the page",
  );
});

// A selection is anchored in TEXT NODES. Replace the markup and it is gone
// with them; morph the markup and the text node that did not change is the
// same object, so the selection is still in it.
When("I select the title {string}", async function (title) {
  await this.page.evaluate((t) => {
    const el = [...document.querySelectorAll("#ol-outline .ol-title")].find((e) =>
      e.textContent.includes(t),
    );
    if (!el) throw new Error(`no title matching ${t}`);
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }, title);
  assert.equal(await selectedText(this.page), title);
});

Then("{string} is still selected", async function (title) {
  assert.equal(await selectedText(this.page), title, "the swap ate the selection");
});

function selectedText(page) {
  return page.evaluate(() => window.getSelection().toString().trim());
}

// ---- the same element, or a new one ----------------------------------------

When("I mark the chat panel", async function () {
  await this.page.locator("#ol-chat").evaluate((el, k) => {
    el[k] = true;
  }, NODE_MARK);
});

Then("the chat panel is the one I marked", async function () {
  const same = await this.page
    .locator("#ol-chat")
    .evaluate((el, k) => el[k] === true, NODE_MARK);
  assert.equal(same, true, "the chat panel was rebuilt by navigating");
});

// A link that lost its href is a link no-JS, middle-click and copy-link can
// follow. The partial fetch is an ADDITION to it, never a replacement.
Then("every link in the sidebar tree has an href", async function () {
  const missing = await this.page.evaluate(() =>
    [...document.querySelectorAll("#ol-sidebar a")].filter((a) => !a.getAttribute("href"))
      .length,
  );
  assert.equal(missing, 0, "a sidebar link has no href");
});

When("I go back", async function () {
  await this.page.goBack();
});

// ---- the stream's health ---------------------------------------------------
//
// The server going away is the honest way to say "the stream died": the socket
// is actually gone, the way it is after a deploy, a restart or a box that
// rebooted — and the browser finds out the way it does in life. Emulating
// offline would leave the connection open and prove nothing about recovery.

When("the server goes away", async function () {
  await this.stopServer();
});

When("the server comes back", async function () {
  await this.startServerAgain();
});

Then("the page says it is showing last known state", async function () {
  await this.page.waitForFunction((c) => document.documentElement.classList.contains(c), STALE);
  await this.page.getByText("showing last known state").waitFor({ state: "visible" });
});

// Quiet is the healthy state: no class, and nothing on the page about a
// stream. Waited for — the reconnect is the browser's own, on its own clock.
Then("the page says nothing about the stream", async function () {
  await this.page.waitForFunction(
    (cs) => cs.every((c) => !document.documentElement.classList.contains(c)),
    [CONNECTING, STALE],
  );
  await this.page.locator("#ol-stream").waitFor({ state: "hidden" });
});
