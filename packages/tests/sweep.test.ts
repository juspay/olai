/**
 * The shared sweep fixture, held to its own rules.
 *
 * `./support/sweep.ts` is what three sweeps in this package now walk the tree
 * through — `extension.test.ts`, `kinds.test.ts` and `stdio.test.ts` — and a
 * fixture three tests depend on is worth a test of its own for the reason the
 * sweeps themselves exist: the way it breaks is silent. A listing that came back
 * short, or a grant that quietly covers a file nobody granted, turns three red
 * fences green and nothing anywhere says so.
 *
 * {@link granting} is the half with a real edge in it. A trailing `/` makes an
 * entry a DIRECTORY, matched by prefix; everything else is one exact path —
 * and prefix-matching the lot, which is the natural first draft, grants
 * `docs/format.mdx` and `docs/format.md.bak` along with the file that was meant.
 * That is a review finding on `extension.test.ts`' own grant list, not a
 * hypothetical, which is why it is a rule with a test rather than four lines
 * each sweep writes for itself.
 */

import { expect, test } from "bun:test";

import {
  exists,
  granting,
  read,
  tracked,
  unresolved,
  withoutComments,
} from "./support/sweep.ts";

test("an exact entry grants that file and nothing that merely starts with it", () => {
  const granted = granting(["docs/format.md"]);
  expect(granted("docs/format.md")).toBe(true);
  expect(granted("docs/format.mdx")).toBe(false);
  expect(granted("docs/format.md.bak")).toBe(false);
  expect(granted("docs/format.md/notes.md")).toBe(false);
  expect(granted("packages/docs/format.md")).toBe(false);
});

test("an entry ending in a slash grants the directory under it", () => {
  const granted = granting(["docs/RCA/"]);
  expect(granted("docs/RCA/2026-08-11-roadmap-stamp-reverts.md")).toBe(true);
  expect(granted("docs/RCA/nested/deeper.md")).toBe(true);
  // The directory's own name without the slash is a different path, and a
  // sibling whose name merely starts with it is not inside it.
  expect(granted("docs/RCA")).toBe(false);
  expect(granted("docs/RCAs/other.md")).toBe(false);
});

test("an empty list grants nothing, and grants are read together", () => {
  expect(granting([])("anything")).toBe(false);
  const granted = granting(["justfile", "docs/brainstorming/"]);
  expect(granted("justfile")).toBe(true);
  expect(granted("docs/brainstorming/filter-in-place.md")).toBe(true);
  expect(granted("README.md")).toBe(false);
});

// …and the grant list held to the DISK, which is the half both sweeps went two
// days without: `docs/roadmap.olai` became `docs/roadmap/` and the entry naming
// it went on being spelled while covering nothing, so the ledger it was written
// to excuse turned both sweeps red on master. A directory is asked about
// without its trailing slash; a file exactly as written.
test("an entry that names nothing on disk is reported, and a live one is not", () => {
  expect(unresolved(["justfile", "packages/tests/"])).toEqual([]);
  expect(unresolved(["docs/roadmap.olai", "docs/", "docs/nowhere/"]))
    .toEqual(["docs/roadmap.olai", "docs/nowhere/"]);
});

// The walk itself: the listing is real, it leaves the caller out of it, and the
// paths in it are paths that can be read. A floor rather than a count, for the
// reason the sweeps state — a number that had to be updated per commit would be
// updated without being read.
test("the tracked listing is the repository, minus whoever asked", () => {
  const listed = tracked(import.meta.filename);
  expect(listed.length).toBeGreaterThan(200);
  expect(listed).not.toContain("packages/tests/sweep.test.ts");
  expect(listed).toContain("packages/tests/support/sweep.ts");
  // Root-relative and `/`-spelled, never absolute: every grant list in this
  // package is written that way.
  expect(listed.every((one) => !one.startsWith("/"))).toBe(true);
});

test("a tracked file is one this fixture can find and read", () => {
  expect(exists("packages/tests/support/sweep.ts")).toBe(true);
  expect(exists("packages/tests/no-such-file.ts")).toBe(false);
  expect(read("packages/tests/support/sweep.ts")).toContain("git ls-files");
});

// The stripper is `@olai/web`'s `claims.test.ts`', deliberately: a line comment
// is only taken when `//` opens the line or follows whitespace, so a URL inside
// a string survives to be swept.
test("comments come out and a URL in a string does not", () => {
  const code = [
    "/* a block comment */",
    "const dial = 'https://example.invalid/x' // trailing",
    "// a whole line",
  ].join("\n");
  const stripped = withoutComments(code);
  expect(stripped).toContain("https://example.invalid/x");
  expect(stripped).not.toContain("a block comment");
  expect(stripped).not.toContain("a whole line");
  expect(stripped).not.toContain("trailing");
});

// …and the two ways a stripper eats code it was supposed to read. These are a
// PAIR on purpose: each is what the other's fix causes, so a rewrite that
// closes one by running the passes in the other order fails the other test
// rather than shipping. Both are silent — the sweep goes on passing and simply
// reads less — which is the one failure the stripper promises it does not have,
// and `selectors.test.ts`' fence is what caught the first (three hand-built
// selectors reported in a file that plainly has four).
//
// Blocks-first is what honours a block OPENER written inside a line comment.
// Two files in this tree write one today.
test("a block opener inside a line comment swallows no code", () => {
  const code = [
    "// the accepted type is image/* here",
    "const kept = 'this line is code'",
    "/** and this really is a block */",
    "const also = 'so is this'",
  ].join("\n");
  const stripped = withoutComments(code);
  expect(stripped).toContain("this line is code");
  expect(stripped).toContain("so is this");
  expect(stripped).not.toContain("the accepted type");
  expect(stripped).not.toContain("and this really is a block");
});

// …and lines-first is what honours a `//` written inside a BLOCK comment: the
// line rule eats to the end of that line, taking the block's closer with it, so
// the block runs on to whatever closer comes next and everything between is
// gone. A prose comment mentioning a URL scheme or a path is all it takes.
test("a line comment inside a block comment swallows no code either", () => {
  const code = [
    "/* a note // with a slash-slash in it */",
    "const kept = 'this line is code'",
    "/** and this really is a block */",
    "const also = 'so is this'",
  ].join("\n");
  const stripped = withoutComments(code);
  expect(stripped).toContain("this line is code");
  expect(stripped).toContain("so is this");
  expect(stripped).not.toContain("with a slash-slash");
  expect(stripped).not.toContain("and this really is a block");
});

// The output is LINE-PRESERVING, not line-compacting: a line comment's newline
// survives, so the code above a comment does not become adjacent to the code
// below it. Two sweeps match with `^…` under `m`, and an invented adjacency is
// a match the file does not contain.
test("stripping a comment leaves the line break it was on", () => {
  const stripped = withoutComments("const a = 1\n// a note\nconst b = 2\n");
  expect(stripped.split("\n").length).toBe(4);
  expect(stripped).not.toContain("a note");
});
