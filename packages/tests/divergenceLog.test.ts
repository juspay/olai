/**
 * THE FLIP'S GATE AND THE FILE THE PROCESS WRITES ARE ONE FILE.
 *
 * The incremental validator runs as a shadow and a divergence is appended to a
 * log; the flip that makes the narrowed verdict authoritative is gated on that
 * log being EMPTY. So the gate is a claim about a path, and a gate naming a
 * path nothing writes is a green nobody earned — the log would be absent
 * forever, every divergence would land somewhere else, and the flip would sail
 * through on a file that was never the file.
 *
 * That is not hypothetical. This suite exists because it HAPPENED: the log was
 * first named with the extension olai's own outlines used to carry,
 * `./extension.test.ts` failed the run, the rename landed on the writer — and
 * the sentence stating the gate went on naming the old file, invisible to that
 * sweep because the places the gate is written down are on its grant list.
 * Half a rename is worse than none: it leaves two names for one thing and a
 * check that agrees with neither.
 *
 * So the name is a VALUE (`@olai/format`'s `DIVERGENCE_LOG`), the server joins
 * it onto the state home rather than spelling it, and this file is the half
 * that a constant cannot do on its own: PROSE cannot import. Every sentence in
 * the tree that names the log is held to the one spelling, so the next rename
 * either moves all of them or fails here.
 *
 * It is a NAME sweep and not an extension sweep, which is what makes it outlive
 * the mistake that caused it: `validate-shadow.anything` fails, whatever the
 * anything is, and so does a mention that has drifted to some other stem
 * entirely — `./extension.test.ts` next door would only ever have caught one
 * particular wrong answer.
 */

import { DIVERGENCE_LOG } from "@olai/format";
import { expect, test } from "bun:test";

import { read, tracked } from "./support/sweep.ts";

/** The listing and its guarantees are `./support/sweep.ts`', shared with the
 *  two sweeps next door. Not filtered by extension: the gate is written down in
 *  a `.ts` header, a `README.md`, an architecture note and a roadmap record,
 *  and the point is that ALL of them say one thing. */
const TRACKED = tracked(import.meta.filename);

/** The log's stem, and everything a mention could have drifted to: the stem
 *  followed by whatever suffix somebody wrote, or by none at all. */
const NAMED = /validate-shadow[A-Za-z0-9.]*/g;

/** Every spelling of the log's name anywhere in the tree, with the file it is
 *  in — so a failure names the sentence to fix rather than a count. */
const spellings = (): ReadonlyArray<readonly [file: string, said: string]> =>
  TRACKED.flatMap((file) =>
    [...read(file).matchAll(NAMED)].map((found) => [file, found[0]] as const)
  );

// A guard on the sweep itself, `./extension.test.ts`' reason: a listing that
// came back short, or a pattern that rotted, would report an empty list and
// pass every assertion below while reading nothing. The floor says the gate is
// actually written down somewhere.
test("the sweep is reading a tree that names the log at all", () => {
  expect(TRACKED.length).toBeGreaterThan(200);
  expect(spellings().length).toBeGreaterThan(3);
});

test("every mention of the divergence log names the file the process writes", () => {
  const wrong = spellings()
    .filter(([, said]) => said !== DIVERGENCE_LOG)
    .map(([file, said]) => `${file}: ${said}`)
    .sort();
  // AN EQUALITY TO THE EMPTY LIST rather than a count, so a failure says which
  // sentence is out of step and what it says instead.
  expect(wrong).toEqual([]);
});

// The other half, and the one a search-and-replace over prose gets wrong: the
// constant itself has to keep being the thing the sweep is comparing against.
// A `DIVERGENCE_LOG` that stopped matching the pattern above would make every
// mention in the tree "wrong" — or, worse, make the pattern match nothing and
// the sweep vacuous.
test("the constant is a name this sweep can recognise", () => {
  expect([...DIVERGENCE_LOG.matchAll(NAMED)].map((found) => found[0])).toEqual([
    DIVERGENCE_LOG,
  ]);
});
