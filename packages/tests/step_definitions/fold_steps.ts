/**
 * What this BROWSER remembers about folding — the storage behind
 * `features/folds_are_remembered.feature`.
 *
 * The folds themselves are pressed with the tree's own steps
 * (`outline_tree_steps.ts`) and the directory's (`outline_list_steps.ts`);
 * nothing here duplicates a gesture. What is here is the thing a scenario
 * cannot say through the screen: what is actually in storage.
 */

import * as assert from "node:assert";
import { Then } from "@cucumber/cucumber";

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
