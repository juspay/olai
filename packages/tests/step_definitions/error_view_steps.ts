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
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";
import type { Locator } from "playwright";

/** Every error row's text, from wherever it is scoped. Read as one list so a
 *  failure can print what IS on screen — an error view that shows the wrong
 *  errors is much easier to fix when the message says which ones. */
const rowsIn = async (scope: Locator): Promise<Array<string>> =>
  (await scope.locator(ERROR_ROW).allInnerTexts()).map((text) =>
    text.replace(/\s+/g, " ").trim(),
  );

const groupFor = (world: OlaiWorld, file: string): Locator =>
  world.page.locator(`${ERROR_FILE_GROUP}[data-file="${file}"]`);

Then("the error view is shown", async function (this: OlaiWorld) {
  await this.page
    .locator(ERROR_VIEW)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then(
  "the error view shows an error with code {string}",
  async function (this: OlaiWorld, code: string) {
    const row = this.page.locator(`${ERROR_ROW}[data-code="${code}"]`);
    await row
      .first()
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT })
      .catch(() => undefined);
    assert.ok(
      (await row.count()) > 0,
      `no error with code "${code}" is listed; the view shows:\n  ` +
        (await rowsIn(this.page.locator(ERROR_VIEW))).join("\n  "),
    );
  },
);

Then(
  "an error is listed at {string}",
  async function (this: OlaiWorld, site: string) {
    const view = this.page.locator(ERROR_VIEW);
    await view.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const rows = await rowsIn(view);
    assert.ok(
      rows.some((text) => text.includes(site)),
      `no error names ${site}; the view shows:\n  ${rows.join("\n  ")}`,
    );
  },
);

Then(
  "the error group for {string} is shown",
  async function (this: OlaiWorld, file: string) {
    await groupFor(this, file).waitFor({
      state: "visible",
      timeout: HYDRATION_TIMEOUT,
    });
  },
);

Then(
  "the error group for {string} shows an error at {string}",
  async function (this: OlaiWorld, file: string, site: string) {
    const group = groupFor(this, file);
    await group.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const rows = await rowsIn(group);
    assert.ok(
      rows.some((text) => text.includes(site)),
      `the group for "${file}" does not name ${site}; it shows:\n  ${rows.join("\n  ")}`,
    );
  },
);

Then("the cross-file section is shown", async function (this: OlaiWorld) {
  await this.page
    .locator(CROSS_FILE_ERRORS)
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});

Then(
  "the cross-file section shows an error with code {string}",
  async function (this: OlaiWorld, code: string) {
    const section = this.page.locator(CROSS_FILE_ERRORS);
    await section.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const row = section.locator(`${ERROR_ROW}[data-code="${code}"]`);
    await row
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
    assert.ok(
      (await row.count()) > 0,
      `the cross-file section does not show a "${code}" error; it shows:\n  ` +
        (await rowsIn(section)).join("\n  "),
    );
  },
);

Then(
  "the cross-file section does not show an error with code {string}",
  async function (this: OlaiWorld, code: string) {
    const section = this.page.locator(CROSS_FILE_ERRORS);
    await section.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    assert.strictEqual(
      await section.locator(`${ERROR_ROW}[data-code="${code}"]`).count(),
      0,
      `a "${code}" error implicates one file only, so it belongs under that ` +
        `file rather than in the cross-file section`,
    );
  },
);
