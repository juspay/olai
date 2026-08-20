/**
 * What an agent READS of a set — values in, values out, no disk and no
 * protocol, the same bargain {@link ./plan.test.ts} makes about writes.
 *
 * The half these tests exist for is the half a write cannot reach: a placement
 * and an edge are both written BY ID, so a caller that cannot read them back
 * can only guess. The wire tests in `@olai/server` cover one happy path each
 * through a real MCP client; this is where the shapes are pinned, because a
 * field dropped from a search hit would fail nothing over there.
 */

import {
  type Derived,
  Found,
  isNodeHit,
  NodeId,
  type NodeHit,
  type OutlineSet,
  type SearchAnswer,
} from "@olai/format"
import { describe, expect, test } from "bun:test"

import { readingOf, setOf } from "./fixtures.testlib.ts"
import {
  dated,
  detail,
  matches,
  named,
  outlines,
  owed,
  search,
  subtree,
  tags,
} from "./query.ts"

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
 *  is the day of the layer's own clock (`./tools.ts`'s `asking`), and here it
 *  is a constant, so nothing in this file is a different test tomorrow. */
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
      `{"id":"git","parent":"bugs","ord":"a1","title":"two git indicators","todo":true,"custom":{"pr":"https://github.com/juspay/olai/pull/176","agent":"claude-opus"}}`,
    ].join("\n"),
    "focus.olai": [
      `{"id":"focus","ord":"a0","title":"Focus"}`,
      // A mirror OF a mirror: `now-git` shows this, which shows `git`.
      `{"id":"focus-git","parent":"focus","ord":"a0","mirror":"git"}`,
    ].join("\n"),
  })

const at = () => derivedOf(LEDGER())

/** The whole READING — what a search is asked of now that it answers with both
 *  kinds of thing: the derivation is where the records are matched, and the set
 *  is where the documents are. */
const reading = () => readingOf(LEDGER())

/**
 * EVERY field {@link Found} declares is one this layer actually fills.
 *
 * The floor's record fields are all OPTIONAL, so a field declared there and
 * never produced by `foundOf` type-checks clean everywhere and is silently
 * absent from every answer — which is precisely how a field once reached an
 * agent through `search_nodes` and was dropped on the way to the palette
 * (`@olai/format`'s `searching.ts` header). `carriedOf`'s list and `Found`'s
 * are two hand-written lists of the same three fields; this is the cheap thing
 * that fails when they stop agreeing, and it names the field when it does.
 */
test("a node carrying everything produces every field `Found` declares", () => {
  const at = derivedOf(setOf({
    "roadmap.olai": [
      `{"id":"top","ord":"a0","title":"Top"}`,
      `{"id":"all","parent":"top","ord":"a0","title":"carries everything","todo":true,` +
      `"see":["top"],"after":["top"],"custom":{"pr":"https://github.com/juspay/olai/pull/192"}}`,
    ].join("\n"),
  }))
  // A child in a node's list is a plain `Found` — no `matched`, which is the
  // query's fact rather than the record's.
  const carrying = detail(at, "top")?.children[0]
  expect(carrying?.id).toBe("all")
  expect(Object.keys(carrying ?? {}).sort()).toEqual(Object.keys(Found.fields).sort())
})

describe("the edges a node carries", () => {
  test("a search hit carries `after` and `see`, and omits what is not there", () => {
    const hits = search(reading(), { text: "header" }, TODAY).hits
    expect(hits[0]).toMatchObject({ id: "sticky", after: ["git"], see: ["git"] })
    // A node that points nowhere does not pretend to: absence is how the
    // format spells an empty list, and an answer follows the format.
    const other = search(reading(), { text: "indicators" }, TODAY).hits[0]
    expect(other).toMatchObject({ id: "git" })
    expect(other).not.toHaveProperty("after")
    expect(other).not.toHaveProperty("see")
  })

  test("a node read carries them too, and so does a child in its list", () => {
    const bugs = detail(at(), "bugs")
    expect(bugs?.children.find((child) => child.id === "sticky"))
      .toMatchObject({ after: ["git"] })
    expect(detail(at(), "sticky")).toMatchObject({ after: ["git"], see: ["git"] })
  })

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
    expect(nodeHits(search(reading(), { text: "is:blocked" }, TODAY)).map((hit) => hit.id))
      .toEqual(["sticky"])
    // And the negation through the same door. Named rather than enumerated:
    // what the clause has to get right is that `sticky` LEAVES and `git` —
    // unfinished work with nothing in its way, the blocker itself — stays. A
    // list of every other node in the fixture would break for reasons that
    // have nothing to do with blockedness.
    const free = search(reading(), { text: "-is:blocked" }, TODAY).hits.filter(isNodeHit).map((hit) => hit.id)
    expect(free).not.toContain("sticky")
    expect(free).toContain("git")
  })
})

