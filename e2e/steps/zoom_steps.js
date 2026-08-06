// Zooming: a node's own page (/n/<key>), and the trail back out of it.
//
// A key never appears in a scenario. It is minted by the load layer and is
// nobody's to type — what a person does is click a bullet, and what they get
// back is an address that is one node's. So the steps click, and assert the
// SHAPE of where they landed.

import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";

// Every node's address, whoever links to it: /n/ + the key.
const NODE_URL = /\/n\/[^/]+$/;

const CRUMBS = "nav.ol-breadcrumbs";

When("I zoom into {string}", async function (title) {
  await this.node(title).first().locator(":scope > .ol-row .ol-bullet-link").click();
  await this.page.waitForURL(NODE_URL);
});

When("I zoom into the sidebar's {string}", async function (title) {
  await this.treeNode(title).first().locator(".ol-tree-link").first().click();
  await this.page.waitForURL(NODE_URL);
});

When("I follow the breadcrumb {string}", async function (label) {
  await this.page.locator(`${CRUMBS} a.ol-crumb`, { hasText: label }).first().click();
});

Then("I am on a node's own page", async function () {
  assert.match(new URL(this.page.url()).pathname, NODE_URL);
});

Then("I am back on the home page", async function () {
  await this.page.waitForURL(this.url("/"));
});

// The tab is what a permalink is pasted into, so the node's title has to be on
// it — a page called "olai" says nothing about which node you sent someone.
Then("the tab is named for {string}", async function (title) {
  assert.match(await this.page.title(), new RegExp(title));
});

// The trail above the node, in order, as it reads: "home" first (it is always
// drawn), then the file, then each ancestor. The node itself is NOT a crumb —
// it is the thing you are looking at.
Then("the breadcrumbs read {string}", async function (trail) {
  const crumbs = this.page.locator(`${CRUMBS} .ol-crumb`);
  await crumbs.first().waitFor({ state: "visible" });
  const read = (await crumbs.allInnerTexts()).map((s) => s.trim());
  assert.deepEqual(read, trail.split(" > "));
});

Then("the page says there is no such node", async function () {
  await this.page.getByText("No such node.").first().waitFor({ state: "visible" });
});
