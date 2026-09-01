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
  bytesOf,
  type Derived,
  type Detail,
  DocumentPath,
  fileKind,
  Found,
  isNodeHit,
  markdownIn,
  NodeId,
  type NarrowingAnswer,
  type NodeHit,
  type OpFailure,
  type OutlineSet,
  type PageRequest,
  Projected,
  NO_KINDS,
  PROJECTABLE,
  type ProjectedRoots,
  type ProjectedSubtree,
  type Reading,
  type SearchAnswer,
  type OutlineRoots,
  type Subtree,
  type SubtreeAnswer,
  type SubtreeRequest,
} from "@olai/format"
import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { failed, planned, readingOf, setOf, steady, succeeded } from "./fixtures.testlib.ts"
import { folding } from "./following.ts"
import { scoping } from "./plan.ts"
import {
  dated,
  detail,
  documents,
  homes,
  named,
  narrowing,
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
      `{"id":"git","parent":"bugs","ord":"a1","title":"two git indicators","todo":true,"desc":"the pill and the readout answer the same question","custom":{"pr":"https://github.com/juspay/olai/pull/176","agent":"claude-opus"}}`,
    ].join("\n"),
    "focus.olai": [
      `{"id":"focus","ord":"a0","title":"Focus"}`,
      // A mirror OF a mirror: `now-git` shows this, which shows `git`.
      `{"id":"focus-git","parent":"focus","ord":"a0","mirror":"git"}`,
    ].join("\n"),
  })

const at = () => derivedOf(LEDGER())

/**
 * A subtree read that ANSWERED, and one that refused.
 *
 * The read answers a `Result` now that it takes a path as well as an id: an id
 * the set does not hold is still an ANSWER (`{ missing }`), and a path that is
 * not an outline is a refusal carrying the closest one that is. The UNWRAP and
 * the diagnostic that goes with it are `./fixtures.testlib.ts`'s, which is
 * where the planner's pair already lived — a walk that refuses where the case
 * expected an answer says what it refused with rather than failing two
 * assertions later on `undefined`.
 */
const walked = (of: Reading, request: SubtreeRequest): SubtreeAnswer =>
  succeeded(subtree(of, request), "`read_subtree` to answer")

const refusedWalk = (of: Reading, request: SubtreeRequest): OpFailure =>
  failed(subtree(of, request), "`read_subtree`")

/**
 * A node read that ANSWERED — `detail`'s pair, since it went the way of
 * {@link subtree}: a field nobody may name is a refusal now, so the function
 * says "or else" and the door lifts it. The UNWRAP and the diagnostic are the
 * two lines above, which is where `walked`/`refusedWalk` already live for it.
 */
const read = (of: Derived, id: string, fields?: ReadonlyArray<string>): Detail | null =>
  succeeded(detail(of, id, fields), "`read_node` to answer")

/** The one that REFUSED — {@link read}'s other arm. */
const refusedRead = (of: Derived, id: string, fields: ReadonlyArray<string>): OpFailure =>
  failed(detail(of, id, fields), "`read_node`")

/**
 * The two ARMS of an answer that is not the `{ missing }` one — a diagnostic
 * rather than a cast at each assertion.
 *
 * Every arm of the union is a real answer this read can give, so reading
 * `children` or `roots` off the wrong one is `undefined` two assertions later,
 * naming nothing. These say which arm was expected, once, and hand back the
 * narrowed value.
 */
const nodeOf = (answer: SubtreeAnswer): Subtree | ProjectedSubtree => {
  if (!("children" in answer)) {
    throw new Error(`expected one node's walk, and got ${JSON.stringify(answer)}`)
  }
  return answer
}

const outlineOf = (answer: SubtreeAnswer): OutlineRoots | ProjectedRoots => {
  if (!("roots" in answer)) {
    throw new Error(
      `expected the whole-outline answer, and got ${JSON.stringify(answer)}`,
    )
  }
  return answer
}

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
 * are two hand-written lists of the same fields; this is the cheap thing
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
  const carrying = read(at, "top")?.children[0]
  expect(carrying?.id).toBe("all")
  expect(Object.keys(carrying ?? {}).sort()).toEqual(Object.keys(Found.fields).sort())
})

// The work's own facts of time: the record's `started` and `worked` handed
// back verbatim, and `took` derived — the bank when there is one, else the
// settling instant minus the start. An annotation beside `progress`, with
// the same absences doing the saying.
test("a node's read carries `started`, `worked` and the derived `took` — and the jump carries none", () => {
  const at = derivedOf(setOf({
    "house.olai": [
      `{"id":"bake","ord":"a0","title":"bake the bread","done":"2026-08-29T12:26:44-04:00","started":"2026-08-29T09:52:00-04:00"}`,
      `{"id":"plumber","ord":"a1","title":"call the plumber","done":"2026-08-29T12:26:44-04:00"}`,
      `{"id":"hinge","ord":"a2","title":"fix the hinge on the door","cancelled":"2026-08-29T10:33:00-04:00","started":"2026-08-29T09:52:00-04:00"}`,
      `{"id":"water","ord":"a3","title":"water the plants","doing":true,"started":"2026-08-29T09:52:00-04:00"}`,
      // The MULTI-ROUND record — the shapes above with a bank beside them:
      // two rounds in, a third live.
      `{"id":"knead","ord":"a4","title":"knead the dough","doing":true,"started":"2026-08-29T09:50:00-04:00","worked":600}`,
      `{"id":"proof","ord":"a5","title":"proof it","done":"2026-08-29T09:58:00-04:00","started":"2026-08-29T09:50:00-04:00","worked":1080}`,
    ].join("\n"),
  }))
  // SETTLED: the instant, and the span it closes — 2h34m44s and 41m, in
  // whole seconds either way, because the two settling marks read the same.
  expect(read(at, "bake")).toMatchObject({ started: "2026-08-29T09:52:00-04:00", took: 9284 })
  expect(read(at, "hinge")).toMatchObject({ started: "2026-08-29T09:52:00-04:00", took: 2460 })
  // …and NO BANK IS ANSWERED for them: `toMatchObject` ignores extra keys,
  // so a `worked: 0` default grown later would slip the span pins above —
  // the property's ABSENCE is the byte-identical rule, named on purpose.
  expect(read(at, "bake")).not.toHaveProperty("worked")
  expect(read(at, "hinge")).not.toHaveProperty("worked")
  // STILL RUNNING: the instant is there for the tick, and there is no `took`
  // to say — a span needs both ends, and the wire carries no durations.
  expect(read(at, "water")).toHaveProperty("started")
  expect(read(at, "water")).not.toHaveProperty("took")
  // THE JUMP: a todo→done has no span, and `created` is never the fallback —
  // none of the three is invented at read time.
  expect(read(at, "plumber")).not.toHaveProperty("started")
  expect(read(at, "plumber")).not.toHaveProperty("worked")
  expect(read(at, "plumber")).not.toHaveProperty("took")
  // THE SETTLED MULTI-ROUND node: the bank IS the answer — `took` is the
  // 1080 the settles counted, not the 480 a subtraction against the fresh
  // `started` would misread as the whole of it.
  expect(read(at, "proof")).toMatchObject({ worked: 1080, took: 1080 })
  // …and a LIVE one carries the two things the tick is a sum of — bank and
  // instant, durations never: the arithmetic stays where the clock is.
  expect(read(at, "knead")).toMatchObject({ worked: 600, started: "2026-08-29T09:50:00-04:00" })
  expect(read(at, "knead")).not.toHaveProperty("took")
})

