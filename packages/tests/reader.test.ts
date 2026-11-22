/**
 * THE READING COMPANION A SCENARIO RUNS IS THE ONE THE GUIDE SHOWS.
 *
 * `fixtures/reader/plugins/reader/` is the plugin
 * `packages/plugins/vault-plugins/e2e/features/the_reading_companion.feature`
 * turns on, and each of its files the guide prints is printed whole under a
 * `` `<file>`: `` label in `website/docs/`. A fixture that drifted from the page
 * would prove something about code no reader was shown, so the two are held
 * equal here: change the page, then copy it into the fixture.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test } from "bun:test";

import { ROOT } from "./support/sweep.ts";

const FOLDER = path.join(ROOT, "packages", "tests", "fixtures", "reader", "plugins", "reader");

/** Where each printed file of the fixture is printed. */
const PRINTED: ReadonlyArray<readonly [file: string, page: string]> = [
  ["types.ts", "dynamic-plugins-examples.md"],
  ["pairs.ts", "dynamic-plugins-examples.md"],
  ["words.ts", "dynamic-plugins-examples.md"],
  ["lib/sm2.ts", "dynamic-plugins-examples.md"],
  ["server.ts", "dynamic-plugins-examples.md"],
  ["columns.tsx", "dynamic-plugins-examples.md"],
  ["browser.tsx", "dynamic-plugins-examples.md"],
];

for (const [file, page] of PRINTED) {
  test(`the reader's ${file} is the one ${page} prints`, () => {
    const text = fs.readFileSync(path.join(ROOT, "website", "docs", page), "utf8");
    const blocks = [...text.matchAll(new RegExp("`" + file.replaceAll(".", "\\.") + "`:\\n+```[a-z]*\\n([\\s\\S]*?)```", "g"))]
      .map((hit) => hit[1] ?? "");
    // A page with several examples prints an entry once per example; the
    // reader's is the one that names it.
    const printed = blocks.length === 1 ? blocks : blocks.filter((block) => block.includes(`name: "reader"`));
    expect(printed.length).toBe(1);
    expect(fs.readFileSync(path.join(FOLDER, file), "utf8").trimEnd()).toBe(printed[0]!.trimEnd());
  });
}