/**
 * The DERIVED half of the ordering graph, on a node read — what is standing in
 * the way right now, rather than the ids the record happens to name.
 *
 * A page has drawn this since blockedness existed; an agent could not ask for
 * it at all, and reconstructing it from `after` is not the same answer — it
 * would count a `done` target and a bullet as obstacles, and would miss the
 * edge the other record wrote as `blocks` entirely. Which is the whole reason
 * it is a field: one derivation (`@olai/format`'s `blockersOf`, where the rule
 * is argued and tested), answered at both faces.
 *
 * A set of its own rather than the ledger above, because the case that names
 * the rule is a BULLET carrying an `after` — a shape `LEDGER` has no room for,
 * and one every other test in this file would have to be re-read against.
 */
describe("what a node is waiting on", () => {
  /** A slab, a cure, a frame and a shelf: the three answers this field has, in
   *  one file. `frame` waits on both `pour` (its own `after`) and `cure`
   *  (written from the other end as `blocks`); `pour` is unfinished work with
   *  nothing before it; `chips` names the same unfinished target and is a
   *  bullet, so nothing is telling it it cannot start. */
  const WAITING = (): OutlineSet =>
    setOf({
      "build.olai": [
        `{"id":"pour","ord":"a0","title":"pour the slab","todo":true}`,
        `{"id":"cure","ord":"a1","title":"let it cure","doing":true,"blocks":["frame"]}`,
        `{"id":"frame","ord":"a2","title":"frame the walls","todo":true,"after":["pour"]}`,
        `{"id":"chips","ord":"a3","title":"paint chips on the shelf","after":["pour"]}`,
      ].join("\n"),
    })

  const waiting = () => derivedOf(WAITING())

  test("a blocked node names every blocker, situated and marked", () => {
    // In the order the format promises: the node's own `after` first, then the
    // `blocks` pointing back at it from elsewhere. And each blocker is a whole
    // situated answer, so "has this moved" needs no second read.
    expect(detail(waiting(), "frame")?.blockedBy).toEqual([
      { id: "pour", title: "pour the slab", file: "build.olai", line: 1, status: "todo", path: [] },
      { id: "cure", title: "let it cure", file: "build.olai", line: 2, status: "doing", path: [] },
    ])
  })

  test("a node with nothing in its way does not say so with an empty list", () => {
    // `pour` is the blocker itself — unfinished work, and nothing before it.
    // Absence is how the format spells nothing, and an answer follows it.
    expect(detail(waiting(), "pour")).not.toHaveProperty("blockedBy")
  })

  test("a bullet is waiting on nothing, whatever `after` it carries", () => {
    // The one case that separates this field from the record's: `chips` names
    // `pour`, which IS unfinished — but a bullet is not work, so nothing is
    // telling it it cannot start. The record's own field still answers.
    const chips = detail(waiting(), "chips")
    expect(chips).toMatchObject({ after: ["pour"] })
    expect(chips).not.toHaveProperty("blockedBy")
  })
})

/**
 * The custom map, on a node read — every named fact it carries, and nothing
 * invented for a node that carries none.
 *
 * Without it `set_prop` would be a write whose result no read could show, which
 * is the gap `see` and `after` were given their own fields on an answer to
 * close: a value written by id and unreadable can only be changed by guessing.
 */