describe("the edges a node carries", () => {
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

  test("a node read carries them too, and so does a child in its list", () => {
    const bugs = read(at(), "bugs")
    expect(bugs?.children.find((child) => child.id === "sticky"))
      .toMatchObject({ after: ["git"] })
    expect(read(at(), "sticky")).toMatchObject({ after: ["git"], see: ["git"] })
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
    expect(read(waiting(), "frame")?.blockedBy).toEqual([
      { id: "pour", title: "pour the slab", file: "build.olai", line: 1, status: "todo", path: [] },
      { id: "cure", title: "let it cure", file: "build.olai", line: 2, status: "doing", path: [] },
    ])
  })

  test("a node with nothing in its way does not say so with an empty list", () => {
    // `pour` is the blocker itself — unfinished work, and nothing before it.
    // Absence is how the format spells nothing, and an answer follows it.
    expect(read(waiting(), "pour")).not.toHaveProperty("blockedBy")
  })

  test("a bullet is waiting on nothing, whatever `after` it carries", () => {
    // The one case that separates this field from the record's: `chips` names
    // `pour`, which IS unfinished — but a bullet is not work, so nothing is
    // telling it it cannot start. The record's own field still answers.
    const chips = read(waiting(), "chips")
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
    expect(read(at(), "git")?.custom).toEqual({
      pr: "https://github.com/juspay/olai/pull/176",
      agent: "claude-opus",
    })
    // Beside the fields, not instead of them: the mark is still `todo`.
    expect(read(at(), "git")).toMatchObject({ todo: true, status: "todo" })
  })

  test("a node with no properties carries no map, rather than an empty one", () => {
    expect(read(at(), "bugs")).not.toHaveProperty("custom")
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

  test("a child in a node's list and a subtree row carry it, like `see`", () => {
    // Every situated answer is built out of one `foundOf`, so this follows from
    // the hit rather than being a second decision — the same shape the edge
    // test above pins for `see` and `after`.
    expect(read(at(), "bugs")?.children.find((child) => child.id === "git"))
      .toMatchObject({ custom: { agent: "claude-opus" } })
    const bugs = nodeOf(walked(reading(), { id: "bugs", depth: 1 }))
    expect(bugs.children.find((child) => child.id === "git"))
      .toMatchObject({ custom: { agent: "claude-opus" } })
    expect(bugs.children.find((child) => child.id === "sticky"))
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
    expect(read(at(), "git")?.referencedBy).toEqual([
      {
        id: "sticky",
        title: "the header scrolls away",
        file: "roadmap.olai",
        line: 5,
        status: "doing",
        path: ["Bugs"],
        parent: "bugs",
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
    expect(read(at, "git")?.referencedBy?.map((one) => `${one.id} ${one.ways.join("+")}`))
      .toEqual(["said mention", "both see+mention"])
  })

  test("a node nobody has written about says nothing rather than an empty list", () => {
    expect(read(at(), "sticky")).not.toHaveProperty("referencedBy")
  })
})
describe("placements", () => {
  /** WHERE ELSE this node is drawn — the id half of `remove_mirror`, and the
   *  only way to reach a placement a previous session made. */
  test("`mirrors` names every placement of a node, chains followed", () => {
    // `git` is placed twice: directly by `focus-git`, and through it by
    // `now-git`, which mirrors the mirror. Both are places `git` is drawn.
    expect(read(at(), "git")?.mirrors).toEqual([
      { id: "focus-git", file: "focus.olai", line: 2, parent: "focus" },
      { id: "now-git", file: "roadmap.olai", line: 3, parent: "now" },
    ])
    expect(read(at(), "sticky")?.mirrors).toEqual([
      { id: "now-sticky", file: "roadmap.olai", line: 2, parent: "now" },
    ])
  })

  test("a node nothing shows says nothing rather than an empty list", () => {
    expect(read(at(), "bugs")).not.toHaveProperty("mirrors")
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
   * The rule is §3 of https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/model-indices.md — the tax an index
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
    expect(read(condemned, "node")?.mirrors).toEqual([
      { id: "dupe", file: "a.olai", line: 2 },
    ])
  })

  /** WHAT IS ON THE LIST — the question the ledger is read with, and the one
   *  the ops layer could not answer at all before the 2026-08-11 review. */
  test("`placed` lists what a curated list holds, in sibling order", () => {
    const now = read(at(), "now")
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
    expect(read(at(), "now")?.children).toEqual([])
    expect(read(at(), "bugs")).not.toHaveProperty("placed")
  })

  /**
   * THE WALK NAMES WHAT IT WILL NOT DESCEND — `read_subtree`'s answer to a
   * board of mirrors, in the very shape the node read pins above.
   *
   * The case this was filed from (2026-08-27, and again 2026-08-31): a day
   * board's children are ALL placements, and `read_subtree(day-root)`
   * answered `children: []` — the practical answer to "what is on this
   * board" was silence, and an orchestrator read it as the board wiped.
   * `now` is exactly that node, and the whole claim is that the walk says
   * NOW where the node read always has.
   */
  test("a node whose children are all placements no longer reads as empty", () => {
    // At the cheapest ask there is — `depth: 0` bottoms out AT the board
    // itself, and a placement is named rather than descended into, so the
    // naming costs the depth dial nothing.
    const board = nodeOf(walked(reading(), { id: "now", depth: 0 }))
    // Nothing is WALKED: `children` is what hangs off a node, and a board of
    // mirrors hangs nothing off itself. The emptiness was never the lie —
    // the silence beside it was. And a board is not `truncated`: the walk
    // stopped at a leaf here, because a placement is nowhere it ever goes.
    expect(board.children).toEqual([])
    expect(board).not.toHaveProperty("truncated")
    // …and nothing is SILENT: both entries, named — the placement's own id,
    // and the node's own id and title. A chain is followed to the node at
    // its end, exactly as the node read's answer has it.
    expect(board.placed?.map((entry) => [entry.id, entry.shows.id, entry.shows.title]))
      .toEqual([
        ["now-sticky", "sticky", "the header scrolls away"],
        ["now-git", "git", "two git indicators"],
      ])
    // UNWALKED, which is the distinction the design rests on: an entry
    // carries the NODE, never the node's rows — `children` is a walk row's
    // field, and a `placed` entry is not a walk row.
    for (const entry of board.placed ?? []) {
      expect(entry).not.toHaveProperty("children")
    }
  })

  test("the note dial and the row projection leave the naming alone", () => {
    // `withDesc: false` drops prose, not structure: the placements ride.
    const lean = nodeOf(walked(reading(), { id: "now", depth: 0, withDesc: false }))
    expect(lean.placed?.map((entry) => entry.id)).toEqual(["now-sticky", "now-git"])
    // And `fields` shapes RECORD fields: `placed` is the walk's structure,
    // like `children` and `truncated` — a projection that cut it would read
    // this board as empty, which is the silence the listing exists to end.
    const shaped = nodeOf(walked(reading(), { id: "now", depth: 0, fields: ["title"] }))
    expect(shaped).toMatchObject({ id: "now", title: "Now" })
    expect(shaped.placed?.map((entry) => entry.shows.id)).toEqual(["sticky", "git"])
  })

  test("the file arm names them too — every root is the same walk", () => {
    const roots = outlineOf(walked(reading(), { file: "roadmap.olai" })).roots
    expect(roots.find((root) => root.id === "now")?.placed?.map((entry) => entry.id))
      .toEqual(["now-sticky", "now-git"])
    // …and a node with none is answered with none — absence, never an empty
    // list, the same spelling of nothing the node read uses.
    expect(roots.find((root) => root.id === "bugs")).not.toHaveProperty("placed")
  })

  test("a search never answers with a placement", () => {
    // A hit for a mirror would be the same node twice, once at a place no
    // write lands.
    expect(search(reading(), { text: "git" }, TODAY, NO_KINDS).hits.filter(isNodeHit).map((hit) => hit.id))
      .not.toContain("now-git")
  })
})

/**
 * THE PARENT'S ID, on every situated answer — a hit, a child in a node's list,
 * a row of a subtree, and the node read itself.
 *
 * `path` is titles. Every write that names a parent takes an id. A caller that
 * can see "Bugs" and not `bugs` cannot file a sibling without a second guess,
 * which is the 2026-08-28 incident that named the field.
 */
describe("the parent a node sits under", () => {
  test("a child carries `parent`; a root does not", () => {
    expect(read(at(), "git")).toMatchObject({ parent: "bugs" })
    expect(read(at(), "bugs")).not.toHaveProperty("parent")
    expect(read(at(), "bugs")?.children.find((child) => child.id === "git"))
      .toMatchObject({ parent: "bugs" })
  })

  test("a search hit carries it too — the same field, one `foundOf`", () => {
    expect(nodeHits(search(reading(), { text: "indicators" }, TODAY, NO_KINDS))[0])
      .toMatchObject({ id: "git", parent: "bugs" })
    expect(nodeHits(search(reading(), { text: "Bugs" }, TODAY, NO_KINDS))[0])
      .not.toHaveProperty("parent")
  })

  test("a subtree row carries it, at every depth the walk kept", () => {
    const bugs = nodeOf(walked(reading(), { id: "bugs" }))
    expect(bugs).not.toHaveProperty("parent")
    expect(bugs.children.find((child) => child.id === "git"))
      .toMatchObject({ parent: "bugs" })
  })
})

/**
 * THE CALLER SHAPES THE ROWS — `fields`, on both reads.
 *
 * What this describe pins and what it does not: WHICH of the record an answer
 * hands back when the caller names it, the refusal of a name outside the
 * vocabulary, and the one thing `fields` never touches — the walk's own
 * structure. The DESIGNS are in `@olai/format`'s `reading.ts` and this
 * layer's `Wants`; what is pinned here row-for-row is the answer an agent is
 * handed, because a field quietly dropped is exactly the case the request
 * exists to close.
 */
describe("the caller shapes the rows", () => {
  test("the vocabulary and the row's schema are one list, neither way", () => {
    // The one second spelling a `satisfies` cannot close: `Projected`'s keys
    // (what a row may carry) against PROJECTABLE (what a request may name),
    // `id` excepted — it rides. The other legs of the closure — the refusal's
    // sentence, the copy's per-field table — read the list itself; this is
    // where the schema's spread of STAMPED + the record fields is made to
    // answer to it.
    expect(Object.keys(Projected.fields).filter((key) => key !== "id").sort())
      .toEqual([...PROJECTABLE].sort())
  })

  /** A lane and its two steps: the FIRST is settled (its `done` is an
   *  instant, the field a timings walk asks for and the one today's child
   *  rows cannot say), the second under way, and one of them writes notes
   *  and a property — every kind `fields` carries, in two rows. */
  const TIMED = (): OutlineSet =>
    setOf({
      "steps.olai": [
        `{"id":"lane","ord":"a0","title":"the lane"}`,
        `{"id":"one","parent":"lane","ord":"a0","title":"first","done":"2026-08-29T09:12:00-04:00","desc":"the forensics","custom":{"took":"4m","agent":"claude-opus"}}`,
        `{"id":"one-a","parent":"one","ord":"a0","title":"the wrinkle","todo":true}`,
        `{"id":"two","parent":"lane","ord":"a1","title":"second","doing":true,"started":"2026-08-29T09:14:00-04:00","worked":600}`,
      ].join("\n"),
    })

  const timed = () => readingOf(TIMED())

  test("a child row carries EXACTLY what was named — each kind, nothing else", () => {
    const lane = read(timed().derived, "lane", [
      "title",
      "status",
      "done",
      "custom.took",
      "desc",
      "started",
      "worked",
    ])
    // A MARK INSTANT (`done`) — the field this request was born for; the
    // custom key asked alone comes back AS a map of one; the note rides
    // whole. `status` is the derivative's word, beside it.
    expect(lane?.children[0]).toEqual({
      id: "one",
      title: "first",
      status: "done",
      done: "2026-08-29T09:12:00-04:00",
      desc: "the forensics",
      custom: { took: "4m" },
    })
    // …and the row HOW the dial reads, which is the whole point: the
    // situating — `file`, `line`, `path`, `parent` — is not named, so it is
    // not there. `toEqual` rather than `toMatchObject`: the ABSENCE is the
    // answer.
    expect(Object.keys(lane?.children[0] ?? {}).sort()).toEqual([
      "custom",
      "desc",
      "done",
      "id",
      "status",
      "title",
    ])
    // The SECOND row carries this lane's OWN clock, BOTH halves: `started`,
    // the stamp `set_doing` wrote, and `worked`, the bank it cannot be read
    // without — a multi-round row naming the stamp alone would say one
    // round's wall for several rounds' work. And the asked-for names it
    // does not hold stay ABSENT, exactly as they are on a full row.
    expect(lane?.children[1]).toEqual({
      id: "two",
      title: "second",
      status: "doing",
      started: "2026-08-29T09:14:00-04:00",
      worked: 600,
    })
  })

  test("its own node is answered in full — `fields` shapes the list, not the node", () => {
    // The read is "one node in full": the lever on a full read's cost was
    // never its own row. Pinning it as a fact: the note, the place, the
    // stamps are all still there.
    const lane = read(timed().derived, "lane", ["status"])
    expect(lane).toMatchObject({ file: "steps.olai", line: 1, path: [], tags: [] })
    expect(lane?.children[0]).toEqual({ id: "one", status: "done" })
  })

  test("the whole map, and one key of it, are two different asks", () => {
    // `custom` is the whole held map — through `heldCustom` either way, so a
    // key holding nothing is absent exactly as it is on the line on disk.
    const whole = read(timed().derived, "lane", ["custom"])?.children[0]
    expect(whole).toEqual({ id: "one", custom: { agent: "claude-opus", took: "4m" } })
    const one = read(timed().derived, "lane", ["custom.agent"])?.children[0]
    expect(one).toEqual({ id: "one", custom: { agent: "claude-opus" } })
    // Asked for a key the node does not carry: absent, never an empty map —
    // the same spelling of nothing the full rows use.
    const absent = read(timed().derived, "lane", ["custom.pr"])?.children[0]
    expect(absent).toEqual({ id: "one" })
  })

  test("`took` projects the span — whole seconds on a settled row, absent when there is none", () => {
    // The one derived name beside `status`, asked for DIRECTLY: a settled
    // step answers the NUMBER, and `tookOf`'s three absences answer none —
    // four rows for them: the todo→done jump (no `started`), the
    // still-running step (no settle), the merely dated bullet (neither),
    // and work finished before olai stamped instants (a settling mark
    // holding the instant-less `true`).
    const SPAN = (): OutlineSet =>
      setOf({
        "steps.olai": [
          `{"id":"lane","ord":"a0","title":"the lane"}`,
          `{"id":"done-one","parent":"lane","ord":"a0","title":"finished","started":"2026-08-29T09:12:00-04:00","done":"2026-08-29T09:16:00-04:00"}`,
          `{"id":"jump","parent":"lane","ord":"a1","title":"jumped to done","done":"2026-08-29T09:12:00-04:00"}`,
          `{"id":"running","parent":"lane","ord":"a2","title":"under way","doing":true,"started":"2026-08-29T09:14:00-04:00"}`,
          `{"id":"dated","parent":"lane","ord":"a3","title":"only dated","date":"2026-08-29"}`,
          `{"id":"stamped-free","parent":"lane","ord":"a4","title":"done before instants","started":"2026-08-29T09:18:00-04:00","done":true}`,
        ].join("\n"),
      })
    const expected = [
      { id: "done-one", title: "finished", status: "done", took: 240 },
      { id: "jump", title: "jumped to done", status: "done" },
      { id: "running", title: "under way", status: "doing" },
      { id: "dated", title: "only dated" },
      { id: "stamped-free", title: "done before instants", status: "done" },
    ] as const
    // The child list of a `read_node` …
    expect(read(readingOf(SPAN()).derived, "lane", ["title", "status", "took"])?.children)
      .toEqual(expected)
    // …and every row of a `read_subtree`: one derivation, one vocabulary,
    // two doors — the timings ask the parameter was born for. (The walk's
    // rows carry their own `children`, the structure being the walk's own.)
    const rows =
      nodeOf(walked(readingOf(SPAN()), { id: "lane", depth: 1, fields: ["title", "status", "took"] })).children
    for (const [index, row] of expected.entries()) {
      expect(rows[index]?.id).toBe(row.id)
      expect(rows[index]).toMatchObject({ ...row, children: [] })
      expect(Object.keys(rows[index] ?? {}).sort()).toEqual(
        ["children", "id", ...Object.keys(row).filter((key) => key !== "id")].sort(),
      )
    }
    // And the row cannot disagree with the node's own FULL read: the one
    // `tookOf` answers both shapes, the same number either way.
    expect(read(readingOf(SPAN()).derived, "done-one")?.took).toBe(240)
  })

  test("an asked-for field is dropped from the DESCS as well — the walk is shape, not prose", () => {
    // The note dials: `desc` named is the note whole, `withDesc` has nothing
    // left to say — and the two together are their own refusal below.
    const lane = read(timed().derived, "lane", ["desc"])
    expect(lane?.children[0]).toEqual({ id: "one", desc: "the forensics" })
  })

  test("a walk's EVERY row is shaped — root too; the structure is the walk's own", () => {
    const lane = nodeOf(
      walked(timed(), { id: "lane", fields: ["title", "status", "done"] }),
    )
    expect(lane).toEqual({
      id: "lane",
      title: "the lane",
      children: [
        {
          id: "one",
          title: "first",
          status: "done",
          done: "2026-08-29T09:12:00-04:00",
          children: [{ id: "one-a", title: "the wrinkle", status: "todo", children: [] }],
        },
        { id: "two", title: "second", status: "doing", children: [] },
      ],
    })
  })

  test("`depth` cuts the SHAPED rows where it claims to", () => {
    // One level: the children answer, `one-a` under them does not — and the
    // cut is SAID, on the very row that carries the caller's fields. The
    // default is the floor's number's own; the claim is that `depth` on a
    // shaped walk is the same dial.
    const one = nodeOf(
      walked(timed(), { id: "lane", depth: 1, fields: ["title"] }),
    )
    expect(one.children).toEqual([
      { id: "one", title: "first", children: [], truncated: true },
      { id: "two", title: "second", children: [] },
    ])
    // One more level down, and the wrinkle arrives — named and shaped, at
    // whichever distance the caller pays for.
    const two = nodeOf(
      walked(timed(), { id: "lane", depth: 2, fields: ["title", "status"] }),
    )
    expect(two.children[0]?.children).toEqual([
      { id: "one-a", title: "the wrinkle", status: "todo", children: [] },
    ])
  })

  test("a whole OUTLINE is shaped too, one call per ask", () => {
    const walkedOutline = outlineOf(
      walked(timed(), { file: "steps.olai", fields: ["status"] }),
    )
    expect(walkedOutline.roots).toEqual([
      {
        id: "lane",
        children: [
          {
            id: "one",
            status: "done",
            children: [{ id: "one-a", status: "todo", children: [] }],
          },
          { id: "two", status: "doing", children: [] },
        ],
      },
    ])
  })

  test("an id alone is a legal ask — the answer is then the ids", () => {
    // Naming NOTHING is not an error: the row is the id, and only that.
    expect(nodeOf(walked(timed(), { id: "lane", depth: 1, fields: [] })).children)
      .toEqual([{ id: "one", children: [], truncated: true }, { id: "two", children: [] }])
    // …and asking for the id ITSELF is no-op rather than refused: it rides
    // every row already, and a request listing only it is a request for the
    // ids.
    expect(nodeOf(walked(timed(), { id: "lane", depth: 1, fields: ["id"] })).children)
      .toEqual([{ id: "one", children: [], truncated: true }, { id: "two", children: [] }])
    expect(nodeOf(walked(timed(), { id: "lane", depth: 1, fields: ["title", "id"] })).children)
      .toEqual([{ id: "one", title: "first", children: [], truncated: true }, { id: "two", title: "second", children: [] }])
  })

  test("an unknown name is REFUSED, naming the legal ones — never silently dropped", () => {
    const refusal = refusedWalk(timed(), { id: "lane", fields: ["florp"] })
    expect(refusal._tag).toBe("UsageFailure")
    expect(refusal.message).toContain("`florp` is not a field `fields` names")
    // EVERY legal name is in the sentence: the refusal is where one learns
    // them, and the list it names is the vocabulary's own — derived HERE,
    // since a retyped list (the first pass's) can only ever prove that two
    // spellings once agreed.
    for (const legal of PROJECTABLE) {
      expect(refusal.message).toContain(`\`${legal}\``)
    }
    expect(refusal.message).toContain("`custom.<key>`")
    // The same words at the OTHER read, since the question is one.
    const refused = refusedRead(timed().derived, "lane", ["florp"])
    expect(refused._tag).toBe("UsageFailure")
    expect(refused.message).toBe(refusal.message)
    // The id beside it is never REACHED: the request is refused before the
    // set is consulted — a missing id with a bad field is refused, not
    // answered {missing}.
    expect(refusedRead(timed().derived, "gone", ["florp"])._tag).toBe("UsageFailure")
  })

  test("`fields` + `withDesc` is one dial spelled twice — refused, saying which", () => {
    for (const [fields, withDesc] of [
      [["desc"], false],
      [["title"], true],
    ] as const) {
      const refusal = refusedWalk(timed(), { id: "lane", fields, withDesc })
      expect(refusal._tag).toBe("UsageFailure")
      expect(refusal.message).toContain("`withDesc`")
      expect(refusal.message).toContain("`desc`")
    }
    // …and without `fields`, the lean read is untouched: the dial is the
    // projection's own.
    expect(nodeOf(walked(timed(), { id: "lane", depth: 1, withDesc: false })).children[0])
      .not.toHaveProperty("desc")
  })

  test("absent, the dial answers today's rows — the situating and all", () => {
    // THE NO-CHANGE RULE, pinned as a case of its own rather than left to
    // every other test in the file: name nothing, and the full situated
    // shape of today is what comes back, place, ancestry, edges and all.
    const lane = nodeOf(walked(timed(), { id: "lane", depth: 1 }))
    expect(lane.children[0]).toMatchObject({
      id: "one",
      file: "steps.olai",
      line: 2,
      path: ["the lane"],
      parent: "lane",
      status: "done",
      custom: { agent: "claude-opus", took: "4m" },
      desc: "the forensics",
    })
    // …and the KEY SET is pinned against the schemas, not against a third
    // hand-typed list: a default walk row is a {@link Found} plus the five
    // the walk itself adds (`date`, the live note, `children`, `placed`,
    // `truncated`), and nothing FORWARD — the day a walk row carries a key
    // that is neither, the row definition here has drifted in someone's
    // darkness.
    const checkKeys = (row: object) => {
      for (const key of Object.keys(row)) {
        expect(
          key in Found.fields || key === "date" || key === "desc" ||
            key === "children" || key === "placed" || key === "truncated",
        ).toEqual(true)
      }
    }
    checkKeys(lane)
    for (const child of lane.children) {
      checkKeys(child)
      for (const grand of child.children) checkKeys(grand)
    }
    expect(read(timed().derived, "lane")?.children[0]).toMatchObject({
      id: "one",
      file: "steps.olai",
      line: 2,
      path: ["the lane"],
      parent: "lane",
    })
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
 * A WHOLE OUTLINE IN ONE CALL — `read_subtree`'s second way in, and the reason
 * this item exists: `list_outlines` says which files there are and what their
 * roots are CALLED, and until this the only way down was one call per root.
 */
describe("a whole outline, walked", () => {
  /** One outline with SEVERAL roots — the shape the `file` arm is for — with a
   *  placement at its top level (which is not a root), a second outline to be
   *  the near miss's near miss, and a file that did not parse. */
  const SHELF = (): OutlineSet =>
    setOf({
      "plan.olai": [
        `{"id":"today","ord":"a0","title":"Today"}`,
        `{"id":"call","parent":"today","ord":"a0","title":"call the joiner","todo":true}`,
        `{"id":"hinges","parent":"call","ord":"a0","title":"ask about the hinges"}`,
        `{"id":"later","ord":"a1","title":"Later","desc":"nothing urgent"}`,
        // A placement, at the top level, of a node that lives under `today`.
        `{"id":"echo","ord":"a2","mirror":"call"}`,
      ].join("\n"),
      "notes.olai": `{"id":"scrap","ord":"a0","title":"a scrap"}`,
    }, [], { "torn.olai": "{ not a record" })

  const shelf = () => readingOf(SHELF())

  const rootIds = (answer: SubtreeAnswer): ReadonlyArray<string> =>
    outlineOf(answer).roots.map((root) => root.id)

  test("one call answers every top-level node, nested", () => {
    const answer = walked(shelf(), { file: "plan.olai" })
    // The file rides back, so an agent holding several reads in flight knows
    // which one this is.
    expect(answer).toMatchObject({ file: "plan.olai" })
    // BOTH roots, in the sibling order a reader sees them in — which is the
    // whole claim: two roots used to be two calls.
    expect(rootIds(answer)).toEqual(["today", "later"])
    // …and each one walked, not merely named: `list_outlines` already answers
    // the titles.
    const answered = outlineOf(answer)
    expect(answered.roots[0]?.children.map((child) => child.id)).toEqual(["call"])
    expect(answered.roots[0]?.children[0]?.children.map((child) => child.id))
      .toEqual(["hinges"])
    // The note rides on a row exactly as it does under an `id` walk.
    expect(answered.roots[1]).toMatchObject({ desc: "nothing urgent" })
  })

  test("each root says for itself where the walk stopped", () => {
    const answer = outlineOf(walked(shelf(), { file: "plan.olai", depth: 1 }))
    // One root bottoms out at the depth…
    expect(answer.roots[0]?.children[0]).toMatchObject({ id: "call", truncated: true })
    // …while its neighbour bottoms out at a leaf, and says nothing.
    expect(answer.roots[1]).not.toHaveProperty("truncated")
  })

  /**
   * THE LEAN WALK — `withDesc: false` omits every note, default keeps them,
   * and `truncated` does not move. Depth bounds levels, not prose; the flag
   * is how a table-of-contents question does not pay for the forensics.
   */
  test("the notes ride by default, and `withDesc: false` takes them off", () => {
    const withNotes = outlineOf(walked(shelf(), { file: "plan.olai" }))
    expect(withNotes.roots[1]).toMatchObject({ desc: "nothing urgent" })
    // Explicit `true` is the same answer as omitting the flag — ON is the
    // default, said out loud rather than inferred from the line above.
    expect(outlineOf(walked(shelf(), { file: "plan.olai", withDesc: true })).roots[1])
      .toMatchObject({ desc: "nothing urgent" })

    const lean = outlineOf(walked(shelf(), { file: "plan.olai", withDesc: false }))
    expect(lean.roots[1]).not.toHaveProperty("desc")
    // Structure is unchanged: both roots, the child, the grandchild.
    expect(lean.roots.map((root) => root.id)).toEqual(["today", "later"])
    expect(lean.roots[0]?.children[0]?.children.map((child) => child.id))
      .toEqual(["hinges"])
  })

  test("`truncated` is unchanged by the flag", () => {
    const lean = outlineOf(
      walked(shelf(), { file: "plan.olai", depth: 1, withDesc: false }),
    )
    expect(lean.roots[0]?.children[0]).toMatchObject({ id: "call", truncated: true })
    expect(lean.roots[0]?.children[0]).not.toHaveProperty("desc")
    expect(lean.roots[1]).not.toHaveProperty("truncated")
  })

  test("the id arm honours the flag too — one walk, two ways in", () => {
    expect(nodeOf(walked(shelf(), { id: "later" })))
      .toMatchObject({ desc: "nothing urgent" })
    expect(nodeOf(walked(shelf(), { id: "later", withDesc: false })))
      .not.toHaveProperty("desc")
  })

  /**
   * THE ONE PLACE THE TWO ANSWERS ABOUT ONE OUTLINE DIFFER, pinned so it is a
   * decision rather than something that happens.
   *
   * `list_outlines` names a file's roots in the order the FILE writes them, and
   * that is deliberate and has a case of its own ("the directory", below). This
   * walk answers in the TREE's order, `ord`, which is what a page draws and
   * what every `children` list in the same answer is in — a walk that ordered
   * its roots one way and their children another would be the odd one.
   *
   * `ord` is a fractional index and a write re-emits a file without sorting it,
   * so a reordered root parts the two. Both declarations say so; this is what
   * makes them say the same thing as the code.
   */
  test("the roots are the tree's order, where the listing is the file's", () => {
    const set = setOf({
      // Written out of `ord` order on purpose — the same fixture shape the
      // listing's own case uses, so the two claims are read against each other.
      "out.olai": [
        `{"id":"second","ord":"a1","title":"Second"}`,
        `{"id":"first","ord":"a0","title":"First"}`,
      ].join("\n"),
    })
    expect(rootIds(walked(readingOf(set), { file: "out.olai" })))
      .toEqual(["first", "second"])
    expect(outlines(set, derivedOf(set))[0]).toEqual({
      file: "out.olai",
      nodes: 2,
      roots: ["Second", "First"],
    })
  })

  test("a placement at the top level is not a root", () => {
    // The walk's own rule read one level up: a mirror is a second view of a
    // node that lives elsewhere, and elsewhere is where this read answers it.
    expect(rootIds(walked(shelf(), { file: "plan.olai" }))).not.toContain("echo")
  })

  test("a path that is not an outline is refused with the closest one that is", () => {
    const refusal = refusedWalk(shelf(), { file: "plans.olai" })
    expect(refusal._tag).toBe("NotFoundFailure")
    expect(refusal.message).toContain("did you mean `plan.olai`")
  })

  test("…and with the outlines themselves when nothing is close", () => {
    // The right answer for a directory of a handful of outlines, and the wrong
    // one for its few thousand node ids — which is why the two refusals differ.
    const refusal = refusedWalk(shelf(), { file: "nothing/like/it/at/all.olai" })
    expect(refusal.message).toContain("plan.olai")
    expect(refusal.message).toContain("notes.olai")
  })

  test("a file that did not parse is refused with the validator's own rows", () => {
    // Never answered as an outline holding nothing: nobody read that file, so
    // there is nothing to answer with — `read_document`'s rule for a `.md`.
    const refusal = refusedWalk(shelf(), { file: "torn.olai" })
    expect(refusal._tag).toBe("ValidationFailure")
    expect(
      (refusal as { readonly verdict: { readonly findings: ReadonlyArray<unknown> } })
        .verdict.findings,
    ).not.toBeEmpty()
    // …and told the truth about ITSELF. An outline is read perfectly well and
    // then has lines the format cannot take, which is not the same failure as a
    // body that could not be read — the two reads that answer a whole file
    // share one sentence and the file decides which half of it applies.
    expect(refusal.message).toContain("has lines that do not parse")
    expect(refusal.message).toContain("nothing to answer with")
  })

  test("naming both, and naming neither, are refused in their own words", () => {
    const both = refusedWalk(shelf(), { id: "today", file: "plan.olai" })
    expect(both._tag).toBe("UsageFailure")
    expect(both.message).toContain("two different reads")

    const neither = refusedWalk(shelf(), {})
    expect(neither._tag).toBe("UsageFailure")
    expect(neither.message).toContain("`id`")
    expect(neither.message).toContain("`file`")
  })

  test("an id the set does not hold is still an answer, not a refusal", () => {
    // The asymmetry, pinned: an id is minted and carried around in prose, so
    // "is there a node called this?" is a fair question with a true answer. A
    // path was listed or typed, and the useful answer to a typo is the near
    // miss above.
    expect(walked(shelf(), { id: "nope" })).toEqual({ missing: "nope" })
    // A placement is not a node, and is answered the same way.
    expect(walked(shelf(), { id: "echo" })).toEqual({ missing: "echo" })
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
    expect(read(derivedOf(TAGGED()), "call")?.tags).toEqual([
      "@alice",
      "#alice/onboarding",
    ])
  })

  test("a node with none reports an empty list rather than nothing", () => {
    expect(read(derivedOf(TAGGED()), "plain")?.tags).toEqual([])
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
      // The torn row is the other arm: its errors and NOTHING ELSE — no
      // `nodes: 0` for a count nobody counted, and no empty `roots` claiming
      // the outline is about nothing. Empty above is a file somebody emptied;
      // this is a file nobody read. They must not look the same.
      { file: "torn.olai", unreadable: [expect.any(String)] },
    ])
  })
})

/**
 * LISTING SIZES ≡ RECOMPUTE-FROM-BODY.
 *
 * `list_documents` used to UTF-8-encode every served body on every call to
 * report a size the decode already knew. The size now lives on the document;
 * this is the gate that the remembered number is still the old answer, byte
 * for byte — including over multi-byte UTF-8, which is the case a
 * `text.length` count (UTF-16 units) would silently get wrong. And including
 * after a write replaces the body, which is the case a spread that swapped
 * `body` and left `bytes` would silently get wrong.
 */
describe("a document listing's sizes are a recompute from the body", () => {
  const agree = (set: OutlineSet): void => {
    const listed = documents(set)
    const bodies = new Map<string, string>(
      markdownIn(set).map((entry) => [entry.path, entry.body]),
    )
    expect(listed.length).toBeGreaterThan(0)
    for (const row of listed) {
      const body = bodies.get(row.file)
      if (body === undefined) {
        throw new Error(`listed \`${row.file}\` is not a markdown document of the set`)
      }
      if ("unreadable" in row) continue
      expect(row.bytes).toBe(bytesOf(body))
    }
  }

  test("over the suite corpus", () => {
    agree(suiteCorpus())
  })

  test("over a generated corpus, including multi-byte UTF-8", () => {
    const set = generatedCorpus()
    agree(set)
    // THE CLASSIC FAILURE: a size that drifts on emoji. `👋` is one character,
    // two UTF-16 units, four UTF-8 bytes; a listing that reported
    // `text.length` would pass every ASCII fixture and fail here.
    const emoji = documents(set).find((row) => row.file === "emoji.md")
    if (emoji === undefined || "unreadable" in emoji) {
      throw new Error("generated corpus is missing emoji.md")
    }
    expect(emoji.bytes).not.toBe("hello 👋🔥\n".length)
    expect(emoji.bytes).toBe(bytesOf("hello 👋🔥\n"))
  })

  test("after a write replaces the body", () => {
    // THE APPLY STEP, which a cold listing never reaches. `write_document`
    // lands through `following`'s fold (`bodiedDocument` on the applied
    // text); a future fast path that spread a document and swapped `body`
    // without `bytes` would pass every fixture above and fail here.
    const was = "hello\n"
    const next = "hello 👋🔥\n"
    const set = setOf({}, [["note.md", was]])
    agree(set)
    const made = planned(set, { op: "doc", file: "note.md", text: next })
    const folded = succeeded(
      folding(scoping(readingOf(set), steady(), NO_KINDS))(made),
      "`write_document` to apply",
    )
    agree(folded.set)
    const listed = documents(folded.set).find((row) => row.file === "note.md")
    if (listed === undefined || "unreadable" in listed) {
      throw new Error("the rewritten note.md is missing from the listing")
    }
    expect(listed.bytes).toBe(bytesOf(next))
    expect(listed.bytes).not.toBe(bytesOf(was))
  })
})

/** The e2e fixtures' `.md` files, loaded as a set — the directory the suite
 *  actually serves, not a hand-picked handful of the same texts. */
const suiteCorpus = (): OutlineSet => {
  const root = join(import.meta.dir, "../../tests/fixtures")
  const files: Array<readonly [string, string]> = []
  const walk = (dir: string, rel = ""): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const next = rel === "" ? entry.name : `${rel}/${entry.name}`
      if (entry.isDirectory()) walk(join(dir, entry.name), next)
      else if (fileKind(next) === "document") {
        files.push([next, readFileSync(join(dir, entry.name), "utf8")])
      }
    }
  }
  walk(root)
  return setOf({}, files)
}

/**
 * Bodies chosen to catch a size that drifts on emoji: 4-byte UTF-8, a ZWJ
 * sequence, combining marks, CJK, an empty file, frontmatter. `text.length`
 * on any of the multi-byte rows is a different number than `bytesOf`.
 */
const generatedCorpus = (): OutlineSet =>
  setOf({}, [
    ["empty.md", ""],
    ["ascii.md", "hello\n"],
    ["emoji.md", "hello 👋🔥\n"],
    ["family.md", "👨‍👩‍👧‍👦\n"],
    ["cjk.md", "日本語 中文 한국어\n"],
    ["combo.md", "cafe\u0301\n"],
    ["four-byte.md", "𐍈\n"],
    ["mixed.md", "# Title 🎯\n\nProse with naïve café and 中文.\n"],
    ["front.md", "---\ntitle: 🎉\n---\n# Hello\n"],
  ], { "torn.md": "{ not a record" })

// ── the other question the matcher answers ─────────────────────────────

/**
 * `narrowing` is the PAGE FILTER's door: which nodes OF ONE PAGE a query
 * selects, ids and why.
 *
 * Every case here is about the ways it is deliberately NOT {@link search} —
 * uncapped, unranked, records only, no situating — because that is the whole of
 * the shape (`@olai/format`'s `searching.ts` argues it), and a hit list quietly
 * answering here would fail nothing in a browser until somebody counted
 * "3 of 41" off twelve rows. Plus the one that is newer and is the reason this
 * member exists at all: the candidates are the PAGE's rows, so a node the page
 * does not draw is not in the answer however well it matches
 * (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/filter-rides-the-page.md).
 */
describe("which nodes of a page a query selects", () => {
  const PILE = (): OutlineSet =>
    setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order the doors","desc":"walnut, or birch"}`,
        `{"id":"hinges","parent":"kitchen","ord":"a1","title":"pick the door hinges","done":"2026-08-02"}`,
        `{"id":"tiles","parent":"kitchen","ord":"a2","title":"the door mat"}`,
      ].join("\n"),
      "shed.olai": `{"id":"shed","ord":"a0","title":"the shed door"}`,
      "_olai/Trash.olai": [
        `{"id":"old","ord":"a0","title":"the old door"}`,
      ].join("\n"),
    })

  /** The outline everything below is filtered on, unless a case names another
   *  page. An `.olai` path is an outline: the address grammar says which page a
   *  suffix opens, and nothing here re-decides it. */
  const AT_HOUSE: PageRequest = {
    kind: "at",
    address: { kind: "document", path: DocumentPath.make("house.olai") },
  }

  const asked = (page: PageRequest, text: string): NarrowingAnswer =>
    narrowing(readingOf(PILE()), { page, text }, TODAY, NO_KINDS)

  const ids = (text: string, page: PageRequest = AT_HOUSE): ReadonlyArray<string> =>
    asked(page, text).matches.map((one) => one.id)

  test("every match comes back, past the cap a search would have applied", () => {
    // Three of them, where `search` answers twelve by default and a palette
    // asks for eight: a page that pruned itself by a capped answer would draw
    // the rows the cap kept and count the ones it did not.
    expect(ids("door")).toEqual(["order", "hinges", "tiles"])
  })

  test("A NODE THIS PAGE DOES NOT DRAW IS NOT IN THE ANSWER", () => {
    // The whole of `filter-ask-carries-revision`. `shed` matches the query as
    // well as any row of `house.olai` does, and the box that asked is narrowing
    // an outline it is not in — so the walk never reaches it, where the door
    // this replaced walked the whole vault to hand it over for the page to drop
    // again.
    expect(ids("door")).not.toContain("shed")
    // ...and the page that DOES draw it says so, which is what makes the line
    // above a claim about scope rather than about this fixture.
    expect(ids("door", {
      kind: "at",
      address: { kind: "document", path: DocumentPath.make("shed.olai") },
    })).toEqual(["shed"])
  })

  test("the order is the PAGE's, where a search's is the ranking", () => {
    // The two doors onto one matcher, over one query, side by side — which is
    // what makes this a claim rather than a second spelling of the case above.
    // `hinges` is finished, so the shortlist sinks it under the done penalty
    // and this answer leaves it where the page puts it: a page draws its rows
    // in the page's order and looks each one up here, and the day this starts
    // ranking is the day a filtered outline reorders itself under a cursor.
    expect(ids("door")).toEqual(["order", "hinges", "tiles"])
    expect(nodeHits(search(readingOf(PILE()), { text: "door" }, TODAY, NO_KINDS)).map((hit) => hit.id))
      .toEqual(["order", "tiles", "shed", "hinges"])
  })

  test("why a node is here is the field that carried the words, or nothing", () => {
    // `walnut` is in `order`'s note and in no title anywhere — the row a
    // filtered page draws an excerpt for (`@olai/web`'s `filter/why.ts`).
    expect(asked(AT_HOUSE, "walnut").matches)
      .toEqual([{ id: NodeId.make("order"), matched: "desc" }])
    // ...and a query that named no words at all is carried by no field, so the
    // slot is ABSENT rather than filled with an invented reason.
    expect(asked(AT_HOUSE, "is:done").matches)
      .toEqual([{ id: NodeId.make("hinges") }])
  })

  test("the words come back with the answer, so a page knows what it answers", () => {
    // Read off the value that holds the rows rather than off a signal beside
    // it: the bar draws `filtering…` over rows that answer a query the reader
    // has moved on from, and that fact may not be a frame ahead of them
    // (`@olai/format`'s `NarrowingAnswer`).
    expect(asked(AT_HOUSE, "walnut").text).toBe("walnut")
  })

  test("what was put away is out, unless the PAGE is already showing it", () => {
    // A live outline draws no archived row, so `is:trashed` on one selects
    // nothing: the grammar's door is still the grammar's, and what it opens is
    // a corner of the set this page is not in.
    expect(ids("is:trashed door")).toEqual([])
    // The trash IS the archive, and a matcher applying the default there would
    // take every row off the screen and leave the reader nothing to read the
    // absence by.
    expect(ids("door", { kind: "trash" })).toEqual(["old"])
  })

  test("a query nobody could read selects nothing, and says nothing about it", () => {
    // No `refusals` on this answer, deliberately: the door that asks it reads
    // the same grammar itself, so it has already drawn the sentence by the time
    // a frame could carry one (`@olai/format`'s `NarrowingAnswer`).
    expect(asked(AT_HOUSE, "is:open")).toEqual({ text: "is:open", matches: [] })
    // Nothing typed is not a question either.
    expect(asked(AT_HOUSE, "  ")).toEqual({ text: "  ", matches: [] })
  })

  // A DOCUMENT IS NEVER ONE, and it is structural rather than a case: a
  // document's page draws no rows at all, so the walk that produces the
  // candidates has nothing to yield. Which is the honest arrangement — the page
  // that draws prose is the one page that carries no filter at all
  // (`@olai/web`'s `routes.ts`).
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
/**
 * The house, for the TWO doors that ask about ids exactly — {@link named} and
 * {@link homes}.
 *
 * ONE fixture and not one each, because the sharpest case in either describe is
 * the CONTRAST: `nowhere` is a placement whose chain is dead, and what the two
 * doors say about it is the whole reason they are two members. Over two sets
 * that merely look alike, that contrast stops being one the day somebody edits
 * the copy in front of them.
 */
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
    "garden.olai": HERBS,
    "_olai/Trash.olai": [
      `{"id":"old","ord":"a0","title":"the old counters"}`,
    ].join("\n"),
  })

/** One record in a file of its own, so a case can ask about a FILE it is not
 *  asking about the ids of. */
const HERBS = `{"id":"herbs","ord":"a0","title":"the herb bed"}`

describe("which of these ids the set declares", () => {
  const asked = (...ids: ReadonlyArray<string>) => named(derivedOf(HOUSE()), { ids }).named

  test("an id the set declares comes back with the node it names", () => {
    expect(asked("order")).toEqual([{ asked: "order", id: "order", title: "order the cabinets" }])
  })

  test("a PLACEMENT names the node it shows, not itself", () => {
    // The whole reason this answers with a pair. A row in the tree carries the
    // node it SHOWS, so a span marked `echo` would name no row and every press
    // of it would leave the page for a node that is right there.
    expect(asked("echo")).toEqual([{ asked: "echo", id: "order", title: "order the cabinets" }])
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
      { asked: "order", id: "order", title: "order the cabinets" },
      { asked: "echo", id: "order", title: "order the cabinets" },
    ])

  })

  test("an id repeated is asked once", () => {
    // A caller builds a lookup out of this, and a lookup has one entry per key.
    expect(asked("order", "order", "order")).toEqual([{ asked: "order", id: "order", title: "order the cabinets" }])
  })

  test("what was put away is still declared", () => {
    // A lookup is not a search, so the grammar's rule about `is:trashed` has
    // nothing to say here: the id names the node it names, and a reader
    // pressing it is shown where it now is.
    expect(asked("old")).toEqual([{ asked: "old", id: "old", title: "the old counters" }])
  })

  test("nothing asked is nothing answered", () => {
    expect(named(derivedOf(HOUSE()), { ids: [] })).toEqual({ named: [] })
  })
})

