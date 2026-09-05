/**
 * THE FIXTURE'S PLUGIN IS THE DOC'S PLUGIN, and this is what says so.
 *
 * ## The failure this exists to make impossible
 *
 * `docs/dynamic-plugins.md`'s worked example is a morning agenda; the corpus at
 * `fixtures/morning-agenda/` holds the same source as the note of a node, and
 * `features/the_morning_agenda.feature` runs it. Three places then said, in
 * prose, that the two are one file apart from two clock constants — the
 * feature's own header, the fixtures README, and a comment inside the fixture.
 *
 * Prose is not a mechanism. The copies were forked identical and nothing
 * reconciled them, so the claim was true for exactly as long as nobody improved
 * the doc: `@olai/server`'s `worked.test.ts` COMPILES the doc's copy, this suite
 * RUNS the fixture's, and neither had ever compared them. The first edit to the
 * page — a corrected field read, a failure reported instead of swallowed —
 * leaves the doc green, the fixture green, and the e2e no longer evidence for
 * the thing the page promises a person they can paste.
 *
 * That is the same shape `worked.test.ts` was itself written against, one
 * directory over and in its own words: *"A test that held its own copy of the
 * example would have compiled that copy happily while the doc went on saying
 * something else."* This suite held such a copy, and it was the copy that ran.
 *
 * ## Why HERE, and why no fenced-block reader
 *
 * `@olai/tests` is the package above all the others (`support/sweep.ts`), which
 * is where a claim about two files in two other packages belongs — the same
 * argument `plugin_docs.test.ts` makes for its own sweep over `docs/`.
 *
 * And it needs no markdown parser. `worked.test.ts` extracts fenced blocks
 * because it must hand one to a compiler; this only has to know that the page
 * CONTAINS the fixture's source, so it substitutes the two constants back and
 * asks `includes`. One string search, no second extractor to keep in step with
 * the first, and a failure that names which half moved.
 *
 * ## What is NOT claimed
 *
 * That the fixture is the whole example, or that the page has one. It is a
 * containment: whatever else the page grows, the source this suite runs is on
 * it, verbatim, with two named lines swapped. The two are named below and both
 * are asserted to have matched — a substitution that silently found nothing
 * would turn this into a test of two identical strings.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test } from "bun:test";

import { ROOT } from "./support/sweep.ts";

const DOC = path.join(ROOT, "docs", "dynamic-plugins.md");
const FIXTURE = path.join(ROOT, "packages", "tests", "fixtures", "morning-agenda", "morning-agenda.olai");

/**
 * THE TWO LINES THAT MAY DIFFER, and the whole list of them.
 *
 * Both are the clock, and both are why: a scenario cannot sit out five minutes
 * and cannot wait until seven in the morning. Anything else differing is drift.
 */
const CLOCK: ReadonlyArray<readonly [fixture: string, doc: string]> = [
  ["const AT_HOUR = 0", "const AT_HOUR = 7"],
  [`const EVERY = "1 second"`, `const EVERY = "5 minutes"`],
];

/** The `server.ts` half out of the fixture — read as the outline it is, by the
 *  node's title, rather than by a line number that a second row would move. */
const halfInFixture = (): string => {
  const rows = fs.readFileSync(FIXTURE, "utf8").split("\n").filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as { readonly title?: string; readonly desc?: string });
  const half = rows.find((row) => row.title === "server.ts")?.desc;
  if (half === undefined) throw new Error(`${FIXTURE} has no node titled server.ts carrying a note`);
  return half;
};

test("the fixture's morning agenda is the doc's, with the two clock lines swapped", () => {
  let source = halfInFixture();
  for (const [fixture, doc] of CLOCK) {
    // A substitution that matched nothing is the failure this guard is for: it
    // would leave the comparison below passing on a source that never carried
    // the line, which is drift wearing agreement's face.
    expect(source).toContain(fixture);
    source = source.replace(fixture, doc);
  }
  const page = fs.readFileSync(DOC, "utf8");
  if (page.includes(source)) return;
  // The equality is a `includes`, so a failure has to say WHERE — otherwise a
  // reader gets "false is not true" about two hundred-line strings.
  const wandered = source.split("\n").find((line) => !page.includes(line));
  throw new Error(
    `fixtures/morning-agenda/ has drifted from docs/dynamic-plugins.md.\n`
      + `The first line of the fixture's server half the page does not carry:\n`
      + `  ${wandered ?? "(every line is on the page, so the drift is in their order)"}\n`
      + `Regenerate the fixture from the page, or change the page.`,
  );
});
