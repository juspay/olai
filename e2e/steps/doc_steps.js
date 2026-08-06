// The document a node's @doc attaches: the one line of it the outline draws,
// the whole of it on the node's own page, and what happens when the FILE moves
// while a page is open.
//
// A node is addressed by (part of) its title, like everywhere else in this
// suite; the document is addressed through the node, because that is what it
// belongs to.

import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";

import { literal } from "../support/dom.js";

// The document block of a node's OWN row-level content: a descendant's is
// another node's, exactly as with .ol-note.
function block(world, title) {
  return world.node(title).first().locator(":scope > .ol-doc").first();
}

Then("{string} attaches the document {string}", async function (title, name) {
  const el = block(this, title).locator(".ol-doc-name").first();
  await el.waitFor({ state: "visible" });
  assert.equal((await el.innerText()).trim(), name);
});

Then("{string} attaches no document", async function (title) {
  assert.equal(await block(this, title).count(), 0, `${title} draws a document`);
});

Then(
  "the document line under {string} reads {string}",
  async function (title, lead) {
    const el = block(this, title).locator(".ol-doc-lead").first();
    await el.waitFor({ state: "visible" });
    assert.match((await el.innerText()).trim(), literal(lead));
  },
);

// The whole document, drawn: only the zoomed node gets one, so this asks the
// page rather than a node.
Then("no document is drawn in full", async function () {
  assert.equal(
    await this.page.locator("#ol-outline .ol-doc-body").count(),
    0,
    "a document is drawn in full",
  );
});

// Waited for, not read: on the edit scenario this text is arriving over SSE.
Then("the document on this page reads {string}", async function (text) {
  await this.page
    .locator("#ol-outline .ol-doc-body")
    .getByText(text, { exact: false })
    .first()
    .waitFor({ state: "visible" });
});

// The name is a link to the node's own page — the outline's way of saying
// "the rest is one click away".
When("I follow the document under {string}", async function (title) {
  await this.follow(block(this, title).locator("a.ol-doc-name").first());
  await this.page.waitForURL(/\/n\/[^/]+$/);
});

// The .rkt does not move here. Every scenario's document is its own file in
// its own temp dir (support/world.js), and this is the only step that writes
// one — a different size as well as different bytes, like every other edit
// this suite makes (support/outline.js on the staleness probe).
When("I rewrite the document", async function () {
  await this.rewriteDoc(
    "# Rewritten under the server\n\nThe outline never moved.\n",
  );
});
