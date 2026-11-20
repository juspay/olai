import { TEST_CLAIMS } from "olai-plugin-outline-olai/testlib"
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
  detail,
  documents,
  homes,
  named,
  narrowing,
  outlines,
  subtree,
  tags,
} from "./query.ts"

const nodeHits = (answer: SearchAnswer): ReadonlyArray<NodeHit> =>
  answer.hits.filter(isNodeHit)

const derivedOf = (set: OutlineSet): Reading => readingOf(set)

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

const at = () => derivedOf(LEDGER())

const walked = (of: Reading, request: SubtreeRequest): SubtreeAnswer =>
  succeeded(subtree(of, request), "`outlines_subtree` to answer")

const refusedWalk = (of: Reading, request: SubtreeRequest): OpFailure =>
  failed(subtree(of, request), "`outlines_subtree`")

const read = (of: Reading, id: string, fields?: ReadonlyArray<string>): Detail | null =>
  succeeded(detail(of, id, fields), "`outlines_read` to answer")

const refusedRead = (of: Reading, id: string, fields: ReadonlyArray<string>): OpFailure =>
  failed(detail(of, id, fields), "`outlines_read`")
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

const reading = () => readingOf(LEDGER())

test("a node carrying everything produces every field `Found` declares", () => {
  const at = derivedOf(setOf({
    "roadmap.olai": [
      `{"id":"top","ord":"a0","title":"Top"}`,
      `{"id":"all","parent":"top","ord":"a0","title":"carries everything","todo":true,` +
      `"see":["top"],"after":["top"],"custom":{"pr":"https://github.com/juspay/olai/pull/192"}}`,
    ].join("\n"),
  }))
  const carrying = read(at, "top")?.children[0]
  expect(carrying?.id).toBe("all")
  expect(Object.keys(carrying ?? {}).sort()).toEqual(Object.keys(Found.fields).sort())
})

test("a node's read carries `started`, `worked` and the derived `took` — and the jump carries none", () => {
  const at = derivedOf(setOf({
    "house.olai": [
      `{"id":"bake","ord":"a0","title":"bake the bread","done":"2026-08-29T12:26:44-04:00","started":"2026-08-29T09:52:00-04:00"}`,
      `{"id":"plumber","ord":"a1","title":"call the plumber","done":"2026-08-29T12:26:44-04:00"}`,
      `{"id":"hinge","ord":"a2","title":"fix the hinge on the door","cancelled":"2026-08-29T10:33:00-04:00","started":"2026-08-29T09:52:00-04:00"}`,
      `{"id":"water","ord":"a3","title":"water the plants","doing":true,"started":"2026-08-29T09:52:00-04:00"}`,
      `{"id":"knead","ord":"a4","title":"knead the dough","doing":true,"started":"2026-08-29T09:50:00-04:00","worked":600}`,
      `{"id":"proof","ord":"a5","title":"proof it","done":"2026-08-29T09:58:00-04:00","started":"2026-08-29T09:50:00-04:00","worked":1080}`,
    ].join("\n"),
  }))
  expect(read(at, "bake")).toMatchObject({ started: "2026-08-29T09:52:00-04:00", took: 9284 })
  expect(read(at, "hinge")).toMatchObject({ started: "2026-08-29T09:52:00-04:00", took: 2460 })
  expect(read(at, "bake")).not.toHaveProperty("worked")
  expect(read(at, "hinge")).not.toHaveProperty("worked")
  expect(read(at, "water")).toHaveProperty("started")
  expect(read(at, "water")).not.toHaveProperty("took")
  expect(read(at, "plumber")).not.toHaveProperty("started")
  expect(read(at, "plumber")).not.toHaveProperty("worked")
  expect(read(at, "plumber")).not.toHaveProperty("took")
  expect(read(at, "proof")).toMatchObject({ worked: 1080, took: 1080 })
  expect(read(at, "knead")).toMatchObject({ worked: 600, started: "2026-08-29T09:50:00-04:00" })
  expect(read(at, "knead")).not.toHaveProperty("took")
})

