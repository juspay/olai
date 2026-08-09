/**
 * The error view: what a broken set looks like.
 *
 * Every assertion here is about LOCATION as much as about the error — a code
 * with no `file:line` beside it is a stack trace with better manners, and the
 * whole point of the format's one-node-per-line rule is that the line is the
 * whole story.
 */

import * as assert from "node:assert";
import { Then } from "@cucumber/cucumber";

import {
  CROSS_FILE_ERRORS,
  ERROR_FILE_GROUP,
  ERROR_ROW,
  ERROR_VIEW,
  HYDRATION_TIMEOUT,
  oneLine,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";
import type { Locator } from "playwright";

/** Every error row's text, from wherever it is scoped. Read as one list so a
 *  failure can print what IS on screen — an error view that shows the wrong
 *  errors is much easier to fix when the message says which ones. */
const rowsIn = async (scope: Locator): Promise<Array<string>> =>
  (await scope.locator(ERROR_ROW).allInnerTexts()).map(oneLine);

const groupFor = (world: OlaiWorld, file: string): Locator =>
  world.page.locator(`${ERROR_FILE_GROUP}[data-file="${file}"]`);

/** Wait for a scope to appear. Every assertion below needs its scope on screen
 *  first, and the budget is the HYDRATION one for all of them: the scope IS
 *  the first paint after `goto` — a broken set renders the error view and its
 *  sections in that same first frame, so there is no interaction-scale wait to
 *  be had here.
 *
 *  Nothing INSIDE a visible scope gets that budget. Once the section is on
 *  screen its rows came out of the same render, so a row poll is only
 *  absorbing the frame between them: interaction scale, `POLL_TIMEOUT`. The
 *  two copies this replaced had drifted into disagreeing about that. */
const showScope = async (scope: Locator): Promise<void> => {
  await scope.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
};

/** Assert a scope lists an error carrying `code`. `what` names the scope the
 *  way the feature sentence does, so the failure reads as the scenario does. */
const expectCodeIn = async (
  scope: Locator,
  code: string,
  what: string,
): Promise<void> => {
  await showScope(scope);
  const row = scope.locator(`${ERROR_ROW}[data-code="${code}"]`);
  await row
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
    .catch(() => undefined);
  assert.ok(
    (await row.count()) > 0,
    `${what} lists no error with code "${code}"; it shows:\n  ` +
      (await rowsIn(scope)).join("\n  "),
  );
};

/** Assert a scope lists an error that names `site` — a `file:line`. Matched
 *  against the row's TEXT rather than an attribute: where the error happened
 *  has to be legible to the person reading the screen, not merely present in
 *  the markup. */
const expectSiteIn = async (
  scope: Locator,
  site: string,
  what: string,
): Promise<void> => {
  await showScope(scope);
  const rows = await rowsIn(scope);
  assert.ok(
    rows.some((text) => text.includes(site)),
    `${what} names no error at ${site}; it shows:\n  ${rows.join("\n  ")}`,
  );
};

Then("the error view is shown", async function (this: OlaiWorld) {
  await showScope(this.page.locator(ERROR_VIEW));
});

Then(
  "the error view shows an error with code {string}",
  async function (this: OlaiWorld, code: string) {
    await expectCodeIn(this.page.locator(ERROR_VIEW), code, "the error view");
  },
);

Then(
  "an error is listed at {string}",
  async function (this: OlaiWorld, site: string) {
    await expectSiteIn(this.page.locator(ERROR_VIEW), site, "the error view");
  },
);

Then(
  "the error group for {string} is shown",
  async function (this: OlaiWorld, file: string) {
    await showScope(groupFor(this, file));
  },
);

Then(
  "the error group for {string} shows an error at {string}",
  async function (this: OlaiWorld, file: string, site: string) {
    await expectSiteIn(groupFor(this, file), site, `the group for "${file}"`);
  },
);

Then("the cross-file section is shown", async function (this: OlaiWorld) {
  await showScope(this.page.locator(CROSS_FILE_ERRORS));
});

Then(
  "the cross-file section shows an error with code {string}",
  async function (this: OlaiWorld, code: string) {
    await expectCodeIn(
      this.page.locator(CROSS_FILE_ERRORS),
      code,
      "the cross-file section",
    );
  },
);

Then(
  "the cross-file section does not show an error with code {string}",
  async function (this: OlaiWorld, code: string) {
    const section = this.page.locator(CROSS_FILE_ERRORS);
    await showScope(section);
    assert.strictEqual(
      await section.locator(`${ERROR_ROW}[data-code="${code}"]`).count(),
      0,
      `a "${code}" error implicates one file only, so it belongs under that ` +
        `file rather than in the cross-file section`,
    );
  },
);
