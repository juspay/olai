// This package may import `@olai/ops`, and `@olai/ops` may not import this one.
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
  type Reading,
  type SearchAnswer,
  type SearchRequest,
} from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import { Query } from "@olai/ops"
import { succeeded } from "@olai/ops/testlib"
import { describe, expect, test } from "bun:test"

import { search } from "./matcher.ts"

const nodeHits = (answer: SearchAnswer): ReadonlyArray<NodeHit> =>
  answer.hits.filter(isNodeHit)

const derivedOf = (set: OutlineSet): Derived => readingOf(set).derived

const TODAY = "2026-08-09"

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
      `{"id":"focus-git","parent":"focus","ord":"a0","mirror":"git"}`,
    ].join("\n"),
  })

const reading = () => readingOf(LEDGER())

const read = (of: Reading, id: string): Detail | null =>
  succeeded(Query.detail(of, id), "`outlines_read` to answer")

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
    const other = search(reading(), { text: "indicators" }, TODAY, NO_KINDS).hits[0]
    expect(other).toMatchObject({ id: "git" })
    expect(other).not.toHaveProperty("after")
    expect(other).not.toHaveProperty("see")
  })


  test("a search hit answers the map, verbatim and uncut — found by word or by property", () => {
    expect(search(reading(), { text: "indicators" }, TODAY, NO_KINDS).hits[0]).toMatchObject({
      id: "git",
      custom: { pr: "https://github.com/juspay/olai/pull/176", agent: "claude-opus" },
    })
    const byProp = nodeHits(search(reading(), { text: "prop:agent=claude-opus" }, TODAY, NO_KINDS))
    expect(byProp.map((hit) => hit.id)).toEqual(["git"])
    expect(byProp[0]?.custom?.["pr"]).toBe("https://github.com/juspay/olai/pull/176")
  })


  test("a hit says which property carried it, beside which field carried the words", () => {
    const [byProp] = nodeHits(search(reading(), { text: "prop:agent=claude-opus" }, TODAY, NO_KINDS))
    expect(byProp?.matchedProps).toEqual(["agent"])
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


  test("a key holding nothing is carried by neither the hit nor `prop:`", () => {
    const lane = readingOf(setOf({
      "roadmap.olai": `{"id":"lane","ord":"a0","title":"a lane","custom":{"pr":"","agent":"claude-opus"}}`,
    }))
    expect(search(lane, { text: "prop:pr" }, TODAY, NO_KINDS).hits).toEqual([])
    expect(nodeHits(search(lane, { text: "lane" }, TODAY, NO_KINDS))[0]?.custom)
      .toEqual({ agent: "claude-opus" })
    const bare = readingOf(setOf({
      "roadmap.olai": `{"id":"bare","ord":"a0","title":"a bare lane","custom":{"pr":""}}`,
    }))
    expect(search(bare, { text: "lane" }, TODAY, NO_KINDS).hits[0]).not.toHaveProperty("custom")
    expect(read(bare, "bare")).not.toHaveProperty("custom")
  })


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
    expect(hit).not.toHaveProperty("matched")
    expect(Object.keys((hit as { props: object }).props)).toEqual(["agent", "pr"])
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
  test("`is:blocked` reaches an agent as the derivation the page draws", () => {
    expect(nodeHits(search(reading(), { text: "is:blocked" }, TODAY, NO_KINDS)).map((hit) => hit.id))
      .toEqual(["sticky"])
    const free = search(reading(), { text: "-is:blocked" }, TODAY, NO_KINDS).hits.filter(isNodeHit).map((hit) => hit.id)
    expect(free).not.toContain("sticky")
    expect(free).toContain("git")
  })


  test("a search never answers with a placement", () => {
    expect(search(reading(), { text: "git" }, TODAY, NO_KINDS).hits.filter(isNodeHit).map((hit) => hit.id))
      .not.toContain("now-git")
  })


  test("a tag is found by its name and by its written form", () => {
    const set = readingOf(TAGGED())
    for (const text of ["alice", "@alice", "#alice"]) {
      expect(nodeHits(search(set, { text }, TODAY, NO_KINDS)).map((hit) => hit.id)).toEqual(["call"])
    }
  })


  test("the order is the PAGE's, where a search's is the ranking", () => {
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

describe("the notes a query asks for", () => {
  test("a hit carries `desc` when the query asked, and never otherwise", () => {
    const [asked] = nodeHits(search(reading(), { text: "indicators", withDesc: true }, TODAY, NO_KINDS))
    expect(asked).toMatchObject({
      id: "git",
      desc: "the pill and the readout answer the same question",
    })
    expect(nodeHits(search(reading(), { text: "indicators" }, TODAY, NO_KINDS))[0])
      .not.toHaveProperty("desc")
    expect(nodeHits(search(reading(), { text: "indicators", withDesc: false }, TODAY, NO_KINDS))[0])
      .not.toHaveProperty("desc")
  })

  test("a node with no note says nothing, asked or not", () => {
    expect(nodeHits(search(reading(), { text: "header", withDesc: true }, TODAY, NO_KINDS))[0])
      .not.toHaveProperty("desc")
  })

  test("the note travels WHOLE — the flag is the dial, never a length", () => {
    const long = `forensics: ${"the pill said committed while nothing was. ".repeat(40)}`
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
    const set = setOf(
      { "bugs.olai": `{"id":"one","ord":"a0","title":"a bug"}` },
      [["notes/bug.md", "# a bug\n\nthe prose lives here\n"]],
    )
    const [hit] = search(readingOf(set), { text: "bug", withDesc: true }, TODAY, NO_KINDS).hits
      .filter((one) => one.at.kind === "document" && one.at.path === "notes/bug.md")
    expect(hit).toMatchObject({ at: { kind: "document", path: "notes/bug.md" } })
    expect(hit).not.toHaveProperty("desc")
  })
})

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
    expect(ids({ text: "the is:done" })).toEqual(["book", "paint"])
    expect(ids({ text: "the -is:done" })).toEqual(["trip", "house", "pack"])
    expect(ids({ text: "has:desc" })).toEqual(["pack"])
    expect(ids({ text: "date:2026-08-09" })).toEqual(["paint"])
  })

  test("a relative date is counted from the day the search is asked on", () => {
    expect(ids({ text: "date:today" })).toEqual(["paint"])
    expect(ids({ text: "date:this-week" })).toEqual(["book", "paint"])
    expect(ids({ text: "date:last-week" })).toEqual([])
    expect(ids({ text: "date:tomorrow" })).toEqual([])
    expect(ids({ text: "date:this-month" })).toEqual(["book", "paint"])
  })

  test("a phrase and an `OR` group reach the ranked door too", () => {
    expect(ids({ text: `"book the flights"` })).toEqual(["book"])
    expect(ids({ text: `"flights the book"` })).toEqual([])
    expect(ids({ text: "flights the book" })).toEqual(["book"])
    expect(ids({ text: "flights OR hall" })).toEqual(["book", "paint"])
    expect(ids({ text: "is:done flights OR hall" })).toEqual(["book", "paint"])
    expect(ids({ text: "-is:done flights OR hall" })).toEqual([])
  })

  test("a refused operator answers with nothing rather than with half the query", () => {
    expect(ids({ text: "is:open trip" })).toEqual([])
  })

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

  test("a refused query carries the reason to whoever asked", () => {
    const answer = search(readingOf(WORK()), { text: "is:open trip" }, TODAY, NO_KINDS)
    expect(answer.refusals).toEqual([{
      token: "is:open",
      reason: "is: takes one of done, cancelled, doing, todo, marked, blocked, mirrored, trashed",
    }])
    expect(search(readingOf(WORK()), { text: "is:OPEN" }, TODAY, NO_KINDS).refusals?.[0]?.token)
      .toBe("is:OPEN")
  })

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
    const answer = search(readingOf(WORK()), { text: "is:done", limit: 1 }, TODAY, NO_KINDS)
    expect(answer.hits.filter(isNodeHit).map((hit) => hit.id)).toEqual(["book"])
    expect(answer.total).toBe(2)
  })
})

