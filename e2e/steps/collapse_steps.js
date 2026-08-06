// Folding: the toggle, and what a fold means in each pane.
//
// "Folded" is asserted three ways at once because the app spells it three
// ways — the class the CSS hangs off, the ARIA state a screen reader gets,
// and the children actually being gone. Any one of them drifting is a bug.

import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";

import { assertClass, hasClass } from "../support/dom.js";

// The node's OWN toggle. A descendant's would fold the wrong node.
const TOGGLE = ":scope > .ol-row > .ol-toggle";

When("I fold {string}", async function (title) {
  await setFold(this.node(title).first(), true);
});

When("I unfold {string}", async function (title) {
  await setFold(this.node(title).first(), false);
});

When("I fold the sidebar's {string}", async function (title) {
  await setFold(this.treeNode(title).first(), true);
});

Then("{string} is folded", async function (title) {
  await assertFolded(this.node(title).first(), true, title);
});

Then("{string} is unfolded", async function (title) {
  await assertFolded(this.node(title).first(), false, title);
});

Then("the sidebar's {string} is folded", async function (title) {
  await assertFolded(this.treeNode(title).first(), true, `sidebar ${title}`);
});

Then("the sidebar's {string} is unfolded", async function (title) {
  await assertFolded(this.treeNode(title).first(), false, `sidebar ${title}`);
});

// Hidden, not absent: a folded child is still in the document, so the
// "I do not see the title" step would be asserting the wrong thing.
Then("{string} is out of sight", async function (title) {
  await this.node(title).first().waitFor({ state: "hidden" });
});

// ---- helpers --------------------------------------------------------------

/** Click the toggle only when it is pointing the wrong way. It is a toggle, so
 *  a step that always clicked would mean "fold" or "unfold" by luck. */
async function setFold(node, want) {
  if ((await hasClass(node, "is-collapsed")) === want) return;
  await node.locator(TOGGLE).click();
}

async function assertFolded(node, want, what) {
  // Wait on the children first: it is the one part that settles late (an htmx
  // swap re-applies the fold after the new markup lands), and once it holds
  // the class and the ARIA state are already whatever they are going to be.
  const kids = node.locator(":scope > .ol-children");
  await kids.waitFor({ state: want ? "hidden" : "visible" });
  await assertClass(node, "is-collapsed", want, what);
  assert.equal(
    await node.locator(TOGGLE).getAttribute("aria-expanded"),
    want ? "false" : "true",
    `${what}: aria-expanded disagrees with the fold`,
  );
}