describe("the edges a node carries", () => {
  test("a node read carries them too, and so does a child in its list", () => {
    const bugs = read(at(), "bugs")
    expect(bugs?.children.find((child) => child.id === "sticky"))
      .toMatchObject({ after: ["git"] })
    expect(read(at(), "sticky")).toMatchObject({ after: ["git"], see: ["git"] })
  })

})

describe("what a node is waiting on", () => {
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
    expect(read(waiting(), "frame")?.blockedBy).toEqual([
      { id: "pour", title: "pour the slab", file: "build.olai", line: 1, status: "todo", path: [] },
      { id: "cure", title: "let it cure", file: "build.olai", line: 2, status: "doing", path: [] },
    ])
  })

  test("a node with nothing in its way does not say so with an empty list", () => {
    expect(read(waiting(), "pour")).not.toHaveProperty("blockedBy")
  })

  test("a bullet is waiting on nothing, whatever `after` it carries", () => {
    const chips = read(waiting(), "chips")
    expect(chips).toMatchObject({ after: ["pour"] })
    expect(chips).not.toHaveProperty("blockedBy")
  })
})

describe("the properties a node carries", () => {
  test("a node read answers the map, verbatim", () => {
    expect(read(at(), "git")?.custom).toEqual({
      pr: "https://github.com/juspay/olai/pull/176",
      agent: "claude-opus",
    })
    expect(read(at(), "git")).toMatchObject({ todo: true, status: "todo" })
  })

  test("a node with no properties carries no map, rather than an empty one", () => {
    expect(read(at(), "bugs")).not.toHaveProperty("custom")
  })

  test("a child in a node's list and a subtree row carry it, like `see`", () => {
    expect(read(at(), "bugs")?.children.find((child) => child.id === "git"))
      .toMatchObject({ custom: { agent: "claude-opus" } })
    const bugs = nodeOf(walked(reading(), { id: "bugs", depth: 1 }))
    expect(bugs.children.find((child) => child.id === "git"))
      .toMatchObject({ custom: { agent: "claude-opus" } })
    expect(bugs.children.find((child) => child.id === "sticky"))
      .not.toHaveProperty("custom")
  })

})

