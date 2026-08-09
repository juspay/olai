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
  expectCodeIn,
  expectSiteIn,
  rowsIn,
  showScope,
} from "../support/errors.ts";
import { CROSS_FILE_ERRORS, ERROR_FILE_GROUP, ERROR_ROW, ERROR_VIEW } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";
import type { Locator } from "playwright";

const groupFor = (world: OlaiWorld, file: string): Locator =>
  world.page.locator(`${ERROR_FILE_GROUP}[data-file="${file}"]`);

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
