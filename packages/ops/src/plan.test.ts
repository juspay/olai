/**
 * The planner, op by op.
 *
 * Every test here is a value in and a value out — no disk, no store, no
 * protocol — because that is what {@link ./plan.ts} being pure buys. What the
 * assertions look at is the RECORDS a write would produce, not the bytes: the
 * bytes are `@olai/format`'s to get right, and there is a test over there that
 * says a multi-record write can never glue a line.
 */

import {
  derive,
  type Node,
  type OpFailure,
  type OutlineSet,
  type RegularNode,
  serializeOutline,
} from "@olai/format"
import { describe, expect, test } from "bun:test"
import { Result, Schema } from "effect"

import { setOf, STAMP, steady } from "./fixtures.testlib.ts"
import { plan, type Plan } from "./plan.ts"
import { AddRequest, type Request } from "./request.ts"

const KITCHEN = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
  `{"id":"loose","ord":"a1","title":"a node with no children"}`,
].join("\n")

const house = (): OutlineSet => setOf({ "house.jsonl": KITCHEN })

const planning = (set: OutlineSet, request: Request): Result.Result<Plan, OpFailure> =>
  plan(set, steady(), request)

/** The plan, or a failure quoted well enough to fix the test without a
 *  debugger. */
const planned = (set: OutlineSet, request: Request): Plan => {
  const outcome = planning(set, request)
  if (Result.isFailure(outcome)) {
    throw new Error(
      `expected \`${request.op}\` to plan, and it refused: ` +
        `${outcome.failure._tag} — ${outcome.failure.message}`,
    )
  }
  return outcome.success
}

const refused = (set: OutlineSet, request: Request): OpFailure => {
  const outcome = planning(set, request)
  if (Result.isSuccess(outcome)) {
    throw new Error(`expected \`${request.op}\` to be refused, and it planned`)
  }
  return outcome.failure
}

/** One file of a plan, by name. */
const fileOf = (result: Plan, file: string): ReadonlyArray<Node> => {
  const found = result.files.find((entry) => entry.file === file)
  if (found === undefined) {
    throw new Error(
      `the plan does not write \`${file}\`; it writes ${
        result.files.map((entry) => entry.file).join(", ") || "nothing"
      }`,
    )
  }
  return found.nodes
}

const record = (nodes: ReadonlyArray<Node>, id: string): RegularNode => {
  const found = nodes.find((node) => node.id === id)
  if (found === undefined) throw new Error(`no record \`${id}\` in the plan`)
  return found as RegularNode
}

/** The children of a node, in the order the format sorts them — which is what
 *  a placement assertion is actually about. */
const childOrder = (nodes: ReadonlyArray<Node>, parent: string): ReadonlyArray<string> =>
  nodes
    .filter((node) => node.parent === parent)
    .slice()
    .sort((a, b) => (a.ord < b.ord ? -1 : a.ord > b.ord ? 1 : 0))
    .map((node) => node.id)

// ── add ────────────────────────────────────────────────────────────────

describe("add", () => {
  test("captures under a parent, last among its siblings", () => {
    const result = planned(house(), {
      op: "add",
      parent: "kitchen",
      title: "paint the walls #home",
    })
    const nodes = fileOf(result, "house.jsonl")
    expect(childOrder(nodes, "kitchen")).toEqual(["demo", "order", "install", "n1"])
    expect(record(nodes, "n1")).toMatchObject({
      id: "n1",
      parent: "kitchen",
      title: "paint the walls #home",
    })
    expect(result.summary).toBe("capture: paint the walls #home")
  })

  test("`before` and `after` put it where they say", () => {
    const first = fileOf(
      planned(house(), { op: "add", parent: "kitchen", title: "x", before: "order" }),
      "house.jsonl",
    )
    expect(childOrder(first, "kitchen")).toEqual(["demo", "n1", "order", "install"])

    const second = fileOf(
      planned(house(), { op: "add", parent: "kitchen", title: "x", after: "demo" }),
      "house.jsonl",
    )
    expect(childOrder(second, "kitchen")).toEqual(["demo", "n1", "order", "install"])
  })

  test("only the new node's `ord` moves — an insert is a one-line diff", () => {
    const before = house()
    const nodes = fileOf(
      planned(before, { op: "add", parent: "kitchen", title: "x", before: "install" }),
      "house.jsonl",
    )
    for (const id of ["demo", "order", "install"]) {
      expect(record(nodes, id).ord).toBe(
        (derive(before.nodes).byId.get(id)?.node as RegularNode).ord,
      )
    }
  })

  test("a file with no parent puts the node at top level", () => {
    const nodes = fileOf(
      planned(house(), { op: "add", file: "house.jsonl", title: "a new root" }),
      "house.jsonl",
    )
    expect(record(nodes, "n1").parent).toBeUndefined()
  })

  test("neither a parent nor a file is a usage refusal, not a guess", () => {
    expect(refused(house(), { op: "add", title: "x" })._tag).toBe("UsageFailure")
  })

  test("a file the directory does not serve is not-found, and says what it does serve", () => {
    const failure = refused(house(), { op: "add", file: "nope.jsonl", title: "x" })
    expect(failure._tag).toBe("NotFoundFailure")
    expect(failure.message).toContain("house.jsonl")
  })

  test("an id the set already holds is refused rather than duplicated", () => {
    expect(
      refused(house(), { op: "add", parent: "kitchen", title: "x", id: "order" })._tag,
    ).toBe("UsageFailure")
  })

  test("a chosen id is kept verbatim", () => {
    const nodes = fileOf(
      planned(house(), { op: "add", parent: "kitchen", title: "x", id: "paint" }),
      "house.jsonl",
    )
    expect(record(nodes, "paint").title).toBe("x")
  })

  test("an empty title is refused — a node is its title", () => {
    expect(refused(house(), { op: "add", parent: "kitchen", title: "  " })._tag).toBe(
      "UsageFailure",
    )
  })

  test("a mark can arrive with the node, written as the mark ops write it", () => {
    const nodes = fileOf(
      planned(house(), {
        op: "add",
        parent: "kitchen",
        title: "sand the floor",
        mark: "todo",
      }),
      "house.jsonl",
    )
    expect(record(nodes, "n1").todo).toBe(true)
  })
})