describe("what refers to a node", () => {
  test("a `see` is a reference and an ordering edge is not", () => {
    expect(read(at(), "git")?.referencedBy).toEqual([{
      source: {
        node: {
          id: "sticky",
          title: "the header scrolls away",
          ord: "a0",
          doing: true,
          after: ["git"],
          see: ["git"],
          parent: "bugs",
        },
        file: "roadmap.olai",
        line: 5,
      },
      ways: ["see"],
    }])
  })

  test("a word in a title or a note refers too, and one record is one referrer", () => {
    const view = derivedOf(setOf({
      "a.olai": [
        `{"id":"git","ord":"a0","title":"two git indicators"}`,
        `{"id":"said","ord":"a1","title":"about @git","desc":"and @git again"}`,
        `{"id":"both","ord":"a2","title":"see @git","see":["git"]}`,
      ].join("\n"),
    }))
    expect(read(view, "git")?.referencedBy?.map((one) => `${"node" in one.source ? one.source.node.id : one.source.path} ${one.ways.join("+")}`))
      .toEqual(["said mention", "both see+mention"])
  })

  test("a node nobody has written about says nothing rather than an empty list", () => {
    expect(read(at(), "sticky")).not.toHaveProperty("referencedBy")
  })

test("a node read reports the dead links its note names, against the served set", () => {
  const set = setOf({
    "projects/olai.olai": [
      `{"id":"link-test","ord":"a0","title":"Links","desc":"[x](nix-flakes.md)"}`,
    ].join("\n"),
  }, ["notes/nix-flakes.md"])
  const served = new Set(set.documents.map((one) => one.path))
  const answered = succeeded(
    detail(derivedOf(set), "link-test", undefined, served),
    "`outlines_read` to answer",
  )
  expect(answered?.deadLinks?.map((one) => one.resolved)).toEqual(["projects/nix-flakes.md"])
  expect(answered?.deadLinks?.[0]?.suggest).toEqual(["../notes/nix-flakes.md"])
})

  test("a document's body can refer to a node too, and is one source like a record", () => {
    const view = derivedOf(setOf(
      {
        "a.olai": [`{"id":"git","ord":"a0","title":"two git indicators"}`].join("\n"),
      },
      [["note.md", "# Note\n\nabout @git and [git](#git)"]],
    ))
    expect(read(view, "git")?.referencedBy?.map((one) =>
      `${"path" in one.source ? one.source.path : one.source.node.id} ${one.ways.join("+")}`
    )).toEqual(["note.md mention+link"])
  })
})
describe("placements", () => {
  test("`mirrors` names every placement of a node, chains followed", () => {
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

  test("`placed` lists what a curated list holds, in sibling order", () => {
    const now = read(at(), "now")
    expect(now?.placed?.map((entry) => entry.id)).toEqual(["now-sticky", "now-git"])
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
    expect(now?.placed?.[1]?.shows).toMatchObject({ id: "git", status: "todo" })
  })

  test("the placements are not the node's own children", () => {
    expect(read(at(), "now")?.children).toEqual([])
    expect(read(at(), "bugs")).not.toHaveProperty("placed")
  })

  test("a node whose children are all placements no longer reads as empty", () => {
    const board = nodeOf(walked(reading(), { id: "now", depth: 0 }))
    expect(board.children).toEqual([])
    expect(board).not.toHaveProperty("truncated")
    expect(board.placed?.map((entry) => [entry.id, entry.shows.id, entry.shows.title]))
      .toEqual([
        ["now-sticky", "sticky", "the header scrolls away"],
        ["now-git", "git", "two git indicators"],
      ])
    expect(Object.keys(board.placed![0]!).sort())
      .toEqual(["file", "id", "line", "parent", "shows"])
  })

  test("the note dial and the row projection leave the naming alone", () => {
    const lean = nodeOf(walked(reading(), { id: "now", depth: 0, withDesc: false }))
    expect(lean.placed?.map((entry) => entry.id)).toEqual(["now-sticky", "now-git"])
    const shaped = nodeOf(walked(reading(), { id: "now", depth: 0, fields: ["title"] }))
    expect(shaped).toMatchObject({ id: "now", title: "Now" })
    expect(shaped.placed?.map((entry) => entry.shows.id)).toEqual(["sticky", "git"])
    expect(shaped.placed?.[0]?.shows).toEqual({
      id: "sticky",
      title: "the header scrolls away",
    })
    expect(shaped.placed?.[0]?.shows).not.toHaveProperty("path")
    expect(shaped.placed?.[0]?.shows).not.toHaveProperty("file")
    expect(shaped.placed?.[0]?.shows).not.toHaveProperty("custom")
  })

  test("the file arm names them too — every root is the same walk", () => {
    const answer = outlineOf(walked(reading(), { file: "roadmap.olai" }))
    expect(answer.roots.find((root) => root.id === "now")?.placed?.map((entry) => entry.id))
      .toEqual(["now-sticky", "now-git"])
    expect(answer.roots.find((root) => root.id === "bugs")).not.toHaveProperty("placed")
    expect(answer).not.toHaveProperty("placed")
  })

})

describe("the parent a node sits under", () => {
  test("a child carries `parent`; a root does not", () => {
    expect(read(at(), "git")).toMatchObject({ parent: "bugs" })
    expect(read(at(), "bugs")).not.toHaveProperty("parent")
    expect(read(at(), "bugs")?.children.find((child) => child.id === "git"))
      .toMatchObject({ parent: "bugs" })
  })

  test("a subtree row carries it, at every depth the walk kept", () => {
    const bugs = nodeOf(walked(reading(), { id: "bugs" }))
    expect(bugs).not.toHaveProperty("parent")
    expect(bugs.children.find((child) => child.id === "git"))
      .toMatchObject({ parent: "bugs" })
  })
})

describe("the caller shapes the rows", () => {
  test("the vocabulary and the row's schema are one list, neither way", () => {
    expect(Object.keys(Projected.fields).filter((key) => key !== "id").sort())
      .toEqual([...PROJECTABLE].sort())
  })

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
    const lane = read(timed(), "lane", [
      "title",
      "status",
      "done",
      "custom.took",
      "desc",
      "started",
      "worked",
    ])
    expect(lane?.children[0]).toEqual({
      id: "one",
      title: "first",
      status: "done",
      done: "2026-08-29T09:12:00-04:00",
      desc: "the forensics",
      custom: { took: "4m" },
    })
    expect(Object.keys(lane?.children[0] ?? {}).sort()).toEqual([
      "custom",
      "desc",
      "done",
      "id",
      "status",
      "title",
    ])
    expect(lane?.children[1]).toEqual({
      id: "two",
      title: "second",
      status: "doing",
      started: "2026-08-29T09:14:00-04:00",
      worked: 600,
    })
  })

  test("its own node is answered in full — `fields` shapes the list, not the node", () => {
    const lane = read(timed(), "lane", ["status"])
    expect(lane).toMatchObject({ file: "steps.olai", line: 1, path: [], tags: [] })
    expect(lane?.children[0]).toEqual({ id: "one", status: "done" })
  })

  test("the whole map, and one key of it, are two different asks", () => {
    const whole = read(timed(), "lane", ["custom"])?.children[0]
    expect(whole).toEqual({ id: "one", custom: { agent: "claude-opus", took: "4m" } })
    const one = read(timed(), "lane", ["custom.agent"])?.children[0]
    expect(one).toEqual({ id: "one", custom: { agent: "claude-opus" } })
    const absent = read(timed(), "lane", ["custom.pr"])?.children[0]
    expect(absent).toEqual({ id: "one" })
  })

  test("`took` projects the span — whole seconds on a settled row, absent when there is none", () => {
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
    expect(read(readingOf(SPAN()), "lane", ["title", "status", "took"])?.children)
      .toEqual(expected)
    const rows =
      nodeOf(walked(readingOf(SPAN()), { id: "lane", depth: 1, fields: ["title", "status", "took"] })).children
    for (const [index, row] of expected.entries()) {
      expect(rows[index]?.id).toBe(row.id)
      expect(rows[index]).toMatchObject({ ...row, children: [] })
      expect(Object.keys(rows[index] ?? {}).sort()).toEqual(
        ["children", "id", ...Object.keys(row).filter((key) => key !== "id")].sort(),
      )
    }
    expect(read(readingOf(SPAN()), "done-one")?.took).toBe(240)
  })

  test("an asked-for field is dropped from the DESCS as well — the walk is shape, not prose", () => {
    const lane = read(timed(), "lane", ["desc"])
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
    const one = nodeOf(
      walked(timed(), { id: "lane", depth: 1, fields: ["title"] }),
    )
    expect(one.children).toEqual([
      { id: "one", title: "first", children: [], truncated: true },
      { id: "two", title: "second", children: [] },
    ])
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
    expect(nodeOf(walked(timed(), { id: "lane", depth: 1, fields: [] })).children)
      .toEqual([{ id: "one", children: [], truncated: true }, { id: "two", children: [] }])
    expect(nodeOf(walked(timed(), { id: "lane", depth: 1, fields: ["id"] })).children)
      .toEqual([{ id: "one", children: [], truncated: true }, { id: "two", children: [] }])
    expect(nodeOf(walked(timed(), { id: "lane", depth: 1, fields: ["title", "id"] })).children)
      .toEqual([{ id: "one", title: "first", children: [], truncated: true }, { id: "two", title: "second", children: [] }])
  })

  test("an unknown name is REFUSED, naming the legal ones — never silently dropped", () => {
    const refusal = refusedWalk(timed(), { id: "lane", fields: ["florp"] })
    expect(refusal._tag).toBe("UsageFailure")
    expect(refusal.message).toContain("`florp` is not a field `fields` names")
    for (const legal of PROJECTABLE) {
      expect(refusal.message).toContain(`\`${legal}\``)
    }
    expect(refusal.message).toContain("`custom.<key>`")
    const refused = refusedRead(timed(), "lane", ["florp"])
    expect(refused._tag).toBe("UsageFailure")
    expect(refused.message).toBe(refusal.message)
    expect(refusedRead(timed(), "gone", ["florp"])._tag).toBe("UsageFailure")
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
    expect(nodeOf(walked(timed(), { id: "lane", depth: 1, withDesc: false })).children[0])
      .not.toHaveProperty("desc")
  })

  test("absent, the dial answers today's rows — the situating and all", () => {
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
    expect(read(timed(), "lane")?.children[0]).toMatchObject({
      id: "one",
      file: "steps.olai",
      line: 2,
      path: ["the lane"],
      parent: "lane",
    })
  })
})

