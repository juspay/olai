import * as assert from "node:assert";
import { Then } from "@olai/tests/harness/runner.ts";

import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const FOLDS_KEY = "olai.folds";
const FOLDERS_KEY = "olai.sidebar.folders";

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
    await this.waitUntil(held, `"${id}" to be folded in "${file}"`).catch(() =>
      assert.fail(
        `this browser keeps ${seen ?? "nothing"} under ${FOLDS_KEY}, which does not ` +
          `fold "${id}" in "${file}" — a fold is remembered by NODE ID, under the ` +
          "file that node is DEFINED in, whichever outline it was folded from",
      )
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
