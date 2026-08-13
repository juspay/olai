/**
 * What this BROWSER remembers about folding — the storage behind
 * `features/folds_are_remembered.feature`, and the second tab that proves the
 * memory belongs to the browser rather than to one document.
 *
 * The folds themselves are pressed with the tree's own steps
 * (`outline_tree_steps.ts`) and the directory's (`outline_list_steps.ts`);
 * nothing here duplicates a gesture. What is here is the two things a scenario
 * cannot say through the screen: what is actually in storage, and what another
 * tab of the same browser does to this one.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  HYDRATION_TIMEOUT,
  nodeSelector,
  POLL_TIMEOUT,
  TOGGLE,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** The keys the client writes. Spelled here rather than imported from the
 *  client, deliberately: a scenario about what a browser REMEMBERS is a
 *  scenario about the entry a reader's browser is actually carrying, and a
 *  constant imported from the code under test would rename itself along with
 *  the thing it is supposed to pin. */
const FOLDS_KEY = "olai.folds";
const FOLDERS_KEY = "olai.sidebar.folders";

Then(
  "this browser remembers {string} folded in {string}",
  async function (this: OlaiWorld, id: string, file: string) {
    const raw = await this.stored(FOLDS_KEY);
    assert.ok(raw !== null, `this browser has nothing under ${FOLDS_KEY}`);
    const folds = JSON.parse(raw) as Record<string, ReadonlyArray<string>>;
    assert.ok(
      (folds[file] ?? []).includes(id),
      `this browser keeps ${raw} under ${FOLDS_KEY}, which does not fold ` +
        `"${id}" in "${file}" — a fold is remembered by NODE ID, under the ` +
        "file that node is DEFINED in, whichever outline it was folded from",
    );
  },
);

Then("this browser remembers no folds", async function (this: OlaiWorld) {
  // The other half of the shape: what is stored is what has been SHUT, so a
  // reader who opened everything again leaves no entry behind rather than one
  // listing every node they have ever touched.
  assert.strictEqual(
    await this.stored(FOLDS_KEY),
    null,
    `this browser still keeps something under ${FOLDS_KEY}`,
  );
});

Then(
  "this browser remembers the folder {string} open",
  async function (this: OlaiWorld, path: string) {
    const raw = await this.stored(FOLDERS_KEY);
    assert.ok(raw !== null, `this browser has nothing under ${FOLDERS_KEY}`);
    const open = JSON.parse(raw) as ReadonlyArray<string>;
    assert.ok(
      open.includes(path),
      `this browser keeps ${raw} under ${FOLDERS_KEY}, which does not hold ` +
        `"${path}" open`,
    );
  },
);

/**
 * A SECOND page in the same context, which is what makes it a second tab of the
 * same browser rather than a second browser: one origin, one `localStorage`, and
 * the `storage` event this app listens for fires in every document of it except
 * the one that wrote.
 *
 * Driven through the triangle rather than through `setItem`, so what crosses is
 * a fold somebody actually pressed. Left open on purpose, exactly as the theme's
 * twin and the Done default's are: a preference that only crossed once the other
 * tab was gone would pass a scenario that closed it.
 */
When(
  "a second tab collapses the node {string}",
  async function (this: OlaiWorld, id: string) {
    const other = await this.context.newPage();
    await other.goto(this.pathname());
    // `nodeSelector`, not a bare `data-node-id`: a zoomed page puts that
    // attribute on its heading as well as on its rows, so the unscoped
    // spelling would match two things and quietly press whichever came first.
    const row = other.locator(nodeSelector(id)).first();
    await row.waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
    const toggle = row.locator(TOGGLE).first();
    await toggle.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await toggle.click();
    await other
      .locator(`${nodeSelector(id)}[data-collapsed="true"]`)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .catch(() => {
        throw new Error(
          `the second tab never folded "${id}", so there was nothing for this ` +
            "one to hear",
        );
      });
  },
);
