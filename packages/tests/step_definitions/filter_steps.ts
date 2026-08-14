/**
 * The filter over the page: the box, what it found, what it refused, and the
 * `#tag` that fills it.
 *
 * Its own file rather than more of `./outline_tree_steps.ts` for the reason the
 * palette left `./panel_steps.ts`: a filter is a reading of the page and not a
 * fact about a row — it has an address, a grammar and a sentence of its own
 * when it finds nothing.
 *
 * WAITED FOR, never read once. Every assertion here follows a keystroke that
 * re-renders the tree, and reading a count or an attribute in the same tick
 * races the frame that produced it — so each one goes through the suite's own
 * two waits: a locator where a selector can express the question, and
 * `world.waitUntil` where it cannot ("this count has changed").
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import { saysThat } from "../support/said.ts";
import {
  FILTER_BAR,
  FILTER_CLEAR,
  FILTER_COUNT,
  FILTER_INPUT,
  FILTER_REFUSAL,
  NODE,
  nodeSelector,
  OUTLINE_TREE,
  POLL_TIMEOUT,
  SEARCH_REFUSAL,
  TAG,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** Every row the tree draws — the ones a reader counts. Scoped to the tree, so
 *  a zoomed page's own heading (which is a node too, and says so) is not one. */
const rows = (world: OlaiWorld) => world.page.locator(`${OUTLINE_TREE} ${NODE}`);

// ── typing ─────────────────────────────────────────────────────────────

When(
  "I filter the page by {string}",
  async function (this: OlaiWorld, text: string) {
    const box = this.page.locator(FILTER_INPUT);
    await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await box.fill(text);
    await this.waitForFrame();
  },
);

When("I clear the filter", async function (this: OlaiWorld) {
  await this.press(this.page.locator(FILTER_CLEAR));
});

// ── what it drew ───────────────────────────────────────────────────────

Then(
  "the outline has {int} rows",
  async function (this: OlaiWorld, expected: number) {
    await this.waitUntil(
      async () => (await rows(this).count()) === expected,
      `the outline has ${expected} rows`,
    );
  },
);

Then(
  "the filter found {string}",
  async function (this: OlaiWorld, said: string) {
    // The count settles a frame after the query. Waited for here because a
    // sentence that CHANGES is not a selector; read and reported by the
    // suite's one reader (`support/said.ts`), so a failure says what the bar
    // actually says.
    await this.waitUntil(
      async () =>
        (await this.page.locator(FILTER_COUNT).innerText().catch(() => "")).includes(
          said,
        ),
      `the filter says ${JSON.stringify(said)}`,
    ).catch(() => undefined);
    await saysThat(this, FILTER_COUNT, said, "filter count");
  },
);

/** SELECTED by the query, rather than kept as the ancestry that leads to one.
 *  The distinction is the whole of "filter in place": a page of matches with
 *  no context is a result list, and context that cannot be told from a match
 *  is a page that lies about what it found. */
Then(
  "the node {string} is a match",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(
      nodeSelector(id),
      "data-match",
      "true",
      `node \`${id}\``,
    );
  },
);

Then(
  "the node {string} is context",
  async function (this: OlaiWorld, id: string) {
    await this.expectAttribute(
      nodeSelector(id),
      "data-match",
      "false",
      `node \`${id}\``,
    );
  },
);

/** The token AND what the operator takes — the second half is the whole point.
 *  A refusal naming the typo without saying what would have worked is a
 *  refusal that leaves the reader exactly where they were. The TONE is asserted
 *  through the same `data-tone` fact every other said-line in this suite is
 *  read by (`support/said.ts`). */
Then(
  "the filter refuses {string} and says {string}",
  async function (this: OlaiWorld, token: string, teaching: string) {
    await saysThat(this, FILTER_REFUSAL, token, "filter refusal", "alarm");
    await saysThat(this, FILTER_REFUSAL, teaching, "filter refusal");
  },
);

/** The SAME refusal, on a door that had to ask the server for it. One step for
 *  both of those doors, because it is one sentence about one grammar. */
Then(
  "the search refuses {string} and says {string}",
  async function (this: OlaiWorld, token: string, teaching: string) {
    await saysThat(this, SEARCH_REFUSAL, token, "search refusal");
    await saysThat(this, SEARCH_REFUSAL, teaching, "search refusal");
  },
);

// ── the box itself ─────────────────────────────────────────────────────

Then(
  "the filter box holds {string}",
  async function (this: OlaiWorld, text: string) {
    const box = this.page.locator(FILTER_INPUT);
    await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(await box.inputValue(), text);
  },
);

Then("there is no filter bar", async function (this: OlaiWorld) {
  assert.strictEqual(
    await this.page.locator(FILTER_BAR).count(),
    0,
    "a filter box is drawn on a page whose address has nowhere to keep one",
  );
});

// ── the address, query and all ─────────────────────────────────────────

/** Not `the address is` — that step reads the PATH, and every scenario using
 *  it would go on passing over a page that is also filtered. This is the whole
 *  bar, which is what a filtered page's link actually is. */
Then(
  "the address is exactly {string}",
  async function (this: OlaiWorld, address: string) {
    await this.page
      .waitForURL((url) => url.pathname + url.search === address, {
        timeout: POLL_TIMEOUT,
      })
      .catch(() => undefined);
    assert.strictEqual(this.address(), address);
  },
);

// ── the tag, pressed ───────────────────────────────────────────────────

When("I press the tag {string}", async function (this: OlaiWorld, tag: string) {
  await this.press(this.page.locator(TAG).filter({ hasText: tag }).first());
});
