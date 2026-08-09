/**
 * Editing the files underneath a running server, and asking what the page did
 * about it.
 *
 * The WRITES go through `world.writeServed`, which refuses unless the scenario
 * asked for a scratch copy — the shared corpora are tracked fixtures and every
 * other scenario is reading them.
 *
 * There are no assertions here about what an error SAYS: those are the same two
 * questions the error-view feature asks, and they live in `support/errors.ts`
 * so that both features ask them the same way. What is left is the handful of
 * steps that are about liveness itself — an outline marked unreadable, a banner
 * that has to go away.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import { expectCodeIn, expectSiteIn } from "../support/errors.ts";
import {
  OUTLINE_FAILURE,
  OUTLINE_LINK,
  POLL_TIMEOUT,
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

// ── one outline that could not be read ─────────────────────────────────

Then(
  "the outline {string} is marked unreadable",
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
    await expectSiteIn(this.page.locator(OUTLINE_FAILURE), site, "this outline's place");
  },
);

Then(
  "the outline failure shows an error with code {string}",
  async function (this: OlaiWorld, code: string) {
    await expectCodeIn(this.page.locator(OUTLINE_FAILURE), code, "this outline's place");
  },
);

// ── the whole set, held ────────────────────────────────────────────────

Then("the stale banner is shown", async function (this: OlaiWorld) {
  await this.page
    .locator(STALE_BANNER)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then("the stale banner is gone", async function (this: OlaiWorld) {
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
    await expectCodeIn(this.page.locator(STALE_BANNER), code, "the banner");
  },
);
