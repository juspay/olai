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
 * races the frame that produced it — so each one is a selector that only
 * matches when the page has settled on the answer.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

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
  TAG,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** Every row the tree draws — the ones a reader counts. Scoped to the tree, so
 *  a zoomed page's own heading (which is a node too, and says so) is not one. */
const rows = (world: OlaiWorld) =>
  world.page.locator(`${OUTLINE_TREE} ${NODE}`);

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
    // Polled through Playwright's own retrying assertion shape: a count read
    // once is a count read in whichever frame the keystroke happened to land.
    await this.page
      .waitForFunction(
        ([selector, want]) =>
          document.querySelectorAll(selector as string).length === want,
        [`${OUTLINE_TREE} ${NODE}`, expected] as const,
        { timeout: POLL_TIMEOUT },
      )
      .catch(() => undefined);
    assert.strictEqual(await rows(this).count(), expected);
  },
);

Then(
  "the filter found {string}",
  async function (this: OlaiWorld, said: string) {
    const count = this.page.locator(FILTER_COUNT);
    await count.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await count
      .filter({ hasText: said })
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
    assert.ok(
      (await count.innerText()).includes(said),
      `the filter says "${await count.innerText()}", not "${said}"`,
    );
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

Then(
  "the filter refuses {string} and says {string}",
  async function (this: OlaiWorld, token: string, teaching: string) {
    const line = this.page.locator(FILTER_REFUSAL).first();
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const said = await line.innerText();
    assert.ok(said.includes(token), `the refusal does not name \`${token}\`: ${said}`);
    assert.ok(
      said.includes(teaching),
      `the refusal does not say what the operator takes: ${said}`,
    );
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

Then("the filter box is empty", async function (this: OlaiWorld) {
  const box = this.page.locator(FILTER_INPUT);
  await box.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(await box.inputValue(), "");
});

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
  await this.press(
    this.page.locator(TAG).filter({ hasText: tag }).first(),
  );
});
