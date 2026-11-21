/**
 * What refers to a node — the reading, and the rulings inside it.
 *
 * The INDEX is held to `derive` by `./patch.test.ts`'s oracle; what is
 * asserted here is the meaning laid over it: which of the things a record can
 * do counts as a reference, which ids a node answers to, and who is left out.
 *
 * THE SET'S POINTING INDEX is where the reading looks, and a `Reading` is what
 * carries both halves of it — so a fixture here is built with {@link readingOf},
 * the helper that pairs a set with its derived view and its index exactly as
 * `validate` does in production.
 */
import { expect, test } from "bun:test"

import { DocumentPath, NodeId, Slug, type Address } from "./address.ts"
import { referencesOf } from "./backlinks.ts"
import { readingOf, setOf } from "./fixtures.testlib.ts"
import type { Reading } from "./validate.ts"
import { wikilinkAddress } from "./wikilinks.ts"

/** The node address the grammar spells, off a plain id — the tests' own
 *  {@link addressOf}, which needs claims. */
const atNode = (id: string): Address => ({ kind: "node", id: NodeId.make(id) })

const viewOf = (
  files: Record<string, string>,
  documents: ReadonlyArray<string | readonly [file: string, text: string]> = [],
): Reading => readingOf(setOf(files, documents))
const said = (view: Reading, id: string): ReadonlyArray<string> =>
  referencesOf(view, atNode(id)).map((one) =>
    `${"file" in one.source ? one.source.node.id : one.source.path} ${one.ways.join("+")}`
  )

const HOUSE = {
  "house.olai": `{"id":"kitchen","ord":"a","title":"kitchen remodel"}\n` +
    `{"id":"order","parent":"kitchen","ord":"a","title":"order the cabinets","see":["herbs"]}\n` +
    `{"id":"install","parent":"kitchen","ord":"b","title":"install them","desc":"after @herbs is in"}`,
  "garden.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}`,
}

test("a `see` lands on the node it names, and so does a word in a note", () => {
  expect(said(viewOf(HOUSE), "herbs")).toEqual(["order see", "install mention"])
})

test("nothing refers to a node nobody has written about", () => {
  expect(referencesOf(viewOf(HOUSE), atNode("kitchen"))).toEqual([])
  // An id the set does not hold has no referrers either — the same empty
  // answer, since this is a lookup rather than a claim about what exists.
  expect(referencesOf(viewOf(HOUSE), atNode("nobody"))).toEqual([])
})