describe("a whole outline, walked", () => {
  const SHELF = (): OutlineSet =>
    setOf({
      "plan.olai": [
        `{"id":"today","ord":"a0","title":"Today"}`,
        `{"id":"call","parent":"today","ord":"a0","title":"call the joiner","todo":true}`,
        `{"id":"hinges","parent":"call","ord":"a0","title":"ask about the hinges"}`,
        `{"id":"later","ord":"a1","title":"Later","desc":"nothing urgent"}`,
        `{"id":"echo","ord":"a2","mirror":"call"}`,
      ].join("\n"),
      "notes.olai": `{"id":"scrap","ord":"a0","title":"a scrap"}`,
    }, [], { "torn.olai": "{ not a record" })

  const shelf = () => readingOf(SHELF())

  const rootIds = (answer: SubtreeAnswer): ReadonlyArray<string> =>
    outlineOf(answer).roots.map((root) => root.id)

  test("one call answers every top-level node, nested", () => {
    const answer = walked(shelf(), { file: "plan.olai" })
    expect(answer).toMatchObject({ file: "plan.olai" })
    expect(rootIds(answer)).toEqual(["today", "later"])
    const answered = outlineOf(answer)
    expect(answered.roots[0]?.children.map((child) => child.id)).toEqual(["call"])
    expect(answered.roots[0]?.children[0]?.children.map((child) => child.id))
      .toEqual(["hinges"])
    expect(answered.roots[1]).toMatchObject({ desc: "nothing urgent" })
  })

  test("each root says for itself where the walk stopped", () => {
    const answer = outlineOf(walked(shelf(), { file: "plan.olai", depth: 1 }))
    expect(answer.roots[0]?.children[0]).toMatchObject({ id: "call", truncated: true })
    expect(answer.roots[1]).not.toHaveProperty("truncated")
  })

  test("the notes ride by default, and `withDesc: false` takes them off", () => {
    const withNotes = outlineOf(walked(shelf(), { file: "plan.olai" }))
    expect(withNotes.roots[1]).toMatchObject({ desc: "nothing urgent" })
    expect(outlineOf(walked(shelf(), { file: "plan.olai", withDesc: true })).roots[1])
      .toMatchObject({ desc: "nothing urgent" })

    const lean = outlineOf(walked(shelf(), { file: "plan.olai", withDesc: false }))
    expect(lean.roots[1]).not.toHaveProperty("desc")
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

  test("the roots are the tree's order, where the listing is the file's", () => {
    const set = setOf({
      "out.olai": [
        `{"id":"second","ord":"a1","title":"Second"}`,
        `{"id":"first","ord":"a0","title":"First"}`,
      ].join("\n"),
    })
    expect(rootIds(walked(readingOf(set), { file: "out.olai" })))
      .toEqual(["first", "second"])
    expect(outlines(set, derivedOf(set).derived)[0]).toEqual({
      file: "out.olai",
      nodes: 2,
      roots: ["Second", "First"],
    })
  })

  test("a placement at the top level is not a root", () => {
    const answer = outlineOf(walked(shelf(), { file: "plan.olai" }))
    expect(answer.roots.map((root) => root.id)).not.toContain("echo")
    expect(answer.placed?.map((entry) => [entry.id, entry.shows.id, entry.shows.title]))
      .toEqual([["echo", "call", "call the joiner"]])
  })

  test("a file whose top level is all placements is not silence", () => {
    const set = setOf({
      "now.olai": `{"id":"now-call","ord":"a0","mirror":"call"}`,
      "work.olai": `{"id":"call","ord":"a0","title":"call the joiner"}`,
    })
    const answer = outlineOf(walked(readingOf(set), { file: "now.olai" }))
    expect(answer.roots).toEqual([])
    expect(answer.placed?.map((entry) => [entry.id, entry.shows.id, entry.shows.title]))
      .toEqual([["now-call", "call", "call the joiner"]])
  })

  test("the file arm's `shows` obeys the dial too", () => {
    const answer = outlineOf(
      walked(shelf(), { file: "plan.olai", fields: ["title"] }),
    )
    expect(answer.placed?.[0]?.shows).toEqual({ id: "call", title: "call the joiner" })
    expect(answer.placed?.[0]?.shows).not.toHaveProperty("path")
  })

  test("a path that is not an outline is refused with the closest one that is", () => {
    const refusal = refusedWalk(shelf(), { file: "plans.olai" })
    expect(refusal._tag).toBe("NotFoundFailure")
    expect(refusal.message).toContain("did you mean `plan.olai`")
  })

  test("…and with the outlines themselves when nothing is close", () => {
    const refusal = refusedWalk(shelf(), { file: "nothing/like/it/at/all.olai" })
    expect(refusal.message).toContain("plan.olai")
    expect(refusal.message).toContain("notes.olai")
  })

  test("a file that did not parse is refused with the validator's own rows", () => {
    const refusal = refusedWalk(shelf(), { file: "torn.olai" })
    expect(refusal._tag).toBe("ValidationFailure")
    expect(
      (refusal as { readonly verdict: { readonly findings: ReadonlyArray<unknown> } })
        .verdict.findings,
    ).not.toBeEmpty()
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
    expect(walked(shelf(), { id: "nope" })).toEqual({ missing: "nope" })
    expect(walked(shelf(), { id: "echo" })).toEqual({ missing: "echo" })
  })
})

describe("the tags a node carries", () => {
  const TAGGED = (): OutlineSet =>
    setOf({
      "work.olai": [
        `{"id":"call","ord":"a0","title":"call @alice about #alice/onboarding"}`,
        `{"id":"plain","ord":"a1","title":"nothing to see here"}`,
      ].join("\n"),
    })

  test("a node read reports its tags as they are written", () => {
    expect(read(derivedOf(TAGGED()), "call")?.tags).toEqual([
      "@alice",
      "#alice/onboarding",
    ])
  })

  test("a node with none reports an empty list rather than nothing", () => {
    expect(read(derivedOf(TAGGED()), "plain")?.tags).toEqual([])
  })

})

describe("the directory", () => {
  const DIRECTORY = (): OutlineSet =>
    setOf({
      "house.olai": [
        `{"id":"garden","ord":"a1","title":"Garden"}`,
        `{"id":"house","ord":"a0","title":"House"}`,
        `{"id":"paint","parent":"house","ord":"a0","title":"paint the hall","todo":true}`,
        `{"id":"shown","ord":"a2","mirror":"paint"}`,
      ].join("\n"),
      "empty.olai": "",
      "shed.olai": `{"id":"shed","ord":"a0","title":"Shed"}`,
    }, [], { "torn.olai": `{"id":` })

  test("every file gets its row, in order, counted and titled by its own nodes", () => {
    const set = DIRECTORY()
    expect(outlines(set, derivedOf(set).derived)).toEqual([
      { file: "empty.olai", nodes: 0, roots: [] },
      { file: "house.olai", nodes: 3, roots: ["Garden", "House"] },
      { file: "shed.olai", nodes: 1, roots: ["Shed"] },
      { file: "torn.olai", unreadable: [expect.any(String)] },
    ])
  })
})

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
    const emoji = documents(set).find((row) => row.file === "emoji.md")
    if (emoji === undefined || "unreadable" in emoji) {
      throw new Error("generated corpus is missing emoji.md")
    }
    expect(emoji.bytes).not.toBe("hello 👋🔥\n".length)
    expect(emoji.bytes).toBe(bytesOf("hello 👋🔥\n"))
  })

  test("after a write replaces the body", () => {
    const was = "hello\n"
    const next = "hello 👋🔥\n"
    const set = setOf({}, [["note.md", was]])
    agree(set)
    const made = planned(set, { op: "doc", file: "note.md", text: next })
    const folded = succeeded(
      folding(scoping(readingOf(set), steady(), NO_KINDS, "outline-olai"))(made),
      "`markdown_write` to apply",
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

const suiteCorpus = (): OutlineSet => {
  const root = join(import.meta.dir, "../../tests/fixtures")
  const files: Array<readonly [string, string]> = []
  const walk = (dir: string, rel = ""): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const next = rel === "" ? entry.name : `${rel}/${entry.name}`
      if (entry.isDirectory()) walk(join(dir, entry.name), next)
      else if (fileKind(TEST_CLAIMS, next) === "markdown") {
        files.push([next, readFileSync(join(dir, entry.name), "utf8")])
      }
    }
  }
  walk(root)
  return setOf({}, files)
}

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

  const AT_HOUSE: PageRequest = {
    kind: "at",
    address: { kind: "document", path: DocumentPath.make("house.olai") },
  }

  const asked = (page: PageRequest, text: string): NarrowingAnswer =>
    narrowing(readingOf(PILE()), { page, text }, TODAY, NO_KINDS)

  const ids = (text: string, page: PageRequest = AT_HOUSE): ReadonlyArray<string> =>
    asked(page, text).matches.map((one) => one.id)

  test("every match comes back, past the cap a search would have applied", () => {
    expect(ids("door")).toEqual(["order", "hinges", "tiles"])
  })

  test("A NODE THIS PAGE DOES NOT DRAW IS NOT IN THE ANSWER", () => {
    expect(ids("door")).not.toContain("shed")
    expect(ids("door", {
      kind: "at",
      address: { kind: "document", path: DocumentPath.make("shed.olai") },
    })).toEqual(["shed"])
  })

  test("why a node is here is the field that carried the words, or nothing", () => {
    expect(asked(AT_HOUSE, "walnut").matches)
      .toEqual([{ id: NodeId.make("order"), matched: "desc" }])
    expect(asked(AT_HOUSE, "is:done").matches)
      .toEqual([{ id: NodeId.make("hinges") }])
  })

  test("the words come back with the answer, so a page knows what it answers", () => {
    expect(asked(AT_HOUSE, "walnut").text).toBe("walnut")
  })

  test("what was put away is out, unless the PAGE is already showing it", () => {
    expect(ids("is:trashed door")).toEqual([])
    expect(ids("door", { kind: "trash" })).toEqual(["old"])
  })

  test("a query nobody could read selects nothing, and says nothing about it", () => {
    expect(asked(AT_HOUSE, "is:open")).toEqual({ text: "is:open", matches: [] })
    expect(asked(AT_HOUSE, "  ")).toEqual({ text: "  ", matches: [] })
  })
})

