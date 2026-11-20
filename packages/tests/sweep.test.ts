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

test("an entry that names nothing on disk is reported, and a live one is not", () => {
  expect(unresolved(["justfile", "packages/tests/"])).toEqual([]);
  expect(unresolved(["website/docs/roadmap.olai", "website/docs/", "website/docs/nowhere/"]))
    .toEqual(["website/docs/roadmap.olai", "website/docs/nowhere/"]);
});

test("the tracked listing is the repository, minus whoever asked", () => {
  const listed = tracked(import.meta.filename);
  expect(listed.length).toBeGreaterThan(200);
  expect(listed).not.toContain("packages/tests/sweep.test.ts");
  expect(listed).toContain("packages/tests/support/sweep.ts");
  expect(listed.every((one) => !one.startsWith("/"))).toBe(true);
});

test("a tracked file is one this fixture can find and read", () => {
  expect(exists("packages/tests/support/sweep.ts")).toBe(true);
  expect(exists("packages/tests/no-such-file.ts")).toBe(false);
  expect(read("packages/tests/support/sweep.ts")).toContain("git ls-files");
});

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

test("stripping a comment leaves the line break it was on", () => {
  const stripped = withoutComments("const a = 1\n// a note\nconst b = 2\n");
  expect(stripped.split("\n").length).toBe(4);
  expect(stripped).not.toContain("a note");
});
