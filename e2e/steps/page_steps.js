// Getting to a page, and the chrome that is on every one of them: the
// sidebar, the error banner, and whether this is still the same page load.

import assert from "node:assert/strict";
import * as path from "node:path";
import { Given, Then, When } from "@cucumber/cucumber";

import { escapeRx } from "../support/dom.js";

// ---- navigation -------------------------------------------------------------

When("I open the home page", async function () {
  await this.open("/");
});

When("I open the Today page", async function () {
  await this.open("/today");
});

When("I reload the page", async function () {
  await this.page.reload();
});

When("I follow the sidebar's Today link", async function () {
  await sidebarLink(this, "/today").click();
  await this.page.waitForURL(this.url("/today"));
});

When("I follow the sidebar's Archive link", async function () {
  await sidebarLink(this, "/archive").click();
  await this.page.waitForURL(this.url("/archive"));
});

// ---- one page load ----------------------------------------------------------
//
// The live view swaps a region of the page; a reload replaces the page. They
// look the same from the outside, and only one of them is the feature.

Given("I mark this page load", async function () {
  await this.mark();
});

Then("the page has not reloaded", async function () {
  assert.equal(await this.marked(), true, "the mark is gone: the page reloaded");
});

// And the one case where a reload is the FEATURE: the page was drawn by a
// process that is gone, so its markup, its scripts and its stream address all
// belong to a server that no longer exists. Polled rather than asserted once —
// the reload is the browser's, on the reload frame's arrival, and the step
// before this one only started the new server.
Then("the page has reloaded", async function () {
  await this.waitForReload();
});

// ---- the sidebar ------------------------------------------------------------

Then("the sidebar lists {string}", async function (title) {
  await this.treeNode(title).first().waitFor({ state: "visible" });
});

// Nowhere in the column: not a tree link, and not a line of text either. The
// tree-link count alone passed vacuously for anything the sidebar draws some
// OTHER way — a file's label, the journal's month — which is exactly what a
// step saying "not in the sidebar" gets asked about. A count and a read, like
// "I do not see the title": sound about a page that has finished loading, and
// says nothing about one mid-swap.
Then("the sidebar does not list {string}", async function (title) {
  assert.equal(
    await this.treeNode(title).count(),
    0,
    `${title} is in the sidebar tree`,
  );
  const text = await this.page.locator("#ol-sidebar").innerText();
  assert.ok(!text.includes(title), `${title} is in the sidebar`);
});

Then("the sidebar links to {string}", async function (href) {
  await sidebarLink(this, href).waitFor({ state: "visible" });
});

function sidebarLink(world, href) {
  return world.page.locator(`#ol-sidebar a[href="${href}"]`).first();
}

// ---- the error banner -------------------------------------------------------
//
// The store saying "this file does not load, here is the last good page
// anyway". role=alert is the part a screen reader gets, so that is what gets
// addressed.

Then(
  "the error banner names the file, with a line and a column",
  async function () {
    const banner = this.page.locator('.ol-error[role="alert"]');
    await banner.waitFor({ state: "visible" });
    const where = banner.locator(".ol-error-where");
    // which file it is, is the world's to say — it named the temp outline
    const file = escapeRx(path.basename(this.outlinePath));
    assert.match((await where.innerText()).trim(), new RegExp(`${file}:\\d+:\\d+$`));
  },
);

Then("the error banner clears", async function () {
  await this.page.locator(".ol-error").waitFor({ state: "detached" });
});
