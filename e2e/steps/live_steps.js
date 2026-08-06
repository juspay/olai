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

import { isMarkedElement, markElement } from "../support/dom.js";

// ---- what a swap must not disturb ------------------------------------------

// Enough nodes that the page is taller than the window. One write, and its own
// swap, before the scenario's real one.
// Scoped to the outline pane: the sidebar tree is a live region of its own
// now and lists the same top-level nodes, so an unscoped match finds the title
// twice — once in each surface that followed the write.
When("the outline is long enough to scroll", async function () {
  const filler = Array.from({ length: 60 }, (_, i) => `Filler ${i}`).join("\n");
  await this.append(`${filler}\n`);
  await this.node("Filler 59").first().waitFor();
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
  await markElement(this.page.locator("#ol-chat"));
});

Then("the chat panel is the one I marked", async function () {
  assert.equal(
    await isMarkedElement(this.page.locator("#ol-chat")),
    true,
    "the chat panel was rebuilt by navigating",
  );
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

// Asserted through what a reader SEES, not through the class behind it. The
// class is the framework's vocabulary (live/client.rkt) and the sentence is
// olai's (web/render); a step that read the class would pass on a page that
// paints nothing, which is the failure it exists to catch.
Then("the page says it is showing last known state", async function () {
  await this.page.getByText("showing last known state").waitFor({ state: "visible" });
});

// Healthy is a state with a look of its own, not the absence of the other
// two: an indicator that shows nothing while things are fine cannot be told
// apart from an indicator that never worked. Waited for — a reconnect is the
// browser's own, on its own clock.
Then("the page says the stream is live", async function () {
  await this.page.getByText("live", { exact: true }).waitFor({ state: "visible" });
});
