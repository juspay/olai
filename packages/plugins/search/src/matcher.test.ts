/**
 * WHAT THE MATCHER ANSWERS — values in, values out, no disk and no protocol.
 *
 * These cases were `@olai/ops`' `query.test.ts` and they travelled with the
 * function they are about ({@link ./matcher.ts}, which was `Query.search`).
 * That file keeps every case about what a READ of the set answers — `read_node`,
 * `read_subtree`, `list_outlines`, the narrowing over one page — and what is
 * here is every case about the ranked, capped, situated answer this row stands
 * behind.
 *
 * Two of them are deliberately double-sided and are here for exactly that
 * reason: "a key holding nothing is carried by neither the hit nor `prop:`"
 * asserts a hit and a node read agree, and "the order is the PAGE's" asserts
 * this door and `Query.narrowing` deliberately DISAGREE about order. A claim
 * about two doors has to live where both are reachable, and after phase 13 that
 * is here — this package may import `@olai/ops`, and `@olai/ops` may not import
 * this one.
 *
 * NO INDEX in any case below, which is the same deliberate choice this
 * function's own header argues: the answer is the same with the table and
 * without it, `./table.test.ts` is where that equality is soaked, and every
 * case here is therefore a walk of the corpus.
 */

import {
  type Derived,
  type Detail,
  DocumentPath,
  isNodeHit,
  type NarrowingAnswer,
  type NodeHit,
  NO_KINDS,
  type OutlineSet,
  type PageRequest,
  type SearchAnswer,
  type SearchRequest,
} from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import { Query } from "@olai/ops"
import { succeeded } from "@olai/ops/testlib"
import { describe, expect, test } from "bun:test"

import { search } from "./matcher.ts"

/** The hits on RECORDS, which is what nearly every case below is about: a
 *  search answers with both kinds now, and a reader that draws one says so. */
const nodeHits = (answer: SearchAnswer): ReadonlyArray<NodeHit> =>
  answer.hits.filter(isNodeHit)

/** The derivation these walks are asked of: the half of a fixture READING they
 *  read. Production never builds one — `validate` pairs the set with the view
 *  it judged, and every caller is handed the pair. */
const derivedOf = (set: OutlineSet): Derived => readingOf(set).derived

/** The day every search below is asked on. A search takes one because the
 *  grammar's relative words count from it (`date:yesterday`); in the server it
 *  is the day of the ops layer's own clock (`asking`), and here it is a
 *  constant, so nothing in this file is a different test tomorrow. */
const TODAY = "2026-08-09"

/** A ledger: items in their sections, and a `Now` list made of placements —
 *  including one that CHAINS through another placement, which is the case
 *  every answer here has to follow rather than report as itself. */
const LEDGER = (): OutlineSet =>
  setOf({
    "roadmap.olai": [
      `{"id":"now","ord":"a0","title":"Now"}`,
      `{"id":"now-sticky","parent":"now","ord":"a0","mirror":"sticky"}`,
      `{"id":"now-git","parent":"now","ord":"a1","mirror":"focus-git"}`,
      `{"id":"bugs","ord":"a1","title":"Bugs"}`,
      `{"id":"sticky","parent":"bugs","ord":"a0","title":"the header scrolls away","doing":true,"after":["git"],"see":["git"]}`,
      `{"id":"git","parent":"bugs","ord":"a1","title":"two git indicators","todo":true,"desc":"the pill and the readout answer the same question","custom":{"pr":"https://github.com/juspay/olai/pull/176","agent":"claude-opus"}}`,
    ].join("\n"),
    "focus.olai": [
      `{"id":"focus","ord":"a0","title":"Focus"}`,
      // A mirror OF a mirror: `now-git` shows this, which shows `git`.
      `{"id":"focus-git","parent":"focus","ord":"a0","mirror":"git"}`,
    ].join("\n"),
  })

/** The whole READING a search is asked of, because it answers with both kinds
 *  of thing: the derivation is where the records are matched, and the set is
 *  where the documents are. */
