import { expect, test } from "bun:test"
import { deadLinksIn, deadLinksOf, relativeFrom } from "./dead-links.ts"
import { nodesOf } from "./fixtures.testlib.ts"

const served = new Set(["notes/nix-flakes.md", "other/nix-flakes.md", "the brief.md"])
test("missing links name their resolved path and all basename matches beside the writer", () => {
  expect(deadLinksIn("projects/olai.olai", "[x](nix-flakes.md#scope)", served)).toEqual([
    { written: "nix-flakes.md#scope", resolved: "projects/nix-flakes.md", suggest: ["../notes/nix-flakes.md", "../other/nix-flakes.md"] },
  ])
  expect(relativeFrom("projects/olai.olai", "projects/a.md")).toBe("a.md")
})
test("clamping, encoded and angle-bracket names, fragments and non-relative targets share the forward rule", () => {
  expect(deadLinksIn("projects/olai.olai", "[x](../../the%20brief.md#absent) [x](<../the brief.md>) [x](#missing) [x](/missing.md) [x](https://example.org/missing.md)", served)).toEqual([])
  expect(deadLinksIn("projects/olai.olai", "[x](../../gone%20away.md)", served)[0]?.resolved).toBe("gone away.md")
  expect(deadLinksIn("a.olai", "[x](<gone away.md>)", served)[0]?.written).toBe("gone away.md")
})
test("a newly served target clears the reading without changing its record", () => {
  const at = nodesOf('{"id":"a","ord":"a0","title":"[x](future.md)"}', "projects/olai.olai")[0]!
  expect(deadLinksOf(at, served)).toHaveLength(1)
  expect(deadLinksOf(at, new Set([...served, "projects/future.md"]))).toEqual([])
})
test("an edit-distance suggestion is relative too, and repeated links appear once", () => {
  expect(deadLinksIn("notes/a.md", "[x](nix-flaks.md) [again](nix-flaks.md)", served)).toEqual([
    { written: "nix-flaks.md", resolved: "notes/nix-flaks.md", suggest: ["nix-flakes.md"] },
  ])
})

test("title and note are separate Markdown sources, with shared deduplication", () => {
  const split = nodesOf('{"id":"a","ord":"a0","title":"[unfinished","desc":"](missing.md)"}', "a.olai")[0]!
  expect(deadLinksOf(split, served)).toEqual([])
  expect(deadLinksIn("a.olai", ["[x](missing.md)", "[again](missing.md)"], served)).toHaveLength(1)
})
