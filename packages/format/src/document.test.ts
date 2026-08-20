/**
 * The two readings the face made possible, held to their rules.
 *
 * `./set.test.ts` says what a face IS — the fields a decode fills in. These are
 * the two things that READ one: which documents a query selects, and what
 * points at an address. Both are rules with corners a browser test cannot
 * reach cheaply, which is what this file is for; `packages/tests` proves the
 * same two reach a screen.
 */

import { expect, test } from "bun:test"

import { addressOf, printAddress } from "./address.ts"
import { referrersTo } from "./backlinks.ts"
import { faceOf } from "./document.ts"
import { linksIn } from "./documents.ts"
import { derive, tagsIn } from "./derive.ts"
import { matching, matchingDocuments, parseFilter, rankedTogether } from "./filter.ts"
import { recordsOf, setOf } from "./fixtures.testlib.ts"
import { bodiedIn, markdownIn, type OutlineSet } from "./set.ts"

/** The day every query below is asked on — a constant, so nothing here is a
 *  different test tomorrow. */
const TODAY = "2026-08-19"

const VAULT = (): OutlineSet =>
  setOf(
    {
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doc":"notes/plan.md"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","done":"2026-08-10T09:00:00+05:30",` +
        `"desc":"quoted in [the brief](../brief.md)"}`,
        "",
      ].join("\n"),
    },
    [
      // The one document with a record on top of it. Every key is one this
      // reading has to get right about something: a plain scalar, a list, a
      // key that SPELLS a system field and is still a property, a `#`-looking
      // value that must not index as a tag, and a `[…](…)` that must not
      // index as a link.
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

/** Which documents a query selects, written. */
const selected = (set: OutlineSet, text: string): ReadonlyArray<string> =>
  matchingDocuments(bodiedIn(set), parseFilter(text, TODAY)).map((one) => one.at.path)

// ── which documents a query selects ────────────────────────────────────

// The four places a word is looked for, and they line up with a record's one
// for one: what it is CALLED, what it is NAMED, its tags, and its prose.
test("a document is found by its title, its path, its tags and its body", () => {
  const set = VAULT()
  expect(selected(set, "the plan")).toEqual(["notes/plan.md"])
  expect(selected(set, "notes/")).toEqual(["notes/plan.md"])
  expect(selected(set, "@alice")).toEqual(["notes/plan.md"])
  // `counters` is in one body and in no title, path or tag — the half of this
  // directory no search could see before (roadmap `search-document-bodies`).
  expect(selected(set, "counters")).toEqual(["brief.md"])
})

// A saved page has a NAME and no body the set keeps, so it is found by what it
// is called and by nothing inside it. A door that left it out would be the one
// place in this app where a page in your vault is not a thing you can find.
test("a saved page is found by its name and not by its prose", () => {
  const set = VAULT()
  expect(selected(set, "quote")).toEqual(["saved/quote.html"])
  expect(selected(set, "cabinets")).toEqual(["notes/plan.md"])
})

// There is nowhere on a `.md` to write a MARK or a DAY, so the honest answer
// to "which documents are done" is still none of them — and a frontmatter
// `date:` does not change that, being a property named `date` rather than the
// journal's day (`./frontmatter.ts` argues the ruling).
test("a clause about a mark or a day selects no document at all", () => {
  const set = VAULT()
  for (const text of ["is:done", "has:date", "date:today", "created:2026", "is:blocked"]) {
    expect(selected(set, text)).toEqual([])
  }
  // …and a clause beside a word takes the documents out with it.
  expect(selected(set, "plan is:todo")).toEqual([])
})

// The one clause a document CAN answer, and the door this whole item is: its
// frontmatter is a `Custom` map like a record's, so `prop:` is asked of both
// kinds through one `propKeyOf`.
test("a document answers prop: out of its frontmatter", () => {
  const set = VAULT()
  expect(selected(set, "prop:pr")).toEqual(["notes/plan.md"])
  expect(selected(set, "prop:pr=176")).toEqual(["notes/plan.md"])
  // Folded on both halves, exactly as a record's are.
  expect(selected(set, "prop:PR=176")).toEqual(["notes/plan.md"])
  // A list value matches on any member.
  expect(selected(set, "prop:owners=bob")).toEqual(["notes/plan.md"])
  // A key nobody wrote is a key nobody wrote.
  expect(selected(set, "prop:isbn")).toEqual([])
  // A key a document carries and a query narrows by a word it does not hold
  // is still no hit — the conjunction is the shared one.
  expect(selected(set, "prop:pr counters")).toEqual([])
  // …and a document with no frontmatter answers no property at all.
  expect(selected(set, "prop:pr brief")).toEqual([])
})

// The block is the document's RECORD, so it is not the document's PROSE
// either: a word only the frontmatter holds is found by `prop:` and not by
// typing it. Otherwise every frontmatter'd file in a vault would be a hit for
// `title`, and a row would say a word was in the body when a property held it.
test("a word inside the frontmatter is not a word in the prose", () => {
  const set = VAULT()
  expect(selected(set, "brief")).toEqual(["brief.md"])
  expect(selected(set, "owners")).toEqual([])
})

// A property is READ, not a mark: `done: yes` in a `.md` is `prop:done` and
// never `is:done`. Reading it the other way would put a document in a search
// the day page, the agenda and the calendar do not draw it in.
test("a frontmatter key that spells a system field is still a property", () => {
  const set = VAULT()
  expect(selected(set, "prop:date=2026-09-01")).toEqual(["notes/plan.md"])
  expect(selected(set, "prop:done")).toEqual(["notes/plan.md"])
  expect(selected(set, "is:done")).toEqual([])
})

// The whole reason the block had to be hidden from every scanner and not only
// from the renderer: the face is built out of the PROSE.
test("a document's face is read past its frontmatter", () => {
  const document = markdownIn(VAULT()).find((one) => one.path === "notes/plan.md")
  expect(document?.title).toBe("The plan")
  // `#draft` is a YAML value and not a tag somebody wrote in prose; `@alice`
  // is, and is still here.
  expect(document?.tags.map(String)).toEqual(["@alice"])
  // The `[…](…)` in the block is not a link this document writes either.
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

/**
 * THE BOUNDARY THE WHOLE STRIP TURNS ON: a `.md` is a FILE and has
 * frontmatter; a node's NOTE is a field on a record and does not.
 *
 * `tagsIn` and `linksIn` are asked of both — `bodiedDocument` hands them a
 * document's prose, `recordLinks` and `writtenTags` hand them a record's title
 * and note as written — so the skip lives at the caller and not in them. That
 * is a claim about two functions with no test on it until now, and it is the
 * load-bearing one: it is why `@olai/web`'s markdown pipeline is deliberately
 * innocent of the block (`markdown/pipeline.ts`). If a note's leading `---`
 * were skipped here, the pipeline would have to hide it there, and every note
 * that opens with a thematic break would lose it off the screen.
 *
 * The render half of the same boundary is pinned next door — `slugs.test.ts`
 * hands the pipeline a whole body and requires the `<hr>` back. This is the
 * indexing half.
 */
test("a note is not a file, so a leading --- block is prose in one", () => {
  const text = [
    "---",
    "tags: '#home'",
    "seen: '[the brief](../brief.md)'",
    "---",
    "",
    "Talk to @alice.",
  ].join("\n")

  // AS A NOTE, the block is prose: the `#home` in it is a tag somebody wrote,
  // and the `[…](…)` is a link this note points along. Nothing skipped.
  expect(tagsIn(text).map(String)).toEqual(["#home", "@alice"])
  expect(linksIn("house.olai", text).map(printAddress)).toEqual(["brief.md"])

  // AS A DOCUMENT, the same six lines index neither — the block is the file's
  // own record, and what it holds is a PROPERTY. One text, two readings, and
  // the difference is entirely which kind of thing is asking.
  const set = setOf({ "house.olai": `{"id":"a","ord":"a0","title":"a"}` }, [
    ["notes/note.md", text],
    ["brief.md", "# Brief\n"],
  ])
  const document = markdownIn(set).find((one) => one.path === "notes/note.md")
  expect(document?.tags.map(String)).toEqual(["@alice"])
  expect(document?.links.map(printAddress)).toEqual([])
  expect(document?.props).toEqual({ tags: "#home", seen: "[the brief](../brief.md)" })
})

// …and the same sentence read the other way: `-is:done` asks for what is not
// finished, and a document is not. Dropping them there too would make
// `#kitchen -is:done` narrower than `#kitchen`, which no reader expects of a
// negation.
test("a negated clause is satisfied by a document", () => {
  const set = VAULT()
  expect(selected(set, "-is:done plan")).toEqual(["notes/plan.md"])
})

// `file` is one outline and `under` is one node's subtree — both questions
// about where a RECORD sits in a tree, and a document is in neither.
test("a scoped query selects no documents", () => {
  const set = VAULT()
  const filter = parseFilter("plan", TODAY)
  expect(matchingDocuments(bodiedIn(set), filter, { file: "house.olai" })).toEqual([])
  expect(matchingDocuments(bodiedIn(set), filter, { under: "kitchen" })).toEqual([])
})

// ONE LIST, and it is why the two weight tables share a scale: a document whose
// TITLE holds the word outranks a node that only mentions it in a note, and a
// body match is the weakest hit there is.
test("both kinds come back in one ranked order", () => {
  const set = VAULT()
  const derived = derive(recordsOf(set))
  // `plan` is the WHOLE title of one document and a word in the middle of no
  // record's — so the document leads, and the record whose note holds it is
  // last, because a note is the weakest field a record has.
  const filter = parseFilter("plan", TODAY)
  const ranked = rankedTogether(
    derived,
    matching(derived, filter),
    matchingDocuments(bodiedIn(set), filter),
  )
  expect(
    ranked.map((one) => (one.kind === "node" ? one.at.node.id : String(one.at.path))),
  ).toEqual(["notes/plan.md"])
})

// ── what points at an address ──────────────────────────────────────────

const pointingAt = (set: OutlineSet, path: string): ReadonlyArray<string> => {
  const derived = derive(recordsOf(set))
  // THE FACES, which is what the browser holds and what this reads: the whole
  // documents are in hand here, and `faceOf` is the projection the wire
  // carries, so the case is asking the question the page asks.
  const faces = set.documents.map(faceOf)
  const address = addressOf(path, null)!
  return referrersTo(address, faces, derived).map((one) =>
    one.at === undefined ? String(one.face.path) : one.at.node.title
  )
}

// A `doc` field is a link a record MADE, and the answer names the RECORD rather
// than the outline it sits in: a link is always some record's, and naming the
// file would be the coarser answer offered because it was the easier one.
test("a `doc` attachment is a reference from the record that wrote it", () => {
  expect(pointingAt(VAULT(), "notes/plan.md")).toEqual(["kitchen remodel #home"])
})

// A `[…](…)` in a note is a reference the same way, read by the same rule a
// body is read by — which is what makes one rule for both worth having.
test("a link in a note is a reference from the record that wrote it", () => {
  expect(pointingAt(VAULT(), "brief.md")).toEqual(["order the cabinets"])
})

// A document nothing names has no referrers, and the absence is the answer.
test("a document nothing points at has no referrers", () => {
  expect(pointingAt(VAULT(), "saved/quote.html")).toEqual([])
})

// A link onto a HEADING points at the document: the reader who opens that file
// is who wants to know, and a page that showed it only under the heading would
// answer half the question and hide the other half.
test("a link onto a heading points at the document", () => {
  const set = setOf(
    { "a.olai": `{"id":"n","ord":"a0","title":"see [the scope](brief.md#scope)"}\n` },
    [["brief.md", "# Brief\n\n## Scope\n"]],
  )
  expect(pointingAt(set, "brief.md")).toEqual(["see [the scope](brief.md#scope)"])
})

// A document does not refer to ITSELF: a `.md` whose own body links a heading
// of itself is talking about the page it is on.
test("a document linking its own heading is not its own referrer", () => {
  const set = setOf({}, [["self.md", "# Self\n\n[up](self.md#self)\n"]])
  expect(pointingAt(set, "self.md")).toEqual([])
  // …and the link is still on its face, because it IS one.
  expect(markdownIn(set)[0]?.links.map(printAddress)).toEqual(["self.md#self"])
})

// What is put away is drawn on the Trash and nowhere else — this module's
// standing rule, read once more over the other kind of referrer.
test("a referrer written in an archive is left out", () => {
  const set = setOf(
    { "_olai/Trash.olai": `{"id":"old","ord":"a0","title":"was here","doc":"brief.md"}\n` },
    [["brief.md", "# Brief\n"]],
  )
  expect(pointingAt(set, "brief.md")).toEqual([])
})