describe("the properties a node carries", () => {
  test("a node read answers the map, verbatim", () => {
    expect(detail(at(), "git")?.custom).toEqual({
      pr: "https://github.com/juspay/olai/pull/176",
      agent: "claude-opus",
    })
    // Beside the fields, not instead of them: the mark is still `todo`.
    expect(detail(at(), "git")).toMatchObject({ todo: true, status: "todo" })
  })

  test("a node with no properties carries no map, rather than an empty one", () => {
    expect(detail(at(), "bugs")).not.toHaveProperty("custom")
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
    expect(search(reading(), { text: "indicators" }, TODAY).hits[0]).toMatchObject({
      id: "git",
      custom: { pr: "https://github.com/juspay/olai/pull/176", agent: "claude-opus" },
    })
    // The orchestration board's own query: select by the agent, and the answer
    // already holds the PR.
    const byProp = nodeHits(search(reading(), { text: "prop:agent=claude-opus" }, TODAY))
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
    const [byProp] = nodeHits(search(reading(), { text: "prop:agent=claude-opus" }, TODAY))
    expect(byProp?.matchedProps).toEqual(["agent"])
    // No words in that query, so no field carried it — and `matched` still
    // means exactly what it meant.
    expect(byProp).not.toHaveProperty("matched")

    const [both] = nodeHits(search(reading(), { text: "indicators prop:pr" }, TODAY))
    expect(both).toMatchObject({ id: "git", matched: "title", matchedProps: ["pr"] })
  })

  test("a query that named no property leaves the field off entirely", () => {
    expect(search(reading(), { text: "indicators" }, TODAY).hits[0]).not.toHaveProperty("matchedProps")
  })

  test("a hit for a node carrying none says nothing, as its read does", () => {
    const hit = search(reading(), { text: "header" }, TODAY).hits[0]
    expect(hit).toMatchObject({ id: "sticky" })
    expect(hit).not.toHaveProperty("custom")
  })

  test("a child in a node's list and a subtree row carry it, like `see`", () => {
    // Every situated answer is built out of one `foundOf`, so this follows from
    // the hit rather than being a second decision — the same shape the edge
    // test above pins for `see` and `after`.
    expect(detail(at(), "bugs")?.children.find((child) => child.id === "git"))
      .toMatchObject({ custom: { agent: "claude-opus" } })
    const walked = subtree(at(), "bugs", { depth: 1 })
    expect(walked?.children.find((child) => child.id === "git"))
      .toMatchObject({ custom: { agent: "claude-opus" } })
    expect(walked?.children.find((child) => child.id === "sticky"))
      .not.toHaveProperty("custom")
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
    expect(search(lane, { text: "prop:pr" }, TODAY).hits).toEqual([])
    expect(nodeHits(search(lane, { text: "lane" }, TODAY))[0]?.custom)
      .toEqual({ agent: "claude-opus" })
    // …and a map with nothing but such keys is no map at all, exactly as it is
    // no `custom` field on disk.
    const bare = readingOf(setOf({
      "roadmap.olai": `{"id":"bare","ord":"a0","title":"a bare lane","custom":{"pr":""}}`,
    }))
    expect(search(bare, { text: "lane" }, TODAY).hits[0]).not.toHaveProperty("custom")
    expect(detail(bare.derived, "bare")).not.toHaveProperty("custom")
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
    expect(nodeHits(search(readingOf(set), { text: "lane" }, TODAY))[0]?.custom)
      .toEqual({ pr: long })
  })
})

