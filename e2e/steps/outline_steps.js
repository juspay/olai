// What the outline pane draws: the parts of a node, the mirror sites, the
// zoom, and the empty state that stands in for all of it.
//
// A node is addressed by (part of) its own title — world.node — so these read
// like the outline does rather than like the DOM does.

import assert from "node:assert/strict";
import { Then } from "@cucumber/cucumber";

import { assertClass, literal } from "../support/dom.js";

// ---- a title is there, or it is not ----------------------------------------

Then("I see the title {string}", async function (title) {
  await this.node(title).first().waitFor({ state: "visible" });
});

// A count NOW, so this is sound about a page that has finished loading and
// says nothing about one mid-swap. "leaves the page" is the waiting one.
Then("I do not see the title {string}", async function (title) {
  assert.equal(await this.node(title).count(), 0, `${title} is on the page`);
});

Then("{string} leaves the page", async function (title) {
  await this.node(title).first().waitFor({ state: "detached" });
});

// ---- the rest of a node ----------------------------------------------------

/** A part of a node's OWN row: a descendant's row is another node's. */
function part(world, title, cls) {
  return world.node(title).first().locator(`:scope > .ol-row ${cls}`).first();
}

Then("the note under {string} reads {string}", async function (title, note) {
  const el = part(this, title, ".ol-note");
  await el.waitFor({ state: "visible" });
  assert.match((await el.innerText()).trim(), literal(note));
});

Then("{string} carries the tag {string}", async function (title, tag) {
  const el = part(this, title, ".ol-tag");
  await el.waitFor({ state: "visible" });
  assert.equal((await el.innerText()).trim(), tag);
});

Then("{string} carries the date {string}", async function (title, date) {
  const pill = part(this, title, ".ol-date");
  await pill.waitFor({ state: "visible" });
  // the pill reads friendly ("Thu 15 Jan"); the ISO it stands for is its title
  assert.equal(await pill.getAttribute("title"), date);
});

// Done is a state of the NODE (web/render), so that is where it is asserted —
// not on the strikethrough, which is one of several ways it draws.
Then("{string} is done", async function (title) {
  await assertClass(this.node(title).first(), "is-done", true, title);
});

Then("{string} is not done", async function (title) {
  await assertClass(this.node(title).first(), "is-done", false, title);
});

// The third state, same standing: a class on the node, plus a pill that is
// the only thing on the row saying so (a doing node has no strikethrough and
// need not have a date).
Then("{string} is doing", async function (title) {
  await assertClass(this.node(title).first(), "is-doing", true, title);
  await part(this, title, ".ol-doing").waitFor({ state: "visible" });
});

// The waiting one, for a state that ARRIVES under a live swap. It waits for
// the node wearing the new state rather than for the old one to change:
// mid-swap, the element a class would be read off is whichever of the two
// copies the query happened to land on.
Then("{string} becomes done", async function (title) {
  await this.nodeInState(title, "is-done").first().waitFor({ state: "visible" });
});

Then("{string} is not doing", async function (title) {
  await assertClass(this.node(title).first(), "is-doing", false, title);
});

// ---- mirrors ---------------------------------------------------------------
//
// A mirror is the same node drawn at a second SITE, so it is addressed by
// where it hangs (the parent) rather than by its title — which is the title of
// the node it mirrors, and belongs to that node's defining site too.

Then("{string} holds a mirror of {string}", async function (parent, anchor) {
  const link = this.node(parent).first().locator(".ol-mirror").first();
  await link.waitFor({ state: "visible" });
  assert.equal(await link.getAttribute("href"), `#${anchor}`);
});

// Waiting, not reading: the node a mirror site draws is the node another file
// may have just been edited in, and that title arrives over SSE. Reading the
// site's text now would be reading it before the swap.
Then("the mirror under {string} draws {string}", async function (parent, title) {
  const site = this.node(parent)
    .first()
    .locator(".ol-node")
    .filter({ has: this.page.locator(".ol-mirror") })
    .filter({ hasText: title })
    .first();
  await site.waitFor({ state: "visible" });
});

// ---- zoom, and nothing to zoom to ------------------------------------------

Then("the main pane is zoomed", async function () {
  await this.page.locator("#ol-outline.ol-zoom").waitFor({ state: "visible" });
});

// The empty state names the day it went looking for, so the assertion asks the
// server which day that was rather than deciding for itself.
Then("the main pane says there is no day node for today", async function () {
  const day = await this.today();
  await this.page
    .getByText(`No day node for ${day}`)
    .first()
    .waitFor({ state: "visible" });
});
