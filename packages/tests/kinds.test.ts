/**
 * The file-kind registry, held as a sweep rather than as a sentence.
 *
 * `@olai/format`'s `kinds.ts` claims to be the ONE place that says which files
 * a served directory is made of, and what each one is called. Two things can
 * quietly falsify that, and neither is a type error:
 *
 *   - a suffix SPELLED somewhere else — `endsWith(".md")` in a new module, a
 *     `".olai"` copied out of git history. It works on the day it is written
 *     and it is a second answer from then on, which is exactly the failure the
 *     outline rename was: a rule the walk stopped claiming while one caller went
 *     on believing it (./extension.test.ts bans the retired spelling outright,
 *     and this is its sibling in the present tense);
 *   - a kind added to the registry and NOT DRAWN. The type checker catches most
 *     of that on its own — every surface that draws a kind holds a `Record` over
 *     the registry's union, so a new entry is a compile error at each of them —
 *     but the compiler can only name the sites that already exist. The second
 *     sweep below is the list of them, so "everywhere it must" is a thing a
 *     person can read.
 *
 * It lives in `@olai/tests` for ./extension.test.ts' reason: this is the only
 * package ABOVE all the others, and a sweep in `@olai/format` reading the
 * client would be the floor reading the roof.
 *
 * **Code only, and comments stripped.** The registry's own rule is that CODE
 * that decides reads the table while PROSE that describes spells it out, so the
 * hundred docstrings, tool descriptions and Gherkin lines saying `.olai` in
 * words are not the subject here — the opposite of ./extension.test.ts, where
 * the prose was exactly the point because the spelling was being retired.
 */

import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { FILE_KINDS } from "@olai/format";

/** The repository root — two directories up from this file, which lives in
 *  `packages/tests/`. */
const ROOT = path.dirname(path.dirname(import.meta.dirname));

const SELF = path.relative(ROOT, import.meta.filename);

/** Every TypeScript file this repository owns, with its comments removed —
 *  `git ls-files` for the reason ./extension.test.ts gives (tracked is what
 *  "a file this repo owns" means, and an untracked one has not landed).
 *
 *  The comment stripper is `@olai/web`'s `claims.test.ts`, verbatim in effect:
 *  a `//` is only taken when it opens a line or follows whitespace, so a
 *  `https://…` inside a string survives. The cost is a comment pasted
 *  mid-expression surviving too, which for a sweep means a false alarm a human
 *  reads — never a silent pass. */
const SOURCES: ReadonlyArray<{ file: string; code: string }> = (() => {
  const listed = spawnSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" });
  if (listed.status !== 0) {
    throw new Error(`git ls-files failed in ${ROOT}: ${listed.stderr || listed.error}`);
  }
  return listed.stdout
    .split("\0")
    .filter((one) => one !== "" && one !== SELF && /\.tsx?$/.test(one))
    .map((file) => ({
      file,
      code: fs
        .readFileSync(path.join(ROOT, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|\s)\/\/.*$/gm, "$1"),
    }));
})();

const filesSpelling = (pattern: RegExp): ReadonlyArray<string> =>
  SOURCES.filter((one) => pattern.test(one.code)).map((one) => one.file).sort();

// A guard on the sweep itself: a listing that came back short would pass every
// assertion below while reading almost nothing. A floor, not a count.
test("the sweep is actually reading the repository", () => {
  expect(SOURCES.length).toBeGreaterThan(100);
});

/**
 * A registered extension, written out as a bare string literal — `".md"`,
 * `'.olai'`. That shape is the one a DECISION is made of (`endsWith(…)`, a
 * comparison, a list of suffixes); a `` `.md` `` inside a sentence in a tool
 * description is prose in a string and is deliberately not matched.
 */
const SPELLED = new RegExp(
  `["']\\.(?:${Object.values(FILE_KINDS).map((claim) => claim.ext.slice(1)).join("|")})["']`,
);

/**
 * Where a suffix may still be written out, and why each one may.
 *
 * The registry itself is the first, and it has to keep matching: the
 * expectation below is an EQUALITY to this list rather than "nothing else",
 * for `claims.test.ts`' reason — a pattern that rotted would report an empty
 * list here, a green run that checked nothing, instead of failing.
 *
 * `@olai/surface`'s `attach.ts` answers a DIFFERENT question with a list that
 * happens to share one string: what a person may hand an agent as a path, which
 * is five extensions olai does not serve pages for. Making it read the registry
 * would join two lists that mean different things, and the day one of them
 * moves the other would follow it silently.
 *
 * The fake ACP agent is a THIRD PARTY, and its own comment says why: an agent
 * on the far end of a pipe has no access to olai's constants, so deriving the
 * fixture from the implementation under test would make the scenario agree with
 * the client by construction.
 */
const MAY_SPELL_IT: ReadonlyArray<string> = [
  "packages/format/src/kinds.ts",
  "packages/surface/src/attach.ts",
  "packages/tests/agent/fake-acp-agent.ts",
];

test("no code outside the registry decides by spelling a suffix", () => {
  expect(filesSpelling(SPELLED)).toEqual([...MAY_SPELL_IT].sort());
});

/**
 * Every surface that has to DRAW a kind, and the shape an entry takes there.
 *
 * Each of these is a `Record` over the registry's union, so this list is not
 * what enforces the property — the type checker is, on every one of them, and
 * that is the whole reason the tables are `Record`s. What the list is FOR is
 * the other half: it says out loud what "renders everywhere it must" means, so
 * a person adding a kind can read the sites, and a site that quietly stopped
 * being a table (an entry deleted, a `Partial<>`, a cast) is named here.
 */
const DRAWN_AT: ReadonlyArray<string> = [
  // The glyph before the name, in the tree and on the collapsed rail.
  "packages/web/src/client/file/icons.tsx",
  // Where a row of that kind links, and what a scenario calls it.
  "packages/web/src/client/file/kinds.ts",
];

/**
 * And the surfaces that draw only the BODIED kinds — the files a `/doc/…`
 * address opens. An outline has no entry there and must not: it is a different
 * kind of page (a tree with rows to zoom and filter), which is what the
 * registry's `holds` column separates.
 */
const FACED_AT: ReadonlyArray<string> = [
  // What the body of one is drawn as, and whether its page can write it.
  "packages/web/src/client/document/faces.tsx",
];

/** Whether `site` has a table entry for `kind` — the shape every one of these
 *  tables writes, `<kind>: {…}`, at the start of a line. */
const entered = (site: string, kind: string): boolean => {
  const source = SOURCES.find((one) => one.file === site);
  if (source === undefined) throw new Error(`${site} is not a tracked source file`);
  return new RegExp(`^\\s*${kind}:`, "m").test(source.code);
};

test("every kind in the registry is drawn at every surface that draws kinds", () => {
  const missing: Array<string> = [];
  for (const site of DRAWN_AT) {
    for (const kind of Object.keys(FILE_KINDS)) {
      if (!entered(site, kind)) missing.push(`${site}: ${kind}`);
    }
  }
  expect(missing).toEqual([]);
});

test("every bodied kind has a face, and no other kind has one", () => {
  const wrong: Array<string> = [];
  for (const site of FACED_AT) {
    for (const [kind, claim] of Object.entries(FILE_KINDS)) {
      const wanted = claim.holds === "text";
      if (entered(site, kind) !== wanted) {
        wrong.push(`${site}: ${kind} ${wanted ? "has no face" : "has a face it should not"}`);
      }
    }
  }
  expect(wrong).toEqual([]);
});
