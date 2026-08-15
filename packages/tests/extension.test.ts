/**
 * The rename, held as a sweep rather than as a sentence.
 *
 * Outlines are `.olai` files. They were `.jsonl` files, across 174 of them —
 * source, docstrings, fixture names, Gherkin, testids — and a rename that size
 * has exactly one failure mode: not that it breaks, but that it is 99% done.
 * A survivor is silent. `fileKind` no longer claims the suffix, so a fixture
 * still named `house.jsonl` is a file the server does not serve and a scenario
 * that times out thirty seconds later saying nothing about why; a docstring
 * still describing `.jsonl` is a sentence the next reader believes.
 *
 * So the string is banned under `packages/` — everywhere but the one test that
 * proves it is unclaimed — and the ban is what makes the cutover atomic going
 * forward too: a new module written next month with `endsWith(".jsonl")` in it
 * — or a doc comment copied out of git history — fails here, named by file, on
 * the run that introduces it.
 *
 * It lives in `@olai/tests` because this is the only package ABOVE all the
 * others. `@olai/format` owns the extension and would be the obvious home, but
 * a sweep there would be the floor reading the client, which is the layering
 * `ops`' own manifest refuses in the other direction.
 *
 * **The DOT is the whole pattern.** `JSONL` names the CONTENT format, and the
 * content did not change: one JSON object per line, byte for byte what it was.
 * `format/src/write.ts` explaining that a record is one line "because the format
 * is JSONL" is a true sentence and must stay sayable. What may not appear is
 * `.jsonl` — a file extension, which is the thing that moved.
 *
 * The `docs/` tree is deliberately out of scope. `docs/brainstorming/` and
 * `docs/RCA/` are dated records of decisions and incidents, and one of them is
 * the argument for this rename ("is it time for `.olai` instead of `.jsonl`?");
 * rewriting them would falsify what was actually argued. Prose that describes
 * the PRESENT — `docs/*.md`, README, website — was renamed with everything else
 * and has this suite's own e2e scenarios standing behind it.
 */

import { expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

/** The `packages/` directory, from this file's own location. */
const PACKAGES = path.dirname(import.meta.dirname);

const SELF = import.meta.filename;

/** Directories no rename could reach and nobody edits by hand. `dist` and
 *  `node_modules` are build output; a dot-directory is not content, the same
 *  rule the store's own walk prunes by. */
const SKIP = new Set(["node_modules", "dist"]);

/** Every file under `packages/` a person wrote, as absolute paths. Not filtered
 *  by extension: the point is that NOTHING says it, and a `.feature`, a
 *  `README.md`, an `index.html` and a fixture outline are all places the old
 *  spelling actually lived. This file is excluded — it quotes what it hunts,
 *  and a sweep that caught its own net teaches the next reader to weaken the
 *  pattern rather than fix the code. */
const authored = (directory: string): ReadonlyArray<string> =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(entry.parentPath, entry.name);
      if (entry.isDirectory()) {
        return SKIP.has(entry.name) || entry.name.startsWith(".")
          ? []
          : authored(full);
      }
      return entry.isFile() && full !== SELF ? [full] : [];
    });

const SOURCES = authored(PACKAGES);

// A guard on the sweep itself: a walk that quietly returned nothing — a moved
// file, a pruning rule that grew — would pass every assertion below while
// checking not one line. The number is a floor, not a count.
test("the sweep is actually reading the tree", () => {
  expect(SOURCES.length).toBeGreaterThan(200);
});

// ONE file may say it, and the expectation is written as that list rather than
// as "empty" for `claims.test.ts`' reason one package over: an equality keeps
// the sweep honest, because a pattern that rotted would report an empty list
// here — a green run that checked nothing — instead of passing quietly.
//
// The one is `@olai/format`'s own `node.test.ts`, which asserts that `fileKind`
// does NOT claim the suffix. That is the cutover itself, and it has to be
// written out to be tested. A second name on this list is a survivor.
test("only the test that proves it is unclaimed may spell the old extension", () => {
  const spelling = /\.jsonl/i;
  const survivors = SOURCES
    .filter((full) => spelling.test(fs.readFileSync(full, "utf8")))
    .map((full) => path.relative(PACKAGES, full))
    .sort();
  expect(survivors).toEqual([path.join("format", "src", "node.test.ts")]);
});

// The other half, and the one a `git mv` gets wrong rather than a `sed`: a file
// whose NAME still carries it. The fixtures are the whole corpus every e2e
// scenario runs against, and one left behind is a directory the server serves
// one file short of what the scenario expects.
test("no file under packages/ is still named with it", () => {
  const named = SOURCES
    .filter((full) => full.toLowerCase().endsWith(".jsonl"))
    .map((full) => path.relative(PACKAGES, full))
    .sort();
  expect(named).toEqual([]);
});