const reading = () => readingOf(LEDGER())

/** A node read that ANSWERED — the ops layer's own door, used by the two cases
 *  below whose claim is that a hit and a read say the same thing. */
const read = (of: Derived, id: string): Detail | null =>
  succeeded(Query.detail(of, id), "`read_node` to answer")

/** A set with both sigils, including the same NAME under each — which is the
 *  whole reason the sigil is reported. `@olai/ops`' own suite keeps a copy for
 *  the read side of the same contract. */
const TAGGED = (): OutlineSet =>
  setOf({
    "work.olai": [
      `{"id":"call","ord":"a0","title":"call @alice about #alice/onboarding"}`,
      `{"id":"plain","ord":"a1","title":"nothing to see here"}`,
    ].join("\n"),
  })

describe("the fields a hit carries", () => {
  test("a search hit carries `after` and `see`, and omits what is not there", () => {
    const hits = search(reading(), { text: "header" }, TODAY, NO_KINDS).hits
    expect(hits[0]).toMatchObject({ id: "sticky", after: ["git"], see: ["git"] })
    // A node that points nowhere does not pretend to: absence is how the
    // format spells an empty list, and an answer follows the format.
    const other = search(reading(), { text: "indicators" }, TODAY, NO_KINDS).hits[0]
    expect(other).toMatchObject({ id: "git" })
    expect(other).not.toHaveProperty("after")
    expect(other).not.toHaveProperty("see")
  })


  /** THE HIT, which is the point of the field being on `Found` at all: a board
   *  asking "every lane at review" is one call, not one call and a `read_node`
   *  per row to see the fact the query already matched on.
   *
   *  Both ways of reaching the node in ONE test, because they are one path — a
   *  word and a `prop:` clause select through the same `matching`, and what a
   *  hit then carries is `foundOf`'s answer either way. What the second half
   *  pins is the round trip the field exists to remove, not a second branch. */
  test("a search hit answers the map, verbatim and uncut — found by word or by property", () => {
    expect(search(reading(), { text: "indicators" }, TODAY, NO_KINDS).hits[0]).toMatchObject({
      id: "git",
      custom: { pr: "https://github.com/juspay/olai/pull/176", agent: "claude-opus" },
    })
    // The orchestration board's own query: select by the agent, and the answer
    // already holds the PR.
    const byProp = nodeHits(search(reading(), { text: "prop:agent=claude-opus" }, TODAY, NO_KINDS))
    expect(byProp.map((hit) => hit.id)).toEqual(["git"])
    expect(byProp[0]?.custom?.["pr"]).toBe("https://github.com/juspay/olai/pull/176")
  })


  /**
   * WHY the hit is here, when the reason is a property — the half `matched`
   * cannot carry, and the reason it is a field of its own.
   *
   * Both halves on one hit is the case that settles the design: a query naming
   * a word AND a property matched on both, and one slot would have had to drop
   * whichever a precedence rule nobody asked for preferred.
   */
  test("a hit says which property carried it, beside which field carried the words", () => {
    const [byProp] = nodeHits(search(reading(), { text: "prop:agent=claude-opus" }, TODAY, NO_KINDS))
    expect(byProp?.matchedProps).toEqual(["agent"])
    // No words in that query, so no field carried it — and `matched` still
    // means exactly what it meant.
    expect(byProp).not.toHaveProperty("matched")

    const [both] = nodeHits(search(reading(), { text: "indicators prop:pr" }, TODAY, NO_KINDS))
    expect(both).toMatchObject({ id: "git", matched: "title", matchedProps: ["pr"] })
  })


  test("a query that named no property leaves the field off entirely", () => {
    expect(search(reading(), { text: "indicators" }, TODAY, NO_KINDS).hits[0]).not.toHaveProperty("matchedProps")
  })


  test("a hit for a node carrying none says nothing, as its read does", () => {
    const hit = search(reading(), { text: "header" }, TODAY, NO_KINDS).hits[0]
    expect(hit).toMatchObject({ id: "sticky" })
    expect(hit).not.toHaveProperty("custom")
  })


  /**
   * An answer and the GRAMMAR agree about what a node carries, which is one
   * rule and not two.
   *
   * A key holding nothing is a key the file does not carry (`write.ts`'s
   * `nothing`, read one map in by `prop:` already). The answer used to ask a
   * different question — is the MAP empty — so a node written by hand with
   * `{"custom":{"pr":""}}` reported `custom: {"pr": ""}` on a hit that
   * `prop:pr` did not return. Same node, same query language, two answers.
   */
  test("a key holding nothing is carried by neither the hit nor `prop:`", () => {
    const lane = readingOf(setOf({
      "roadmap.olai": `{"id":"lane","ord":"a0","title":"a lane","custom":{"pr":"","agent":"claude-opus"}}`,
    }))
    // The key `prop:` refuses is the key the answer leaves out…
    expect(search(lane, { text: "prop:pr" }, TODAY, NO_KINDS).hits).toEqual([])
    expect(nodeHits(search(lane, { text: "lane" }, TODAY, NO_KINDS))[0]?.custom)
      .toEqual({ agent: "claude-opus" })
    // …and a map with nothing but such keys is no map at all, exactly as it is
    // no `custom` field on disk.
    const bare = readingOf(setOf({
      "roadmap.olai": `{"id":"bare","ord":"a0","title":"a bare lane","custom":{"pr":""}}`,
    }))
    expect(search(bare, { text: "lane" }, TODAY, NO_KINDS).hits[0]).not.toHaveProperty("custom")
    expect(read(bare.derived, "bare")).not.toHaveProperty("custom")
  })


  /** A long value travels WHOLE. The wire-cost decision, pinned rather than
   *  left to whoever next reads a hit and wonders whether it was cut: a value
   *  cut at some length is one no reader can tell from a short one, and the
   *  first casualty would be the half of a URL that makes it a link. The dial
   *  on an answer's size is `limit`, and that one is exact. */
  test("a long property is not truncated on a hit, and not reduced to its key", () => {
    const long = `https://github.com/juspay/olai/pull/176#${"x".repeat(500)}`
    const set = setOf({
      "roadmap.olai": `{"id":"lane","ord":"a0","title":"a lane","custom":{"pr":${
        JSON.stringify(long)
      }}}`,
    })
    expect(nodeHits(search(readingOf(set), { text: "lane" }, TODAY, NO_KINDS))[0]?.custom)
      .toEqual({ pr: long })
  })


  /**
   * THE OTHER ARM CARRIES THE SAME TWO FIELDS, and that is the whole of what a
   * document gained: a `.md` writes named facts about itself in the `---` block
   * at the top (`@olai/format`'s `frontmatter.ts`), so `prop:` selects one, and
   * the hit says both what the file carries and which key was the reason.
   *
   * Pinned HERE rather than only in the format, for this file's own reason: the
   * fields are optional on the wire, so one produced by the matcher and not
   * spread onto the hit type-checks clean everywhere and is silently absent
   * from every answer an agent and the palette read.
   */
  test("a document hit carries its frontmatter and the key that selected it", () => {
    const vault = readingOf(setOf(
      { "roadmap.olai": `{"id":"lane","ord":"a0","title":"a lane"}` },
      [
        ["notes/plan.md", "---\npr: 176\nagent: claude-opus\n---\n\n# The plan\n"],
        ["brief.md", "# Brief\n"],
      ],
    ))
    const [hit] = search(vault, { text: "prop:agent=claude-opus" }, TODAY, NO_KINDS).hits
    expect(hit).toMatchObject({
      at: { kind: "document", path: "notes/plan.md" },
      title: "The plan",
      props: { pr: "176", agent: "claude-opus" },
      matchedProps: ["agent"],
    })
    // No words in that query, so no field carried it.
    expect(hit).not.toHaveProperty("matched")
    // …and the keys arrive in the FILE's canonical order — alphabetical, not
    // the order the block happens to write them (`heldCustom`). A node hit's
    // `custom` has always come back that way, and two orderings of one open
    // map inside one ranked answer is a difference a reader would see.
    expect(Object.keys((hit as { props: object }).props)).toEqual(["agent", "pr"])
    // A document with no block says nothing, exactly as a node with no map
    // does — absence has one spelling here too.
    const [plain] = search(vault, { text: "brief" }, TODAY, NO_KINDS).hits
    expect(plain).toMatchObject({ at: { kind: "document", path: "brief.md" } })
    expect(plain).not.toHaveProperty("props")
    expect(plain).not.toHaveProperty("matchedProps")
  })


  test("a search hit carries it too — the same field, one `foundOf`", () => {
    expect(nodeHits(search(reading(), { text: "indicators" }, TODAY, NO_KINDS))[0])
      .toMatchObject({ id: "git", parent: "bugs" })
    expect(nodeHits(search(reading(), { text: "Bugs" }, TODAY, NO_KINDS))[0])
      .not.toHaveProperty("parent")
  })
})

