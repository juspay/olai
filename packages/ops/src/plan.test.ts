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
  nodesOf,
  type OpFailure,
  type OutlineSet,
  type RegularNode,
  serializeOutline,
  AddRequest,
  type WriteRequest as Request,
} from "@olai/format"
import { describe, expect, test } from "bun:test"
import { Result, Schema } from "effect"

import { setOf, STAMP, steady } from "./fixtures.testlib.ts"
import { plan, type Plan } from "./plan.ts"

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

  // The cap is the JSON Schema's, not the format's (`@olai/format`'s `writing.ts`'s
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

  // ── the condition a text write may carry ─────────────────────────────
  //
  // `was` is what the caller expects to find, and it is checked HERE rather
  // than by whoever built the request — which is the whole point of it being a
  // field. The write gate re-plans this same request whenever the store moves
  // under it, so a condition checked before that loop is a condition the retry
  // does not check; that is how an undo of a title came to overwrite a
  // concurrent retitle (review, 2026-08-12). Every attempt plans, so every
  // attempt tests.

  test("a conditional retitle writes while the title still says what it expected", () => {
    const result = planned(house(), {
      op: "title",
      id: "order",
      title: "order cabinets",
      was: "order the cabinets",
    })
    expect(record(fileOf(result, "house.jsonl"), "order").title).toBe("order cabinets")
  })

  test("and is refused, naming what is there, when somebody else wrote first", () => {
    // This IS the retry, in the shape the planner sees it: the same request,
    // planned a second time against a set where the title has moved on.
    const moved = setOf({
      "house.jsonl": KITCHEN.replace(
        `"title":"order the cabinets"`,
        `"title":"order the walnut ones"`,
      ),
    })
    const failure = refused(moved, {
      op: "title",
      id: "order",
      title: "order cabinets",
      was: "order the cabinets",
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("order the walnut ones")
    expect(failure.message).toContain("has been retitled since")
  })

  test("a note's condition can be `null`, which is a note that is not there", () => {
    // The reason the check is on the FIELD being given rather than on its
    // content: "expects no note" is a real expectation, and it is not "not
    // checking".
    expect(
      record(
        fileOf(
          planned(house(), { op: "desc", id: "order", desc: "measure first", was: null }),
          "house.jsonl",
        ),
        "order",
      ).desc,
    ).toBe("measure first")

    const noted = setOf({ "a.jsonl": `{"id":"x","ord":"a0","title":"x","desc":"theirs"}` })
    expect(refused(noted, { op: "desc", id: "x", desc: "mine", was: null }).message)
      .toContain("has changed since")
  })

  test("no condition at all is last-one-wins, which is what typing means", () => {
    // What `set_title` has always meant, unchanged: a request with no `was`
    // overwrites whatever is there.
    const moved = setOf({
      "house.jsonl": KITCHEN.replace(
        `"title":"order the cabinets"`,
        `"title":"order the walnut ones"`,
      ),
    })
    expect(
      record(
        fileOf(planned(moved, { op: "title", id: "order", title: "mine" }), "house.jsonl"),
        "order",
      ).title,
    ).toBe("mine")
  })

  // `date:`, not the reference implementation's `move:`. Beside this format's
  // real reparenting op, `move:` read as a structural change that never
  // happened — which is exactly how it looked in a log of eleven auto-commits.
  test("a date says it is a date, cleared included", () => {
    expect(planned(house(), { op: "date", id: "order", date: "2026-08-10" }).summary).toBe(
      "date: order the cabinets -> 2026-08-10",
    )
    expect(planned(house(), { op: "date", id: "order", date: null }).summary).toBe(
      "date: order the cabinets -> (cleared)",
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
    const failure = refused(house(), { op: "move", id: "kitchen", parent: "order" })
    expect(failure.message).toContain("loop")
    // …and it NAMES the ancestry, the way the other two loop refusals do: the
    // chain by which the proposed parent already sits inside the node.
    expect(failure.message).toContain("`order` → `kitchen`")
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

  // The hole this closes: `create` then `add_node` was TWO plans, and a second
  // one that refused left an empty outline on disk nobody had asked for. A seed
  // is a whole capture now, so the file and everything in it are one plan.
  test("a seed is a whole capture — the outline is born holding its tree", () => {
    const result = planned(house(), {
      op: "create",
      file: "shed.jsonl",
      seed: {
        title: "The shed",
        children: [
          {
            title: "clear it out",
            mark: "todo",
            children: [{ title: "the old paint tins", mark: "done" }],
          },
          { title: "new lock", date: "2026-09-04" },
        ],
      },
    })

    // ONE file plan: the outline and its contents are validated together and
    // renamed together.
    expect(result.files).toHaveLength(1)
    const nodes = fileOf(result, "shed.jsonl")
    expect(nodes.map((node) => node.id)).toEqual(["n1", "n2", "n3", "n4"])
    expect(record(nodes, "n2")).toMatchObject({ parent: "n1", todo: true })
    expect(record(nodes, "n3")).toMatchObject({ parent: "n2", done: STAMP })
    expect(record(nodes, "n4")).toMatchObject({ parent: "n1", date: "2026-09-04" })
    expect(childOrder(nodes, "n1")).toEqual(["n2", "n4"])

    expect(result.summary).toBe("capture: The shed (+3)")
    expect(result.captured?.map((node) => node.title)).toEqual([
      "The shed",
      "clear it out",
      "the old paint tins",
      "new lock",
    ])
  })

  test("a seed refused anywhere in its tree writes no file at all", () => {
    // A collision two levels down, and an empty title three levels down: the
    // whole `create` refuses, so there is no outline — not an empty one.
    for (
      const seed of [
        {
          title: "The shed",
          children: [{ title: "clear it out", children: [{ title: "x", id: "order" }] }],
        },
        { title: "The shed", children: [{ title: "clear it out" }, { title: " " }] },
      ]
    ) {
      const failure = refused(house(), { op: "create", file: "shed.jsonl", seed })
      expect(failure._tag).toBe("UsageFailure")
    }

    // And the seed nests exactly as far as a capture does, refused by the same
    // rule rather than by a second one.
    const failure = refused(house(), {
      op: "create",
      file: "shed.jsonl",
      seed: {
        title: "one",
        children: [{
          title: "two",
          children: [{
            title: "three",
            children: [{ title: "four", children: [{ title: "five" }] }],
          }],
        }],
      },
    })
    expect(failure.message).toContain("`four`")
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

// ── split ──────────────────────────────────────────────────────────────

describe("split", () => {
  test("the head keeps the row and the tail follows it as a sibling", () => {
    const result = planned(house(), {
      op: "split",
      id: "order",
      title: "order ",
      rest: "the cabinets",
    })
    const nodes = fileOf(result, "house.jsonl")
    expect(record(nodes, "order").title).toBe("order ")
    expect(record(nodes, "n1").title).toBe("the cabinets")
    expect(childOrder(nodes, "kitchen")).toEqual(["demo", "order", "n1", "install"])
    // The write is ABOUT the node that did not exist a moment ago, which is
    // what lets a caret follow the half that came off.
    expect(result.id).toBe("n1")
    expect(result.title).toBe("the cabinets")
    expect(result.captured).toEqual([{ id: "n1", title: "the cabinets" }])
    expect(result.summary).toBe("split: order the cabinets")
  })

  test("everything that DESCRIBED the node stays with the head", () => {
    const set = setOf({
      "house.jsonl": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order it","done":"2026-08-01","date":"2026-09-01","desc":"walnut","see":["kitchen"]}`,
        `{"id":"quote","parent":"order","ord":"a0","title":"get a quote"}`,
      ].join("\n"),
    })
    const nodes = fileOf(
      planned(set, { op: "split", id: "order", title: "order", rest: " it" }),
      "house.jsonl",
    )
    const head = record(nodes, "order")
    expect(head).toMatchObject({
      done: "2026-08-01",
      date: "2026-09-01",
      desc: "walnut",
      see: ["kitchen"],
    })
    expect(record(nodes, "quote").parent).toBe("order")
    // And the tail is a BULLET: a node with no mark is not an unstarted task,
    // so a split may not invent one.
    expect(record(nodes, "n1")).toEqual({
      id: "n1",
      parent: "kitchen",
      ord: record(nodes, "n1").ord,
      title: " it",
    })
  })

  test("a top-level node splits into a top-level sibling", () => {
    const nodes = fileOf(
      planned(house(), { op: "split", id: "loose", title: "a node", rest: " with no children" }),
      "house.jsonl",
    )
    expect(record(nodes, "n1").parent).toBeUndefined()
    expect(
      nodes.filter((node) => node.parent === undefined).map((node) => node.id),
    ).toEqual(["kitchen", "loose", "n1"])
  })

  test("neither half may be empty — a node is its title", () => {
    expect(
      refused(house(), { op: "split", id: "order", title: "  ", rest: "everything" }).message,
    ).toContain("a node needs a title")
    expect(
      refused(house(), { op: "split", id: "order", title: "everything", rest: "" }).message,
    ).toContain("nothing to split off")
  })

  test("a placement has no title of its own, so it cannot be split", () => {
    const set = setOf({
      "house.jsonl": KITCHEN,
      "week.jsonl": `{"id":"m","ord":"a0","mirror":"order"}`,
    })
    expect(refused(set, { op: "split", id: "m", title: "a", rest: "b" }).message)
      .toContain("is a mirror")
  })
})

// ── merge ──────────────────────────────────────────────────────────────

describe("merge", () => {
  const merged = (set: OutlineSet, id: string) => {
    const result = planned(set, { op: "merge", id })
    return {
      result,
      source: fileOf(result, "house.jsonl"),
      archive: fileOf(result, "Archive.jsonl"),
    }
  }

  test("the titles run together and the record goes to the archive", () => {
    const { archive, result, source } = merged(house(), "install")

    expect(record(source, "order").title).toBe("order the cabinetsinstall them")
    expect(source.map((node) => node.id)).toEqual(["kitchen", "demo", "order", "loose"])
    expect(record(archive, "install").title).toBe("install them")
    // The write is about the row that SURVIVED, which is where the caret goes.
    expect(result.id).toBe("order")
    expect(result.title).toBe("order the cabinetsinstall them")
    expect(result.summary).toBe("merge: order the cabinetsinstall them")
    // Nothing was carried off, so there is nothing to say about it.
    expect(result.nudge).toBeUndefined()
  })

  test("the children move, in order, to the end of the survivor's own", () => {
    const set = setOf({
      "house.jsonl": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order"}`,
        `{"id":"quote","parent":"order","ord":"a0","title":"get a quote"}`,
        `{"id":"install","parent":"kitchen","ord":"a1","title":" them"}`,
        `{"id":"fit","parent":"install","ord":"a0","title":"fit the doors"}`,
        `{"id":"level","parent":"install","ord":"a1","title":"level them"}`,
      ].join("\n"),
    })
    const { source } = merged(set, "install")
    expect(childOrder(source, "order")).toEqual(["quote", "fit", "level"])
    // A mirror under the merged row is a placement and moves like any child.
    expect(record(source, "fit").parent).toBe("order")
  })

  test("the notes join a blank line apart, and one note alone simply moves", () => {
    const both = setOf({
      "house.jsonl": [
        `{"id":"a","ord":"a0","title":"a","desc":"the first"}`,
        `{"id":"b","ord":"a1","title":"b","desc":"the second"}`,
      ].join("\n"),
    })
    expect(record(fileOf(planned(both, { op: "merge", id: "b" }), "house.jsonl"), "a").desc)
      .toBe("the first\n\nthe second")

    const only = setOf({
      "house.jsonl": [
        `{"id":"a","ord":"a0","title":"a"}`,
        `{"id":"b","ord":"a1","title":"b","desc":"the second"}`,
      ].join("\n"),
    })
    expect(record(fileOf(planned(only, { op: "merge", id: "b" }), "house.jsonl"), "a").desc)
      .toBe("the second")
  })

  test("a mark, a date, a document or an edge goes with the record — and is said out loud", () => {
    // Every field a node carries ONE of, so the survivor's own answer stands
    // and this one leaves the live outline. None of them may go quietly —
    // `doc` was the one that did, for a review (2026-08-14).
    const set = setOf({
      "house.jsonl": [
        `{"id":"a","ord":"a0","title":"a"}`,
        `{"id":"b","ord":"a1","title":"b","done":"2026-08-01","date":"2026-09-01","doc":"finishes.md","see":["a"]}`,
      ].join("\n"),
    })
    const result = planned(set, { op: "merge", id: "b" })
    expect(record(fileOf(result, "Archive.jsonl"), "b")).toMatchObject({
      done: "2026-08-01",
      date: "2026-09-01",
      doc: "finishes.md",
      see: ["a"],
    })
    expect(record(fileOf(result, "house.jsonl"), "a").done).toBeUndefined()
    expect(result.nudge).toContain("`done` mark")
    expect(result.nudge).toContain("its date")
    expect(result.nudge).toContain("its document `finishes.md`")
    expect(result.nudge).toContain("its edges")
  })

  test("a node carrying only a document still says so", () => {
    // The list is assembled per field, so the one that was silent has to be
    // pinned ALONE as well — a nudge that only appears beside a mark would be
    // the same hole one field over.
    const set = setOf({
      "house.jsonl": [
        `{"id":"a","ord":"a0","title":"a"}`,
        `{"id":"b","ord":"a1","title":"b","doc":"finishes.md"}`,
      ].join("\n"),
    })
    expect(planned(set, { op: "merge", id: "b" }).nudge)
      .toContain("kept its document `finishes.md`")
  })

  test("the first of its siblings has nothing above it", () => {
    expect(refused(house(), { op: "merge", id: "demo" }).message)
      .toContain("no row above it to merge into")
  })

  test("a mirror above has no title to merge into", () => {
    const set = setOf({
      "house.jsonl": [
        `{"id":"a","ord":"a0","title":"a"}`,
        `{"id":"m","ord":"a1","mirror":"a"}`,
        `{"id":"b","ord":"a2","title":"b"}`,
      ].join("\n"),
    })
    expect(refused(set, { op: "merge", id: "b" }).message).toContain("is a mirror")
  })

  test("a placement cannot be merged either", () => {
    const set = setOf({
      "house.jsonl": KITCHEN,
      "week.jsonl": [
        `{"id":"first","ord":"a0","title":"first"}`,
        `{"id":"m","ord":"a1","mirror":"order"}`,
      ].join("\n"),
    })
    expect(refused(set, { op: "merge", id: "m" }).message).toContain("is a mirror")
  })

  test("a split and a merge are each other's inverse, on disk", () => {
    const before = house()
    const split = planned(before, {
      op: "split",
      id: "order",
      title: "order ",
      rest: "the cabinets",
    })
    const after = setOf({ "house.jsonl": serializeOutline(fileOf(split, "house.jsonl")) })
    const back = planned(after, { op: "merge", id: "n1" })
    expect(serializeOutline(fileOf(back, "house.jsonl")))
      .toBe(serializeOutline(nodesOf(before.nodes, "house.jsonl").map((at) => at.node)))
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

// ── unarchive ──────────────────────────────────────────────────────────

describe("unarchive", () => {
  /** The set a plan leaves behind: every file re-serialized through the
   *  format's own writer and re-parsed, which is the path a real write takes.
   *  What the unarchive tests need it for is the archive op's OWN output — a
   *  hand-written archive that drifted from what `planArchive` writes would
   *  test a fixture rather than the inverse. */
  const after = (set: OutlineSet, request: Request): OutlineSet => {
    const texts = Object.fromEntries(
      set.files.map((file) => [
        file,
        serializeOutline(nodesOf(set.nodes, file).map((located) => located.node)),
      ]),
    )
    for (const file of planned(set, request).files) {
      texts[file.file] = serializeOutline(file.nodes)
    }
    return setOf(texts)
  }

  test("the subtree comes back out, where the recorded chain says it came from", () => {
    const set = after(house(), { op: "archive", id: "order" })
    const result = planned(set, { op: "unarchive", id: "order" })

    const source = fileOf(result, "house.jsonl")
    expect(record(source, "order").parent).toBe("kitchen")
    // Last among its new siblings: the archive does not record where in the
    // row it sat, and the honest answer is the one every other arrival gets.
    expect(childOrder(source, "kitchen")).toEqual(["demo", "install", "order"])
    // The scaffold the removal left empty is tidied away, so archive-then-
    // unarchive leaves the archive as it stood.
    expect(fileOf(result, "Archive.jsonl")).toEqual([])
    expect(result.summary).toBe("unarchive: order the cabinets")
    expect(result.file).toBe("house.jsonl")
  })

  test("descendants come back along, shaped as they were", () => {
    const start = setOf({
      "house.jsonl": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order"}`,
        `{"id":"quote","parent":"order","ord":"a0","title":"get a quote","done":"2026-07-01"}`,
        `{"id":"sign","parent":"quote","ord":"a0","title":"sign it"}`,
      ].join("\n"),
    })
    const set = after(start, { op: "archive", id: "order" })
    const source = fileOf(planned(set, { op: "unarchive", id: "order" }), "house.jsonl")
    expect(source.map((node) => node.id)).toEqual(["kitchen", "order", "quote", "sign"])
    expect(record(source, "quote").parent).toBe("order")
    expect(record(source, "sign").parent).toBe("quote")
    // Nothing was stamped on the way in, and nothing is on the way out.
    expect(record(source, "quote").done).toBe("2026-07-01")
    expect(record(source, "sign").done).toBeUndefined()
  })

  test("an explicit `parent` overrides the chain", () => {
    const set = after(house(), { op: "archive", id: "order" })
    const source = fileOf(
      planned(set, { op: "unarchive", id: "order", parent: "loose" }),
      "house.jsonl",
    )
    expect(record(source, "order").parent).toBe("loose")
  })

  test("an explicit `file` lands it at top level", () => {
    const set = after(house(), { op: "archive", id: "order" })
    const source = fileOf(
      planned(set, { op: "unarchive", id: "order", file: "house.jsonl" }),
      "house.jsonl",
    )
    expect(record(source, "order").parent).toBeUndefined()
    expect(source.filter((node) => node.parent === undefined).map((node) => node.id))
      .toEqual(["kitchen", "loose", "order"])
  })

  test("a node that was never put away is refused", () => {
    const failure = refused(house(), { op: "unarchive", id: "order" })
    expect(failure.message).toContain("not an archive")
  })

  test("a mirror's id is refused, naming the node it shows", () => {
    const set = setOf({
      "Archive.jsonl": `{"id":"x","ord":"a0","title":"x"}`,
      "week.jsonl": `{"id":"m","ord":"a0","mirror":"x"}`,
    })
    expect(refused(set, { op: "unarchive", id: "m" }).message).toContain("is a mirror")
  })

  test("a chain that matches nowhere is refused, naming the chain", () => {
    const set = setOf({
      "house.jsonl": KITCHEN,
      "Archive.jsonl": [
        `{"id":"n9","ord":"a0","title":"Old kitchen"}`,
        `{"id":"gone","parent":"n9","ord":"a0","title":"something"}`,
      ].join("\n"),
    })
    const failure = refused(set, { op: "unarchive", id: "gone" })
    expect(failure.message).toContain("`Old kitchen`")
    expect(failure.message).toContain("matches nothing")
    expect(failure.message).toContain("`parent`")
  })

  test("a chain that matches more than one place is refused, naming each", () => {
    const set = setOf({
      "house.jsonl": KITCHEN,
      "flat.jsonl": `{"id":"twin","ord":"a0","title":"Kitchen remodel"}`,
      "Archive.jsonl": [
        `{"id":"n9","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"gone","parent":"n9","ord":"a0","title":"something"}`,
      ].join("\n"),
    })
    const failure = refused(set, { op: "unarchive", id: "gone" })
    expect(failure.message).toContain("more than one place")
    expect(failure.message).toContain("`kitchen`")
    expect(failure.message).toContain("`twin`")
  })

  test("a top-level node goes back to the one outline beside its archive", () => {
    const set = after(house(), { op: "archive", id: "loose" })
    const source = fileOf(planned(set, { op: "unarchive", id: "loose" }), "house.jsonl")
    expect(record(source, "loose").parent).toBeUndefined()
  })

  test("a top-level node with outlines to choose from is refused, naming them", () => {
    const set = setOf({
      "house.jsonl": KITCHEN,
      "flat.jsonl": `{"id":"other","ord":"a0","title":"elsewhere"}`,
      "Archive.jsonl": `{"id":"x","ord":"a0","title":"was top level"}`,
    })
    const failure = refused(set, { op: "unarchive", id: "x" })
    expect(failure.message).toContain("top level")
    expect(failure.message).toContain("`house.jsonl`")
    expect(failure.message).toContain("`flat.jsonl`")
  })

  test("an archive is not a destination", () => {
    const set = setOf({
      "house.jsonl": KITCHEN,
      "Archive.jsonl": [
        `{"id":"kept","ord":"a0","title":"kept"}`,
        `{"id":"x","ord":"a1","title":"was top level"}`,
      ].join("\n"),
    })
    expect(refused(set, { op: "unarchive", id: "x", file: "Archive.jsonl" }).message)
      .toContain("OUT of an archive")
    expect(refused(set, { op: "unarchive", id: "x", parent: "kept" }).message)
      .toContain("OUT of an archive")
  })

  test("scaffold still holding a sibling stays; only the emptied chain goes", () => {
    const once = after(house(), { op: "archive", id: "order" })
    const set = after(once, { op: "archive", id: "install" })
    const archive = fileOf(planned(set, { op: "unarchive", id: "order" }), "Archive.jsonl")
    // `install` is still put away under the same merged chain, so the scaffold
    // above it is not empty and is not tidied.
    expect(archive.map((node) => node.id)).toEqual(["n1", "install"])
    expect(record(archive, "install").parent).toBe("n1")
  })

  test("a scaffold record something still names is kept", () => {
    const set = setOf({
      "house.jsonl": [
        KITCHEN,
        `{"id":"note","parent":"kitchen","ord":"a3","title":"see the old plan","see":["n9"]}`,
      ].join("\n"),
      "Archive.jsonl": [
        `{"id":"n9","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"gone","parent":"n9","ord":"a0","title":"something"}`,
      ].join("\n"),
    })
    const archive = fileOf(
      planned(set, { op: "unarchive", id: "gone", parent: "kitchen" }),
      "Archive.jsonl",
    )
    expect(archive.map((node) => node.id)).toEqual(["n9"])
  })

  /**
   * THE SIGNPOST IS NOT A NODE (review of #147, S1/S2).
   *
   * `archive` writes two kinds of record: the subtree it MOVED, ids and all,
   * and above it a scaffold of the live ancestors' TITLES under freshly minted
   * ids. The Trash draws both, and the scaffold is the root row — so "put this
   * pile back" is the click that reaches for it first. Restoring one mints a
   * second live node carrying a title the set already has, and hangs the
   * archived rows off the copy instead of the original.
   */
  /** One archive's records, read off the set the plan produced. */
  const archived = (set: OutlineSet): ReadonlyArray<Node> =>
    nodesOf(set.nodes, "Archive.jsonl").map((located) => located.node)

  test("the signpost the archive minted above a node is not restorable", () => {
    const set = after(house(), { op: "archive", id: "order" })
    // `n1` is that scaffold: minted by `archive` to carry the LIVE `kitchen`'s
    // title, and the root row of the Trash.
    expect(record(archived(set), "n1")).toMatchObject({ title: "Kitchen remodel" })

    const failure = refused(set, { op: "unarchive", id: "n1" })
    expect(failure.message).toContain("Kitchen remodel")
    // It names the live node that already carries the title, so the reader
    // knows which one is the real one…
    expect(failure.message).toContain("`kitchen`")
    // …and what to put back instead.
    expect(failure.message).toContain("what was put away")
  })

  test("a signpost part-way down the chain is refused the same way", () => {
    // A two-deep chain, so the inner husk is the one that would duplicate a
    // live node that is not the root.
    const deep = setOf({
      "house.jsonl": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets"}`,
        `{"id":"quote","parent":"order","ord":"a0","title":"get a quote"}`,
      ].join("\n"),
    })
    const set = after(deep, { op: "archive", id: "quote" })
    expect(record(archived(set), "n2"))
      .toMatchObject({ title: "order the cabinets", parent: "n1" })

    const failure = refused(set, { op: "unarchive", id: "n2" })
    expect(failure.message).toContain("order the cabinets")
    expect(failure.message).toContain("`order`")
  })

  /** And the fence does NOT catch content that merely looks like scaffold: a
   *  node carrying only a title kept its own id when `archive` moved it, and
   *  nothing live is called what it is called. `loose` is exactly that. */
  test("a title-only node the archive MOVED is still restorable", () => {
    const set = after(house(), { op: "archive", id: "loose" })
    const source = fileOf(planned(set, { op: "unarchive", id: "loose" }), "house.jsonl")
    expect(record(source, "loose").title).toBe("a node with no children")
  })

  test("an emptied ancestor that is not bare scaffold is kept — it is content", () => {
    const set = setOf({
      "house.jsonl": KITCHEN,
      "Archive.jsonl": [
        `{"id":"was-real","ord":"a0","title":"a whole archived branch","done":"2026-07-01"}`,
        `{"id":"leaf","parent":"was-real","ord":"a0","title":"its one leaf"}`,
      ].join("\n"),
    })
    const archive = fileOf(
      planned(set, { op: "unarchive", id: "leaf", parent: "kitchen" }),
      "Archive.jsonl",
    )
    expect(archive.map((node) => node.id)).toEqual(["was-real"])
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
   * The refusal that teaches, and it teaches the way the VALIDATOR does: the
   * closest id that exists, over the same typo budget, so an agent that
   * mistyped corrects without a round-trip to `search_nodes`.
   *
   * It used to list every id in the set — the right answer for the OUTLINES of
   * a directory, where there are five, and the wrong one for the nodes in it: a
   * vault of a few thousand put its whole id space in one refusal with the one
   * id worth reading somewhere in the middle.
   */
  test("an unknown add is not-found, with the id it was probably meant to be", () => {
    const failure = refused(house(), {
      op: "see",
      id: "order",
      add: ["instal"],
    })
    expect(failure._tag).toBe("NotFoundFailure")
    if (failure._tag !== "NotFoundFailure") return
    expect(failure.named).toBe("instal")
    expect(failure.message).toContain("did you mean `install`")
  })

  test("an unknown add nothing is close to names the tool that finds one", () => {
    const failure = refused(house(), { op: "see", id: "order", add: ["nope"] })
    expect(failure._tag).toBe("NotFoundFailure")
    expect(failure.message).toContain("`nope`")
    expect(failure.message).toContain("search_nodes")
    // The whole id space is exactly what a refusal must not become.
    expect(failure.message).not.toContain("kitchen")
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

// ── after ──────────────────────────────────────────────────────────────

/**
 * The other edge, and it is `see`'s shape over a graph with a rule: what a node
 * must come after. What is only about the SHAPE — an unknown target, a mirror
 * addressed as a node — is `see`'s above and is not repeated, because ONE
 * function plans both and a copy here would assert nothing new. What is here is
 * what `after` MEANS: acyclicity, counted the way the format counts it, and the
 * two refusals whose wording is this field's own.
 */
describe("after", () => {
  const CHAIN = (): OutlineSet =>
    setOf({
      "house.jsonl": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition"}`,
        `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","after":["demo"]}`,
        `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
      ].join("\n"),
    })

  test("adds an edge, keeping the ones already written", () => {
    const result = planned(CHAIN(), { op: "after", id: "order", add: ["kitchen"] })
    expect(record(fileOf(result, "house.jsonl"), "order").after).toEqual([
      "demo",
      "kitchen",
    ])
    expect(result.summary).toBe("after: order the cabinets")
  })

  test("removes an edge, and clears the field when none remain", () => {
    const nodes = fileOf(
      planned(CHAIN(), { op: "after", id: "order", remove: ["demo"] }),
      "house.jsonl",
    )
    expect("after" in record(nodes, "order")).toBe(false)
  })

  /** The whole rule, and the message is the point of refusing it here rather
   *  than letting the validator refuse the write: it names the loop, so the
   *  agent fixes the CALL instead of reading a report about a file that was
   *  never written. */
  test("an add that closes a loop is refused, naming the loop", () => {
    const failure = refused(CHAIN(), { op: "after", id: "demo", add: ["order"] })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`demo` → `order` → `demo`")
    expect(failure.message).toContain("acyclic")
  })

  test("a node after itself is a loop of one", () => {
    expect(refused(CHAIN(), { op: "after", id: "demo", add: ["demo"] }).message)
      .toContain("`demo` → `demo`")
  })

  /** `blocks` is sugar — `a blocks b` means `b after a` — and the acyclicity
   *  rule reads ONE graph with it normalised in. An op that checked only the
   *  `after` fields would let a loop through that the validator then refuses,
   *  which is two answers to one question. */
  test("a loop that closes through `blocks` is refused too", () => {
    const set = setOf({
      "a.jsonl": [
        `{"id":"a","ord":"a0","title":"a"}`,
        `{"id":"b","ord":"a1","title":"b","blocks":["a"]}`,
      ].join("\n"),
    })
    // `b blocks a` IS `a after b`, so `b after a` closes it.
    expect(refused(set, { op: "after", id: "b", add: ["a"] }).message)
      .toContain("`b` → `a` → `b`")
  })

  /** An edge naming a MIRROR is an edge to the node standing there — the
   *  format's own resolution — so a deadlock that closes through a placement is
   *  one loop rather than two dead ends. */
  test("a loop that closes through a mirror is one loop", () => {
    const set = setOf({
      "a.jsonl": [
        `{"id":"a","ord":"a0","title":"a"}`,
        `{"id":"b","ord":"a1","title":"b","after":["mirror-of-a"]}`,
      ].join("\n"),
      "b.jsonl": `{"id":"mirror-of-a","ord":"a0","mirror":"a"}`,
    })
    const failure = refused(set, { op: "after", id: "a", add: ["b"] })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`a` → `b` → `a`")
  })

  /** …including when the ADD is the one addressing the placement. */
  test("adding an edge to a mirror is adding it to the node it shows", () => {
    const set = setOf({
      "a.jsonl": [
        `{"id":"a","ord":"a0","title":"a"}`,
        `{"id":"b","ord":"a1","title":"b","after":["a"]}`,
      ].join("\n"),
      "b.jsonl": `{"id":"mirror-of-b","ord":"a0","mirror":"b"}`,
    })
    expect(refused(set, { op: "after", id: "a", add: ["mirror-of-b"] }).message)
      .toContain("`a` → `b` → `a`")
  })

  test("neither add nor remove is a usage refusal naming the field", () => {
    const failure = refused(CHAIN(), { op: "after", id: "order" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`after`")
  })

  test("a no-op is refused rather than rewritten", () => {
    const failure = refused(CHAIN(), { op: "after", id: "order", add: ["demo"] })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("already comes after")
  })

})

// ── mirrors ────────────────────────────────────────────────────────────

/**
 * A second PLACEMENT of a node that already exists — the op the ledger's Now
 * list was being hand-edited for.
 *
 * The fixture is two files, because that is the case a mirror exists for: a
 * `parent` cannot cross outlines, so a node appearing in another file at all is
 * a mirror.
 */
describe("mirror", () => {
  const TWO = (): OutlineSet =>
    setOf({
      "house.jsonl": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition"}`,
        `{"id":"install","parent":"kitchen","ord":"a1","title":"install them"}`,
        `{"id":"handles","parent":"install","ord":"a0","title":"choose the handles"}`,
      ].join("\n"),
      "now.jsonl": [
        `{"id":"now","ord":"a0","title":"Now"}`,
        `{"id":"now-demo","parent":"now","ord":"a0","mirror":"demo"}`,
      ].join("\n"),
    })

  test("places a mirror under a parent, last among its siblings", () => {
    const result = planned(TWO(), { op: "mirror", target: "install", parent: "now" })
    const nodes = fileOf(result, "now.jsonl")
    expect(childOrder(nodes, "now")).toEqual(["now-demo", "n1"])
    expect(result.id).toBe("n1")
    // The whole record: four fields, and there is no way to ask for a fifth.
    expect(nodes.find((node) => node.id === "n1")).toEqual({
      id: "n1",
      parent: "now",
      ord: expect.any(String),
      mirror: "install",
    })
    // What a person reads in the log is the node it shows, not the id of a
    // placement nobody chose.
    expect(result.summary).toBe("mirror: install them")
    expect(result.title).toBe("install them")
  })

  test("`before` and `after` place it among the siblings there", () => {
    const nodes = fileOf(
      planned(TWO(), {
        op: "mirror",
        target: "install",
        parent: "now",
        before: "now-demo",
      }),
      "now.jsonl",
    )
    expect(childOrder(nodes, "now")).toEqual(["n1", "now-demo"])
  })

  test("`file` puts it at the top level of an outline", () => {
    const nodes = fileOf(
      planned(TWO(), { op: "mirror", target: "install", file: "now.jsonl" }),
      "now.jsonl",
    )
    expect(nodes.find((node) => node.id === "n1")).toMatchObject({ mirror: "install" })
    expect("parent" in (nodes.find((node) => node.id === "n1") as Node)).toBe(false)
  })

  /** The placement's own id, which is what retires it — so a convention like
   *  `now-<item>` is writable rather than something only a hand edit can keep. */
  test("a chosen id names the PLACEMENT, and a taken one refuses", () => {
    const nodes = fileOf(
      planned(TWO(), {
        op: "mirror",
        target: "install",
        parent: "now",
        id: "now-install",
      }),
      "now.jsonl",
    )
    expect(nodes.find((node) => node.id === "now-install")).toMatchObject({
      mirror: "install",
    })

    const failure = refused(TWO(), {
      op: "mirror",
      target: "install",
      parent: "now",
      id: "now-demo",
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("already the id")
  })

  /** A mirror of a mirror is legal — the format says the chain is followed to
   *  the node at its end — and every answer here is about that node. */
  test("a chain is allowed, and the reply names what it shows", () => {
    const result = planned(TWO(), {
      op: "mirror",
      target: "now-demo",
      file: "house.jsonl",
    })
    expect(fileOf(result, "house.jsonl").find((node) => node.id === "n1"))
      .toMatchObject({ mirror: "now-demo" })
    expect(result.summary).toBe("mirror: demolition")
  })

  /**
   * The containment rule, which is the one thing about a mirror that cannot be
   * checked one record at a time: a placement inside the subtree it shows is a
   * drawing that never ends.
   */
  test("a mirror inside the subtree it shows is refused, naming the loop", () => {
    const failure = refused(TWO(), {
      op: "mirror",
      target: "kitchen",
      parent: "handles",
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`kitchen` → `install` → `handles`")
    expect(failure.message).toContain("expand forever")
  })

  test("a mirror of a node under that same node is refused", () => {
    expect(
      refused(TWO(), { op: "mirror", target: "kitchen", parent: "kitchen" })._tag,
    ).toBe("UsageFailure")
  })

  /** …and the loop can close through another PLACEMENT. Drawing `now` draws
   *  `now-demo`, which draws `demo` — so a mirror of `now` placed under `demo`
   *  is inside what it shows, by a route no `parent` chain would find. */
  test("a loop that closes through an existing mirror is refused", () => {
    const failure = refused(TWO(), {
      op: "mirror",
      target: "now",
      parent: "demo",
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`now` → `now-demo` → `demo`")
    expect(failure.message).toContain("expand forever")
  })

  /** Containment is about what is drawn UNDER what, not about which file
   *  anything is in: a mirror beside its target is a second row, not a loop. */
  test("a mirror at the top of its target's own file is fine", () => {
    const nodes = fileOf(
      planned(TWO(), { op: "mirror", target: "demo", file: "house.jsonl" }),
      "house.jsonl",
    )
    expect(nodes.find((node) => node.id === "n1")).toMatchObject({ mirror: "demo" })
  })

  test("neither parent nor file is a usage refusal", () => {
    expect(refused(TWO(), { op: "mirror", target: "install" })._tag).toBe("UsageFailure")
  })

  test("a parent in an outline whose lines do not parse is refused", () => {
    const set = setOf(
      { "good.jsonl": `{"id":"x","ord":"a0","title":"x"}` },
      [],
      { "bad.jsonl": `{"id":"y","ord":"a0"` },
    )
    expect(refused(set, { op: "mirror", target: "x", file: "bad.jsonl" })._tag)
      .toBe("ValidationFailure")
  })
})

describe("unmirror", () => {
  const PLACED = (): OutlineSet =>
    setOf({
      "house.jsonl": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01"}`,
      ].join("\n"),
      "now.jsonl": [
        `{"id":"now","ord":"a0","title":"Now"}`,
        `{"id":"now-demo","parent":"now","ord":"a0","mirror":"demo"}`,
        `{"id":"now-kitchen","parent":"now","ord":"a1","mirror":"kitchen"}`,
      ].join("\n"),
    })

  /** The whole semantic: a placement goes, the node does not. */
  test("takes the placement out and leaves the node alone", () => {
    const result = planned(PLACED(), { op: "unmirror", id: "now-demo" })
    expect(result.files.map((file) => file.file)).toEqual(["now.jsonl"])
    const nodes = fileOf(result, "now.jsonl")
    expect(nodes.map((node) => node.id)).toEqual(["now", "now-kitchen"])
    // The target's own record is in another file the plan does not even write.
    expect(result.summary).toBe("unmirror: demolition")
    expect(result.title).toBe("demolition")
    expect(result.id).toBe("now-demo")
  })

  /** Removing one placement is not a claim about any other. */
  test("every other placement of the same node stays", () => {
    const set = setOf({
      "now.jsonl": [
        `{"id":"x","ord":"a0","title":"x"}`,
        `{"id":"one","ord":"a1","mirror":"x"}`,
        `{"id":"two","ord":"a2","mirror":"x"}`,
      ].join("\n"),
    })
    expect(
      fileOf(planned(set, { op: "unmirror", id: "one" }), "now.jsonl")
        .map((node) => node.id),
    ).toEqual(["x", "two"])
  })

  test("refuses on a regular node, and says what does put a node away", () => {
    const failure = refused(PLACED(), { op: "unmirror", id: "demo" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("is a node, not a mirror")
    expect(failure.message).toContain("archive_node")
  })

  /**
   * A placement something else NAMES.
   *
   * Retiring it would leave that pointing at nothing, and the write gate would
   * refuse — but with a row about a record the caller never touched, saying an
   * id it has just deleted is unknown, sometimes suggesting a neighbour of it.
   * So the plan refuses first and says WHO still names it and what to do
   * (2026-08-11 review). These two are the fence against a future "helpful"
   * cascade landing quietly instead.
   */
  test("a placement another mirror chains onto is refused, naming it", () => {
    const set = setOf({
      "now.jsonl": [
        `{"id":"x","ord":"a0","title":"x"}`,
        `{"id":"one","ord":"a1","mirror":"x"}`,
      ].join("\n"),
      "focus.jsonl": `{"id":"two","ord":"a0","mirror":"one"}`,
    })
    const failure = refused(set, { op: "unmirror", id: "one" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`two`")
    expect(failure.message).toContain("`mirror`")
    expect(failure.message).toContain("focus.jsonl:1")
    // The node the placement shows is what a re-point should name.
    expect(failure.message).toContain("`x`")
  })

  test("a placement an edge names is refused too, whichever edge it is", () => {
    for (const edge of ["after", "blocks", "see"]) {
      const set = setOf({
        "now.jsonl": [
          `{"id":"x","ord":"a0","title":"x"}`,
          `{"id":"one","ord":"a1","mirror":"x"}`,
          `{"id":"y","ord":"a2","title":"y","${edge}":["one"]}`,
        ].join("\n"),
      })
      const failure = refused(set, { op: "unmirror", id: "one" })
      expect(failure._tag).toBe("UsageFailure")
      expect(failure.message).toContain("`y`")
      expect(failure.message).toContain(`\`${edge}\``)
    }
  })
})

/**
 * The neighbours of an edited line come back BYTE-IDENTICAL.
 *
 * Every op re-emits the whole file from its records, so "did anything else
 * move" is a real question and this is the answer: one line differs, and it is
 * the line the op was about. That is what keeps a line-based git merge worth
 * having — a mirror placed in one branch and a mark set in another are two
 * one-line diffs that merge, and an op that quietly renumbered a row or
 * re-spelled a date would be a conflict about nothing.
 */
describe("documents", () => {
  const NOTES = "# Notes\n\nwhat was here before\n"
  const vault = (): OutlineSet =>
    setOf({ "house.jsonl": KITCHEN }, [["notes/notes.md", NOTES], "flat.md"])

  test("a write replaces the text whole, and touches no outline", () => {
    const outcome = planned(vault(), {
      op: "doc",
      file: "notes/notes.md",
      text: "# Notes\n\nrewritten\n",
    })
    expect(outcome.files).toEqual([])
    expect(outcome.documents).toEqual([
      { file: "notes/notes.md", text: "# Notes\n\nrewritten\n" },
    ])
    // The unit is the file, so the reply names it the way an outline write
    // names its node.
    expect(outcome.id).toBe("notes/notes.md")
    expect(outcome.summary).toBe("doc: notes/notes.md")
  })

  test("a `was` that matches plans; one the file has moved past is refused", () => {
    const conditional = planned(vault(), {
      op: "doc",
      file: "notes/notes.md",
      text: "new",
      was: NOTES,
    })
    expect(conditional.documents).toEqual([{ file: "notes/notes.md", text: "new" }])

    const failure = refused(vault(), {
      op: "doc",
      file: "notes/notes.md",
      text: "new",
      was: "# Notes\n\nwhat this editor read, before vim got there\n",
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("has changed since it was read")
    // Deliberately NOT quoting either text: a document is not a title, and
    // the caller re-reads the file rather than a sentence.
    expect(failure.message).not.toContain("vim got there")
  })

  test("a path the set does not hold is refused with the closest one that exists", () => {
    const near = refused(vault(), { op: "doc", file: "notes/notez.md", text: "x" })
    expect(near._tag).toBe("NotFoundFailure")
    expect(near.message).toContain("notes/notes.md")

    const far = refused(vault(), { op: "doc", file: "elsewhere.md", text: "x" })
    expect(far._tag).toBe("NotFoundFailure")
    expect(far.message).toContain("create_document")
  })

  test("a document that could not be read is never overwritten from a set that lost it", () => {
    const set = setOf({}, [], { "broken.md": "anything at all" })
    const failure = refused(set, { op: "doc", file: "broken.md", text: "x" })
    expect(failure._tag).toBe("ValidationFailure")
    expect(failure.message).toContain("Fix the file first")
  })

  test("create mints the file, empty or holding its text", () => {
    const empty = planned(vault(), { op: "create-doc", file: "ideas.md" })
    expect(empty.documents).toEqual([{ file: "ideas.md", text: "" }])
    expect(empty.summary).toBe("create: ideas.md")

    const seeded = planned(vault(), {
      op: "create-doc",
      file: "Daily/2026/08/2026-08-13.md",
      text: "# Today\n",
    })
    expect(seeded.documents).toEqual([
      { file: "Daily/2026/08/2026-08-13.md", text: "# Today\n" },
    ])
  })

  test("create refuses a path that exists — write is what edits one", () => {
    const failure = refused(vault(), { op: "create-doc", file: "flat.md" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("write_document")
  })

  test("create judges the path the way every minted path is judged", () => {
    for (const path of ["/etc/notes.md", "../up.md", "a/./b.md", "notes.txt", ""]) {
      const failure = refused(vault(), { op: "create-doc", file: path })
      expect(failure._tag).toBe("UsageFailure")
      expect(failure.message).toContain("is not a relative `.md` path")
    }
  })
})

describe("round trip", () => {
  const LEDGER = [
    `{"id":"now","ord":"a0","title":"Now"}`,
    `{"id":"now-demo","parent":"now","ord":"a0","mirror":"demo"}`,
    `{"id":"kitchen","ord":"a1","title":"Kitchen remodel"}`,
    `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":true,"after":["survey"]}`,
    `{"id":"survey","parent":"kitchen","ord":"a1","title":"survey the room","todo":"2026-08-01"}`,
    `{"id":"paint","parent":"kitchen","ord":"a2","title":"paint the walls"}`,
  ]

  const lines = (request: Request): ReadonlyArray<string> =>
    serializeOutline(
      fileOf(planned(setOf({ "ledger.jsonl": LEDGER.join("\n") }), request), "ledger.jsonl"),
    ).trimEnd().split("\n")

  test("placing a mirror adds one line and touches none", () => {
    const after = lines({ op: "mirror", target: "survey", parent: "now" })
    expect(after).toHaveLength(LEDGER.length + 1)
    expect(after.filter((line) => LEDGER.includes(line))).toEqual(LEDGER)
  })

  test("retiring a mirror removes one line and touches none", () => {
    expect(lines({ op: "unmirror", id: "now-demo" })).toEqual(
      LEDGER.filter((line) => !line.includes(`"id":"now-demo"`)),
    )
  })

  test("an after edge rewrites one line and touches none", () => {
    const after = lines({ op: "after", id: "paint", add: ["survey"] })
    expect(after).toHaveLength(LEDGER.length)
    const differing = after.filter((line, at) => line !== LEDGER[at])
    expect(differing).toHaveLength(1)
    expect(differing[0]).toContain(`"after":["survey"]`)
    // Its neighbours keep the spellings they were read with — a `true` marker
    // and a day-only `todo` come back exactly as they were written.
    expect(after).toContain(LEDGER[3] as string)
    expect(after).toContain(LEDGER[4] as string)
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

/** ONE refusal for an id nothing declares, whatever the id was doing: the node
 *  an op is ABOUT gets the same did-you-mean as a target it was asked to point
 *  at, because an agent that mistyped is in the same position either way. */
test("a mistyped id is offered the one it was probably meant to be, on any op", () => {
  for (const request of [
    { op: "done", id: "instal" },
    { op: "move", id: "instal", parent: "kitchen" },
    { op: "unmirror", id: "instal" },
    { op: "after", id: "order", add: ["instal"] },
    { op: "mirror", target: "instal", file: "house.jsonl" },
  ] as ReadonlyArray<Request>) {
    const failure = refused(house(), request)
    expect(failure._tag).toBe("NotFoundFailure")
    if (failure._tag !== "NotFoundFailure") return
    // The id that was not found travels as DATA beside the sentence, whichever
    // field of whichever op named it.
    expect(failure.named).toBe("instal")
    expect(failure.message).toContain("did you mean `install`")
  }
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
