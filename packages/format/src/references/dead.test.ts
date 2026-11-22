import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { deadLinksIn as deadLinksWith, deadLinksOf as deadLinksOfWith, deadLinkSaid } from "./dead.ts"
import { relativeFrom } from "../links/paths.ts"
import { nodesOf } from "../fixtures.testlib.ts"
import type { Located } from "../node.ts"
import { namesOf } from "../links/names.ts"
import { read } from "@olai/prose/read.ts"

const deadLinksIn = (from: string, text: string | ReadonlyArray<string>, served: ReadonlySet<string>) =>
  deadLinksWith(namesOf(TEST_CLAIMS, served), from, (typeof text === "string" ? [text] : text).map(read))
const deadLinksOf = (at: Located, served: ReadonlySet<string>) => deadLinksOfWith(namesOf(TEST_CLAIMS, served), at)

const served = new Set(["notes/nix-flakes.md", "other/nix-flakes.md", "the brief.md"])
test("missing links name their resolved path and all basename matches beside the writer", () => {
  expect(deadLinksIn("projects/olai.olai", "[x](nix-flakes.md#scope)", served)).toEqual([
    { kind: "path", written: "nix-flakes.md#scope", resolved: "projects/nix-flakes.md", suggest: ["../notes/nix-flakes.md", "../other/nix-flakes.md"] },
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
    { kind: "path", written: "nix-flaks.md", resolved: "notes/nix-flaks.md", suggest: ["nix-flakes.md"] },
  ])
})

test("title and note are separate Markdown sources, with shared deduplication", () => {
  const split = nodesOf('{"id":"a","ord":"a0","title":"[unfinished","desc":"](missing.md)"}', "a.olai")[0]!
  expect(deadLinksOf(split, served)).toEqual([])
  expect(deadLinksIn("a.olai", ["[x](missing.md)", "[again](missing.md)"], served)).toHaveLength(1)
})

test("directory targets are not missing files and URL suffixes do not change membership", () => {
  expect(deadLinksIn("a.olai", "[x](.) [x](..) [x](notes/) [x](?v=1) [x](%2E%2E) [x](notes%2F)", served)).toEqual([])
  expect(deadLinksIn("a.olai", "[x](the%20brief.md?v=1#heading)", served)).toEqual([])
  expect(deadLinksIn("a.olai", "[x](missing.md?v=1#heading)", served)[0]?.resolved).toBe("missing.md")
})

// ── wikilinks ──────────────────────────────────────────────────────────

const named = new Set(["finishes.md", "notes/palette.md", "house.olai", "art/handle.png"])

test("an unresolved wikilink is reported by name, with the nearest names", () => {
  expect(deadLinksIn("notes/a.md", "see [[finsihes]]", named)).toEqual([
    { kind: "name", written: "[[finsihes]]", resolved: "finsihes", suggest: ["[[finishes]]"] },
  ])
})

test("a bare name that only an outline has is offered with its suffix", () => {
  expect(deadLinksIn("notes/a.md", "[[house]] and [[house#kitchen]]", named)).toEqual([
    { kind: "name", written: "[[house]]", resolved: "house", suggest: ["[[house.olai]]"] },
    { kind: "name", written: "[[house#kitchen]]", resolved: "house", suggest: ["[[house.olai]]"] },
  ])
})

test("a resolved wikilink is not dead, wherever its file is", () => {
  expect(deadLinksIn("notes/a.md", "[[finishes]] [[palette#Swatches]] ![[handle.png]] [[house.olai#kitchen]] [[#Here]]", named)).toEqual([])
})

test("a wikilink in code is not a link at all", () => {
  expect(deadLinksIn("notes/a.md", "`[[nowhere]]`\n\n```\n[[nowhere]]\n```\n\\[[nowhere]]", named)).toEqual([])
})

test("a missing picture embed is dead, written as an embed", () => {
  expect(deadLinksIn("notes/a.md", "![[gone.png]]", named).map(one => one.written)).toEqual(["![[gone.png]]"])
})

test("one name written twice is reported once, across a title and a note", () => {
  const at = nodesOf('{"id":"a","ord":"a0","title":"[[nowhere]]","desc":"again [[nowhere|there]]"}', "house.olai")[0]!
  expect(deadLinksOf(at, named)).toHaveLength(1)
})

test("a wikilink heals the moment a file by its name is served", () => {
  const at = nodesOf('{"id":"a","ord":"a0","title":"see [[shed]]"}', "house.olai")[0]!
  expect(deadLinksOf(at, named)).toHaveLength(1)
  expect(deadLinksOf(at, new Set([...named, "garden/shed.md"]))).toEqual([])
})

test("an unresolved wikilink says that no file has that name", () => {
  expect(deadLinkSaid({ kind: "name", resolved: "finsihes", suggest: ["[[finishes]]"] }))
    .toBe("no file is named finsihes — did you mean `[[finishes]]`?")
  expect(deadLinkSaid({ kind: "name", resolved: "nowhere", suggest: [] })).toBe("no file is named nowhere.")
})

test("a dead link says which kind it is: a path, or a name", () => {
  expect(deadLinksIn("notes/a.md", "[x](gone.md) and [[gone]]", named).map(one => [one.kind, one.written])).toEqual([
    ["path", "gone.md"],
    ["name", "[[gone]]"],
  ])
})