const HOUSE = (): OutlineSet =>
  setOf({
    "house.olai": [
      `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
      `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets"}`,
      `{"id":"echo","ord":"a1","mirror":"order"}`,
      `{"id":"nowhere","ord":"a2","mirror":"gone"}`,
    ].join("\n"),
    "garden.olai": HERBS,
    "_olai/Trash.olai": [
      `{"id":"old","ord":"a0","title":"the old counters"}`,
    ].join("\n"),
  })

const HERBS = `{"id":"herbs","ord":"a0","title":"the herb bed"}`

describe("which of these ids the set declares", () => {
  const asked = (...ids: ReadonlyArray<string>) => named(derivedOf(HOUSE()).derived, { ids }).named

  test("an id the set declares comes back with the node it names", () => {
    expect(asked("order")).toEqual([{ asked: "order", id: "order", title: "order the cabinets" }])
  })

  test("a PLACEMENT names the node it shows, not itself", () => {
    expect(asked("echo")).toEqual([{ asked: "echo", id: "order", title: "order the cabinets" }])
  })

  test("what the set does not declare is not in the answer at all", () => {
    expect(asked("true", "house.olai", "bun test", "nowhere")).toEqual([])
  })

  test("one question, one answer per id — the rest of the batch is unaffected", () => {
    expect(asked("true", "order", "npm test", "echo")).toEqual([
      { asked: "order", id: "order", title: "order the cabinets" },
      { asked: "echo", id: "order", title: "order the cabinets" },
    ])

  })

  test("an id repeated is asked once", () => {
    expect(asked("order", "order", "order")).toEqual([{ asked: "order", id: "order", title: "order the cabinets" }])
  })

  test("what was put away is still declared", () => {
    expect(asked("old")).toEqual([{ asked: "old", id: "old", title: "the old counters" }])
  })

  test("nothing asked is nothing answered", () => {
    expect(named(derivedOf(HOUSE()).derived, { ids: [] })).toEqual({ named: [] })
  })
})