/**
 * `homes` is the FOLD MEMORY's door: where these ids are, and which of these
 * files the set has anything from.
 *
 * The door beside it ({@link named}) is the same shape and a different
 * question, which is what most of these cases hold apart: this one is the plain
 * record table and follows no mirror chain, because its caller remembers
 * RECORDS rather than what a reader would be shown. The browser answered both
 * halves out of a walk of its own copy of the whole directory until
 * `vib-6-refile`.
 */
describe("where these ids are, and which of these files the set has", () => {
  const asking = (ids: ReadonlyArray<string>, files: ReadonlyArray<string> = []) =>
    homes(readingOf(HOUSE()), { ids, files })

  test("an id the set declares comes back with the file its record is written in", () => {
    expect(asking(["order"]).homes).toEqual([{ id: "order", file: "house.olai" }])
  })

  test("a node that was PUT AWAY answers with the file it was moved to", () => {
    // The case the whole member exists for: `archive` keeps the id and moves
    // the record, so a fold filed under the source file is re-filed rather than
    // read as a deletion.
    expect(asking(["old"]).homes).toEqual([{ id: "old", file: "_olai/Trash.olai" }])
  })

  test("a PLACEMENT answers for ITSELF — no chain is followed", () => {
    // The one decision in the function, and the difference from `named` one
    // door over. A fold is of a record: a mirror whose chain has died shows
    // nothing and is folded by its own id, so asked through `named` it would
    // read as a node that is gone while its record sits in the file.
    expect(asking(["echo", "nowhere"]).homes).toEqual([
      { id: "echo", file: "house.olai" },
      { id: "nowhere", file: "house.olai" },
    ])
    expect(named(derivedOf(HOUSE()), { ids: ["nowhere"] }).named).toEqual([])
  })

  test("an id no record carries is not in the answer at all", () => {
    expect(asking(["deleted", "order"]).homes).toEqual([
      { id: "order", file: "house.olai" },
    ])
  })

  test("an id repeated is asked once", () => {
    expect(asking(["order", "order"]).homes).toEqual([
      { id: "order", file: "house.olai" },
    ])
  })

  test("the files answered are the asked ones this directory READ", () => {
    // The other half of the decision, and the half the ids cannot give: a file
    // whose every remembered id has gone away looks exactly like a file that
    // stopped parsing, from the ids alone. A path the directory does not serve
    // is not one either.
    expect(asking([], ["house.olai", "garden.olai", "gone.olai"]).loaded).toEqual([
      "house.olai",
      "garden.olai",
    ])
  })

  test("an outline somebody EMPTIED was still read", () => {
    // The near miss. `byFile` answers "holds a record", and a file with nothing
    // of its own is absent from it rather than mapped to an empty list — so an
    // outline whose last node was deleted would come back unreadable, and a
    // caller reading that as "nothing can be concluded" would keep the folds of
    // every node that used to be in it, for good.
    const emptied = readingOf(setOf({ "house.olai": "", "garden.olai": HERBS }))
    expect(homes(emptied, { ids: [], files: ["house.olai"] }).loaded).toEqual([
      "house.olai",
    ])
  })

  test("a file that would not parse is silent, and so is one nobody serves", () => {
    // Both mean "nothing can be concluded", which is what leaving them out
    // says. The broken one keeps its key on the wire and declares no nodes; the
    // other is not there at all.
    const torn = readingOf(
      setOf({ "garden.olai": HERBS }, [], { "house.olai": `{"id":` }),
    )
    expect(homes(torn, { ids: ["herbs"], files: ["house.olai", "gone.olai"] })).toEqual({
      homes: [{ id: "herbs", file: "garden.olai" }],
      loaded: [],
    })
  })

  test("nothing asked is nothing answered", () => {
    expect(asking([], [])).toEqual({ homes: [], loaded: [] })
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
    // Two late over two outlines; today is `posts` (doing). `mum` is an
    // occurrence on the same day — on the day page, not owed.
    expect(owed(derivedOf(DAYS()), { today: "2026-08-09" }))
      .toEqual({ overdue: 2, today: 1 })
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
