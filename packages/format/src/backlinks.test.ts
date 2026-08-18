/**
 * What refers to a node — the reading, and the four rulings inside it.
 *
 * The INDEXES are held to `derive` by `./patch.test.ts`'s oracle; what is
 * asserted here is the meaning laid over them: which of the things a record can
 * do counts as a reference, which ids a node answers to, and who is left out.
 */

import { expect, test } from "bun:test"

import { backlinksOf } from "./backlinks.ts"
import { derive, type Derived } from "./derive.ts"
import { setOf } from "./fixtures.testlib.ts"

const viewOf = (files: Record<string, string>): Derived => derive(setOf(files).nodes)

/** A referrer as this suite reads one: which record, and how it refers. */
const said = (derived: Derived, id: string): ReadonlyArray<string> =>
  backlinksOf(derived, id).map((one) => `${one.at.node.id} ${one.ways.join("+")}`)

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
  expect(backlinksOf(viewOf(HOUSE), "kitchen")).toEqual([])
  // An id the set does not hold has no referrers either — the same empty
  // answer, since this is a lookup rather than a claim about what exists.
  expect(backlinksOf(viewOf(HOUSE), "nobody")).toEqual([])
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
  expect(backlinksOf(viewOf(files), "alice")).toEqual([])
  const claimed = viewOf({ ...files, "b.olai": `{"id":"alice","ord":"a","title":"Alice"}` })
  expect(said(claimed, "alice")).toEqual(["note mention"])
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

test("a placement is not a reference, and neither is an ordering edge", () => {
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed","todo":true}\n` +
      `{"id":"later","ord":"b","title":"later","after":["herbs"]}\n` +
      `{"id":"sooner","ord":"c","title":"sooner","blocks":["herbs"]}`,
    "b.olai": `{"id":"m","ord":"a","mirror":"herbs"}`,
  })
  // The mirror is drawn where it sits and answered by `read_node`'s `mirrors`;
  // the two ordering edges are drawn as `blocked by` and `after` on the pages
  // that already say them. None of the three is a reference.
  expect(backlinksOf(view, "herbs")).toEqual([])
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
  expect(backlinksOf(view, "herbs")).toEqual([])
})

test("what is put away is on the Trash and nowhere else", () => {
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"live","ord":"b","title":"live","see":["herbs"]}`,
    "Archive.olai": `{"id":"gone","ord":"a","title":"about @herbs","see":["herbs"]}`,
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

// ── a note is markdown, and this reading is not ────────────────────────
//
// The decision is `./derive.ts`'s `mentionsOf`: this package holds no markdown
// parser, and deciding what a reference IS out of one would put a parser under
// the write gate — so what the record SAYS is the answer. What that costs is a
// disagreement with the browser, which DOES parse before it styles a tag
// (`web/src/client/markdown/tags.ts`, whose `SKIP_TAGS` is `code` and `a`).
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
  expect(backlinksOf(view, "herbs")).toEqual([])
})

test("and the divergence runs the OTHER way too: emphasis is styled and is not a mention", () => {
  // The half that is easy to miss, and the reason "the bias is toward showing
  // more" is not a safe thing to say: `*` and `_` are not in the opening
  // alphabet, so this reading skips them — while the client's tag styling walks
  // into `em` and `strong` (they are not in `SKIP_TAGS`) and draws the pill.
  // So a reader can see `@herbs` styled as a tag on a record's own page and not
  // find that record in the herb bed's referenced-by section.
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"emphasised","ord":"b","title":"emphasised","desc":"see *@herbs* today"}\n` +
      `{"id":"strong","ord":"c","title":"strong","desc":"see **@herbs** today"}`,
  })
  expect(backlinksOf(view, "herbs")).toEqual([])
})

test("a word inside another word is not a mention", () => {
  // `titleTagRe`'s own rule for `@`, inherited rather than restated: the sigil
  // is claimed only where a word starts, because `@` sits inside addresses all
  // the time. `#herbs` is the other namespace and is never one either.
  const view = viewOf({
    "a.olai": `{"id":"herbs","ord":"a","title":"the herb bed"}\n` +
      `{"id":"mail","ord":"b","title":"write to sam@herbs.example","desc":"filed under #herbs"}`,
  })
  expect(backlinksOf(view, "herbs")).toEqual([])
})
