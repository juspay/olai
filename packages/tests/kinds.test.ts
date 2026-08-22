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
 *   - a kind added to the registry and NOT DRAWN. Every surface that draws one
 *     holds a `Record` over the registry's union, so the type checker fails each
 *     of them on a new entry — but only the ones it knows about. What it cannot
 *     see is a surface that draws kinds WITHOUT such a table, or one added and
 *     never written down, so the second sweep is about the INVENTORY: every
 *     table over the union is on the list, and every kind is in every table.
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

import { FILE_KINDS } from "@olai/format";

import { read, tracked, withoutComments } from "./support/sweep.ts";

/** Every TypeScript file this repository owns, with its comments removed. */
const SOURCES: ReadonlyArray<{ file: string; code: string }> = tracked(import.meta.filename)
  .filter((file) => /\.tsx?$/.test(file))
  .map((file) => ({ file, code: withoutComments(read(file)) }));

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
 * Every surface that draws a kind, and which union it draws over.
 *
 * `FileKind` is every kind there is; `BodyKind` is the ones whose content is a
 * body, which is what a bodied address opens. A table over the second must
 * NOT have an outline in it — that is not a page with a body, and an entry
 * there would be a face nothing can reach.
 *
 * This list is not what enforces per-kind coverage — the type checker is, on
 * every one of these tables, which is the whole reason they are `Record`s. What
 * it enforces is the thing a compiler cannot see: that the list is COMPLETE.
 * The test below finds every table over either union in the tree and requires
 * it to be here, so a fourth surface added a year from now is either written
 * down or red.
 */
const TABLES: ReadonlyArray<{ file: string; over: "FileKind" | "BodyKind" }> = [
  // The glyph before the name, in the tree and on the collapsed rail. Its union
  // is the directory's — every file kind, plus the folders they sit under.
  { file: "packages/web/src/client/file/icons.tsx", over: "FileKind" },
  // What a scenario grips a row of this kind by, and what a READER is told a
  // kind is — the client's vocabulary seam, spent by the empty page that says
  // the directory holds nothing by that name and by the refusal under the
  // sidebar's path box. TWO TABLES, one file, one entry, because this list is
  // about where a table lives: the sweep below reads a FILE, so what it holds
  // for this row is that every kind is somewhere in it, and what makes the
  // coverage per table is the type checker on each `Record` — which is what it
  // has always been (the paragraph above says so).
  { file: "packages/web/src/client/file/kinds.ts", over: "FileKind" },
  // What the body of one is drawn as, and whether its page can write it.
  { file: "packages/web/src/client/document/faces.tsx", over: "BodyKind" },
];

/** Whether `code` has a table entry for `kind` — the shape every one of these
 *  writes, `<kind>: …`, at the start of a line. */
const entered = (code: string, kind: string): boolean =>
  new RegExp(`^\\s*${kind}:`, "m").test(code);

const sourceOf = (file: string): string => {
  const source = SOURCES.find((one) => one.file === file);
  if (source === undefined) throw new Error(`${file} is not a tracked source file`);
  return source.code;
};

test("every kind is in every table that draws kinds, and only the bodied ones are faced", () => {
  const wrong: Array<string> = [];
  for (const table of TABLES) {
    const code = sourceOf(table.file);
    for (const [kind, claim] of Object.entries(FILE_KINDS)) {
      const wanted = table.over === "FileKind" || claim.holds === "text";
      if (entered(code, kind) === wanted) continue;
      wrong.push(`${table.file}: ${kind} ${wanted ? "is missing" : "should not be here"}`);
    }
  }
  expect(wrong).toEqual([]);
});

test("every table over the registry's unions is on the list", () => {
  const declares = /Record<\s*(?:FileKind|BodyKind|DirectoryKind)\b/;
  expect(filesSpelling(declares)).toEqual(TABLES.map((one) => one.file).sort());
});