describe("what a shortlist selects", () => {
  /**
   * And the QUESTION about those edges, asked through the door an agent uses:
   * `sticky` is `doing` and waits on `git`, which is `todo`, so the ledger
   * draws it blocked and `search_nodes` answers with it.
   *
   * What each operator SELECTS is `@olai/format`'s (`filter.test.ts` holds the
   * grammar, including this one's derived half). What is pinned here is that a
   * SHORTLIST answers it at all — this is the only operator whose answer is not
   * in the record, so it is the only one this layer's ranking and capping walk
   * past a value it did not read off the node.
   */
  test("`is:blocked` reaches an agent as the derivation the page draws", () => {
    expect(nodeHits(search(reading(), { text: "is:blocked" }, TODAY, NO_KINDS)).map((hit) => hit.id))
      .toEqual(["sticky"])
    // And the negation through the same door. Named rather than enumerated:
    // what the clause has to get right is that `sticky` LEAVES and `git` —
    // unfinished work with nothing in its way, the blocker itself — stays. A
    // list of every other node in the fixture would break for reasons that
    // have nothing to do with blockedness.
    const free = search(reading(), { text: "-is:blocked" }, TODAY, NO_KINDS).hits.filter(isNodeHit).map((hit) => hit.id)
    expect(free).not.toContain("sticky")
    expect(free).toContain("git")
  })


  test("a search never answers with a placement", () => {
    // A hit for a mirror would be the same node twice, once at a place no
    // write lands.
    expect(search(reading(), { text: "git" }, TODAY, NO_KINDS).hits.filter(isNodeHit).map((hit) => hit.id))
      .not.toContain("now-git")
  })


  // The index's own half of the same contract: a tag is searchable BARE and as
  // written, so a bare word still finds it and a sigil narrows to one
  // namespace.
  test("a tag is found by its name and by its written form", () => {
    const set = readingOf(TAGGED())
    for (const text of ["alice", "@alice", "#alice"]) {
      expect(nodeHits(search(set, { text }, TODAY, NO_KINDS)).map((hit) => hit.id)).toEqual(["call"])
    }
  })


  /**
   * THE TWO DOORS ONTO ONE MATCHER, over one query, side by side.
   *
   * It lives here rather than beside `narrowing`'s own cases (`@olai/ops`'
   * `query.test.ts`) because it is the one claim that needs BOTH doors, and
   * after phase 13 only this package can reach both: the shortlist is this
   * row's and the page filter is core's, and the arrow runs one way.
   */
  test("the order is the PAGE's, where a search's is the ranking", () => {
    // The pile the page filter's own cases are asked over, kept here for the
    // one case that compares the two answers. `hinges` is finished, so the
    // shortlist sinks it under the done penalty and the page's answer leaves it
    // where the page puts it: a page draws its rows in the page's order and
    // looks each one up, and the day that starts ranking is the day a filtered
    // outline reorders itself under a cursor.
    const PILE = (): OutlineSet =>
      setOf({
        "house.olai": [
          `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
          `{"id":"order","parent":"kitchen","ord":"a0","title":"order the doors","desc":"walnut, or birch"}`,
          `{"id":"hinges","parent":"kitchen","ord":"a1","title":"pick the door hinges","done":"2026-08-02"}`,
          `{"id":"tiles","parent":"kitchen","ord":"a2","title":"the door mat"}`,
        ].join("\n"),
        "shed.olai": `{"id":"shed","ord":"a0","title":"the shed door"}`,
        "_olai/Trash.olai": `{"id":"old","ord":"a0","title":"the old door"}`,
      })
    const AT_HOUSE: PageRequest = {
      kind: "at",
      address: { kind: "document", path: DocumentPath.make("house.olai") },
    }
    const narrowed: NarrowingAnswer = Query.narrowing(
      readingOf(PILE()),
      { page: AT_HOUSE, text: "door" },
      TODAY,
      NO_KINDS,
    )
    expect(narrowed.matches.map((one): string => one.id)).toEqual(["order", "hinges", "tiles"])
    expect(nodeHits(search(readingOf(PILE()), { text: "door" }, TODAY, NO_KINDS)).map((hit) => hit.id))
      .toEqual(["order", "tiles", "shed", "hinges"])
  })
})

/**
 * A SELECTION WITH ITS NOTES — the other half of the same item, and the one
 * field of a record a hit does not carry unless it is asked for.
 *
 * The rule is the same at both ends: a note is unbounded prose, so a query that
 * will not read one does not pay for twelve of them — and one that will gets
 * them WHOLE, in the call that made the selection, rather than in a `read_node`
 * per hit.
 */
describe("the notes a query asks for", () => {
  test("a hit carries `desc` when the query asked, and never otherwise", () => {
    const [asked] = nodeHits(search(reading(), { text: "indicators", withDesc: true }, TODAY, NO_KINDS))
    expect(asked).toMatchObject({
      id: "git",
      desc: "the pill and the readout answer the same question",
    })
    // …and the same node, same query, without the flag.
    expect(nodeHits(search(reading(), { text: "indicators" }, TODAY, NO_KINDS))[0])
      .not.toHaveProperty("desc")
    // Off is what an absent flag means, said out loud rather than inferred from
    // the line above: `false` and absent are one answer.
    expect(nodeHits(search(reading(), { text: "indicators", withDesc: false }, TODAY, NO_KINDS))[0])
      .not.toHaveProperty("desc")
  })

  test("a node with no note says nothing, asked or not", () => {
    // The format's own rule for absence, and it means a caller can read `desc`
    // the same way whether it asked or not — absent is absent.
    expect(nodeHits(search(reading(), { text: "header", withDesc: true }, TODAY, NO_KINDS))[0])
      .not.toHaveProperty("desc")
  })

  test("the note travels WHOLE — the flag is the dial, never a length", () => {
    // A cut note is one no reader can tell from a short one, and `set_desc` and
    // `update`'s `was` both take the note as ONE text: a shortened one is a note
    // an edit gets written against. The same argument `custom`'s values won.
    const long = `forensics: ${"the pill said committed while nothing was. ".repeat(40)}`
    // Through `JSON.stringify` rather than a hand-written line, because what
    // this case is about is a note far too long to write out in one.
    const set = setOf({
      "bugs.olai": JSON.stringify({
        id: "one",
        ord: "a0",
        title: "the commit pill lies",
        todo: true,
        desc: long,
      }),
    })
    expect(nodeHits(search(readingOf(set), { text: "pill", withDesc: true }, TODAY, NO_KINDS))[0]?.desc)
      .toBe(long)
  })

  test("a document hit is untouched by the flag", () => {
    // A `.md`'s prose is the file, and `read_document` is how a file is read —
    // so there is nothing on this arm for the flag to turn on.
    const set = setOf(
      { "bugs.olai": `{"id":"one","ord":"a0","title":"a bug"}` },
      [["notes/bug.md", "# a bug\n\nthe prose lives here\n"]],
    )
    const [hit] = search(readingOf(set), { text: "bug", withDesc: true }, TODAY, NO_KINDS).hits
      .filter((one) => one.at.kind === "document")
    expect(hit).toMatchObject({ at: { kind: "document", path: "notes/bug.md" } })
    expect(hit).not.toHaveProperty("desc")
  })
})

/**
 * The operators, from THIS side of the seam.
 *
 * What each one selects is `@olai/format`'s (`filter.test.ts` holds the
 * grammar); what is pinned here is that this procedure is a caller of it —
 * that an agent typing `is:done` gets the same reading the browser's filter
 * gets, that a scope is askable, and that the two things this layer still
 * decides for itself (the shortlist and what it says about a hit) survive a
 * query that named no words.
 */
describe("a query is words and operators", () => {
  const WORK = (): OutlineSet =>
    setOf({
      "work.olai": [
        `{"id":"trip","ord":"a0","title":"the trip"}`,
        `{"id":"book","parent":"trip","ord":"a0","title":"book the flights","done":"2026-08-03"}`,
        `{"id":"pack","parent":"trip","ord":"a1","title":"pack","todo":true,"desc":"the small case"}`,
        `{"id":"house","ord":"a1","title":"the house"}`,
        `{"id":"paint","parent":"house","ord":"a0","title":"paint the hall","done":"2026-08-09"}`,
      ].join("\n"),
      "_olai/Trash.olai": `{"id":"old","ord":"a0","title":"an old trip","done":"2026-01-01"}`,
    })

  const ids = (query: SearchRequest): ReadonlyArray<string> =>
    search(readingOf(WORK()), query, TODAY, NO_KINDS).hits.filter(isNodeHit).map((hit) => hit.id)

  test("an operator gates the words, and the two compose", () => {
    expect(ids({ text: "is:done" })).toEqual(["book", "paint"])
    // "the" is in all five (`pack` carries it in its note); the clause is what
    // cuts them, and what this layer still decides about the answer is the CAP
    // and the situating — the order is `@olai/format`'s `ranked`, called from
    // here (`./query.ts`).
    expect(ids({ text: "the is:done" })).toEqual(["book", "paint"])
    expect(ids({ text: "the -is:done" })).toEqual(["trip", "house", "pack"])
    expect(ids({ text: "has:desc" })).toEqual(["pack"])
    expect(ids({ text: "date:2026-08-09" })).toEqual(["paint"])
  })

  // The relative words reach this door through the same grammar, counted from
  // the day handed in — which in the server is the day of the ops layer's own
  // clock (`./tools.ts`'s `asking`), the one a `done` is stamped with. `paint`
  // was finished on the 9th, which is the day this reading is asked on and a
  // Sunday — so the week it closes is the one `book` opened on the Monday.
  test("a relative date is counted from the day the search is asked on", () => {
    expect(ids({ text: "date:today" })).toEqual(["paint"])
    expect(ids({ text: "date:this-week" })).toEqual(["book", "paint"])
    expect(ids({ text: "date:last-week" })).toEqual([])
    expect(ids({ text: "date:tomorrow" })).toEqual([])
    expect(ids({ text: "date:this-month" })).toEqual(["book", "paint"])
  })

  // A phrase and a group reach this door the way every other part of the
  // grammar does — through the one `parseFilter` — so what an agent can ask for
  // is what a person can type into the filter. Ordered by the format's `ranked`,
  // which is what the chat composer's own list orders by: one answer about
  // whether a finished node outranks an open one, wherever it is asked.
  test("a phrase and an `OR` group reach the ranked door too", () => {
    expect(ids({ text: `"book the flights"` })).toEqual(["book"])
    // The same words, with the order between them no longer part of the query.
    expect(ids({ text: `"flights the book"` })).toEqual([])
    expect(ids({ text: "flights the book" })).toEqual(["book"])
    // Either one, and both are still gated by the clause beside them.
    expect(ids({ text: "flights OR hall" })).toEqual(["book", "paint"])
    expect(ids({ text: "is:done flights OR hall" })).toEqual(["book", "paint"])
    expect(ids({ text: "-is:done flights OR hall" })).toEqual([])
  })

  test("a refused operator answers with nothing rather than with half the query", () => {
    expect(ids({ text: "is:open trip" })).toEqual([])
  })

  // The two refusals this grammar grew with quoting and `OR`, on the door three
  // of the four faces read their refusals from: an unclosed quote and a joiner
  // with nothing on one side of it are told the same way `is:open` is.
  test("an unclosed quote and a dangling `OR` carry their reasons too", () => {
    expect(search(readingOf(WORK()), { text: `"book the` }, TODAY, NO_KINDS).refusals)
      .toEqual([{
        token: `"book the`,
        reason: `a quote nothing closes — a phrase runs from one " to the next`,
      }])
    expect(search(readingOf(WORK()), { text: "trip OR" }, TODAY, NO_KINDS).refusals)
      .toEqual([{
        token: "OR",
        reason: "OR joins the token before it to the token after it — one of them is missing",
      }])
  })

  // ...AND WITH THE REASON. This layer is the only one that has both the
  // parser's answer and a caller to hand it to, so a door that dropped it would
  // answer `is:open` with an empty list and no explanation — the silent
  // failure the refusals were written to prevent. Three of the four doors read
  // it from here.
  test("a refused query carries the reason to whoever asked", () => {
    const answer = search(readingOf(WORK()), { text: "is:open trip" }, TODAY, NO_KINDS)
    expect(answer.refusals).toEqual([{
      token: "is:open",
      reason: "is: takes one of done, cancelled, doing, todo, marked, blocked, mirrored, trashed",
    }])
    // As TYPED — an agent that echoed the folded token back to a person would
    // be quoting them wrongly.
    expect(search(readingOf(WORK()), { text: "is:OPEN" }, TODAY, NO_KINDS).refusals?.[0]?.token)
      .toBe("is:OPEN")
  })

  // An empty query and a refused one both answer with no hits, and only one of
  // them has anything to say about it: there is no question to have refused.
  test("a query nobody typed carries no refusal", () => {
    const answer = search(readingOf(WORK()), { text: "  " }, TODAY, NO_KINDS)
    expect(answer).toEqual({ hits: [], total: 0 })
    expect(answer).not.toHaveProperty("refusals")
    expect(search(readingOf(WORK()), { text: "trip" }, TODAY, NO_KINDS)).not.toHaveProperty("refusals")
  })

  test("the archive is out of it unless the query says so", () => {
    expect(ids({ text: "trip" })).toEqual(["trip"])
    expect(ids({ text: "trip is:trashed" })).toEqual(["old"])
  })

  test("a scope narrows to one outline, or to one node and what is beneath it", () => {
    expect(ids({ text: "is:done", file: "work.olai" })).toEqual(["book", "paint"])
    expect(ids({ text: "is:done", under: "trip" })).toEqual(["book"])
    expect(ids({ text: "is:done", file: "_olai/Trash.olai", under: "trip" })).toEqual([])
  })

  test("a hit says which field carried the words — and says nothing when none did", () => {
    expect(search(readingOf(WORK()), { text: "flights" }, TODAY, NO_KINDS).hits[0])
      .toMatchObject({ id: "book", matched: "title" })
    const marked = search(readingOf(WORK()), { text: "is:todo" }, TODAY, NO_KINDS).hits[0]
    expect(marked).toMatchObject({ id: "pack" })
    expect(marked).not.toHaveProperty("matched")
  })

  test("a finished node still loses ties, and the total is still uncapped", () => {
    // `book` and `paint` both match on their title; `book` is written first
    // and both are done, so order is the file's and the count is honest.
    const answer = search(readingOf(WORK()), { text: "is:done", limit: 1 }, TODAY, NO_KINDS)
    expect(answer.hits.filter(isNodeHit).map((hit) => hit.id)).toEqual(["book"])
    expect(answer.total).toBe(2)
  })
})