test("one record doing both is one referrer saying both, edge first", () => {
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"both","ord":"b","title":"see @herbs","see":["herbs"]}`,
  })
  expect(said(view, "herbs")).toEqual(["both see+mention"])
})

test("`@word` is a reference exactly when a record claims the word", () => {
  // The same title, in two directories: `@alice` is a person tag where nobody
  // is called that, and a reference where somebody is. The INDEX cannot tell
  // them apart — that is what makes it patchable — so this is the reading's
  // decision, asserted from both sides.
  const files = { "a.olai": `{"id":"note","ord":"a","title":"ask @alice about it"}` }
  expect(referencesOf(viewOf(files), atNode("alice"))).toEqual([])
  const claimed = viewOf({ ...files, "b.olai": `{"id":"alice","ord":"a","title":"Alice"}` })
  expect(said(claimed, "alice")).toEqual(["note mention"])
})

// THE HALF OF THE INDEX THIS READING TAKES, asserted here because nothing else
// can assert it. `taggedBy` files both sigils under keys that keep them, and a
// reading that looked up the bare word — or looked up both spellings — would
// draw `#herbs` as a referrer of the node called `herbs`. The oracle next door
// cannot catch that: `derive` and `patch` would agree about a key either way,
// and the widget's own tests are about the vocabulary rather than about who
// refers to what. So the pair is pinned at the door that decides it.
test("a `#topic` spelled like an id is not a reference, and the `@` beside it is", () => {
  const view = viewOf({
    "garden.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}`,
    "house.olai": `{"id":"ask","ord":"a","title":"ask @herbs about the pots"}\n` +
      `{"id":"topic","ord":"b","title":"seed order","desc":"filed under #herbs"}`,
  })
  // Both keys are really there, so this is the READING choosing between them
  // rather than an index that never filed the topic.
  expect([...view.derived.taggedBy.keys()].sort()).toEqual(["#herbs", "@herbs"])
  expect(said(view, "herbs")).toEqual(["ask mention"])
})

test("a mention that arrives with the node it names is a reference at once", () => {
  // The other half of the rule above, and the reason the index is not filtered
  // by existence: the word was already written, and nothing rewrote it.
  const view = viewOf({
    "a.olai": `{"id":"note","ord":"a","title":"ask @alice about it"}\n` +
      `{"id":"alice","ord":"b","title":"Alice"}`,
  })
  expect(said(view, "alice")).toEqual(["note mention"])
})

test("a body's `@mention` of a node is a reference, with the file as its source", () => {
  const view = viewOf({
    "garden.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}`,
  }, [["notes/garden.md", "# the garden\n\nwater the @herbs every morning"]])
  expect(said(view, "herbs")).toEqual(["notes/garden.md mention"])
})

test("a body's link onto the node is a reference, way `link`", () => {
  const view = viewOf({
    "garden.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}`,
  }, [["notes/garden.md", "# the garden\n\n[the herb bed](#herbs) is outside"]])
  expect(said(view, "herbs")).toEqual(["notes/garden.md link"])
})

test("a reference to a PLACEMENT of this node is a reference to this node", () => {
  // What a forward reader does — `see: ["m"]` draws the herb bed's title and
  // opens the herb bed's page — read backwards. Chains too: `m2` mirrors `m`
  // mirrors `herbs`, and `mirrorsOf` files both under `herbs`.
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}`,
    "b.olai": `{"id":"m","ord":"a","mirror":"herbs"}\n` +
      `{"id":"points","ord":"b","title":"points","see":["m"]}`,
    "deep/c.olai": `{"id":"m2","ord":"a","mirror":"m"}\n` +
      `{"id":"says","ord":"b","title":"about @m2"}`,
  })
  expect(said(view, "herbs")).toEqual(["points see", "says mention"])
})

test("a record never refers to itself, through its own prose or its own placement", () => {
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed","desc":"this is @herbs","see":["m"]}`,
    "b.olai": `{"id":"m","ord":"a","mirror":"herbs"}`,
  })
  expect(referencesOf(view, atNode("herbs"))).toEqual([])
})

test("what is put away is on the Trash and nowhere else", () => {
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"live","ord":"b","title":"live","see":["herbs"]}`,
    "_olai/Trash.olai": `{"id":"gone","ord":"a","title":"about @herbs","see":["herbs"]}`,
  })
  expect(said(view, "herbs")).toEqual(["live see"])
})

test("a leftover Archive.olai is not a referrer either", () => {
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"live","ord":"b","title":"live","see":["herbs"]}`,
    "Archive.olai": `{"id":"old","ord":"a","title":"about @herbs","see":["herbs"]}`,
  })
  expect(said(view, "herbs")).toEqual(["live see"])
})

test("the referrers come in corpus order, whichever index found them", () => {
  // Two files and two ways, deliberately crossed: the mention is in the file
  // that sorts FIRST and the edge in the one that sorts last, so a reading that
  // simply ran one index after the other would answer in the wrong order.
  const view = viewOf({
    "a.olai": `{"id":"early","ord":"a","title":"about @herbs"}`,
    "b.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"late","ord":"b","title":"late","see":["herbs"]}`,
  })
  expect(said(view, "herbs")).toEqual(["early mention", "late see"])
})

// ── THE THIRD WAY: a LINK, from a note or a body's prose ────────────────
//
// Item 1 of the backlinks plan: a `.md` writing `@herbs` or `[x](#herbs)` was
// invisible on the herb bed's page, and a record's note `[x](#herbs)` was in
// `recordLinks` but not a backlink. Both are references now, filed in the
// pointing index at the fold and read back here.

test("a record's note linking the node is a reference, way `link`", () => {
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"note","ord":"b","title":"note","desc":"see [the bed](#herbs) outside"}`,
  })
  expect(said(view, "herbs")).toEqual(["note link"])
})

test("a document and its headings are the same referrer question", () => {
  // Links onto a document's heading are filed under the document too, so the
  // document arm answers whole-document — and the node arm is unaffected.
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}`,
  }, [["notes/plan.md", "# plan\n\nsee [the bed](#herbs) or [the doc](notes/plan.md)"]])
  expect(said(view, "herbs")).toEqual(["notes/plan.md link"])
})