describe("where these ids are, and which of these files the set has", () => {
  const asking = (ids: ReadonlyArray<string>, files: ReadonlyArray<string> = []) =>
    homes(readingOf(HOUSE()), { ids, files })

  test("an id the set declares comes back with the file its record is written in", () => {
    expect(asking(["order"]).homes).toEqual([{ id: "order", file: "house.olai" }])
  })

  test("a node that was PUT AWAY answers with the file it was moved to", () => {
    expect(asking(["old"]).homes).toEqual([{ id: "old", file: "_olai/Trash.olai" }])
  })

  test("a PLACEMENT answers for ITSELF — no chain is followed", () => {
    expect(asking(["echo", "nowhere"]).homes).toEqual([
      { id: "echo", file: "house.olai" },
      { id: "nowhere", file: "house.olai" },
    ])
    expect(named(derivedOf(HOUSE()).derived, { ids: ["nowhere"] }).named).toEqual([])
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
    expect(asking([], ["house.olai", "garden.olai", "gone.olai"]).loaded).toEqual([
      "house.olai",
      "garden.olai",
    ])
  })

  test("an outline somebody EMPTIED was still read", () => {
    const emptied = readingOf(setOf({ "house.olai": "", "garden.olai": HERBS }))
    expect(homes(emptied, { ids: [], files: ["house.olai"] }).loaded).toEqual([
      "house.olai",
    ])
  })

  test("a file that would not parse is silent, and so is one nobody serves", () => {
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

  test("the answer is the shortlist, ranked, in the envelope the wire carries", () => {
    expect(tags(derivedOf(HOUSE()).derived, { sigil: "#", query: "ho", limit: 8 }))
      .toEqual({
        tags: [
          { name: "home", count: 2 },
          { name: "hob", count: 1 },
          { name: "shopping", count: 1 },
        ],
      })
  })

  test("the sigil asked with is the only namespace answered", () => {
    expect(tags(derivedOf(HOUSE()).derived, { sigil: "@", query: "", limit: 8 }))
      .toEqual({ tags: [{ name: "alice", count: 1 }] })
  })
})
