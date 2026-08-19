/**
 * What refers to a node — the reading, and the four rulings inside it.
 *
 * The INDEXES are held to `derive` by `./patch.test.ts`'s oracle; what is
 * asserted here is the meaning laid over them: which of the things a record can
 * do counts as a reference, which ids a node answers to, and who is left out.
 *
 * AND THE SAME RULINGS READ FORWARDS. `referencesOf` answers what a record
 * refers TO, which no reverse index can be asked, and the last test in this
 * file is the whole of why it lives beside `backlinksOf` rather than beside
 * the graph that needs it: over a corpus holding one of everything the rulings
 * are about, the two readings are the same set of pairs. That is the only form
 * of "these agree" that survives somebody editing one of them.
 */

import { expect, test } from "bun:test"

import { backlinksOf, referencesOf } from "./backlinks.ts"
import { derive, type Derived } from "./derive.ts"
import { setOf } from "./fixtures.testlib.ts"
import { isRegular } from "./node.ts"

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
  expect([...view.taggedBy.keys()].sort()).toEqual(["#herbs", "@herbs"])
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
  expect(backlinksOf(view, "herbs")).toEqual([])
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

// ── the same rulings, read forwards ──────────────────────────────────

/** A corpus with one of everything above at once — the two readings are
 *  compared over it, so anything a ruling covers is in the comparison. */
const BOTH_WAYS = {
  "garden.olai": [
    `{"id":"garden","ord":"a0","title":"garden"}`,
    `{"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed"}`,
    `{"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil, beside @herbs"}`,
    `{"id":"frames","parent":"garden","ord":"a1","title":"the cold frames","see":["basil"]}`,
    `{"id":"itself","parent":"garden","ord":"a2","title":"@itself and @nobody","see":["itself"]}`,
    `{"id":"shed","parent":"garden","ord":"a3","title":"the shed","see":["retired"]}`,
    `{"id":"topic","parent":"garden","ord":"a4","title":"seed order #herbs","desc":"also filed under #herbs"}`,
  ].join("\n"),
  "house.olai": [
    `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","see":["herbs"]}`,
    `{"id":"install","parent":"kitchen","ord":"a2","title":"install them","desc":"after @herbs is in","after":["order"]}`,
    `{"id":"both","parent":"kitchen","ord":"a3","title":"water @herbs","see":["herbs"]}`,
    `{"id":"kitchen-herbs","parent":"kitchen","ord":"a4","mirror":"herbs"}`,
    `{"id":"through","parent":"kitchen","ord":"a5","title":"trim @kitchen-herbs","see":["kitchen-herbs"]}`,
  ].join("\n"),
  "Archive.olai": `{"id":"retired","ord":"a0","title":"the old bed, see @herbs","see":["herbs"]}`,
}

test("a record refers to nothing when it names nothing, itself, or a word nobody claims", () => {
  const view = viewOf(BOTH_WAYS)
  const itself = view.byId.get("itself")!
  expect(isRegular(itself) ? referencesOf(view, itself) : ["not a node"]).toEqual([])
})

test("the forward reading and the backward one are about the same pairs", () => {
  const view = viewOf(BOTH_WAYS)

  // Every (referrer, target, way) the FORWARD reading finds, over every live
  // record. An ARCHIVED one is skipped on both sides rather than inside
  // `referencesOf`: that reading is asked about a record somebody named, and
  // the one caller who can name an archived one is a reader looking at a node
  // that was put away — whose page still says what it points at, exactly as
  // `backlinksOf` still says what points at it. Which records a WALK reaches is
  // the graph's own rule (`./graph.test.ts`), and it never reaches into the
  // Trash.
  const forward = new Set<string>()
  for (const at of view.nodes) {
    if (!isRegular(at) || at.file === "Archive.olai") continue
    for (const { to, ways } of referencesOf(view, at)) {
      for (const way of ways) forward.add(`${at.node.id} ${way} ${to}`)
    }
  }

  // ...and every one the BACKWARD reading finds. Asked of the NODES, never of
  // a mirror's id: `backlinksOf` answers about whatever a placement stands for
  // and files the pair under the id it was asked with, so asking about both
  // ends of a chain would be one relationship counted twice under two names.
  // The forward reading names the canonical end, which is the node.
  const backward = new Set<string>()
  for (const at of view.nodes) {
    if (!isRegular(at)) continue
    // AN ARCHIVED TARGET is the one pair the two readings disagree about, and
    // it is stated rather than papered over: `backlinksOf` asked about a node
    // that was put away still answers with its live referrers, because it is a
    // question about that node's own page. The forward reading leaves it out,
    // because what asks it is a picture that may not grow a limb into the
    // Trash — so the pairs landing on `retired` are the backward reading's
    // alone.
    if (at.file === "Archive.olai") continue
    for (const back of backlinksOf(view, at.node.id)) {
      for (const way of back.ways) backward.add(`${back.at.node.id} ${way} ${at.node.id}`)
    }
  }

  expect([...backward].sort()).toEqual([...forward].sort())
  // ...and the exclusion above is real rather than vacuous: something live does
  // point into the archive, and the forward reading does not have it.
  expect(backlinksOf(view, "retired").map((back) => back.at.node.id)).toEqual(["shed"])
  expect([...forward].some((pair) => pair.endsWith(" retired"))).toBe(false)

  // AND SO IS THE SIGIL RULE, which the two readings reach from opposite sides:
  // the backward one asks the index for the `@` key alone, the forward one
  // reads a record's written tags and keeps the `@` half. `topic` writes
  // `#herbs` twice and `@herbs` never, so an agreement that dropped it on both
  // sides for two different wrong reasons is what this rules out — the index
  // filed the topic, and neither reading calls it a reference.
  expect([...view.taggedBy.keys()]).toContain("#herbs")
  expect([...forward].some((pair) => pair.startsWith("topic "))).toBe(false)
  expect(backlinksOf(view, "herbs").map((back) => back.at.node.id)).not.toContain("topic")
})