test("the referrers come in byPath order, so a directory sorts before the file beside it", () => {
  // `wing.olai` and `wing/held.olai` both point at the node; a plain `<`
  // compare would put `wing.olai` first (`.`, code point 0x2E, before `/`.
  // 0x2F). The reading uses the same `byPath` the directory is read in, which
  // sorts the separator first: the file INSIDE `wing/` comes before the file
  // named `wing.olai` beside it.
  const view = viewOf({
    "wing.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"plan","ord":"b","title":"plan","see":["herbs"]}`,
    "wing/held.olai": `{"id":"held","ord":"a","title":"held"}\n` +
      `{"id":"also","ord":"b","title":"also","see":["herbs"]}`,
  })
  expect(said(view, "herbs")).toEqual(["also see", "plan see"])
})

// ── a note is markdown, and this reading is not ────────────────────────
//
// The decision is `./derive.ts`'s `writtenTags`: this package holds no markdown
// parser, and deciding what a reference IS out of one would put a parser under
// the write gate — so what the record SAYS is the answer. What that costs is a
// disagreement with the browser, which DOES parse before it styles a tag
// (`web/src/client/markdown/tags.ts`, which reads no tag inside `code` or `a`).
//
// THE DISAGREEMENT GOES BOTH WAYS, and these tests are the enumeration. Two
// reviewers of #237 each found the prose one case short of the truth — it said
// "one case, not two" — so the cases are pinned rather than described. What
// decides every one of them is a single inherited rule: `titleTagRe` claims `@`
// only where a WORD STARTS (the beginning of the text, or after a space, `(`,
// `[` or `{`), because `@` sits inside ordinary words all the time.

test("markdown the browser skips: a `@id` that still starts a word IS a mention", () => {
  // Over-report, three shapes, all of them the same rule: the character before
  // the sigil opens a word even though the markup around it is something the
  // browser would decline to style a tag inside.
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      // A space INSIDE an inline code span. The backtick does not open a word;
      // the space after it does.
      `{"id":"spanned","ord":"b","title":"spanned","desc":"write \`see @herbs here\` please"}\n` +
      // A fenced block: the content line begins after a newline, and `\\n` is
      // whitespace, so the sigil starts a word.
      `{"id":"fenced","ord":"c","title":"fenced","desc":"\`\`\`\\n@herbs do this\\n\`\`\`"}\n` +
      // An indented block, for the same reason.
      `{"id":"indented","ord":"d","title":"indented","desc":"    @herbs do this"}\n` +
      // A link's TEXT: `[` is in the opening alphabet.
      `{"id":"linked","ord":"e","title":"linked","desc":"see [@herbs](https://example.invalid)"}`,
  })
  expect(said(view, "herbs")).toEqual([
    "spanned mention",
    "fenced mention",
    "indented mention",
    "linked mention",
  ])
})

test("...and a TIGHT code span is not one, on either side", () => {
  // The one case where the two agree, and it is worth pinning because the
  // agreement is an ACCIDENT of the sigil rule rather than knowledge: a
  // backtick is not in the opening alphabet, so nothing here has to know what
  // a code span is.
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"tight","ord":"b","title":"tight","desc":"write \`@herbs\` in the note"}`,
  })
  expect(referencesOf(view, atNode("herbs"))).toEqual([])
})

test("and the divergence runs the OTHER way too: emphasis is styled and is not a mention", () => {
  // The half that is easy to miss, and the reason "the bias is toward showing
  // more" is not a safe thing to say: `*` and `_` are not in the opening
  // alphabet, so this reading skips them — while the client's tag styling walks
  // into `em` and `strong` (they are not in `NO_TAGS_IN`) and draws the pill.
  // So a reader can see `@herbs` styled as a tag on a record's own page and not
  // find that record in the herb bed's referenced-by section.
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"emphasised","ord":"b","title":"emphasised","desc":"see *@herbs* today"}\n` +
      `{"id":"strong","ord":"c","title":"strong","desc":"see **@herbs** today"}`,
  })
  expect(referencesOf(view, atNode("herbs"))).toEqual([])
})

