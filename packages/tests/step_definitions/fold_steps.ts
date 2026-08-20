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

/** Which file a fold is filed under, as the entry actually holds it.
 *
 *  POLLED rather than read once, because a fold is filed twice: the press
 *  writes it under the file the row said, and the app then asks the server
 *  where that id now LIVES and re-files what moved (`fold/refiling.ts`,
 *  settled and a round trip behind the click). Read once, the second of those
 *  is a race — and a step that happened to run before it would be asserting
 *  about the entry mid-thought. */
Then(
  "this browser remembers {string} folded in {string}",
  async function (this: OlaiWorld, id: string, file: string) {
    let seen: string | null = null;
    const held = async () => {
      seen = await this.stored(FOLDS_KEY);
      if (seen === null) return false;
      const folds = JSON.parse(seen) as Record<string, ReadonlyArray<string>>;
      return (folds[file] ?? []).includes(id);
    };
    if (await held()) return;
    // The wait's own words say what is being waited for; what the entry
    // actually held is only knowable once the waiting is over, which is why
    // the sentence that names it is thrown from here rather than passed in.
    try {
      await this.waitUntil(held, `"${id}" to be folded in "${file}"`);
    } catch {
      assert.fail(
        `this browser keeps ${seen ?? "nothing"} under ${FOLDS_KEY}, which does not ` +
          `fold "${id}" in "${file}" — a fold is remembered by NODE ID, under the ` +
          "file that node is DEFINED in, whichever outline it was folded from",
      );
    }
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
