/**
 * Editing the files underneath a running server, and asking what the page did
 * about it.
 *
 * Two kinds of step live here and only here. The WRITES go through
 * `world.writeServed`, which refuses unless the scenario asked for a scratch
 * copy — the shared corpora are tracked fixtures and every other scenario is
 * reading them. The ASSERTIONS are the ones a Playwright selector cannot state
 * on its own: text that has to CHANGE, an element that has to GO. A selector
 * retries until something matches, which is the wrong tool for "it is no longer
 * there" and, worse, silently passes for "it already said that".
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  ERROR_ROW,
  OUTLINE_FAILURE,
  OUTLINE_LINK,
  POLL_TIMEOUT,
  oneLine,
  STALE_BANNER,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── writing ────────────────────────────────────────────────────────────

When(
  "I rewrite {string} as:",
  function (this: OlaiWorld, file: string, contents: string) {
    this.writeServed(file, contents);
  },
);

When("I delete {string}", function (this: OlaiWorld, file: string) {
  this.removeServed(file);
});

// ── the tree, after ────────────────────────────────────────────────────

Then(
  "the node {string} eventually has the title {string}",
  async function (this: OlaiWorld, id: string, expected: string) {
    const title = this.nodeTitle(id);
    await this.waitUntil(
      async () =>
        (await title.count()) > 0 &&
        oneLine(await title.innerText()).replace(/#/g, "").trim() ===
          oneLine(expected).replace(/#/g, "").trim(),
      `the node "${id}" says ${JSON.stringify(expected)}`,
    );
  },
);

// ── one outline that could not be read ─────────────────────────────────

Then(
  "the outline {string} is eventually marked unreadable",
  async function (this: OlaiWorld, file: string) {
    await this.page
      .locator(`${OUTLINE_LINK}[data-file="${file}"][data-broken="true"]`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

When(
  "I open the unreadable outline {string}",
  async function (this: OlaiWorld, file: string) {
    // Not "I open the outline": that step waits for a tree, and the whole point
    // of this one is that there will never be a tree to wait for.
    await this.outlineLink(file).click();
    await this.page
      .locator(`${OUTLINE_FAILURE}[data-file="${file}"]`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the outline failure shows an error at {string}",
  async function (this: OlaiWorld, site: string) {
    await expectSomeError(this, OUTLINE_FAILURE, (text) => text.includes(site), site);
  },
);

Then(
  "the outline failure shows an error with code {string}",
  async function (this: OlaiWorld, code: string) {
    assert.ok(
      (await this.page.locator(`${OUTLINE_FAILURE} ${ERROR_ROW}[data-code="${code}"]`)
        .count()) > 0,
      `no error with code "${code}" is shown in this outline's place`,
    );
  },
);

// ── the whole set, held ────────────────────────────────────────────────

Then("the stale banner is eventually shown", async function (this: OlaiWorld) {
  await this.page
    .locator(STALE_BANNER)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the stale banner is eventually gone", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(STALE_BANNER).count()) === 0,
    "the banner is gone, so the set on disk validates again",
  );
});

Then("no stale banner is shown", async function (this: OlaiWorld) {
  // No wait: this asserts that a degrade did NOT escalate to holding the whole
  // set, and waiting for a banner that must not appear would only make the
  // suite slower at saying so. The step before it has already waited for the
  // change to land.
  assert.strictEqual(
    await this.page.locator(STALE_BANNER).count(),
    0,
    "the last-good banner is on screen; this change should have cost one outline, not the set",
  );
});

Then(
  "the stale banner shows an error with code {string}",
  async function (this: OlaiWorld, code: string) {
    assert.ok(
      (await this.page.locator(`${STALE_BANNER} ${ERROR_ROW}[data-code="${code}"]`)
        .count()) > 0,
      `no error with code "${code}" is in the banner`,
    );
  },
);

/** Some error row under `scope` whose text matches, or a failure quoting every
 *  row that is there — a bare "false is not true" for a missing error is the
 *  least useful thing this suite could say. */
const expectSomeError = async (
  world: OlaiWorld,
  scope: string,
  matches: (text: string) => boolean,
  wanted: string,
): Promise<void> => {
  const rows = await world.page.locator(`${scope} ${ERROR_ROW}`).allInnerTexts();
  assert.ok(
    rows.some((row) => matches(oneLine(row))),
    `no error mentioning ${JSON.stringify(wanted)}; the ${rows.length} shown are:\n  ${
      rows.map(oneLine).join("\n  ")
    }`,
  );
};