test("a word inside another word is not a mention", () => {
  // `titleTagRe`'s own rule for `@`, inherited rather than restated: the sigil
  // is claimed only where a word starts, because `@` sits inside addresses all
  // the time. `#herbs` is the other namespace and is never one either.
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"mail","ord":"b","title":"write to sam@herbs.example","desc":"filed under #herbs"}`,
  })
  expect(referencesOf(view, atNode("herbs"))).toEqual([])
})
// ── wikilinks ──────────────────────────────────────────────────────────

/** Who refers to one file, or one heading of it, as the document page asks. */
const referring = (view: Reading, path: string, slug?: string): ReadonlyArray<string> =>
  referencesOf(view, slug === undefined
    ? { kind: "document", path: DocumentPath.make(path) }
    : { kind: "heading", path: DocumentPath.make(path), slug: Slug.make(slug) },
  ).map((one) => `${"file" in one.source ? one.source.node.id : one.source.path} ${one.ways.join("+")}`)

const FINISHES: readonly [string, string] = ["finishes.md", "# Finishes\n\n## Doors\n\nMatte.\n"]

test("a wikilink from a document and from a row is listed once each, beside a standard link", () => {
  const view = viewOf(
    { "house.olai": `{"id":"fit","ord":"a","title":"fit the doors, see [[finishes]]","desc":"and [[finishes#Doors]] too"}` },
    [FINISHES, ["plan.md", "[[finishes]], [[Finishes|again]] and [the finishes](finishes.md)"]],
  )
  expect(referring(view, "finishes.md")).toEqual(["fit link", "plan.md link"])
})

test("a wikilink to a heading counts for the document, and for that heading alone", () => {
  const view = viewOf({}, [FINISHES, ["plan.md", "see [[finishes#Doors]]"], ["other.md", "see [[finishes]]"]])
  expect(referring(view, "finishes.md")).toEqual(["other.md link", "plan.md link"])
  expect(referring(view, "finishes.md", "doors")).toEqual(["plan.md link"])
})

test("two notes with one name each list only the notes that find them", () => {
  const view = viewOf({}, [
    ["rooms/Note.md", "# rooms"],
    ["garden/Note.md", "# garden"],
    ["rooms/plan.md", "[[Note]]"],
    ["garden/beds.md", "[[Note]]"],
  ])
  expect(referring(view, "rooms/Note.md")).toEqual(["rooms/plan.md link"])
  expect(referring(view, "garden/Note.md")).toEqual(["garden/beds.md link"])
})

test("a namesake arriving nearer the writer takes its link, with nothing re-read", () => {
  const before = viewOf({}, [["rooms/Note.md", "# rooms"], ["garden/beds.md", "[[Note]]"]])
  expect(referring(before, "rooms/Note.md")).toEqual(["garden/beds.md link"])
  const after = viewOf({}, [["rooms/Note.md", "# rooms"], ["garden/Note.md", "# garden"], ["garden/beds.md", "[[Note]]"]])
  expect(referring(after, "rooms/Note.md")).toEqual([])
  expect(referring(after, "garden/Note.md")).toEqual(["garden/beds.md link"])
})

test("a row in the Trash is left out", () => {
  const view = viewOf(
    { "_olai/Trash.olai": `{"id":"gone","ord":"a","title":"see [[finishes]]"}` },
    [FINISHES],
  )
  expect(referring(view, "finishes.md")).toEqual([])
})

test("nothing refers to itself", () => {
  const view = viewOf(
    { "house.olai": `{"id":"kitchen","ord":"a","title":"kitchen [[house.olai#kitchen]] [[house.olai]]"}` },
    [["finishes.md", "# Finishes\n\n[[finishes]] and [[#Finishes]]"]],
  )
  expect(referring(view, "finishes.md")).toEqual([])
  expect(referring(view, "house.olai")).toEqual([])
  expect(said(view, "kitchen")).toEqual([])
})

test("a bare name never finds an outline, and its suffix does", () => {
  const view = viewOf(
    { "house.olai": `{"id":"kitchen","ord":"a","title":"kitchen"}` },
    [["bare.md", "[[house]]"], ["suffixed.md", "[[house.olai]]"]],
  )
  expect(referring(view, "house.olai")).toEqual(["suffixed.md link"])
})

test("a link to a row refers to the node in it, whichever way it is written", () => {
  const view = viewOf(
    { "house.olai": `{"id":"kitchen","ord":"a","title":"kitchen"}` },
    [["wiki.md", "[[house.olai#kitchen]]"], ["standard.md", "[the kitchen](house.olai#kitchen)"]],
  )
  expect(said(view, "kitchen")).toEqual(["standard.md link", "wiki.md link"])
  expect(referring(view, "house.olai")).toEqual(["standard.md link", "wiki.md link"])
})

// THE ROW-LINK RULE'S EDGES, each spelling on its own line, since the
// differential's walk changed with the index and only these can catch a wrong
// ruling: a link to a row counts for the node when the file it names DRAWS
// that row — the file holding the node, or one holding a placement of it,
// since a page lands on the first row that shows the id, mirror or not.
const DRAWN = {
  "house.olai": `{"id":"kitchen","ord":"a","title":"kitchen"}`,
  "now.olai": `{"id":"m1","ord":"a","mirror":"kitchen"}`,
  "garden.olai": `{"id":"bed","ord":"a","title":"the bed"}`,
}

test("a link to a row counts through any file that draws the row", () => {
  const view = viewOf(DRAWN, [
    ["holder.md", "[k](house.olai#kitchen)"],
    ["mirror.md", "[k](now.olai#kitchen)"],
    ["placement.md", "[k](now.olai#m1)"],
    ["wiki-holder.md", "[[house.olai#kitchen]]"],
    ["wiki-mirror.md", "[[now.olai#kitchen]]"],
    ["wiki-placement.md", "[[now.olai#m1]]"],
  ])
  expect(said(view, "kitchen")).toEqual([
    "holder.md link",
    "mirror.md link",
    "placement.md link",
    "wiki-holder.md link",
    "wiki-mirror.md link",
    "wiki-placement.md link",
  ])
})

test("a link whose file half is stale names no row, and does not count", () => {
  const view = viewOf(DRAWN, [
    ["stale.md", "[k](garden.olai#kitchen)"],
    ["wiki-stale.md", "[[garden.olai#kitchen]]"],
    ["placement-elsewhere.md", "[k](house.olai#m1)"],
  ])
  expect(said(view, "kitchen")).toEqual([])
})

test("a link to a row from the Trash does not count", () => {
  const view = viewOf({
    ...DRAWN,
    "_olai/Trash.olai": `{"id":"gone","ord":"a","title":"[k](house.olai#kitchen) [[now.olai#kitchen]]"}`,
  })
  expect(said(view, "kitchen")).toEqual([])
})

test("a row's link to its own row, through any file, is not a reference", () => {
  const view = viewOf({
    ...DRAWN,
    "house.olai": `{"id":"kitchen","ord":"a","title":"kitchen","desc":"[here](house.olai#kitchen) [there](now.olai#kitchen) [[now.olai#m1]]"}`,
  })
  expect(said(view, "kitchen")).toEqual([])
})

test("`[[#kitchen]]` in a row names no heading, so the page and the index both leave it alone", () => {
  const view = viewOf({
    "house.olai": `{"id":"kitchen","ord":"a","title":"kitchen"}\n` +
      `{"id":"order","ord":"b","title":"after [[#kitchen]]"}\n` +
      `{"id":"std","ord":"c","title":"after [x](#kitchen)"}`,
  })
  expect(said(view, "kitchen")).toEqual(["std link"])
  expect(wikilinkAddress(view.names, view.claims, "house.olai", "#kitchen")).toBeNull()
})

// A KNOWN GAP, pinned so it moves only on purpose: the scan that finds links
// has no rule for an HTML comment, so a link inside one — either spelling — is
// counted here, while the page draws the comment as nothing at all
// (`@olai/markdown-ui`'s render test holds the other half). Closing it is a
// change to what standard links do, and is a follow-up of its own.
test("a link inside an HTML comment is counted, either spelling, though the page draws none", () => {
  const view = viewOf({}, [
    FINISHES,
    ["wiki.md", "<!-- see [[finishes]] -->"],
    ["standard.md", "<!-- see [x](finishes.md) -->"],
  ])
  expect(referring(view, "finishes.md")).toEqual(["standard.md link", "wiki.md link"])
})