describe("what refers to a node", () => {
  /**
   * The reverse of a reference, through the door an agent uses.
   *
   * `sticky` does BOTH things to `git` — it sees it and it comes after it — and
   * only the first is a reference: the ordering edge is already answered by
   * `after` on the record and by the blockedness derived from it, so counting
   * it here would say one edge twice under a word that means something else.
   * The placements chained onto `git` are not references either, and they are
   * answered one describe up as `mirrors`.
   */
  test("a `see` is a reference and an ordering edge is not", () => {
    expect(detail(at(), "git")?.referencedBy).toEqual([
      {
        id: "sticky",
        title: "the header scrolls away",
        file: "roadmap.olai",
        line: 5,
        status: "doing",
        path: ["Bugs"],
        see: ["git"],
        after: ["git"],
        ways: ["see"],
      },
    ])
  })

  test("a word in a title or a note refers too, and one record is one referrer", () => {
    const at = derivedOf(setOf({
      "a.olai": [
        `{"id":"git","ord":"a0","title":"two git indicators"}`,
        `{"id":"said","ord":"a1","title":"about @git","desc":"and @git again"}`,
        `{"id":"both","ord":"a2","title":"see @git","see":["git"]}`,
      ].join("\n"),
    }))
    expect(detail(at, "git")?.referencedBy?.map((one) => `${one.id} ${one.ways.join("+")}`))
      .toEqual(["said mention", "both see+mention"])
  })

  test("a node nobody has written about says nothing rather than an empty list", () => {
    expect(detail(at(), "sticky")).not.toHaveProperty("referencedBy")
  })
})
describe("placements", () => {
  /** WHERE ELSE this node is drawn — the id half of `remove_mirror`, and the
   *  only way to reach a placement a previous session made. */
  test("`mirrors` names every placement of a node, chains followed", () => {
    // `git` is placed twice: directly by `focus-git`, and through it by
    // `now-git`, which mirrors the mirror. Both are places `git` is drawn.
    expect(detail(at(), "git")?.mirrors).toEqual([
      { id: "focus-git", file: "focus.olai", line: 2, parent: "focus" },
      { id: "now-git", file: "roadmap.olai", line: 3, parent: "now" },
    ])
    expect(detail(at(), "sticky")?.mirrors).toEqual([
      { id: "now-sticky", file: "roadmap.olai", line: 2, parent: "now" },
    ])
  })

  test("a node nothing shows says nothing rather than an empty list", () => {
    expect(detail(at(), "bugs")).not.toHaveProperty("mirrors")
  })

  /**
   * ONE PLACEMENT PER ID, on a set the validator refuses.
   *
   * Two mirror records claiming `dupe` is a duplicate-id error, so this asks
   * what a CONDEMNED set looks like — which is a real question, because a
   * reader draws one beside the errors. The answer is the record that id
   * means: `byId` is first-claim-wins, the format's one rule for duplicates,
   * and `mirrors` is read out of an index keyed by id like every other. Two
   * entries here would name a record `remove_mirror` could never reach, since
   * that verb takes an ID and one of the two would always be the other.
   *
   * The rule is §3 of docs/brainstorming/model-indices.md — the tax an index
   * charges for answering by id — and this is where it first shows.
   */
  test("two placements sharing an id are the one record that id means", () => {
    const condemned = derivedOf(setOf({
      "a.olai": [
        `{"id":"node","ord":"a0","title":"the node"}`,
        `{"id":"dupe","ord":"a1","mirror":"node"}`,
      ].join("\n"),
      "b.olai": `{"id":"dupe","ord":"a0","mirror":"node"}`,
    }))
    expect(detail(condemned, "node")?.mirrors).toEqual([
      { id: "dupe", file: "a.olai", line: 2 },
    ])
  })

  /** WHAT IS ON THE LIST — the question the ledger is read with, and the one
   *  the ops layer could not answer at all before the 2026-08-11 review. */
  test("`placed` lists what a curated list holds, in sibling order", () => {
    const now = detail(at(), "now")
    expect(now?.placed?.map((entry) => entry.id)).toEqual(["now-sticky", "now-git"])
    // Each entry carries the NODE it shows — situated, so the reader has the
    // item's mark and where it is defined, not just an id.
    expect(now?.placed?.[0]).toMatchObject({
      id: "now-sticky",
      parent: "now",
      shows: {
        id: "sticky",
        title: "the header scrolls away",
        status: "doing",
        file: "roadmap.olai",
        path: ["Bugs"],
      },
    })
    // …and a chain is followed to the node at its end rather than reported as
    // the placement in the middle.
    expect(now?.placed?.[1]?.shows).toMatchObject({ id: "git", status: "todo" })
  })

  test("the placements are not the node's own children", () => {
    // `children` is what hangs off it; `placed` is what it points at. A Now
    // section has no children at all.
    expect(detail(at(), "now")?.children).toEqual([])
    expect(detail(at(), "bugs")).not.toHaveProperty("placed")
  })

  test("a search never answers with a placement", () => {
    // A hit for a mirror would be the same node twice, once at a place no
    // write lands.
    expect(search(reading(), { text: "git" }, TODAY).hits.filter(isNodeHit).map((hit) => hit.id))
      .not.toContain("now-git")
  })
})

