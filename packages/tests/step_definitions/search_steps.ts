/**
 * `/search?q=…` — the everywhere page, and the gesture that widens onto it.
 *
 * The page is drawn out of the same reading every other page is (the `page`
 * stream), narrowed by the same box, lit by the same `filter/why.ts` — so most
 * of what a scenario asks about it is already `filter_steps.ts`'. What is here
 * is the three things that are this page's own: which FILES its rows are
 * grouped under, which DOCUMENTS came back beside them, and the WIDEN gesture
 * that got the reader here without retyping a word
 * (docs/brainstorming/one-search-box.md).
 */

import * as assert from "node:assert";
import { Given, Then, When } from "@cucumber/cucumber";

import {
  attr,
  FILTER_WIDEN,
  HIT,
  POLL_TIMEOUT,
  SEARCH_DOCUMENT,
  SEARCH_GROUP,
  SEARCH_PAGE,
  SEARCH_ROW,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** THE EVERYWHERE PAGE, COLD — the address, in a fresh document, with no
 *  gesture behind it. That is what makes `/search?q=…` a page rather than a
 *  popover: a link somebody can send, a bookmark, a pin on the shelf. */
Given(
  "I search everywhere for {string}",
  async function (this: OlaiWorld, query: string) {
    await this.open(`/search?q=${encodeURIComponent(query)}`);
    await this.page
      .locator(SEARCH_PAGE)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitForFrame();
  },
);

/** THE DOOR, PRESSED — the line under the count, which is the gesture the
 *  design is about: the same query, one press wider, and the words are never
 *  retyped because they are the address either way. */
When("I widen the filter", async function (this: OlaiWorld) {
  const door = this.page.locator(FILTER_WIDEN);
  await door.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  await door.click();
  await this.waitForFrame();
});

/** …and the same gesture as a KEY. The one search box in this app has no list
 *  under it, so `Enter` there was free; it now means *and now everywhere*. */
When("I press Enter in the filter box", async function (this: OlaiWorld) {
  await this.page.keyboard.press("Enter");
  await this.waitForFrame();
});

Then("the search page is open", async function (this: OlaiWorld) {
  await this.page
    .locator(SEARCH_PAGE)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/**
 * WHICH FILES the answer is grouped under, in the order the page draws them
 * (path order) — the whole point of the page, said as a list.
 *
 * The day page's own step is the model and the wording is deliberately its
 * sibling: a group is a file heading and what is under it, on both.
 */
Then(
  "the search groups are {string}",
  async function (this: OlaiWorld, files: string) {
    const wanted = files.split(",").map((one) => one.trim()).filter((one) => one !== "");
    let drawn: ReadonlyArray<string> = [];
    await this.waitUntil(async () => {
      drawn = (await this.page.locator(SEARCH_GROUP).evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-file") ?? "")
      ));
      return drawn.length === wanted.length && drawn.every((one, at) => one === wanted[at]);
    }, `the search page to be grouped by ${JSON.stringify(files)}`).catch(() => undefined);
    assert.deepStrictEqual([...drawn], wanted);
  },
);

/** One row of the page, by the title it draws. `SEARCH_ROW` is the `<li>`, so
 *  `hasText` reaches a row's own title and every title under it — which is why
 *  the assertions below that care about ancestry ask `data-match` instead. */
const searchRow = (world: OlaiWorld, title: string) =>
  world.page.locator(SEARCH_ROW).filter({ hasText: title }).last();

Then(
  "the search page lists the node {string}",
  async function (this: OlaiWorld, title: string) {
    await searchRow(this, title)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the search page lists no node {string}",
  async function (this: OlaiWorld, title: string) {
    // Read after a frame rather than polled: the absence has to be true NOW,
    // and waiting for it would pass on a page that drew the row a beat later.
    await this.waitForFrame();
    assert.strictEqual(
      await this.page.locator(SEARCH_ROW).filter({ hasText: title }).count(),
      0,
      `the search page lists ${JSON.stringify(title)}`,
    );
  },
);

Then(
  "the search page lists the document {string}",
  async function (this: OlaiWorld, file: string) {
    await this.page
      .locator(`${SEARCH_DOCUMENT}${attr("data-file", file)}`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

/**
 * WHY A ROW IS ON THE PAGE — the same `data-match` every filtered page
 * publishes, asked here because this page is where a reader most needs it: a
 * row can be a MATCH or the ancestry that leads to one, and until you can tell
 * which, a title that merely talks about `#next` and one that wears it read
 * exactly alike (`client/filter/why.ts`).
 */
Then(
  "the search row {string} is a match",
  async function (this: OlaiWorld, title: string) {
    const row = searchRow(this, title);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await row.getAttribute("data-match"), "true");
  },
);

Then(
  "the search row {string} is kept as context",
  async function (this: OlaiWorld, title: string) {
    const row = searchRow(this, title);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await row.getAttribute("data-match"), "false");
  },
);

/** One `key value` pair on a row's third line — the answer to "why is this
 *  here" for a `prop:` query, which is the line the deleted shortlist doors
 *  used to draw (`client/search/props.ts`). */
Then(
  "the search row {string} marks {string} as why it matched",
  async function (this: OlaiWorld, title: string, key: string) {
    const pair = searchRow(this, title)
      .locator(`[data-testid="search-row-prop"]${attr("data-key", key)}`);
    await pair.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await pair.getAttribute("data-matched"), "true");
    // …and it LEADS, because a line that has to be ellipsized shows its front.
    const first = searchRow(this, title)
      .locator(`[data-testid="search-row-prop"]`)
      .first();
    assert.strictEqual(await first.getAttribute("data-key"), key);
  },
);

Then(
  "the search row {string} shows the property {string} holding {string}",
  async function (this: OlaiWorld, title: string, key: string, value: string) {
    const pair = searchRow(this, title)
      .locator(`[data-testid="search-row-prop"]${attr("data-key", key)}`);
    await pair.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual((await pair.innerText()).trim(), `${key} ${value}`);
  },
);

/**
 * WHAT A ROW LIGHTS, by the node it draws rather than by what it says — the
 * needles the query found it by, read out of the row's own `<mark>`s.
 *
 * By ID, because the text is exactly what cannot be trusted here: a title with
 * a code span renders text that CONTAINS the bold title beside it, so a
 * scenario locating by label would assert about whichever row matched first.
 */
const searchNode = (world: OlaiWorld, id: string) =>
  world.page.locator(`${SEARCH_ROW}${attr("data-node-id", id)}`);

Then(
  "the search row for node {string} lights {string}",
  async function (this: OlaiWorld, id: string, said: string) {
    const row = searchNode(this, id);
    const read = async () =>
      (await row.locator(HIT).allInnerTexts()).join(" ");
    await this.waitUntil(
      async () => (await read()) === said,
      `the search row for \`${id}\` to light ${JSON.stringify(said)}`,
    ).catch(() => undefined);
    assert.strictEqual(
      await read(),
      said,
      `the search row for \`${id}\` does not light ${JSON.stringify(said)}`,
    );
  },
);

/** Press a row: Enter or a click goes to that node's page, which is what a hit
 *  is for once you can come back to it. */
When(
  "I press the search row {string}",
  async function (this: OlaiWorld, title: string) {
    await searchRow(this, title)
      .locator(`[data-testid="search-row-link"]`)
      .first()
      .click();
    await this.waitForFrame();
  },
);

When(
  "I press the search document {string}",
  async function (this: OlaiWorld, file: string) {
    await this.page
      .locator(`${SEARCH_DOCUMENT}${attr("data-file", file)} a`)
      .first()
      .click();
    await this.waitForFrame();
  },
);

Then(
  "the search page lists no document {string}",
  async function (this: OlaiWorld, file: string) {
    await this.waitForFrame();
    assert.strictEqual(
      await this.page.locator(`${SEARCH_DOCUMENT}${attr("data-file", file)}`).count(),
      0,
      `the search page lists ${JSON.stringify(file)}`,
    );
  },
);

/**
 * WHAT A DOCUMENT ROW CALLS IT — the face's title, asked by PATH so the
 * assertion cannot be satisfied by the thing it is about.
 *
 * A document whose title came off the wrong line would be found by the listing
 * step above and named wrong by this one, which is exactly the failure a `---`
 * block at the top of a `.md` used to produce.
 */
Then(
  "the search document {string} is called {string}",
  async function (this: OlaiWorld, file: string, title: string) {
    const row = this.page.locator(`${SEARCH_DOCUMENT}${attr("data-file", file)}`);
    await row.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual((await row.innerText()).split("\n")[0]?.trim(), title);
  },
);
