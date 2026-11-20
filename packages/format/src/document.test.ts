import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { addressOf, printAddress } from "./address.ts"
import { referencesOf } from "./backlinks.ts"
import { pointingOf } from "./pointing.ts"
import { linksIn } from "./documents.ts"
import { derive, tagsIn } from "./derive.ts"
import { matching, matchingDocuments, parseFilter, rankedTogether } from "./filter.ts"
import { recordsOf, setOf } from "./fixtures.testlib.ts"
import { bodyOf } from "./document.ts"
import { markdownPaths } from "./rules.ts"
import { bodiedIn, markdownAt, markdownIn, type OutlineSet } from "./set.ts"
import { reading } from "./validate.ts"

const TODAY = "2026-08-19"

const VAULT = (): OutlineSet =>
  setOf(
    {
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home","desc":"[document](notes/plan.md)"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","done":"2026-08-10T09:00:00+05:30",` +
        `"desc":"quoted in [the brief](../brief.md)"}`,
        "",
      ].join("\n"),
    },
    [
      ["notes/plan.md", [
        "---",
        "pr: 176",
        "owners: [alice, bob]",
        "date: 2026-09-01",
        "done: yes",
        "tags: '#draft'",
        "seen: '[the brief](../brief.md)'",
        "---",
        "",
        "# The plan",
        "",
        "Talk to @alice about the cabinets.",
        "",
        "## Next steps",
        "",
      ].join("\n")],
      ["brief.md", "# Brief\n\nOak counters, matte doors.\n\n## Scope\n"],
      "saved/quote.html",
    ],
  )

const selected = (set: OutlineSet, text: string): ReadonlyArray<string> =>
  matchingDocuments(bodiedIn(set), parseFilter(text, TODAY)).map((one) => one.at.path)

test("a document is found by its title, its path, its tags and its body", () => {
  const set = VAULT()
  expect(selected(set, "the plan")).toEqual(["notes/plan.md"])
  expect(selected(set, "notes/")).toEqual(["notes/plan.md"])
  expect(selected(set, "@alice")).toEqual(["notes/plan.md"])
  expect(selected(set, "counters")).toEqual(["brief.md"])
})

test("a saved page is found by its name and not by its prose", () => {
  const set = VAULT()
  expect(selected(set, "quote")).toEqual(["saved/quote.html"])
  expect(selected(set, "cabinets")).toEqual(["notes/plan.md"])
})

test("a clause about a mark or a day selects no document at all", () => {
  const set = VAULT()
  for (const text of ["is:done", "has:date", "date:today", "created:2026", "is:blocked"]) {
    expect(selected(set, text)).toEqual([])
  }
  expect(selected(set, "plan is:todo")).toEqual([])
})

test("a document answers prop: out of its frontmatter", () => {
  const set = VAULT()
  expect(selected(set, "prop:pr")).toEqual(["notes/plan.md"])
  expect(selected(set, "prop:pr=176")).toEqual(["notes/plan.md"])
  expect(selected(set, "prop:PR=176")).toEqual(["notes/plan.md"])
  expect(selected(set, "prop:owners=bob")).toEqual(["notes/plan.md"])
  expect(selected(set, "prop:isbn")).toEqual([])
  expect(selected(set, "prop:pr counters")).toEqual([])
  expect(selected(set, "prop:pr brief")).toEqual([])
})

test("a word inside the frontmatter is not a word in the prose", () => {
  const set = VAULT()
  expect(selected(set, "brief")).toEqual(["brief.md"])
  expect(selected(set, "owners")).toEqual([])
})

test("a frontmatter key that spells a system field is still a property", () => {
  const set = VAULT()
  expect(selected(set, "prop:date=2026-09-01")).toEqual(["notes/plan.md"])
  expect(selected(set, "prop:done")).toEqual(["notes/plan.md"])
  expect(selected(set, "is:done")).toEqual([])
})

test("a document's face is read past its frontmatter", () => {
  const document = markdownIn(VAULT()).find((one) => one.path === "notes/plan.md")
  expect(document?.title).toBe("The plan")
  expect(document?.tags.map(String)).toEqual(["@alice"])
  expect(document?.links.map(printAddress)).toEqual([])
  expect(document?.headings.map(String)).toEqual(["the-plan", "next-steps"])
  expect(document?.props).toEqual({
    pr: "176",
    owners: ["alice", "bob"],
    date: "2026-09-01",
    done: "yes",
    tags: "#draft",
    seen: "[the brief](../brief.md)",
  })
})

test("a note is not a file, so a leading --- block is prose in one", () => {
  const text = [
    "---",
    "tags: '#home'",
    "seen: '[the brief](../brief.md)'",
    "---",
    "",
    "Talk to @alice.",
  ].join("\n")

  expect(tagsIn(text).map(String)).toEqual(["#home", "@alice"])
  expect(linksIn(TEST_CLAIMS, "house.olai", text).map(printAddress)).toEqual(["brief.md"])

  const set = setOf({ "house.olai": `{"id":"a","ord":"a0","title":"a"}` }, [
    ["notes/note.md", text],
    ["brief.md", "# Brief\n"],
  ])
  const document = markdownIn(set).find((one) => one.path === "notes/note.md")
  expect(document?.tags.map(String)).toEqual(["@alice"])
  expect(document?.links.map(printAddress)).toEqual([])
  expect(document?.props).toEqual({ tags: "#home", seen: "[the brief](../brief.md)" })
})

test("a negated clause is satisfied by a document", () => {
  const set = VAULT()
  expect(selected(set, "-is:done plan")).toEqual(["notes/plan.md"])
})

test("a scoped query selects no documents", () => {
  const set = VAULT()
  const filter = parseFilter("plan", TODAY)
  expect(matchingDocuments(bodiedIn(set), filter, { file: "house.olai" })).toEqual([])
  expect(matchingDocuments(bodiedIn(set), filter, { under: "kitchen" })).toEqual([])
})

test("both kinds come back in one ranked order", () => {
  const set = VAULT()
  const derived = derive(TEST_CLAIMS, recordsOf(set))
  const filter = parseFilter("plan", TODAY)
  const ranked = rankedTogether(
    derived,
    matching(derived, filter),
    matchingDocuments(bodiedIn(set), filter),
  )
  expect(
    ranked.map((one) => (one.kind === "node" ? one.at.node.id : String(one.at.path))),
  ).toEqual(["notes/plan.md", "kitchen"])
})

const referringTo = (set: OutlineSet, path: string): ReadonlyArray<string> => {
  const address = addressOf(TEST_CLAIMS, path, null)!
  return referencesOf(reading(TEST_CLAIMS, set), address)
    .map((one) => ("path" in one.source ? String(one.source.path) : one.source.node.title))
}

test("a note link is a reference from the record that wrote it", () => {
  expect(referringTo(VAULT(), "notes/plan.md")).toEqual(["kitchen remodel #home"])
})

test("a link in a note is a reference from the record that wrote it", () => {
  expect(referringTo(VAULT(), "brief.md")).toEqual(["order the cabinets"])
})

test("a document nothing points at has no referrers", () => {
  expect(referringTo(VAULT(), "saved/quote.html")).toEqual([])
})

test("a link onto a heading points at the document", () => {
  const set = setOf(
    { "a.olai": `{"id":"n","ord":"a0","title":"see [the scope](brief.md#scope)"}\n` },
    [["brief.md", "# Brief\n\n## Scope\n"]],
  )
  expect(referringTo(set, "brief.md")).toEqual(["see [the scope](brief.md#scope)"])
})

test("a document linking its own heading is not its own referrer", () => {
  const set = setOf({}, [["self.md", "# Self\n\n[up](self.md#self)\n"]])
  expect(referringTo(set, "self.md")).toEqual([])
  expect(markdownIn(set)[0]?.links.map(printAddress)).toEqual(["self.md#self"])
})

test("a referrer written in an archive is left out", () => {
  const set = setOf(
    { "_olai/Trash.olai": `{"id":"old","ord":"a0","title":"was here","desc":"[document](brief.md)"}\n` },
    [["brief.md", "# Brief\n"]],
  )
  expect(referringTo(set, "brief.md")).toEqual([])
})

const HALF = [
  "---",
  "owner: nobody",
  "---",
  `import { definePlugin, Kinds } from "@olai/plugin-api"`,
  "",
  "// see #todo, and the swatch draws #ff8800",
  "// the brief is [here](../../brief.md)",
  "",
  "# register",
  "",
  `export default definePlugin({ name: "swatch" })`,
  "",
].join("\n")

const FOLDER = (): OutlineSet =>
  setOf({ "house.olai": `{"id":"n","ord":"a0","title":"the house"}\n` }, [
    ["plugins/swatch/server.ts", HALF],
    ["plugins/swatch/README.md", "# Swatch\n\nA colour swatch. #home\n"],
    ["brief.md", "# Brief\n"],
  ])

test("a kept body that is not prose has an empty face and the filename for a title", () => {
  const half = bodiedIn(FOLDER()).find((one) => one.path === "plugins/swatch/server.ts")
  expect(half?.title).toBe("server")
  expect(half?.tags.map(String)).toEqual([])
  expect(half?.links.map(printAddress)).toEqual([])
  expect(half?.props).toEqual({})
  expect(half?.holds === "text" && half.kept && half.headings.map(String)).toEqual([])
})

test("a kept body that is not prose still carries its body", () => {
  const set = FOLDER()
  const half = bodiedIn(set).find((one) => one.path === "plugins/swatch/server.ts")
  expect(bodyOf(half!)).toBe(HALF)
  expect(half?.holds === "text" && half.kept && half.bytes).toBe(new TextEncoder().encode(HALF).length)
  expect(markdownAt(set, "plugins/swatch/server.ts")?.body).toBe(HALF)
})

test("a kept body that is not prose is in no document list", () => {
  const set = FOLDER()
  expect(markdownIn(set).map((one) => String(one.path)))
    .toEqual(["brief.md", "plugins/swatch/README.md"])
  expect(markdownPaths(set).has("plugins/swatch/server.ts")).toBe(false)
  expect(selected(set, "swatch")).toEqual(["plugins/swatch/README.md"])
  expect(selected(set, "definePlugin")).toEqual([])
  expect(selected(set, "#ff8800")).toEqual([])
  expect(selected(set, "prop:owner")).toEqual([])
  expect(selected(set, "#home")).toEqual(["plugins/swatch/README.md"])
})