describe("the tags a node carries", () => {
  /** A set with both sigils, including the same NAME under each — which is the
   *  whole reason the sigil is reported. */
  const TAGGED = (): OutlineSet =>
    setOf({
      "work.olai": [
        `{"id":"call","ord":"a0","title":"call @alice about #alice/onboarding"}`,
        `{"id":"plain","ord":"a1","title":"nothing to see here"}`,
      ].join("\n"),
    })

  // AS WRITTEN, sigil and all. `#alice` and `@alice` are two different tags
  // (`@olai/format`'s TAG_SIGILS), so a list of bare names could not say which
  // of them a node carries — and this is the shape an agent reads off
  // `read_node`, which nothing on the wire side would notice losing.
  test("a node read reports its tags as they are written", () => {
    expect(detail(derivedOf(TAGGED()), "call")?.tags).toEqual([
      "@alice",
      "#alice/onboarding",
    ])
  })

  test("a node with none reports an empty list rather than nothing", () => {
    expect(detail(derivedOf(TAGGED()), "plain")?.tags).toEqual([])
  })

  // The index's own half of the same contract: a tag is searchable BARE and as
  // written, so a bare word still finds it and a sigil narrows to one
  // namespace.
  test("a tag is found by its name and by its written form", () => {
    const set = readingOf(TAGGED())
    for (const text of ["alice", "@alice", "#alice"]) {
      expect(nodeHits(search(set, { text }, TODAY)).map((hit) => hit.id)).toEqual(["call"])
    }
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

  const ids = (query: Parameters<typeof search>[1]): ReadonlyArray<string> =>
    search(readingOf(WORK()), query, TODAY).hits.filter(isNodeHit).map((hit) => hit.id)

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
    expect(search(readingOf(WORK()), { text: `"book the` }, TODAY).refusals)
      .toEqual([{
        token: `"book the`,
        reason: `a quote nothing closes — a phrase runs from one " to the next`,
      }])
    expect(search(readingOf(WORK()), { text: "trip OR" }, TODAY).refusals)
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
    const answer = search(readingOf(WORK()), { text: "is:open trip" }, TODAY)
    expect(answer.refusals).toEqual([{
      token: "is:open",
      reason: "is: takes one of done, doing, todo, marked, blocked, mirrored, trashed",
    }])
    // As TYPED — an agent that echoed the folded token back to a person would
    // be quoting them wrongly.
    expect(search(readingOf(WORK()), { text: "is:OPEN" }, TODAY).refusals?.[0]?.token)
      .toBe("is:OPEN")
  })

  // An empty query and a refused one both answer with no hits, and only one of
  // them has anything to say about it: there is no question to have refused.
  test("a query nobody typed carries no refusal", () => {
    const answer = search(readingOf(WORK()), { text: "  " }, TODAY)
    expect(answer).toEqual({ hits: [], total: 0 })
    expect(answer).not.toHaveProperty("refusals")
    expect(search(readingOf(WORK()), { text: "trip" }, TODAY)).not.toHaveProperty("refusals")
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
    expect(search(readingOf(WORK()), { text: "flights" }, TODAY).hits[0])
      .toMatchObject({ id: "book", matched: "title" })
    const marked = search(readingOf(WORK()), { text: "is:todo" }, TODAY).hits[0]
    expect(marked).toMatchObject({ id: "pack" })
    expect(marked).not.toHaveProperty("matched")
  })

  test("a finished node still loses ties, and the total is still uncapped", () => {
    // `book` and `paint` both match on their title; `book` is written first
    // and both are done, so order is the file's and the count is honest.
    const answer = search(readingOf(WORK()), { text: "is:done", limit: 1 }, TODAY)
    expect(answer.hits.filter(isNodeHit).map((hit) => hit.id)).toEqual(["book"])
    expect(answer.total).toBe(2)
  })
})

/**
 * What a listing says about a set of files — every arm of it in one fixture,
 * because a row is answered by a LOOKUP into the grouped nodes, and a lookup
 * is a thing that can miss.
 *
 * The three that miss differently are all here: a file whose nodes are in the
 * grouping, one that holds none at all (in `files`, in no group), and one that
 * did not parse (answered before the grouping is consulted).
 */
describe("the directory", () => {
  const DIRECTORY = (): OutlineSet =>
    setOf({
      "house.olai": [
        // Written out of `ord` order on purpose: the roots a listing shows are
        // the file's, in the order the file writes them.
        `{"id":"garden","ord":"a1","title":"Garden"}`,
        `{"id":"house","ord":"a0","title":"House"}`,
        `{"id":"paint","parent":"house","ord":"a0","title":"paint the hall","todo":true}`,
        // A mirror is a placement: it is neither counted nor a root, even
        // sitting at the top level of the file.
        `{"id":"shown","ord":"a2","mirror":"paint"}`,
      ].join("\n"),
      "empty.olai": "",
      "shed.olai": `{"id":"shed","ord":"a0","title":"Shed"}`,
    }, [], { "torn.olai": `{"id":` })

  /** The WHOLE listing in one assertion rather than four indexes into it: the
   *  order is one of the claims, so a row pinned by position would be leaning
   *  on a fact a sibling test owns. */
  test("every file gets its row, in order, counted and titled by its own nodes", () => {
    const set = DIRECTORY()
    expect(outlines(set, derivedOf(set))).toEqual([
      // In PATH order, which is the set's ({@link ../../format/src/set.ts}'s
      // `assemble` puts it there) and what the sidebar shows.
      { file: "empty.olai", nodes: 0, roots: [] },
      // Three regular nodes — the mirror is a placement, so it is neither
      // counted nor a root — and the roots are in FILE order.
      { file: "house.olai", nodes: 3, roots: ["Garden", "House"] },
      { file: "shed.olai", nodes: 1, roots: ["Shed"] },
      // The torn row carries `unreadable` BESIDE a zero and an empty list —
      // the flat shape {@link OutlineSummary} holds knowingly.
      { file: "torn.olai", nodes: 0, roots: [], unreadable: [expect.any(String)] },
    ])
  })
})