test("document landings count file lines including frontmatter and use the strongest body word", () => {
  const vault = readingOf(setOf({}, [["landing.md", "---\nproject: garden\n---\n# Journal\n\nprefixedweak\n\nSTRONG word\n"]]))
  const answer = search(vault, { text: "weak strong" }, TODAY, NO_KINDS)
  expect(answer.hits[0]).toMatchObject({ matched: "body", line: 8 })
  for (const text of ["journal", "landing.md", "prop:project=garden", "-is:done"]) {
    expect(search(vault, { text }, TODAY, NO_KINDS).hits[0]).not.toHaveProperty("line")
  }
})

test("uncapped category totals describe the requested kind before the hit cap", () => {
  const vault = readingOf(setOf({ "orchid.olai": '{"id":"orchid-node","ord":"a0","title":"orchid"}' }, [["orchid.md", "# orchid"]]))
  const all = search(vault, { text: "orchid", limit: 1 }, TODAY, NO_KINDS)
  expect(all.hits).toHaveLength(1)
  expect(all.total).toBe(3)
  expect(all.totals).toEqual({ node: 1, file: 2 })
  const files = search(vault, { text: "orchid", kind: "file", limit: 1 }, TODAY, NO_KINDS)
  expect(files.hits).toHaveLength(1)
  expect(files.total).toBe(2)
  expect(files).not.toHaveProperty("totals")
})
