/**
 * Asserting about error rows, wherever they are drawn.
 *
 * The client shows errors in four places — the whole page, the banner over a
 * last-good tree, one outline's own pane, the cross-file section — and a
 * scenario asks the same two questions of all of them: does this scope carry an
 * error with that code, and does it name that `file:line`. Those two questions
 * live here rather than in whichever step file asked first, so the two features
 * that ask them cannot drift into asserting them differently — which they had.
 *
 * Every assertion quotes what IS on screen when it fails. An error view showing
 * the wrong errors is enormously easier to fix when the message says which ones
 * it showed.
 */

import * as assert from "node:assert";
import type { Locator } from "playwright";

import { ERROR_ROW, HYDRATION_TIMEOUT, oneLine, POLL_TIMEOUT } from "./world.ts";

/** Every error row's text under a scope, flattened to one line each. */
export const rowsIn = async (scope: Locator): Promise<Array<string>> =>
  (await scope.locator(ERROR_ROW).allInnerTexts()).map(oneLine);

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
export const showScope = async (scope: Locator): Promise<void> => {
  await scope.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
};

/** Assert a scope lists an error carrying `code`. `what` names the scope the
 *  way the feature sentence does, so the failure reads as the scenario does. */
export const expectCodeIn = async (
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
export const expectSiteIn = async (
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