// ── the other question the matcher answers ─────────────────────────────

/**
 * `matches` is the PAGE FILTER's door: which nodes a query selects, all of
 * them, ids and why. Every case here is about the ways it is deliberately NOT
 * {@link search} — uncapped, unranked, records only, no situating — because
 * that is the whole of the shape (`@olai/format`'s `searching.ts` argues it),
 * and a hit list quietly answering here would fail nothing in a browser until
 * somebody counted "3 of 41" off twelve rows.
 */
describe("which nodes a query selects", () => {
  const PILE = (): OutlineSet =>
    setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order the doors","desc":"walnut, or birch"}`,
        `{"id":"hinges","parent":"kitchen","ord":"a1","title":"pick the door hinges","done":"2026-08-02"}`,
        `{"id":"tiles","parent":"kitchen","ord":"a2","title":"the door mat"}`,
      ].join("\n"),
      "_olai/Trash.olai": [
        `{"id":"old","ord":"a0","title":"the old door"}`,
      ].join("\n"),
    })

  const ids = (text: string, trashed?: boolean): ReadonlyArray<string> =>
    matches(derivedOf(PILE()), { text, ...(trashed === undefined ? {} : { trashed }) }, TODAY)
      .matches.map((one) => one.id)

  test("every match comes back, past the cap a search would have applied", () => {
    // Three of them, where `search` answers twelve by default and a palette
    // asks for eight: a page that pruned itself by a capped answer would draw
    // the rows the cap kept and count the ones it did not.
    expect(ids("door")).toEqual(["order", "hinges", "tiles"])
  })

  test("the order is the SET's, where a search's is the ranking", () => {
    // The two doors onto one matcher, over one query, side by side — which is
    // what makes this a claim rather than a second spelling of the case above.
    // `hinges` is finished, so the shortlist sinks it under the done penalty
    // and this answer leaves it where the file puts it: a page draws its rows
    // in the page's order and looks each one up here, and the day this starts
    // ranking is the day a filtered outline reorders itself under a cursor.
    expect(ids("door")).toEqual(["order", "hinges", "tiles"])
    expect(nodeHits(search(readingOf(PILE()), { text: "door" }, TODAY)).map((hit) => hit.id))
      .toEqual(["order", "tiles", "hinges"])
  })

  test("why a node is here is the field that carried the words, or nothing", () => {
    // `walnut` is in `order`'s note and in no title anywhere — the row a
    // filtered page draws an excerpt for (`@olai/web`'s `filter/why.ts`).
    expect(matches(derivedOf(PILE()), { text: "walnut" }, TODAY).matches)
      .toEqual([{ id: NodeId.make("order"), matched: "desc" }])
    // ...and a query that named no words at all is carried by no field, so the
    // slot is ABSENT rather than filled with an invented reason.
    expect(matches(derivedOf(PILE()), { text: "is:done" }, TODAY).matches)
      .toEqual([{ id: NodeId.make("hinges") }])
  })

  test("what was put away is out, unless the query or the PAGE says otherwise", () => {
    expect(ids("door")).not.toContain("old")
    // The grammar's own door, at every caller.
    expect(ids("is:trashed door")).toEqual(["old"])
    // ...and the page's: the trash, and a zoom onto a trashed node, are pages
    // whose rows are already put-away ones, and a matcher applying the default
    // there would take every row off the screen.
    // In the SET's own file-then-line order, which is what this answers in and
    // why `_olai/Trash.olai` comes first — a page draws its rows in the page's
    // order and looks each one up here, so nothing about this list is a
    // presentation.
    expect(ids("door", true)).toEqual(["old", "order", "hinges", "tiles"])
  })

  test("a query nobody could read selects nothing, and says nothing about it", () => {
    // No `refusals` on this answer, deliberately: the door that asks it reads
    // the same grammar itself, so it has already drawn the sentence by the time
    // a round trip could carry one (`@olai/format`'s `MatchingAnswer`).
    expect(matches(derivedOf(PILE()), { text: "is:open" }, TODAY))
      .toEqual({ matches: [] })
    // Nothing typed is not a question either.
    expect(matches(derivedOf(PILE()), { text: "  " }, TODAY)).toEqual({ matches: [] })
  })

  // A DOCUMENT IS NEVER ONE, and it is structural rather than a case: this takes
  // the DERIVATION where {@link search} takes the whole reading, so the half of
  // the directory that is prose is not in reach of it. Which is the honest
  // arrangement — the page that draws prose is the one page that carries no
  // filter at all (`@olai/web`'s `routes.ts`).
})