// ── capture a subtree ──────────────────────────────────────────────────

/**
 * The item this feature was filed for: an agent capturing an outline used to
 * issue one call per node. What is asserted here is that the tree arrives as
 * ONE plan — every record in one file plan, in reading order — and that a
 * refusal anywhere in it is a refusal of the whole thing, since "nothing
 * landed" is the only answer that makes a capture atomic.
 */
describe("add with children", () => {
  /** A kitchen, a pantry and what is in them: two levels below the node being
   *  added, which is the shape the screenshot in the item had. */
  const CAPTURE = {
    op: "add",
    file: "house.jsonl",
    title: "Bathroom remodel",
    children: [
      {
        title: "fixtures",
        children: [
          { title: "taps", mark: "todo" },
          { title: "shower", desc: "the thermostatic one" },
        ],
      },
      { title: "tiling", date: "2026-09-01" },
    ],
  } as const satisfies Request

  test("one plan holds the whole tree, parent before child, siblings in order", () => {
    const result = planned(house(), CAPTURE)
    const nodes = fileOf(result, "house.jsonl")

    // One file plan: the write gate renames all of it or none of it.
    expect(result.files).toHaveLength(1)

    expect(record(nodes, "n1")).toMatchObject({ title: "Bathroom remodel" })
    expect(record(nodes, "n2")).toMatchObject({ parent: "n1", title: "fixtures" })
    expect(record(nodes, "n3")).toMatchObject({ parent: "n2", title: "taps" })
    expect(record(nodes, "n5")).toMatchObject({ parent: "n1", title: "tiling" })

    expect(childOrder(nodes, "n1")).toEqual(["n2", "n5"])
    expect(childOrder(nodes, "n2")).toEqual(["n3", "n4"])

    // File order is the outline's reading order: parent, then its subtree,
    // then the next sibling — which is what a person opening the file sees.
    expect(nodes.slice(5).map((node) => node.id)).toEqual([
      "n1",
      "n2",
      "n3",
      "n4",
      "n5",
    ])
  })

  test("every node it made comes back, id and title, so the ids are usable", () => {
    const result = planned(house(), CAPTURE)
    expect(result.captured).toEqual([
      { id: "n1", title: "Bathroom remodel" },
      { id: "n2", title: "fixtures" },
      { id: "n3", title: "taps" },
      { id: "n4", title: "shower" },
      { id: "n5", title: "tiling" },
    ])
    // The log says how much arrived; `capture: Bathroom remodel` alone would
    // under-report a commit that added five lines.
    expect(result.summary).toBe("capture: Bathroom remodel (+4)")
  })

  // `captured` is what the write MADE, so it has one shape whatever it made:
  // a plain capture is a list of one, and only the commit subject asks whether
  // anything came with it — `(+0)` would be a line counting nothing.
  test("a capture of one node is a list of one, and no count in the subject", () => {
    const result = planned(house(), { op: "add", parent: "kitchen", title: "x" })
    expect(result.captured).toEqual([{ id: "n1", title: "x" }])
    expect(result.summary).toBe("capture: x")

    // An empty `children` is the same statement, spelled with brackets.
    const empty = planned(house(), {
      op: "add",
      parent: "kitchen",
      title: "x",
      children: [],
    })
    expect(empty.captured).toHaveLength(1)
    expect(empty.summary).toBe("capture: x")
  })

  // The seed of a brand-new outline is a capture too — same fields, same
  // record, same id rule — so it answers the same way.
  test("a seeded create names the node it made, and may mark it", () => {
    const result = planned(house(), {
      op: "create",
      file: "shed.jsonl",
      seed: { title: "clear out the shed", id: "shed", mark: "todo" },
    })
    expect(result.captured).toEqual([{ id: "shed", title: "clear out the shed" }])
    expect(fileOf(result, "shed.jsonl")[0]).toMatchObject({ id: "shed", todo: true })

    // And the id rule is `add`'s, spelled once: a chosen id the set holds is
    // refused with the same words.
    expect(
      refused(house(), {
        op: "create",
        file: "shed.jsonl",
        seed: { title: "x", id: "order" },
      }).message,
    ).toContain("already the id")
  })

  test("a child's fields are the node's fields, marks stamped the same way", () => {
    const nodes = fileOf(
      planned(house(), {
        op: "add",
        parent: "kitchen",
        title: "wiring",
        children: [
          { title: "quote", mark: "done" },
          { title: "book the sparky", mark: "doing" },
          { title: "pay", mark: "todo", date: "2026-09-02", desc: "on completion" },
          { title: "plain" },
        ],
      }),
      "house.jsonl",
    )
    // `done` records the instant; the other two say `true` — the same rule the
    // mark ops read, so a captured mark and a marked capture agree.
    expect(record(nodes, "n2").done).toBe(STAMP)
    expect(record(nodes, "n3").doing).toBe(true)
    expect(record(nodes, "n4")).toMatchObject({
      todo: true,
      date: "2026-09-02",
      desc: "on completion",
    })
    // Unmarked is a bullet, and a bullet carries no mark at all.
    for (const mark of ["done", "doing", "todo"] as const) {
      expect(record(nodes, "n5")[mark]).toBeUndefined()
    }
  })

  test("`before` places the node being added; the children keep their order", () => {
    const nodes = fileOf(
      planned(house(), {
        op: "add",
        parent: "kitchen",
        title: "measure",
        before: "order",
        children: [{ title: "walls" }, { title: "floor" }],
      }),
      "house.jsonl",
    )
    expect(childOrder(nodes, "kitchen")).toEqual(["demo", "n1", "order", "install"])
    expect(childOrder(nodes, "n1")).toEqual(["n2", "n3"])
  })

  test("a chosen id anywhere in the tree that the set holds refuses ALL of it", () => {
    const failure = refused(house(), {
      op: "add",
      file: "house.jsonl",
      title: "Bathroom",
      children: [{ title: "fixtures", children: [{ title: "taps", id: "order" }] }],
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`order` is already the id")
  })

  test("one id used twice in the same call is refused — nothing is written", () => {
    const failure = refused(house(), {
      op: "add",
      file: "house.jsonl",
      title: "Bathroom",
      children: [{ title: "taps", id: "twice" }, { title: "shower", id: "twice" }],
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("named twice")
  })

  // What a cycle attempt looks like when every node is being born at once: a
  // child naming an id one of its own ancestors chose. There is no live node to
  // parent onto, so this is a collision — and it is refused before the
  // validator ever sees a set with two `bath` records in it.
  test("a child naming its own ancestor's id is a collision, not a loop", () => {
    const failure = refused(house(), {
      op: "add",
      file: "house.jsonl",
      title: "Bathroom",
      id: "bath",
      children: [{ title: "fixtures", children: [{ title: "taps", id: "bath" }] }],
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("named twice")
  })

  test("a parent nothing declares refuses the tree, not just the root", () => {
    const failure = refused(house(), {
      op: "add",
      parent: "nowhere",
      title: "Bathroom",
      children: [{ title: "taps" }],
    })
    expect(failure._tag).toBe("NotFoundFailure")
  })

  test("an empty title on a child is refused like an empty title on the node", () => {
    expect(
      refused(house(), {
        op: "add",
        parent: "kitchen",
        title: "wiring",
        children: [{ title: "quote" }, { title: "   " }],
      })._tag,
    ).toBe("UsageFailure")
  })

  // The cap is the JSON Schema's, not the format's ({@link ./request.ts}'s
  // NESTING), and the floor of the unrolled schema exists so that going past it
  // is a REFUSAL rather than a level the decoder quietly drops.
  test("nesting past the depth the schema unrolls is refused, and teaches", () => {
    const deep = {
      op: "add",
      file: "house.jsonl",
      title: "one",
      children: [{
        title: "two",
        children: [{
          title: "three",
          children: [{ title: "four", children: [{ title: "five" }] }],
        }],
      }],
    } as const satisfies Request

    const failure = refused(house(), deep)
    expect(failure._tag).toBe("UsageFailure")
    // Named, so the caller knows where to cut the tree in half.
    expect(failure.message).toContain("`four`")
    expect(failure.message).toContain("second `add_node`")

    // The same tree without its last generation is the deepest one that lands:
    // the node being added, and three levels under it.
    const ok = planned(house(), {
      op: "add",
      file: "house.jsonl",
      title: "one",
      children: [{
        title: "two",
        children: [{ title: "three", children: [{ title: "four" }] }],
      }],
    })
    expect(ok.captured).toHaveLength(4)
  })

  // Why the floor of the unrolled schema exists at all. An Effect struct DROPS
  // a key it does not declare, so a schema that simply stopped after the last
  // level would decode a four-deep capture into a three-deep one and report
  // success — a capture quietly missing its leaves. Decoded here through the
  // REAL schema, the one the MCP surface advertises and decodes against: the
  // level past the floor survives, and the planner refuses it by name.
  test("a level past the floor survives decoding, so it can be refused", () => {
    const decoded = Schema.decodeUnknownSync(AddRequest)({
      op: "add",
      file: "house.jsonl",
      title: "one",
      children: [{
        title: "two",
        children: [{
          title: "three",
          children: [{ title: "four", children: [{ title: "five" }] }],
        }],
      }],
    })
    expect(refused(house(), decoded).message).toContain("`four`")
  })

  test("the file it produces is still one record per line", () => {
    const nodes = fileOf(planned(house(), CAPTURE), "house.jsonl")
    const text = serializeOutline(nodes)
    expect(text.split("\n").filter((line) => line !== "")).toHaveLength(nodes.length)
  })
})

// ── done / doing ───────────────────────────────────────────────────────

describe("done and doing", () => {
  test("marking a leaf stamps the instant and says so in the commit line", () => {
    const result = planned(house(), { op: "done", id: "order" })
    expect(record(fileOf(result, "house.jsonl"), "order").done).toBe(STAMP)
    expect(result.summary).toBe("done: order the cabinets")
  })

  // A plan re-emits every record of the file it touches, and the format is
  // validated AS TEXT because a writer must reproduce what it read
  // (docs/format.md). So a neighbour's day-only `done` — and every `true` still
  // out there — comes back exactly as written: the op stamps the node it was
  // asked about and nothing else.
  test("the dates on the other records come back as they were written", () => {
    const nodes = fileOf(planned(house(), { op: "done", id: "order" }), "house.jsonl")
    expect(record(nodes, "demo").done).toBe("2026-08-01")
  })

  // Resolved 2026-08-11 by the human, and it is a decision about the JOURNAL
  // rather than about symmetry between three ops: a date on a mark puts the
  // node on that day (docs/format.md's Days), so a stamped `todo` would file
  // every capture onto the day it was written down and `/today` would stop
  // being about what happened. Finishing is the event a day page is about;
  // starting and filing are not.
  test("only `done` carries an instant — the other two say `true`", () => {
    const marked = (op: "done" | "doing" | "todo"): RegularNode =>
      record(fileOf(planned(house(), { op, id: "order" }), "house.jsonl"), "order")
    expect(marked("done").done).toBe(STAMP)
    expect(marked("doing").doing).toBe(true)
    expect(marked("todo").todo).toBe(true)
  })

  test("undo takes the mark off", () => {
    const result = planned(house(), { op: "done", id: "demo", undo: true })
    expect(record(fileOf(result, "house.jsonl"), "demo").done).toBeUndefined()
    expect(result.summary).toBe("undone: demolition")
  })

  test("`doing` clears a stale `done`, because both at once is not a record", () => {
    const set = setOf({
      "a.jsonl": `{"id":"x","ord":"a0","title":"x","done":"2026-08-01"}`,
    })
    // Straight to `doing` is refused; undo first, as the message says.
    expect(refused(set, { op: "doing", id: "x" }).message).toContain("Undo that first")

    const undone = setOf({ "a.jsonl": `{"id":"x","ord":"a0","title":"x"}` })
    const node = record(fileOf(planned(undone, { op: "doing", id: "x" }), "a.jsonl"), "x")
    expect(node.doing).toBe(true)
    expect(node.done).toBeUndefined()
  })

  test("already marked is refused rather than rewritten", () => {
    expect(refused(house(), { op: "done", id: "demo" }).message).toContain("already done")
  })

  // The third mark is the same op with a third word, and that is the claim:
  // it lands, it clears whatever was there, it undoes, and it refuses to walk
  // finished work backwards without being told to.
  test("`todo` is a mark like the other two", () => {
    const result = planned(house(), { op: "todo", id: "order" })
    expect(record(fileOf(result, "house.jsonl"), "order").todo).toBe(true)
    expect(result.summary).toBe("todo: order the cabinets")

    // Started, then put back on the pile: `doing` goes, `todo` arrives.
    const under = setOf({
      "a.jsonl": `{"id":"x","ord":"a0","title":"x","doing":"2026-08-01"}`,
    })
    const node = record(fileOf(planned(under, { op: "todo", id: "x" }), "a.jsonl"), "x")
    expect(node.todo).toBe(true)
    expect(node.doing).toBeUndefined()

    // A done node is not quietly un-finished, whichever mark is asked for.
    const finished = setOf({
      "a.jsonl": `{"id":"x","ord":"a0","title":"x","done":"2026-08-01"}`,
    })
    expect(refused(finished, { op: "todo", id: "x" }).message).toContain("Undo that first")

    // And taking it off says so in the commit line, like its two siblings.
    const marked = setOf({ "a.jsonl": `{"id":"x","ord":"a0","title":"x","todo":true}` })
    const cleared = planned(marked, { op: "todo", id: "x", undo: true })
    expect(record(fileOf(cleared, "a.jsonl"), "x").todo).toBeUndefined()
    expect(cleared.summary).toBe("not-todo: x")
  })

  test("undoing a mark that is not there is refused", () => {
    expect(refused(house(), { op: "done", id: "order", undo: true }).message).toContain(
      "not marked done",
    )
  })

  /**
   * The 2026-08-11 change, in the layer that used to refuse it: a mark is a
   * stored fact on ANY node. The three shapes the old `derived` refusal had a
   * sentence for — over unfinished tasks, over finished ones, over children
   * that are all notes — are three ordinary writes.
   */
  test("a node with children is marked like any other", () => {
    const set = setOf({
      "house.jsonl": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":true}`,
        `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","doing":true}`,
        `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
      ].join("\n"),
    })
    const result = planned(set, { op: "done", id: "kitchen" })
    expect(record(fileOf(result, "house.jsonl"), "kitchen").done).toBe(STAMP)
    expect(result.summary).toBe("done: Kitchen remodel")
  })

  // The case the model could not express at all, and the one that filed the
  // item: the node IS the work, its children are findings about it. Nothing
  // under it is a task, and it is `todo`.
  test("a node whose children are all notes can be marked todo", () => {
    const set = setOf({
      "a.jsonl": [
        `{"id":"p","ord":"a0","title":"orchestrator in chat"}`,
        `{"id":"c1","parent":"p","ord":"a0","title":"nothing wakes a chat agent"}`,
        `{"id":"c2","parent":"p","ord":"a1","title":"no shell, so no gh"}`,
      ].join("\n"),
    })
    const result = planned(set, { op: "todo", id: "p" })
    expect(record(fileOf(result, "a.jsonl"), "p").todo).toBe(true)
    // Nothing under it is a task, so there is nothing to remark on either.
    expect(result.nudge).toBeUndefined()
  })

  // Policy, not an invariant. The write lands — "shipped, dropping the rest"
  // is a real thing to mean — and the answer says what it noticed, naming the
  // tasks that are still open. The BULLET among them is not one of them.
  test("done over unfinished tasks lands, and says so", () => {
    const set = setOf({
      "a.jsonl": [
        `{"id":"p","ord":"a0","title":"the trip"}`,
        `{"id":"c1","parent":"p","ord":"a0","title":"book the ferry","done":true}`,
        `{"id":"c2","parent":"p","ord":"a1","title":"pack","todo":true}`,
        `{"id":"c3","parent":"p","ord":"a2","title":"ferry times"}`,
      ].join("\n"),
    })
    const result = planned(set, { op: "done", id: "p" })
    expect(record(fileOf(result, "a.jsonl"), "p").done).toBe(STAMP)
    expect(result.nudge).toContain("1 unfinished task")
    expect(result.nudge).toContain("`pack`")
    expect(result.nudge).not.toContain("ferry times")
  })

  // The other nudge, and the one that replaces the old escape hatch: finishing
  // the last open task under a parent is the moment to consider ticking the
  // parent, which is now something a person can actually do.
  test("finishing the last task under a parent suggests marking the parent", () => {
    const set = setOf({
      "a.jsonl": [
        `{"id":"p","ord":"a0","title":"the trip"}`,
        `{"id":"c1","parent":"p","ord":"a0","title":"book the ferry","done":true}`,
        `{"id":"c2","parent":"p","ord":"a1","title":"pack","doing":true}`,
        `{"id":"c3","parent":"p","ord":"a2","title":"ferry times"}`,
      ].join("\n"),
    })
    expect(planned(set, { op: "done", id: "c2" }).nudge)
      .toContain("every task under `the trip` is done now")

    // Not while another task is still open, and not when the parent is already
    // done — neither is news.
    const half = setOf({
      "a.jsonl": [
        `{"id":"p","ord":"a0","title":"the trip"}`,
        `{"id":"c1","parent":"p","ord":"a0","title":"book the ferry","todo":true}`,
        `{"id":"c2","parent":"p","ord":"a1","title":"pack","doing":true}`,
      ].join("\n"),
    })
    expect(planned(half, { op: "done", id: "c2" }).nudge).toBeUndefined()

    const already = setOf({
      "a.jsonl": [
        `{"id":"p","ord":"a0","title":"the trip","done":"2026-08-01"}`,
        `{"id":"c1","parent":"p","ord":"a0","title":"pack","doing":true}`,
      ].join("\n"),
    })
    expect(planned(already, { op: "done", id: "c1" }).nudge).toBeUndefined()
  })

  // A nudge is about a mark going ON, and only `done`: nothing is finished by
  // starting a task, and taking a mark off is never news about the parent.
  test("nothing is nudged for doing, todo, or an undo", () => {
    const set = setOf({
      "a.jsonl": [
        `{"id":"p","ord":"a0","title":"the trip"}`,
        `{"id":"c1","parent":"p","ord":"a0","title":"pack","done":true}`,
      ].join("\n"),
    })
    expect(planned(set, { op: "done", id: "c1", undo: true }).nudge).toBeUndefined()
    expect(planned(set, { op: "todo", id: "p" }).nudge).toBeUndefined()
    expect(planned(set, { op: "doing", id: "p" }).nudge).toBeUndefined()
  })

  test("a mirror is not a node to mark, and the refusal names the one that is", () => {
    const set = setOf({
      "a.jsonl": `{"id":"x","ord":"a0","title":"x"}`,
      "b.jsonl": `{"id":"m","ord":"a0","mirror":"x"}`,
    })
    expect(refused(set, { op: "done", id: "m" }).message).toContain("`x`")
  })
})

// ── title / desc / date ────────────────────────────────────────────────

describe("title, note and date", () => {
  test("a retitle keeps everything else", () => {
    const result = planned(house(), { op: "title", id: "order", title: "order cabinets" })
    expect(record(fileOf(result, "house.jsonl"), "order")).toEqual({
      id: "order",
      parent: "kitchen",
      ord: "a1",
      title: "order cabinets",
    })
    expect(result.summary).toBe("rename: order cabinets")
  })

  test("a note is set and removed; `null` means there is no key at all", () => {
    const written = planned(house(), { op: "desc", id: "order", desc: "measure first" })
    expect(record(fileOf(written, "house.jsonl"), "order").desc).toBe("measure first")

    const cleared = planned(setOf({
      "a.jsonl": `{"id":"x","ord":"a0","title":"x","desc":"gone"}`,
    }), { op: "desc", id: "x", desc: null })
    expect("desc" in record(fileOf(cleared, "a.jsonl"), "x")).toBe(false)
  })

  test("a date reads as racket's `move:` line, cleared included", () => {
    expect(planned(house(), { op: "date", id: "order", date: "2026-08-10" }).summary).toBe(
      "move: order the cabinets -> 2026-08-10",
    )
    expect(planned(house(), { op: "date", id: "order", date: null }).summary).toBe(
      "move: order the cabinets -> (cleared)",
    )
  })
})

// ── move ───────────────────────────────────────────────────────────────

describe("move", () => {
  test("reorders within a parent", () => {
    const nodes = fileOf(
      planned(house(), { op: "move", id: "install", before: "order" }),
      "house.jsonl",
    )
    expect(childOrder(nodes, "kitchen")).toEqual(["demo", "install", "order"])
  })

  test("reparents, appending under the new parent", () => {
    const nodes = fileOf(
      planned(house(), { op: "move", id: "order", parent: "loose" }),
      "house.jsonl",
    )
    expect(childOrder(nodes, "kitchen")).toEqual(["demo", "install"])
    expect(childOrder(nodes, "loose")).toEqual(["order"])
  })

  test("`parent: null` lifts a node to top level", () => {
    const nodes = fileOf(
      planned(house(), { op: "move", id: "order", parent: null }),
      "house.jsonl",
    )
    expect(record(nodes, "order").parent).toBeUndefined()
  })

  test("a parent in another file is refused, with the reason spelled out", () => {
    const set = setOf({
      "a.jsonl": `{"id":"x","ord":"a0","title":"x"}`,
      "b.jsonl": `{"id":"y","ord":"a0","title":"y"}`,
    })
    expect(refused(set, { op: "move", id: "x", parent: "y" }).message).toContain(
      "independent tree",
    )
  })

  test("moving a node under its own descendant is refused before the validator sees it", () => {
    expect(refused(house(), { op: "move", id: "kitchen", parent: "order" }).message)
      .toContain("loop")
  })

  test("both `before` and `after` is a usage refusal", () => {
    expect(
      refused(house(), { op: "move", id: "order", before: "demo", after: "install" })._tag,
    ).toBe("UsageFailure")
  })

  test("a sibling that is not one is not-found", () => {
    expect(refused(house(), { op: "move", id: "order", before: "loose" })._tag).toBe(
      "NotFoundFailure",
    )
  })
})

// ── create ─────────────────────────────────────────────────────────────

describe("create", () => {
  test("an empty outline is a file with no records, named in the commit line", () => {
    const result = planned(house(), { op: "create", file: "shed.jsonl" })
    expect(fileOf(result, "shed.jsonl")).toEqual([])
    expect(result).toMatchObject({
      file: "shed.jsonl",
      id: "shed.jsonl",
      title: "shed.jsonl",
      summary: "create: shed.jsonl",
    })
  })

  test("a seed is one top-level node, minted the way a capture is", () => {
    const result = planned(house(), {
      op: "create",
      file: "notes/ideas.jsonl",
      seed: { title: "an idea #later", desc: "write it down", date: "2026-08-10" },
    })
    expect(fileOf(result, "notes/ideas.jsonl")).toEqual([
      {
        id: "n1",
        ord: "a0",
        title: "an idea #later",
        desc: "write it down",
        date: "2026-08-10",
      },
    ])
    expect(result.summary).toBe("capture: an idea #later")
    expect(result.id).toBe("n1")
  })

  test("a chosen seed id is kept, and a taken one is refused", () => {
    const nodes = fileOf(
      planned(house(), {
        op: "create",
        file: "new.jsonl",
        seed: { title: "x", id: "paint" },
      }),
      "new.jsonl",
    )
    expect(record(nodes, "paint").title).toBe("x")

    expect(
      refused(house(), {
        op: "create",
        file: "new.jsonl",
        seed: { title: "x", id: "order" },
      })._tag,
    ).toBe("UsageFailure")
  })

  test("an absolute path is refused", () => {
    const failure = refused(house(), { op: "create", file: "/tmp/out.jsonl" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("relative")
  })

  test("a traversal is refused, never resolved under the root", () => {
    for (const file of [
      "../secret.jsonl",
      "notes/../../secret.jsonl",
      "notes/./out.jsonl",
      "notes//out.jsonl",
      "a\\b.jsonl",
    ]) {
      expect(refused(house(), { op: "create", file })._tag).toBe("UsageFailure")
    }
  })

  test("a non-`.jsonl` name is refused", () => {
    expect(refused(house(), { op: "create", file: "notes.md" })._tag).toBe("UsageFailure")
    expect(refused(house(), { op: "create", file: "notes" })._tag).toBe("UsageFailure")
  })

  test("an outline the directory already holds is refused rather than overwritten", () => {
    const failure = refused(house(), { op: "create", file: "house.jsonl" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("already")
    expect(failure.message).toContain("add_node")
  })

  test("an empty seed title is refused — a node is its title", () => {
    expect(
      refused(house(), { op: "create", file: "new.jsonl", seed: { title: "  " } })._tag,
    ).toBe("UsageFailure")
  })
})

// ── archive ────────────────────────────────────────────────────────────

describe("archive", () => {
  const archived = (set: OutlineSet, id: string) => {
    const result = planned(set, { op: "archive", id })
    return {
      result,
      source: fileOf(result, "house.jsonl"),
      archive: fileOf(result, "Archive.jsonl"),
    }
  }

  test("the subtree leaves the outline and lands under a rebuilt title chain", () => {
    const { archive, result, source } = archived(house(), "order")

    expect(source.map((node) => node.id)).toEqual(["kitchen", "demo", "install", "loose"])
    // One scaffold node per ancestor, carrying the TITLE and nothing else.
    expect(archive).toEqual([
      { id: "n1", ord: "a0", title: "Kitchen remodel" },
      { id: "order", parent: "n1", ord: "a0", title: "order the cabinets" },
    ])
    expect(result.file).toBe("Archive.jsonl")
    expect(result.summary).toBe("archive: order the cabinets")
  })

  test("descendants come along, shaped as they were", () => {
    const set = setOf({
      "house.jsonl": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order"}`,
        `{"id":"quote","parent":"order","ord":"a0","title":"get a quote","done":"2026-07-01"}`,
        `{"id":"sign","parent":"quote","ord":"a0","title":"sign it"}`,
      ].join("\n"),
    })
    const { archive, source } = archived(set, "order")
    expect(source.map((node) => node.id)).toEqual(["kitchen"])
    expect(archive.map((node) => node.id)).toEqual(["n1", "order", "quote", "sign"])
    // Nothing is stamped: archiving is not finishing.
    expect(record(archive, "quote").done).toBe("2026-07-01")
    expect(record(archive, "sign").done).toBeUndefined()
    expect(record(archive, "quote").parent).toBe("order")
  })

  test("ids move with the nodes, so a mirror pointing at one keeps resolving", () => {
    const set = setOf({
      "house.jsonl": KITCHEN,
      "week.jsonl": `{"id":"m","ord":"a0","mirror":"order"}`,
    })
    const { archive } = archived(set, "order")
    expect(record(archive, "order").id).toBe("order")
    // The scaffold gets a MINTED id rather than a copy of `kitchen`'s: an id is
    // unique across the set, and a copy would collide with the live node.
    expect(archive.map((node) => node.id)).not.toContain("kitchen")
  })

  test("a chain the archive already has is merged into, not duplicated", () => {
    const set = setOf({
      "house.jsonl": KITCHEN,
      "Archive.jsonl": [
        `{"id":"old","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"gone","parent":"old","ord":"a0","title":"something earlier"}`,
      ].join("\n"),
    })
    const archive = fileOf(planned(set, { op: "archive", id: "order" }), "Archive.jsonl")
    expect(archive.filter((node) => node.parent === undefined).map((node) => node.id))
      .toEqual(["old"])
    expect(childOrder(archive, "old")).toEqual(["gone", "order"])
  })

  test("the archive sits beside the outline the node left, in its own directory", () => {
    const set = setOf({ "notes/house.jsonl": KITCHEN })
    const result = planned(set, { op: "archive", id: "order" })
    expect(result.files.map((entry) => entry.file).sort()).toEqual([
      "notes/Archive.jsonl",
      "notes/house.jsonl",
    ])
  })

  test("archiving something already archived is refused", () => {
    const set = setOf({ "Archive.jsonl": `{"id":"x","ord":"a0","title":"x"}` })
    expect(refused(set, { op: "archive", id: "x" }).message).toContain("already in")
  })
})

// ── see ────────────────────────────────────────────────────────────────

describe("see", () => {
  test("adds targets, preserving any that were already there", () => {
    const set = setOf({
      "house.jsonl": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","see":["demo"]}`,
        `{"id":"demo","parent":"kitchen","ord":"a1","title":"demolition"}`,
        `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
      ].join("\n"),
    })
    const result = planned(set, { op: "see", id: "order", add: ["install"] })
    expect(record(fileOf(result, "house.jsonl"), "order").see).toEqual([
      "demo",
      "install",
    ])
    expect(result.summary).toBe("see: order the cabinets")
  })

  test("removes targets, and clears the field when none remain", () => {
    const set = setOf({
      "a.jsonl": [
        `{"id":"a","ord":"a0","title":"a","see":["b","c"]}`,
        `{"id":"b","ord":"a1","title":"b"}`,
        `{"id":"c","ord":"a2","title":"c"}`,
      ].join("\n"),
    })
    const partial = planned(set, { op: "see", id: "a", remove: ["b"] })
    expect(record(fileOf(partial, "a.jsonl"), "a").see).toEqual(["c"])

    const cleared = planned(set, { op: "see", id: "a", remove: ["b", "c"] })
    expect("see" in record(fileOf(cleared, "a.jsonl"), "a")).toBe(false)
  })

  test("add and remove in one call: removes first, then appends adds", () => {
    const set = setOf({
      "a.jsonl": [
        `{"id":"a","ord":"a0","title":"a","see":["b","c"]}`,
        `{"id":"b","ord":"a1","title":"b"}`,
        `{"id":"c","ord":"a2","title":"c"}`,
        `{"id":"d","ord":"a3","title":"d"}`,
      ].join("\n"),
    })
    const nodes = fileOf(
      planned(set, { op: "see", id: "a", add: ["d"], remove: ["b"] }),
      "a.jsonl",
    )
    // Survivors keep their order; new ids append.
    expect(record(nodes, "a").see).toEqual(["c", "d"])
  })

  /**
   * The refusal that teaches: an unknown target is refused with the ids the
   * set DOES hold, the same way an unknown outline file lists the ones under
   * the served directory. An agent that mistyped can correct without a second
   * round-trip.
   */
  test("an unknown add is not-found and lists the ids that exist", () => {
    const failure = refused(house(), {
      op: "see",
      id: "order",
      add: ["nope"],
    })
    expect(failure._tag).toBe("NotFoundFailure")
    if (failure._tag !== "NotFoundFailure") return
    expect(failure.named).toBe("nope")
    expect(failure.message).toContain("kitchen")
    expect(failure.message).toContain("order")
    expect(failure.message).toContain("nope")
  })

  test("neither add nor remove is a usage refusal", () => {
    expect(refused(house(), { op: "see", id: "order" })._tag).toBe(
      "UsageFailure",
    )
  })

  test("a no-op — re-adding what is already there — is refused rather than rewritten", () => {
    const set = setOf({
      "a.jsonl": [
        `{"id":"a","ord":"a0","title":"a","see":["b"]}`,
        `{"id":"b","ord":"a1","title":"b"}`,
      ].join("\n"),
    })
    const failure = refused(set, { op: "see", id: "a", add: ["b"] })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("already sees")
  })

  test("a mirror is not a node to edit, and the refusal names the one that is", () => {
    const set = setOf({
      "a.jsonl": `{"id":"x","ord":"a0","title":"x"}`,
      "b.jsonl": `{"id":"m","ord":"a0","mirror":"x"}`,
    })
    expect(refused(set, { op: "see", id: "m", add: ["x"] }).message).toContain(
      "`x`",
    )
  })

  test("an id nothing declares is not-found", () => {
    expect(refused(house(), { op: "see", id: "nope", add: ["order"] })._tag)
      .toBe("NotFoundFailure")
  })
})

// ── what no op may do ──────────────────────────────────────────────────

test("a file whose lines do not parse is never rewritten from a set that lost them", () => {
  const set = setOf(
    { "good.jsonl": `{"id":"x","ord":"a0","title":"x"}` },
    [],
    { "bad.jsonl": `{"id":"y","ord":"a0"` },
  )
  const failure = refused(set, { op: "add", file: "bad.jsonl", title: "x" })
  expect(failure._tag).toBe("ValidationFailure")
  if (failure._tag !== "ValidationFailure") return
  expect(failure.errors.length).toBeGreaterThan(0)
  expect(failure.message).toContain("Fix the file first")
})

test("an id nothing declares is not-found and names what was asked for", () => {
  const failure = refused(house(), { op: "done", id: "nope" })
  expect(failure._tag).toBe("NotFoundFailure")
  if (failure._tag !== "NotFoundFailure") return
  expect(failure.named).toBe("nope")
})

/**
 * The planner produces RECORDS and the format produces BYTES, and this is the
 * seam where that pays: whatever an op decides, what reaches the disk is one
 * line per record with one trailing newline. Asserted here as well as in the
 * writer's own tests because this is the path a real write takes.
 */
test("whatever an op plans, the bytes are one record per line", () => {
  for (const request of [
    { op: "add", parent: "kitchen", title: "with a note", desc: "two\nlines" },
    { op: "done", id: "order" },
    { op: "move", id: "install", before: "demo" },
    { op: "archive", id: "order" },
  ] as ReadonlyArray<Request>) {
    for (const file of planned(house(), request).files) {
      const text = serializeOutline(file.nodes)
      expect(text.split("\n")).toHaveLength(file.nodes.length + 1)
      expect(text.endsWith("\n\n")).toBe(false)
    }
  }
})
