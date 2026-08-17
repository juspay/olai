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

import { exists, granting, read, tracked, withoutComments } from "./support/sweep.ts";

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

// …and the ORDER, which is not cosmetic. A block opener written inside a LINE
// comment — a MIME type with a star in it, a path to a glob — used to open a
// block the stripper honoured until the next closer, swallowing every line of
// code between: a sweep that passes without reading, which is the one failure
// the stripper's own docstring promises it does not have. Two files in this
// tree write such a comment today, and `selectors.test.ts`' fence is what
// noticed, reporting three hand-built selectors where there are four.
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