/**
 * `named` is the TRANSCRIPT's door: which of these ids the set declares, and
 * what each one names.
 *
 * A lookup and not a query, which is what every case here is about — an id is
 * matched exactly, a placement is followed to the node it shows, and what the
 * set does not declare is simply not in the answer. The browser answered this
 * out of its own copy of the directory until `vib-3-transcript-ids`, so these
 * cases are the ones a chat panel used to prove by pressing a word.
 */
describe("which of these ids the set declares", () => {
  const HOUSE = (): OutlineSet =>
    setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets"}`,
        // A placement of `order`, which is the id an agent writes: `read_node`
        // answers `mirrors` with it and `remove_mirror` takes it.
        `{"id":"echo","ord":"a1","mirror":"order"}`,
        // ...and one whose chain ends nowhere.
        `{"id":"nowhere","ord":"a2","mirror":"gone"}`,
      ].join("\n"),
      "_olai/Trash.olai": [
        `{"id":"old","ord":"a0","title":"the old counters"}`,
      ].join("\n"),
    })

  const asked = (...ids: ReadonlyArray<string>) => named(derivedOf(HOUSE()), { ids }).named

  test("an id the set declares comes back with the node it names", () => {
    expect(asked("order")).toEqual([{ asked: "order", id: "order" }])
  })

  test("a PLACEMENT names the node it shows, not itself", () => {
    // The whole reason this answers with a pair. A row in the tree carries the
    // node it SHOWS, so a span marked `echo` would name no row and every press
    // of it would leave the page for a node that is right there.
    expect(asked("echo")).toEqual([{ asked: "echo", id: "order" }])
  })

  test("what the set does not declare is not in the answer at all", () => {
    // Every other backticked thing an agent writes — a flag, a file, a
    // command — and a placement whose chain is dead, which has nothing to
    // point at either.
    expect(asked("true", "house.olai", "bun test", "nowhere")).toEqual([])
  })

  test("one question, one answer per id — the rest of the batch is unaffected", () => {
    // The batch is the point: one message's backticks are one question, and
    // most of them are not ids.
    expect(asked("true", "order", "npm test", "echo")).toEqual([
      { asked: "order", id: "order" },
      { asked: "echo", id: "order" },
    ])

  })

  test("an id repeated is asked once", () => {
    // A caller builds a lookup out of this, and a lookup has one entry per key.
    expect(asked("order", "order", "order")).toEqual([{ asked: "order", id: "order" }])
  })

  test("what was put away is still declared", () => {
    // A lookup is not a search, so the grammar's rule about `is:trashed` has
    // nothing to say here: the id names the node it names, and a reader
    // pressing it is shown where it now is.
    expect(asked("old")).toEqual([{ asked: "old", id: "old" }])
  })

  test("nothing asked is nothing answered", () => {
    expect(named(derivedOf(HOUSE()), { ids: [] })).toEqual({ named: [] })
  })
})

describe("the sidebar's two date readings", () => {
  /** A directory with dates on both sides of the day below, over two outlines,
   *  so a count of NODES is exercised across the groups an agenda comes in —
   *  and with the two shapes the calendar's own rules turn on: a dated `done`
   *  (which is a day with something on it even though the work is finished) and
   *  a dated `todo` (which is not a day at all).
   *
   *  Fixed dates and a fixed today, for `@olai/format`'s own reason: a test
   *  that read a clock would expire. */
  const DAYS = (): OutlineSet =>
    setOf({
      "work.olai": [
        `{"id":"permit","ord":"a0","title":"file the permit","todo":true,"date":"2026-08-03"}`,
        `{"id":"posts","ord":"a1","title":"dig the post holes","doing":true,"date":"2026-08-09"}`,
        `{"id":"survey","ord":"a2","title":"the boundary survey","done":"2026-08-21","date":"2026-08-28"}`,
        `{"id":"filed","ord":"a3","title":"chase the filing","todo":"2026-08-17"}`,
        `{"id":"next","ord":"a4","title":"pour the slab","todo":true,"date":"2026-09-02"}`,
      ].join("\n"),
      "life.olai": [
        `{"id":"visas","ord":"a0","title":"send the visa forms","todo":true,"date":"2026-08-05"}`,
        `{"id":"mum","ord":"a1","title":"mum's birthday","date":"2026-08-09"}`,
      ].join("\n"),
    })

  test("the dots are the days of THAT month, sorted, and nothing either side", () => {
    // SORTED is the one thing this reading adds to `datedDays`, and it is what
    // lets the server send a frame only when the dots actually moved: the walk's
    // own order is the set's, which a record moved between files reshuffles
    // without lighting or darkening a single day.
    expect(dated(derivedOf(DAYS()), { month: "2026-08" })).toEqual({
      // `2026-08-21` is `survey`'s dated `done` and `2026-08-28` its `date` —
      // both count, which is the format's two-fields rule. `2026-08-17` is a
      // dated `todo` and is not a day.
      days: ["2026-08-03", "2026-08-05", "2026-08-09", "2026-08-21", "2026-08-28"],
    })
    expect(dated(derivedOf(DAYS()), { month: "2026-09" })).toEqual({
      days: ["2026-09-02"],
    })
  })

  test("a month with nothing in it is an answer, not a refusal", () => {
    // A reader may page back through empty years, and the grid still draws.
    expect(dated(derivedOf(DAYS()), { month: "2019-11" })).toEqual({ days: [] })
  })

  test("what is owed counts the rows the agenda page draws", () => {
    // Not a second walk of its own: this is `owedOf` over `agendaOf`, so the
    // number the sidebar prints and the rows one click away are one reading.
    // Two late over two outlines; today holds the work AND the occurrence.
    expect(owed(derivedOf(DAYS()), { today: "2026-08-09" }))
      .toEqual({ overdue: 2, today: 2 })
  })

  test("the day is the READER's, so two tabs either side of midnight differ", () => {
    // Which is the whole reason it travels on the request instead of being read
    // off the server's clock: the dates in the files are what a person wrote
    // down, so what is late is late where that person is standing.
    expect(owed(derivedOf(DAYS()), { today: "2026-08-04" }))
      .toEqual({ overdue: 1, today: 0 })
    // …and a day before everything in the directory owes nothing at all, where
    // the same set read a fortnight later owes plenty.
    expect(owed(derivedOf(DAYS()), { today: "2026-08-01" }))
      .toEqual({ overdue: 0, today: 0 })
  })

  test("upcoming is never counted, however close it is", () => {
    // `owedOf`'s ruling read through this door: a task due tomorrow is not news
    // today, and a count that included it could never fall to nothing.
    expect(owed(derivedOf(DAYS()), { today: "2026-09-01" }).today).toBe(0)
    expect(owed(derivedOf(DAYS()), { today: "2026-09-01" }).overdue).toBe(3)
  })
})

// ── the vocabulary a completion draws ──────────────────────────────────

describe("which tags the set already uses", () => {
  const HOUSE = (): OutlineSet =>
    setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}`,
        `{"id":"order","parent":"kitchen","ord":"a1","title":"order cabinets #home #shopping"}`,
        `{"id":"ask","parent":"kitchen","ord":"a2","title":"ask @alice about the #hob"}`,
      ].join("\n"),
      "_olai/Trash.olai": `{"id":"old","ord":"a0","title":"the old boiler #boiler"}`,
    })

  // The ENVELOPE, which is this layer's half: what the rules are is
  // `@olai/format`'s `vocabulary.ts` and is pinned there, and what travels is
  // this shape — a field dropped between the reading and the answer would fail
  // nothing over there.
  test("the answer is the shortlist, ranked, in the envelope the wire carries", () => {
    expect(tags(derivedOf(HOUSE()), { sigil: "#", query: "ho", limit: 8 }))
      .toEqual({
        tags: [
          { name: "home", count: 2 },
          { name: "hob", count: 1 },
          { name: "shopping", count: 1 },
        ],
      })
  })

  test("the sigil asked with is the only namespace answered", () => {
    expect(tags(derivedOf(HOUSE()), { sigil: "@", query: "", limit: 8 }))
      .toEqual({ tags: [{ name: "alice", count: 1 }] })
  })

  // What the trash does to the vocabulary is NOT re-asserted here: it is a rule
  // about what a tag count means, pinned where the rule lives
  // (`@olai/format`'s `vocabulary.test.ts`). The fixture keeps its trashed
  // record so the two above are asked of a directory that has one.
})
