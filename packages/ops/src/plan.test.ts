import { parseOutline } from "olai-plugin-outline-olai/format"
import { TEST_CLAIMS } from "olai-plugin-outline-olai/testlib"
import { admits, blockersOf, datedOn, derive, type Node, markdownIn, nodesOf, type OpFailure, type OutlineSet, type RegularNode, NO_KINDS, outlinePaths, pinTargetIn, shelfOf, standingBefore, validate, AddRequest, type WriteRequest as Request } from "@olai/format"
import { serializeOutline } from "olai-plugin-outline-olai/format"
import { findingsIn, recordsOf } from "@olai/format/testlib"
import { describe, expect, test } from "bun:test"
import { Result, Schema } from "effect"

import {
  fileOf,
  planned,
  planning,
  readingOf,
  record,
  refused,
  setOf,
  STAMP,
  steady,
  succeeded,
} from "./fixtures.testlib.ts"
import { plan, type Plan, scoping } from "./plan.ts"

const KITCHEN = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
  `{"id":"loose","ord":"a1","title":"a node with no children"}`,
].join("\n")

const house = (): OutlineSet => setOf({ "house.olai": KITCHEN })

const after = (set: OutlineSet, request: Request): OutlineSet =>
  performed(set, planned(set, request))

const judged = (set: OutlineSet): OutlineSet => {
  const verdict = validate(TEST_CLAIMS, set)
  if (Result.isFailure(verdict)) throw new Error("a validation answers with a set")
  return verdict.success.set
}

const performed = (set: OutlineSet, result: Plan): OutlineSet => {
  const texts = Object.fromEntries(
    outlinePaths(set).map((file) => [
      file,
      serializeOutline(nodesOf(derive(TEST_CLAIMS, recordsOf(set)), file).map((located) => located.node)),
    ]),
  )
  for (const file of result.files) {
    texts[file.file] = serializeOutline(file.nodes)
  }
  for (const [file, text] of Object.entries(texts)) {
    const decoded = parseOutline(file, text, TEST_CLAIMS)
    if (Result.isFailure(decoded)) throw new Error(decoded.failure.map(error => error.message).join("\n"))
  }
  return setOf(texts, markdownIn(set).map((one) => [one.path, one.body] as const))
}

const at = (set: OutlineSet, now: string, request: Request): OutlineSet =>
  performed(
    set,
    succeeded(
      plan(scoping(readingOf(set), { mint: () => "n1", now: () => now }, NO_KINDS, "outline-olai"), request),
      `\`${request.op}\` to plan`,
    ),
  )

const childOrder = (
  nodes: ReadonlyArray<Node>,
  parent: string | undefined,
): ReadonlyArray<string> =>
  nodes
    .filter((node) => node.parent === parent)
    .slice()
    .sort((a, b) => (a.ord < b.ord ? -1 : a.ord > b.ord ? 1 : 0))
    .map((node) => node.id)

describe("add", () => {
  test("captures under a parent, last among its siblings", () => {
    const result = planned(house(), {
      op: "add",
      parent: "kitchen",
      title: "paint the walls #home",
    })
    const nodes = fileOf(result, "house.olai")
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
      "house.olai",
    )
    expect(childOrder(first, "kitchen")).toEqual(["demo", "n1", "order", "install"])

    const second = fileOf(
      planned(house(), { op: "add", parent: "kitchen", title: "x", after: "demo" }),
      "house.olai",
    )
    expect(childOrder(second, "kitchen")).toEqual(["demo", "n1", "order", "install"])
  })

  test("only the new node's `ord` moves — an insert is a one-line diff", () => {
    const before = house()
    const nodes = fileOf(
      planned(before, { op: "add", parent: "kitchen", title: "x", before: "install" }),
      "house.olai",
    )
    for (const id of ["demo", "order", "install"]) {
      expect(record(nodes, id).ord).toBe(
        (derive(TEST_CLAIMS, recordsOf(before)).byId.get(id)?.node as RegularNode).ord,
      )
    }
  })

  test("a file with no parent puts the node at top level", () => {
    const nodes = fileOf(
      planned(house(), { op: "add", file: "house.olai", title: "a new root" }),
      "house.olai",
    )
    expect(record(nodes, "n1").parent).toBeUndefined()
  })

  test("neither a parent nor a file is a usage refusal, not a guess", () => {
    expect(refused(house(), { op: "add", title: "x" })._tag).toBe("UsageFailure")
  })

  test("a file the directory does not serve is not-found, and says what it does serve", () => {
    const failure = refused(house(), { op: "add", file: "nope.olai", title: "x" })
    expect(failure._tag).toBe("NotFoundFailure")
    expect(failure.message).toContain("house.olai")
  })

  test("an id the set already holds is refused rather than duplicated", () => {
    expect(
      refused(house(), { op: "add", parent: "kitchen", title: "x", id: "order" })._tag,
    ).toBe("UsageFailure")
  })

  test("a chosen id is kept verbatim", () => {
    const nodes = fileOf(
      planned(house(), { op: "add", parent: "kitchen", title: "x", id: "paint" }),
      "house.olai",
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
      "house.olai",
    )
    expect(record(nodes, "n1").todo).toBe(true)
  })
})

describe("add with children", () => {
  const CAPTURE = {
    op: "add",
    file: "house.olai",
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
    const nodes = fileOf(result, "house.olai")

    expect(result.files).toHaveLength(1)

    expect(record(nodes, "n1")).toMatchObject({ title: "Bathroom remodel" })
    expect(record(nodes, "n2")).toMatchObject({ parent: "n1", title: "fixtures" })
    expect(record(nodes, "n3")).toMatchObject({ parent: "n2", title: "taps" })
    expect(record(nodes, "n5")).toMatchObject({ parent: "n1", title: "tiling" })

    expect(childOrder(nodes, "n1")).toEqual(["n2", "n5"])
    expect(childOrder(nodes, "n2")).toEqual(["n3", "n4"])

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
    expect(result.summary).toBe("capture: Bathroom remodel (+4)")
  })

  test("a capture of one node is a list of one, and no count in the subject", () => {
    const result = planned(house(), { op: "add", parent: "kitchen", title: "x" })
    expect(result.captured).toEqual([{ id: "n1", title: "x" }])
    expect(result.summary).toBe("capture: x")

    const empty = planned(house(), {
      op: "add",
      parent: "kitchen",
      title: "x",
      children: [],
    })
    expect(empty.captured).toHaveLength(1)
    expect(empty.summary).toBe("capture: x")
  })

  test("a seeded create names the node it made, and may mark it", () => {
    const result = planned(house(), {
      op: "create",
      file: "shed.olai",
      seed: { title: "clear out the shed", id: "shed", mark: "todo" },
    })
    expect(result.captured).toEqual([{ id: "shed", title: "clear out the shed" }])
    expect(fileOf(result, "shed.olai")[0]).toMatchObject({ id: "shed", todo: true })

    expect(
      refused(house(), {
        op: "create",
        file: "shed.olai",
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
      "house.olai",
    )
    expect(record(nodes, "n2").done).toBe(STAMP)
    expect(record(nodes, "n3").doing).toBe(true)
    expect(record(nodes, "n3").started).toBe(STAMP)
    expect(record(nodes, "n4")).toMatchObject({
      todo: true,
      date: "2026-09-02",
      desc: "on completion",
    })
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
      "house.olai",
    )
    expect(childOrder(nodes, "kitchen")).toEqual(["demo", "n1", "order", "install"])
    expect(childOrder(nodes, "n1")).toEqual(["n2", "n3"])
  })

  test("a chosen id anywhere in the tree that the set holds refuses ALL of it", () => {
    const failure = refused(house(), {
      op: "add",
      file: "house.olai",
      title: "Bathroom",
      children: [{ title: "fixtures", children: [{ title: "taps", id: "order" }] }],
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`order` is already the id")
  })

  test("one id used twice in the same call is refused — nothing is written", () => {
    const failure = refused(house(), {
      op: "add",
      file: "house.olai",
      title: "Bathroom",
      children: [{ title: "taps", id: "twice" }, { title: "shower", id: "twice" }],
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("named twice")
  })

  test("a child naming its own ancestor's id is a collision, not a loop", () => {
    const failure = refused(house(), {
      op: "add",
      file: "house.olai",
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

  test("nesting past the depth the schema unrolls is refused, and teaches", () => {
    const deep = {
      op: "add",
      file: "house.olai",
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
    expect(failure.message).toContain("`four`")
    expect(failure.message).toContain("second `outlines_add`")

    const ok = planned(house(), {
      op: "add",
      file: "house.olai",
      title: "one",
      children: [{
        title: "two",
        children: [{ title: "three", children: [{ title: "four" }] }],
      }],
    })
    expect(ok.captured).toHaveLength(4)
  })

  test("a level past the floor survives decoding, so it can be refused", () => {
    const decoded = Schema.decodeUnknownSync(AddRequest)({
      op: "add",
      file: "house.olai",
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
    const nodes = fileOf(planned(house(), CAPTURE), "house.olai")
    const text = serializeOutline(nodes)
    expect(text.split("\n").filter((line) => line !== "")).toHaveLength(nodes.length)
  })
})

describe("done and doing", () => {
  test("marking a leaf stamps the instant and says so in the commit line", () => {
    const result = planned(house(), { op: "done", id: "order" })
    expect(record(fileOf(result, "house.olai"), "order").done).toBe(STAMP)
    expect(result.summary).toBe("done: order the cabinets")
  })

  test("the dates on the other records come back as they were written", () => {
    const nodes = fileOf(planned(house(), { op: "done", id: "order" }), "house.olai")
    expect(record(nodes, "demo").done).toBe("2026-08-01")
  })

  test("the SETTLING marks carry an instant — the other two say `true`", () => {
    const marked = (op: "done" | "cancelled" | "doing" | "todo"): RegularNode =>
      record(fileOf(planned(house(), { op, id: "order" }), "house.olai"), "order")
    expect(marked("done").done).toBe(STAMP)
    expect(marked("cancelled").cancelled).toBe(STAMP)
    expect(marked("doing").doing).toBe(true)
    expect(marked("todo").todo).toBe(true)
  })

  test("`doing` stamps `started` — and settling, un-marking and re-filing do not", () => {
    const doing = record(fileOf(planned(house(), { op: "doing", id: "order" }), "house.olai"), "order")
    expect(doing.started).toBe(STAMP)
    expect(doing.doing).toBe(true)
    for (const op of ["done", "cancelled", "todo"] as const) {
      const node = record(fileOf(planned(house(), { op, id: "order" }), "house.olai"), "order")
      expect(node.started).toBeUndefined()
      expect(node.worked).toBeUndefined()
    }
  })

  test("a `started` already on the record is re-stamped — the round just settled is banked", () => {
    const set = setOf({
      "a.olai": `{"id":"x","ord":"a0","title":"x","todo":true,"started":"2026-08-01T07:00:00-04:00"}`,
    })
    const node = record(fileOf(planned(set, { op: "doing", id: "x" }), "a.olai"), "x")
    expect(node.doing).toBe(true)
    expect(node.started).toBe(STAMP)
  })

  test("settling banks the round it closed, and un-marking keeps the `started` and the bank", () => {
    const read = (set: OutlineSet): RegularNode =>
      nodesOf(derive(TEST_CLAIMS, recordsOf(set)), "house.olai")
        .map((located) => located.node)
        .find((node) => node.id === "order") as RegularNode
    const doing = after(house(), { op: "doing", id: "order" })
    const settled = after(doing, { op: "done", id: "order" })
    expect(read(settled).started).toBe(STAMP)
    expect(read(settled).worked).toBe(0)
    const unmarked = after(settled, { op: "done", id: "order", undo: true })
    expect(read(unmarked)).toMatchObject({ started: STAMP, worked: 0 })
    expect(read(unmarked).done).toBeUndefined()
    const notDoing = after(doing, { op: "doing", id: "order", undo: true })
    expect(read(notDoing).started).toBeUndefined()
    expect(read(notDoing).worked).toBe(0)
    const reopened = after(unmarked, { op: "doing", id: "order" })
    expect(read(reopened)).toMatchObject({ doing: true, started: STAMP, worked: 0 })
  })

  test("a todo→done jump stores no `started`, and banks none", () => {
    const once = after(house(), { op: "done", id: "order" })
    const node = nodesOf(derive(TEST_CLAIMS, recordsOf(once)), "house.olai")
      .map((located) => located.node)
      .find((one) => one.id === "order") as RegularNode
    expect(node.started).toBeUndefined()
    expect(node.worked).toBeUndefined()
    expect(node.done).toBe(STAMP)
  })

  test("every settle banks its round, a re-start stamps fresh, and the pause is nobody's", () => {
    const read = (set: OutlineSet): RegularNode =>
      nodesOf(derive(TEST_CLAIMS, recordsOf(set)), "house.olai")
        .map((located) => located.node)
        .find((node) => node.id === "order") as RegularNode
    let set = at(house(), "2026-08-29T09:00:00-04:00", { op: "doing", id: "order" })
    expect(read(set).started).toBe("2026-08-29T09:00:00-04:00")
    set = at(set, "2026-08-29T09:10:00-04:00", { op: "done", id: "order" })
    expect(read(set)).toMatchObject({ done: "2026-08-29T09:10:00-04:00", worked: 600 })
    set = at(set, "2026-08-29T09:46:00-04:00", { op: "done", id: "order", undo: true })
    expect(read(set)).toMatchObject({ started: "2026-08-29T09:00:00-04:00", worked: 600 })
    expect(read(set).done).toBeUndefined()
    set = at(set, "2026-08-29T09:50:00-04:00", { op: "doing", id: "order" })
    expect(read(set)).toMatchObject({ doing: true, started: "2026-08-29T09:50:00-04:00", worked: 600 })
    set = at(set, "2026-08-29T09:58:00-04:00", { op: "done", id: "order" })
    expect(read(set).worked).toBe(600 + 480)
  })

  test("settle → undo → settle mints nothing again: the stamp is buried, the bank stands", () => {
    const read = (set: OutlineSet): RegularNode =>
      nodesOf(derive(TEST_CLAIMS, recordsOf(set)), "house.olai")
        .map((located) => located.node)
        .find((node) => node.id === "order") as RegularNode
    let set = at(house(), "2026-08-29T09:00:00-04:00", { op: "doing", id: "order" })
    set = at(set, "2026-08-29T09:10:00-04:00", { op: "done", id: "order" })
    expect(read(set).worked).toBe(600)
    set = at(set, "2026-08-29T10:00:00-04:00", { op: "done", id: "order", undo: true })
    set = at(set, "2026-08-29T10:00:05-04:00", { op: "done", id: "order" })
    expect(read(set)).toMatchObject({ done: "2026-08-29T10:00:05-04:00", worked: 600 })
    expect(read(set).started).toBeUndefined()
    set = at(set, "2026-08-29T11:00:00-04:00", { op: "done", id: "order", undo: true })
    set = at(set, "2026-08-29T12:00:00-04:00", { op: "done", id: "order" })
    expect(read(set).worked).toBe(600)
  })

  test("…and the `todo` detour mints nothing: back on the queue, called off, the bank stands", () => {
    const read = (set: OutlineSet): RegularNode =>
      nodesOf(derive(TEST_CLAIMS, recordsOf(set)), "house.olai")
        .map((located) => located.node)
        .find((node) => node.id === "order") as RegularNode
    let set = at(house(), "2026-08-29T09:00:00-04:00", { op: "doing", id: "order" })
    set = at(set, "2026-08-29T09:10:00-04:00", { op: "done", id: "order" })
    set = at(set, "2026-08-29T10:00:00-04:00", { op: "done", id: "order", undo: true })
    set = at(set, "2026-08-29T10:05:00-04:00", { op: "todo", id: "order" })
    expect(read(set)).toMatchObject({ todo: true, worked: 600 })
    set = at(set, "2026-08-29T10:30:00-04:00", { op: "cancelled", id: "order" })
    expect(read(set)).toMatchObject({ cancelled: "2026-08-29T10:30:00-04:00", worked: 600 })
    expect(read(set).started).toBeUndefined()
  })

  test("undo of a `doing` banks the round at the peel — the later settle is a jump", () => {
    const read = (set: OutlineSet): RegularNode =>
      nodesOf(derive(TEST_CLAIMS, recordsOf(set)), "house.olai")
        .map((located) => located.node)
        .find((node) => node.id === "order") as RegularNode
    let set = at(house(), "2026-08-29T10:00:00-04:00", { op: "doing", id: "order" })
    set = at(set, "2026-08-29T10:10:00-04:00", { op: "doing", id: "order", undo: true })
    expect(read(set)).toMatchObject({ worked: 600 })
    expect(read(set).started).toBeUndefined()
    set = at(set, "2026-08-29T10:40:00-04:00", { op: "done", id: "order" })
    expect(read(set)).toMatchObject({ done: "2026-08-29T10:40:00-04:00", worked: 600 })
    expect(read(set).started).toBeUndefined()
  })

  test("queueing mid-round banks at the peel — and re-queuing's gap is nobody's work", () => {
    const read = (set: OutlineSet): RegularNode =>
      nodesOf(derive(TEST_CLAIMS, recordsOf(set)), "house.olai")
        .map((located) => located.node)
        .find((node) => node.id === "order") as RegularNode
    let set = at(house(), "2026-08-29T10:00:00-04:00", { op: "doing", id: "order" })
    set = at(set, "2026-08-29T10:30:00-04:00", { op: "todo", id: "order" })
    expect(read(set)).toMatchObject({ todo: true, worked: 1800 })
    expect(read(set).started).toBeUndefined()
    set = at(set, "2026-08-29T10:45:00-04:00", { op: "done", id: "order" })
    expect(read(set)).toMatchObject({ done: "2026-08-29T10:45:00-04:00", worked: 1800 })
    expect(read(set).started).toBeUndefined()
  })

  test("queued, re-opened, settled: the bank says 1800 + 300 and nothing of the queue's wait", () => {
    const read = (set: OutlineSet): RegularNode =>
      nodesOf(derive(TEST_CLAIMS, recordsOf(set)), "house.olai")
        .map((located) => located.node)
        .find((node) => node.id === "order") as RegularNode
    let set = at(house(), "2026-08-29T10:00:00-04:00", { op: "doing", id: "order" })
    set = at(set, "2026-08-29T10:30:00-04:00", { op: "todo", id: "order" })
    set = at(set, "2026-08-29T11:00:00-04:00", { op: "doing", id: "order" })
    expect(read(set)).toMatchObject({ doing: true, started: "2026-08-29T11:00:00-04:00", worked: 1800 })
    set = at(set, "2026-08-29T11:05:00-04:00", { op: "done", id: "order" })
    expect(read(set).worked).toBe(1800 + 300)
  })

  test("calling it off banks the round too", () => {
    let set = at(house(), "2026-08-29T09:00:00-04:00", { op: "doing", id: "order" })
    set = at(set, "2026-08-29T09:41:00-04:00", { op: "cancelled", id: "order" })
    const ended = nodesOf(derive(TEST_CLAIMS, recordsOf(set)), "house.olai")
      .map((located) => located.node)
      .find((node) => node.id === "order") as RegularNode
    expect(ended).toMatchObject({ cancelled: "2026-08-29T09:41:00-04:00", worked: 2460 })
  })

  test("undo takes the mark off", () => {
    const result = planned(house(), { op: "done", id: "demo", undo: true })
    expect(record(fileOf(result, "house.olai"), "demo").done).toBeUndefined()
    expect(result.summary).toBe("undone: demolition")
  })

  test("`doing` clears a stale `done`, because both at once is not a record", () => {
    const set = setOf({
      "a.olai": `{"id":"x","ord":"a0","title":"x","done":"2026-08-01"}`,
    })
    expect(refused(set, { op: "doing", id: "x" }).message).toContain("Undo that first")

    const undone = setOf({ "a.olai": `{"id":"x","ord":"a0","title":"x"}` })
    const node = record(fileOf(planned(undone, { op: "doing", id: "x" }), "a.olai"), "x")
    expect(node.doing).toBe(true)
    expect(node.done).toBeUndefined()
  })

  test("already marked is refused rather than rewritten", () => {
    expect(refused(house(), { op: "done", id: "demo" }).message).toContain("already done")
  })

  test("`todo` is a mark like the other two", () => {
    const result = planned(house(), { op: "todo", id: "order" })
    expect(record(fileOf(result, "house.olai"), "order").todo).toBe(true)
    expect(result.summary).toBe("todo: order the cabinets")

    const under = setOf({
      "a.olai": `{"id":"x","ord":"a0","title":"x","doing":"2026-08-01"}`,
    })
    const node = record(fileOf(planned(under, { op: "todo", id: "x" }), "a.olai"), "x")
    expect(node.todo).toBe(true)
    expect(node.doing).toBeUndefined()

    const finished = setOf({
      "a.olai": `{"id":"x","ord":"a0","title":"x","done":"2026-08-01"}`,
    })
    expect(refused(finished, { op: "todo", id: "x" }).message).toContain("Undo that first")

    const marked = setOf({ "a.olai": `{"id":"x","ord":"a0","title":"x","todo":true}` })
    const cleared = planned(marked, { op: "todo", id: "x", undo: true })
    expect(record(fileOf(cleared, "a.olai"), "x").todo).toBeUndefined()
    expect(cleared.summary).toBe("not-todo: x")
  })

  test("`cancelled` is a mark that SETTLES, and is gated like one", () => {
    const result = planned(house(), { op: "cancelled", id: "order" })
    expect(record(fileOf(result, "house.olai"), "order").cancelled).toBe(STAMP)
    expect(result.summary).toBe("cancelled: order the cabinets")

    expect(record(fileOf(result, "house.olai"), "order").doing).toBeUndefined()

    const off = planned(
      setOf({ "a.olai": `{"id":"x","ord":"a0","title":"x","cancelled":"2026-08-01"}` }),
      { op: "cancelled", id: "x", undo: true },
    )
    expect(record(fileOf(off, "a.olai"), "x").cancelled).toBeUndefined()
    expect(off.summary).toBe("uncancelled: x")

    const called = setOf({
      "a.olai": `{"id":"x","ord":"a0","title":"x","cancelled":"2026-08-01"}`,
    })
    for (const op of ["todo", "doing", "done"] as const) {
      expect(refused(called, { op, id: "x" }).message).toContain("is cancelled. Undo that first")
    }
    expect(refused(called, { op: "cancelled", id: "x" }).message).toContain("already cancelled")

    const finished = setOf({
      "a.olai": `{"id":"x","ord":"a0","title":"x","done":"2026-08-01"}`,
    })
    expect(refused(finished, { op: "cancelled", id: "x" }).message)
      .toContain("is done. Undo that first")

    const blocked = setOf({
      "a.olai": `{"id":"one","ord":"a0","title":"one","todo":true}\n` +
        `{"id":"two","ord":"a1","title":"two","todo":true,"after":["one"]}`,
    })
    expect(record(fileOf(planned(blocked, { op: "cancelled", id: "two" }), "a.olai"), "two")
      .cancelled).toBe(STAMP)
  })

  test("cancelling a branch refuses nothing, and says what it left standing", () => {
    const set = setOf({
      "a.olai": [
        `{"id":"p","ord":"a0","title":"the trip","todo":true}`,
        `{"id":"c1","parent":"p","ord":"a0","title":"pack","todo":true}`,
        `{"id":"c2","parent":"p","ord":"a1","title":"a note"}`,
      ].join("\n"),
    })
    const result = planned(set, { op: "cancelled", id: "p" })
    expect(record(fileOf(result, "a.olai"), "p").cancelled).toBe(STAMP)
    expect(result.nudge).toContain("`the trip` is cancelled, but 1 task under it is")
    expect(result.nudge).toContain("`pack` (`c1`, todo)")
    expect(result.nudge).toContain("Nothing was hidden and nothing was refused")
    expect(result.nudge).not.toContain("a note")

    const settled = setOf({
      "a.olai": [
        `{"id":"p","ord":"a0","title":"the trip","todo":true}`,
        `{"id":"c1","parent":"p","ord":"a0","title":"pack","done":true}`,
      ].join("\n"),
    })
    expect(planned(settled, { op: "cancelled", id: "p" }).nudge).toBeUndefined()
  })

  test("cancelling under a done ancestor leaves that mark alone", () => {
    const set = setOf({
      "a.olai": [
        `{"id":"p","ord":"a0","title":"the trip","done":"2026-08-01"}`,
        `{"id":"c1","parent":"p","ord":"a0","title":"pack","todo":true}`,
      ].join("\n"),
    })
    const result = planned(set, { op: "cancelled", id: "c1" })
    expect(record(fileOf(result, "a.olai"), "p").done).toBe("2026-08-01")
    expect(result.nudge).toBeUndefined()

    const opened = planned(
      setOf({
        "a.olai": [
          `{"id":"p","ord":"a0","title":"the trip","done":"2026-08-01"}`,
          `{"id":"c1","parent":"p","ord":"a0","title":"pack","cancelled":true}`,
        ].join("\n"),
      }),
      { op: "cancelled", id: "c1", undo: true },
    )
    expect(record(fileOf(opened, "a.olai"), "p").done).toBe("2026-08-01")
  })

  test("cancelling a repeating node spawns nothing and keeps the rule", () => {
    const set = setOf({
      "a.olai":
        `{"id":"x","ord":"a0","title":"water the plants","todo":true,"date":"2026-08-25","repeat":"every week on monday"}`,
    })
    const result = planned(set, { op: "cancelled", id: "x" })
    const nodes = fileOf(result, "a.olai")
    expect(nodes.length).toBe(1)
    expect(record(nodes, "x").repeat).toBe("every week on monday")
    expect(result.captured).toBeUndefined()
  })

  test("undoing a mark that is not there is refused", () => {
    expect(refused(house(), { op: "done", id: "order", undo: true }).message).toContain(
      "not marked done",
    )
  })

  test("a node with children is marked like any other", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":true}`,
        `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","done":true}`,
        `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
      ].join("\n"),
    })
    const result = planned(set, { op: "done", id: "kitchen" })
    expect(record(fileOf(result, "house.olai"), "kitchen").done).toBe(STAMP)
    expect(result.summary).toBe("done: Kitchen remodel")
  })

  test("a node whose children are all notes can be marked todo", () => {
    const set = setOf({
      "a.olai": [
        `{"id":"p","ord":"a0","title":"orchestrator in chat"}`,
        `{"id":"c1","parent":"p","ord":"a0","title":"nothing wakes a chat agent"}`,
        `{"id":"c2","parent":"p","ord":"a1","title":"no shell, so no gh"}`,
      ].join("\n"),
    })
    const result = planned(set, { op: "todo", id: "p" })
    expect(record(fileOf(result, "a.olai"), "p").todo).toBe(true)
    expect(result.nudge).toBeUndefined()
  })

  test("finishing the last task under a parent suggests marking the parent", () => {
    const set = setOf({
      "a.olai": [
        `{"id":"p","ord":"a0","title":"the trip"}`,
        `{"id":"c1","parent":"p","ord":"a0","title":"book the ferry","done":true}`,
        `{"id":"c2","parent":"p","ord":"a1","title":"pack","doing":true}`,
        `{"id":"c3","parent":"p","ord":"a2","title":"ferry times"}`,
      ].join("\n"),
    })
    expect(planned(set, { op: "done", id: "c2" }).nudge)
      .toContain("every task under `the trip` is done now")

    const half = setOf({
      "a.olai": [
        `{"id":"p","ord":"a0","title":"the trip"}`,
        `{"id":"c1","parent":"p","ord":"a0","title":"book the ferry","todo":true}`,
        `{"id":"c2","parent":"p","ord":"a1","title":"pack","doing":true}`,
      ].join("\n"),
    })
    expect(planned(half, { op: "done", id: "c2" }).nudge).toBeUndefined()

    const already = setOf({
      "a.olai": [
        `{"id":"p","ord":"a0","title":"the trip","done":"2026-08-01"}`,
        `{"id":"c1","parent":"p","ord":"a0","title":"pack","doing":true}`,
      ].join("\n"),
    })
    expect(planned(already, { op: "done", id: "c1" }).nudge).toBeUndefined()

    const calledOff = setOf({
      "a.olai": [
        `{"id":"p","ord":"a0","title":"the trip","cancelled":"2026-08-25"}`,
        `{"id":"c1","parent":"p","ord":"a0","title":"pack","doing":true}`,
      ].join("\n"),
    })
    const finished = planned(calledOff, { op: "done", id: "c1" })
    expect(record(fileOf(finished, "a.olai"), "c1").done).toBe(STAMP)
    expect(finished.nudge).toBeUndefined()
    expect(refused(calledOff, { op: "done", id: "p" }).message)
      .toContain("is cancelled. Undo that first")

    const deeper = setOf({
      "a.olai": [
        `{"id":"p","ord":"a0","title":"the trip"}`,
        `{"id":"c1","parent":"p","ord":"a0","title":"pack","doing":true}`,
        `{"id":"c2","parent":"p","ord":"a1","title":"paperwork"}`,
        `{"id":"g","parent":"c2","ord":"a0","title":"find the tickets","todo":true}`,
      ].join("\n"),
    })
    expect(planned(deeper, { op: "done", id: "c1" }).nudge).toBeUndefined()
  })

  test("nothing is nudged for doing, todo, or an undo", () => {
    const set = setOf({
      "a.olai": [
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
      "a.olai": `{"id":"x","ord":"a0","title":"x"}`,
      "b.olai": `{"id":"m","ord":"a0","mirror":"x"}`,
    })
    expect(refused(set, { op: "done", id: "m" }).message).toContain("`x`")
  })
})

describe("starting what is blocked", () => {
  const chain = (...records: ReadonlyArray<string>): OutlineSet =>
    setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        ...records,
      ].join("\n"),
    })

  const WAITING = chain(
    `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","doing":true}`,
    `{"id":"install","parent":"kitchen","ord":"a1","title":"install them","after":["order"]}`,
  )

  test("the refusal names the blockers in words, and nothing is written", () => {
    const failure = refused(WAITING, { op: "doing", id: "install" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`install them`")
    expect(failure.message).toContain("`order the cabinets`")
    expect(failure.message).toContain("`order`")
    expect(failure.message).toContain("doing")
    expect(failure.message).toContain("1 unfinished task")
    expect(failure.message).toContain("start what is ready")
  })

  test("every blocker is named, not just the first", () => {
    const two = chain(
      `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","doing":true}`,
      `{"id":"wire","parent":"kitchen","ord":"a1","title":"rewire","todo":true}`,
      `{"id":"install","parent":"kitchen","ord":"a2","title":"install them","after":["order","wire"]}`,
    )
    const message = refused(two, { op: "doing", id: "install" }).message
    expect(message).toContain("2 unfinished tasks")
    expect(message).toContain("`order the cabinets`")
    expect(message).toContain("`rewire`")
    expect(message).toContain("Finish those first")
  })

  test("a bullet with unfinished work before it is refused too", () => {
    const bullet = chain(
      `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","todo":true}`,
      `{"id":"install","parent":"kitchen","ord":"a1","title":"install them","after":["order"]}`,
    )
    expect(refused(bullet, { op: "doing", id: "install" }).message)
      .toContain("`order the cabinets`")
    expect(record(fileOf(planned(bullet, { op: "todo", id: "install" }), "house.olai"), "install")
      .todo).toBe(true)
    expect(record(fileOf(planned(bullet, { op: "done", id: "install" }), "house.olai"), "install")
      .done).toBe(STAMP)
  })

  test("a node with nothing in its way still starts", () => {
    const free = chain(
      `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets"}`,
      `{"id":"install","parent":"kitchen","ord":"a1","title":"install them","after":["order"]}`,
    )
    expect(record(fileOf(planned(free, { op: "doing", id: "order" }), "house.olai"), "order")
      .doing).toBe(true)
    const ready = chain(
      `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","done":"2026-08-01"}`,
      `{"id":"install","parent":"kitchen","ord":"a1","title":"install them","after":["order"]}`,
    )
    expect(record(fileOf(planned(ready, { op: "doing", id: "install" }), "house.olai"), "install")
      .doing).toBe(true)
  })

  test("a bullet, a done target and an archived one block nothing", () => {
    const bullet = chain(
      `{"id":"note","parent":"kitchen","ord":"a0","title":"the showroom's number"}`,
      `{"id":"install","parent":"kitchen","ord":"a1","title":"install them","after":["note"]}`,
    )
    expect(record(fileOf(planned(bullet, { op: "doing", id: "install" }), "house.olai"), "install")
      .doing).toBe(true)

    const finished = chain(
      `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","done":"2026-08-01"}`,
      `{"id":"install","parent":"kitchen","ord":"a1","title":"install them","after":["order"]}`,
    )
    expect(record(fileOf(planned(finished, { op: "doing", id: "install" }), "house.olai"), "install")
      .doing).toBe(true)

    const away = setOf({
      "house.olai": `{"id":"install","ord":"a0","title":"install them","after":["order"]}`,
      "_olai/Trash.olai": `{"id":"order","ord":"a0","title":"order the cabinets","todo":true}`,
    })
    expect(record(fileOf(planned(away, { op: "doing", id: "install" }), "house.olai"), "install")
      .doing).toBe(true)
  })

  test("`blocks` is the same edge from the other end, and refuses the same", () => {
    const sugar = chain(
      `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","todo":true,"blocks":["install"]}`,
      `{"id":"install","parent":"kitchen","ord":"a1","title":"install them"}`,
    )
    expect(refused(sugar, { op: "doing", id: "install" }).message)
      .toContain("`order the cabinets`")
  })

  test("`outlines_done` still lands on a blocked node, with its nudge unchanged", () => {
    const result = planned(WAITING, { op: "done", id: "install" })
    expect(record(fileOf(result, "house.olai"), "install").done).toBe(STAMP)
    expect(result.summary).toBe("done: install them")
    expect(result.nudge).toBeUndefined()
  })

  test("`outlines_todo` is untouched — filing work is not starting it", () => {
    expect(record(fileOf(planned(WAITING, { op: "todo", id: "install" }), "house.olai"), "install")
      .todo).toBe(true)
  })

  test("un-starting needs no gate: the undo of a blocked `doing` goes through", () => {
    const started = chain(
      `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","todo":true}`,
      `{"id":"install","parent":"kitchen","ord":"a1","title":"install them","doing":true,"after":["order"]}`,
    )
    const result = planned(started, { op: "doing", id: "install", undo: true })
    expect(record(fileOf(result, "house.olai"), "install").doing).toBeUndefined()
    expect(result.summary).toBe("not-doing: install them")
  })

  test("`outlines_after` onto an already-doing node lands: the graph is not immutable", () => {
    const started = chain(
      `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","todo":true}`,
      `{"id":"install","parent":"kitchen","ord":"a1","title":"install them","doing":true}`,
    )
    const result = planned(started, { op: "after", id: "install", add: ["order"] })
    const node = record(fileOf(result, "house.olai"), "install")
    expect(node.after).toEqual(["order"])
    expect(node.doing).toBe(true)
    expect(
      standingBefore(derive(TEST_CLAIMS, recordsOf(setOf({ "house.olai": serializeOutline(fileOf(result, "house.olai")) }))), "install")
        .map((one) => one.at.node.id),
    ).toEqual(["order"])
  })

  test("a capture cannot arrive blocked: `after` is an anchor, not an edge", () => {
    const set = chain(
      `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","todo":true}`,
    )
    const nodes = fileOf(
      planned(set, {
        op: "add",
        parent: "kitchen",
        title: "install them",
        mark: "doing",
        after: "order",
      }),
      "house.olai",
    )
    const born = record(nodes, "n1")
    expect(born.doing).toBe(true)
    expect(childOrder(nodes, "kitchen")).toEqual(["order", "n1"])
    expect(born.after).toBeUndefined()
    expect(born.blocks).toBeUndefined()
    expect(
      standingBefore(derive(TEST_CLAIMS, recordsOf(setOf({ "house.olai": serializeOutline(nodes) }))), "n1"),
    ).toEqual([])
  })

  test("the older refusals are not displaced by this one", () => {
    const already = chain(
      `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","todo":true}`,
      `{"id":"install","parent":"kitchen","ord":"a1","title":"install them","doing":true,"after":["order"]}`,
    )
    expect(refused(already, { op: "doing", id: "install" }).message).toContain("already doing")

    const finished = chain(
      `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","todo":true}`,
      `{"id":"install","parent":"kitchen","ord":"a1","title":"install them","done":"2026-08-01","after":["order"]}`,
    )
    expect(refused(finished, { op: "doing", id: "install" }).message).toContain("Undo that first")
  })
})

describe("done over open work: the claim is refused", () => {
  const trip = (...records: ReadonlyArray<string>): OutlineSet =>
    setOf({ "a.olai": [`{"id":"p","ord":"a0","title":"the trip"}`, ...records].join("\n") })

  test("the refusal names the task, in both vocabularies, and nothing is written", () => {
    const failure = refused(
      trip(
        `{"id":"c1","parent":"p","ord":"a0","title":"book the ferry","done":true}`,
        `{"id":"c2","parent":"p","ord":"a1","title":"pack","todo":true}`,
      ),
      { op: "done", id: "p" },
    )
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`the trip` holds 1 unfinished task")
    expect(failure.message).toContain("`pack` (`c2`, todo)")
    expect(failure.message).toContain("Done-hidden hides a done node WITH its subtree")
    expect(failure.message).toContain("or cancel it if it is not happening")
    expect(failure.message).toContain("take the mark off")
  })

  test("it sees the whole subtree — through a bullet, and through finished work", () => {
    const deep = trip(
      `{"id":"c1","parent":"p","ord":"a0","title":"paperwork"}`,
      `{"id":"g1","parent":"c1","ord":"a0","title":"find the tickets","todo":true}`,
      `{"id":"c2","parent":"p","ord":"a1","title":"the ferry","done":true}`,
      `{"id":"g2","parent":"c2","ord":"a0","title":"reserve a cabin","doing":true}`,
    )
    const failure = refused(deep, { op: "done", id: "p" })
    expect(failure.message).toContain("2 unfinished tasks")
    expect(failure.message).toContain("`find the tickets` (`g1`, todo)")
    expect(failure.message).toContain("`reserve a cabin` (`g2`, doing)")
  })

  test("bullets never block it, however many there are", () => {
    const notes = trip(
      `{"id":"c1","parent":"p","ord":"a0","title":"ferry times"}`,
      `{"id":"g1","parent":"c1","ord":"a0","title":"the 9:40 is cheapest"}`,
      `{"id":"c2","parent":"p","ord":"a1","title":"what to take","done":true}`,
    )
    expect(record(fileOf(planned(notes, { op: "done", id: "p" }), "a.olai"), "p").done)
      .toBe(STAMP)
  })

  test("a mirror of open work is a second view, not a second obligation", () => {
    const set = setOf({
      "a.olai": [
        `{"id":"p","ord":"a0","title":"the trip"}`,
        `{"id":"m","parent":"p","ord":"a0","mirror":"far"}`,
      ].join("\n"),
      "b.olai": [
        `{"id":"far","ord":"a0","title":"renew the passport","todo":true}`,
        `{"id":"under","parent":"far","ord":"a0","title":"find the old one","todo":true}`,
      ].join("\n"),
    })
    expect(record(fileOf(planned(set, { op: "done", id: "p" }), "a.olai"), "p").done)
      .toBe(STAMP)
  })

  test("a cancelled child settles, so the parent's `done` is not refused", () => {
    const set = trip(
      `{"id":"c1","parent":"p","ord":"a0","title":"book the ferry","done":true}`,
      `{"id":"c2","parent":"p","ord":"a1","title":"pack the tent","cancelled":"2026-08-25"}`,
      `{"id":"c3","parent":"p","ord":"a2","title":"a note about ferries"}`,
    )
    expect(record(fileOf(planned(set, { op: "done", id: "p" }), "a.olai"), "p").done)
      .toBe(STAMP)

    const deep = trip(
      `{"id":"c1","parent":"p","ord":"a0","title":"the tent","cancelled":true}`,
      `{"id":"g1","parent":"c1","ord":"a0","title":"find the poles","todo":true}`,
    )
    const failure = refused(deep, { op: "done", id: "p" })
    expect(failure.message).toContain("1 unfinished task")
    expect(failure.message).toContain("`find the poles` (`g1`, todo)")
  })

  test("the archive is exempt", () => {
    const set = setOf({
      "_olai/Trash.olai": [
        `{"id":"old","ord":"a0","title":"last year's trip"}`,
        `{"id":"leg","parent":"old","ord":"a0","title":"the leg nobody did","todo":true}`,
      ].join("\n"),
    })
    expect(record(fileOf(planned(set, { op: "done", id: "old" }), "_olai/Trash.olai"), "old").done)
      .toBe(STAMP)
  })

  test("an undo is never refused, and neither is a mark that is not `done`", () => {
    const open = trip(
      `{"id":"c1","parent":"p","ord":"a0","title":"pack","todo":true}`,
    )
    const finished = trip(
      `{"id":"c1","parent":"p","ord":"a0","title":"pack","todo":true}`,
      `{"id":"c2","parent":"p","ord":"a1","title":"the trip itself","done":true}`,
    )
    expect(planned(open, { op: "todo", id: "p" }).summary).toBe("todo: the trip")
    expect(record(
      fileOf(planned(finished, { op: "done", id: "c2", undo: true }), "a.olai"),
      "c2",
    ).done).toBeUndefined()
  })

  test("the naming is capped, and says how many it did not name", () => {
    const many = trip(
      ...Array.from(
        { length: 8 },
        (_, at) => `{"id":"c${at}","parent":"p","ord":"a${at}","title":"leg ${at}","todo":true}`,
      ),
    )
    const failure = refused(many, { op: "done", id: "p" })
    expect(failure.message).toContain("8 unfinished tasks")
    expect(failure.message).toContain("`leg 4`")
    expect(failure.message).toContain("and 3 more")
    expect(failure.message).not.toContain("`leg 5`")
  })

  test("a capture cannot be born done over a task born under it", () => {
    const failure = refused(house(), {
      op: "add",
      title: "the ferry",
      parent: "kitchen",
      mark: "done",
      children: [
        { title: "book it", mark: "todo" },
        { title: "the 9:40 is cheapest" },
      ],
    })
    expect(failure.message).toContain("captured done over 1 unfinished task")
    expect(failure.message).toContain("`book it`")
    expect(failure.message).not.toContain("9:40")
    expect(failure.message).toContain("Nothing was written")
  })

  test("a capture deeper than the schema's floor is refused, not walked", () => {
    const tooDeep = {
      op: "add",
      title: "one",
      parent: "kitchen",
      mark: "done",
      children: [{
        title: "two",
        children: [{
          title: "three",
          children: [{
            title: "four",
            children: [null],
          }],
        }],
      }],
    } as unknown as Request
    expect(refused(house(), tooDeep).message).toContain("nests at most 3 levels")
  })

  test("a seeded outline cannot be born done over its own open work either", () => {
    const failure = refused(house(), {
      op: "create",
      file: "trip.olai",
      seed: {
        title: "the trip",
        mark: "done",
        children: [{ title: "book the ferry", mark: "todo" }],
      },
    })
    expect(failure.message).toContain("captured done over 1 unfinished task")
    expect(failure.message).toContain("`book the ferry`")
  })

  test("a capture born done over bullets and finished work lands", () => {
    const result = planned(house(), {
      op: "add",
      title: "the ferry",
      parent: "kitchen",
      mark: "done",
      children: [
        { title: "book it", mark: "done" },
        { title: "the 9:40 is cheapest" },
      ],
    })
    expect(record(fileOf(result, "house.olai"), "n1").done).toBe(STAMP)
  })
})

describe("done over open work: the arrival re-opens what stood over it", () => {
  const shut = (...records: ReadonlyArray<string>): OutlineSet =>
    setOf({
      "a.olai": [
        `{"id":"house","ord":"a0","title":"the house","done":"2026-08-01"}`,
        `{"id":"attic","parent":"house","ord":"a0","title":"the attic","done":"2026-08-02"}`,
        ...records,
      ].join("\n"),
    })

  test("`outlines_todo` under a done ancestor takes the mark off it, and says so", () => {
    const set = shut(`{"id":"leak","parent":"attic","ord":"a0","title":"the leak"}`)
    const result = planned(set, { op: "todo", id: "leak" })
    const nodes = fileOf(result, "a.olai")

    expect(record(nodes, "leak").todo).toBe(true)
    expect(record(nodes, "attic").done).toBeUndefined()
    expect(record(nodes, "house").done).toBeUndefined()
    expect(record(nodes, "attic").changed).toBe(STAMP)
    expect(result.nudge).toContain("`the house`, `the attic` were marked done")
    expect(result.nudge).toContain("those marks are off now")
    expect(result.summary).toBe("todo: the leak (reopened: the house, the attic)")
  })

  test("`outlines_doing` arrives the same way, and an undo never does", () => {
    const set = shut(`{"id":"leak","parent":"attic","ord":"a0","title":"the leak","todo":true}`)
    expect(record(fileOf(planned(set, { op: "doing", id: "leak" }), "a.olai"), "attic").done)
      .toBeUndefined()
    expect(record(fileOf(planned(set, { op: "todo", id: "leak", undo: true }), "a.olai"), "attic")
      .done).toBe("2026-08-02")
  })

  test("finishing work under a done ancestor changes nothing above it", () => {
    const set = shut(`{"id":"leak","parent":"attic","ord":"a0","title":"the leak","todo":true}`)
    const nodes = fileOf(planned(set, { op: "done", id: "leak" }), "a.olai")
    expect(record(nodes, "leak").done).toBe(STAMP)
    expect(record(nodes, "attic").done).toBe("2026-08-02")
  })

  test("only the `done` marks come off, and only in the parent chain", () => {
    const set = setOf({
      "a.olai": [
        `{"id":"house","ord":"a0","title":"the house","done":"2026-08-01"}`,
        `{"id":"floor","parent":"house","ord":"a0","title":"the top floor","doing":true}`,
        `{"id":"attic","parent":"floor","ord":"a0","title":"the attic"}`,
        `{"id":"leak","parent":"attic","ord":"a0","title":"the leak"}`,
        `{"id":"shed","ord":"a1","title":"the shed","done":"2026-08-01"}`,
      ].join("\n"),
    })
    const nodes = fileOf(planned(set, { op: "todo", id: "leak" }), "a.olai")
    expect(record(nodes, "house").done).toBeUndefined()
    expect(record(nodes, "floor").doing).toBe(true)
    expect(record(nodes, "attic").changed).toBeUndefined()
    expect(record(nodes, "shed").done).toBe("2026-08-01")
  })

  test("a capture that brings a task re-opens what it lands under", () => {
    const result = planned(shut(), {
      op: "add",
      title: "re-slate the roof",
      parent: "attic",
      mark: "todo",
    })
    const nodes = fileOf(result, "a.olai")
    expect(record(nodes, "n1").todo).toBe(true)
    expect(record(nodes, "attic").done).toBeUndefined()
    expect(result.summary).toContain("(reopened: the house, the attic)")
    expect(result.nudge).toContain("marked done")
  })

  test("a capture of bullets and finished work leaves the branch shut", () => {
    const result = planned(shut(), {
      op: "add",
      title: "what it looked like",
      parent: "attic",
      children: [{ title: "the beams are sound" }, { title: "photographed", mark: "done" }],
    })
    expect(record(fileOf(result, "a.olai"), "attic").done).toBe("2026-08-02")
    expect(result.nudge).toBeUndefined()
    expect(result.summary).toBe("capture: what it looked like (+2)")
  })

  test("a task deep in a capture counts as much as the root's own mark", () => {
    const result = planned(shut(), {
      op: "add",
      title: "the roof",
      parent: "attic",
      children: [{ title: "the slates", children: [{ title: "re-lay them", mark: "todo" }] }],
    })
    expect(record(fileOf(result, "a.olai"), "attic").done).toBeUndefined()
  })

  test("a move that lands unfinished work under a done ancestor re-opens it", () => {
    const set = shut(
      `{"id":"jobs","ord":"a1","title":"jobs"}`,
      `{"id":"roof","parent":"jobs","ord":"a0","title":"the roof"}`,
      `{"id":"slates","parent":"roof","ord":"a0","title":"re-lay the slates","todo":true}`,
    )
    const result = planned(set, { op: "move", id: "roof", parent: "attic" })
    const nodes = fileOf(result, "a.olai")
    expect(record(nodes, "roof").parent).toBe("attic")
    expect(record(nodes, "attic").done).toBeUndefined()
    expect(result.summary).toContain("(reopened:")
  })

  const untouched = (request: Request): void => {
    const set = shut(
      `{"id":"note","ord":"a1","title":"a note about the house"}`,
      `{"id":"open","ord":"a2","title":"something open","todo":true}`,
      `{"id":"first","parent":"attic","ord":"a0","title":"one","done":true}`,
      `{"id":"second","parent":"attic","ord":"a1","title":"two","done":true}`,
    )
    expect(record(fileOf(planned(set, request), "a.olai"), "attic").done).toBe("2026-08-02")
  }

  test("a move of bullets leaves it alone", () => {
    untouched({ op: "move", id: "note", parent: "attic" })
  })

  test("a reorder leaves it alone", () => {
    untouched({ op: "move", id: "second", before: "first" })
  })

  test("a placement of open work leaves it alone", () => {
    untouched({ op: "mirror", target: "open", parent: "attic" })
  })

  test("a merge that hands unfinished rows to a finished sibling re-opens it", () => {
    const set = setOf({
      "a.olai": [
        `{"id":"p","ord":"a0","title":"the trip"}`,
        `{"id":"one","parent":"p","ord":"a0","title":"the ferry","done":"2026-08-01"}`,
        `{"id":"two","parent":"p","ord":"a1","title":"the hotel"}`,
        `{"id":"under","parent":"two","ord":"a0","title":"book it","todo":true}`,
      ].join("\n"),
    })
    const result = planned(set, { op: "merge", id: "two" })
    const nodes = fileOf(result, "a.olai")
    expect(record(nodes, "under").parent).toBe("one")
    expect(record(nodes, "one").done).toBeUndefined()
    expect(result.nudge).toContain("`the ferry` was marked done")
    expect(result.summary).toBe("merge: the ferrythe hotel (reopened: the ferry)")
  })

  test("a merge of bullets and finished rows leaves the sibling shut", () => {
    const set = setOf({
      "a.olai": [
        `{"id":"p","ord":"a0","title":"the trip"}`,
        `{"id":"one","parent":"p","ord":"a0","title":"the ferry","done":"2026-08-01"}`,
        `{"id":"two","parent":"p","ord":"a1","title":"the hotel"}`,
        `{"id":"under","parent":"two","ord":"a0","title":"which one it was"}`,
      ].join("\n"),
    })
    const nodes = fileOf(planned(set, { op: "merge", id: "two" }), "a.olai")
    expect(record(nodes, "one").done).toBe("2026-08-01")
  })

  test("work coming back out of the archive re-opens what it comes back under", () => {
    const set = setOf({
      "a.olai": [
        `{"id":"house","ord":"a0","title":"the house","done":"2026-08-01"}`,
        `{"id":"attic","parent":"house","ord":"a0","title":"the attic","done":"2026-08-02"}`,
      ].join("\n"),
      "_olai/Trash.olai": [
        `{"id":"roof","ord":"a0","title":"the roof"}`,
        `{"id":"slates","parent":"roof","ord":"a0","title":"re-lay the slates","todo":true}`,
      ].join("\n"),
    })
    const result = planned(set, { op: "untrash", id: "roof", parent: "attic" })
    const nodes = fileOf(result, "a.olai")
    expect(record(nodes, "roof").parent).toBe("attic")
    expect(record(nodes, "attic").done).toBeUndefined()
    expect(result.summary).toContain("(reopened:")
  })

  test("a contradiction born in the archive is re-opened on the way back out", () => {
    const start = setOf({
      "a.olai": [
        `{"id":"jobs","ord":"a0","title":"jobs"}`,
        `{"id":"roof","parent":"jobs","ord":"a0","title":"the roof"}`,
        `{"id":"slates","parent":"roof","ord":"a0","title":"re-lay the slates","todo":true}`,
      ].join("\n"),
    })
    const away = after(start, { op: "trash", id: "roof" })
    expect(record(fileOf(planned(away, { op: "done", id: "roof" }), "_olai/Trash.olai"), "roof").done)
      .toBe(STAMP)
    const shut = after(away, { op: "done", id: "roof" })

    const result = planned(shut, { op: "untrash", id: "roof", parent: "jobs" })
    const nodes = fileOf(result, "a.olai")
    expect(record(nodes, "roof").parent).toBe("jobs")
    expect(record(nodes, "roof").done).toBeUndefined()
    expect(record(nodes, "roof").changed).toBe(STAMP)
    expect(record(nodes, "slates").todo).toBe(true)
    expect(result.nudge).toContain("`the roof` was marked done over work that is not finished")
    expect(result.summary).toBe("untrash: the roof (reopened: the roof)")
  })

  test("every done mark inside the restored subtree that hides work comes off", () => {
    const set = setOf({
      "a.olai": `{"id":"jobs","ord":"a0","title":"jobs"}`,
      "_olai/Trash.olai": [
        `{"id":"roof","ord":"a0","title":"the roof","done":"2026-08-01"}`,
        `{"id":"slates","parent":"roof","ord":"a0","title":"the slates","done":"2026-08-02"}`,
        `{"id":"lay","parent":"slates","ord":"a0","title":"re-lay them","todo":true}`,
        `{"id":"gutter","parent":"roof","ord":"a1","title":"the gutter","done":"2026-08-03"}`,
        `{"id":"note","parent":"gutter","ord":"a0","title":"cast iron, not plastic"}`,
      ].join("\n"),
    })
    const result = planned(set, { op: "untrash", id: "roof", parent: "jobs" })
    const nodes = fileOf(result, "a.olai")
    expect(record(nodes, "roof").done).toBeUndefined()
    expect(record(nodes, "slates").done).toBeUndefined()
    expect(record(nodes, "gutter").done).toBe("2026-08-03")
    expect(result.summary).toBe("untrash: the roof (reopened: the roof, the slates)")
  })

  test("the chain above and the marks inside are re-opened by one write", () => {
    const set = setOf({
      "a.olai": [
        `{"id":"house","ord":"a0","title":"the house","done":"2026-08-01"}`,
        `{"id":"attic","parent":"house","ord":"a0","title":"the attic","done":"2026-08-02"}`,
      ].join("\n"),
      "_olai/Trash.olai": [
        `{"id":"roof","ord":"a0","title":"the roof","done":"2026-08-03"}`,
        `{"id":"slates","parent":"roof","ord":"a0","title":"re-lay the slates","todo":true}`,
      ].join("\n"),
    })
    const result = planned(set, { op: "untrash", id: "roof", parent: "attic" })
    const nodes = fileOf(result, "a.olai")
    expect(record(nodes, "house").done).toBeUndefined()
    expect(record(nodes, "attic").done).toBeUndefined()
    expect(record(nodes, "roof").done).toBeUndefined()
    expect(result.summary)
      .toBe("untrash: the roof (reopened: the house, the attic, the roof)")
  })

  test("a restored subtree with nothing to contradict keeps every mark", () => {
    const set = setOf({
      "a.olai": `{"id":"jobs","ord":"a0","title":"jobs"}`,
      "_olai/Trash.olai": [
        `{"id":"roof","ord":"a0","title":"the roof","done":"2026-08-01"}`,
        `{"id":"slates","parent":"roof","ord":"a0","title":"the slates","done":"2026-08-02"}`,
      ].join("\n"),
    })
    const result = planned(set, { op: "untrash", id: "roof", parent: "jobs" })
    const nodes = fileOf(result, "a.olai")
    expect(record(nodes, "roof").done).toBe("2026-08-01")
    expect(record(nodes, "slates").done).toBe("2026-08-02")
    expect(record(nodes, "roof").changed).toBeUndefined()
    expect(result.nudge).toBeUndefined()
    expect(result.summary).toBe("untrash: the roof")
  })

  test("nothing is re-opened inside an archive", () => {
    const set = setOf({
      "_olai/Trash.olai": [
        `{"id":"old","ord":"a0","title":"last year","done":"2026-01-01"}`,
        `{"id":"leg","parent":"old","ord":"a0","title":"the leg nobody did"}`,
      ].join("\n"),
    })
    const nodes = fileOf(planned(set, { op: "todo", id: "leg" }), "_olai/Trash.olai")
    expect(record(nodes, "leg").todo).toBe(true)
    expect(record(nodes, "old").done).toBe("2026-01-01")
  })
})

describe("title, note and date", () => {
  test("a retitle keeps everything else", () => {
    const result = planned(house(), { op: "title", id: "order", title: "order cabinets" })
    expect(record(fileOf(result, "house.olai"), "order")).toEqual({
      id: "order",
      parent: "kitchen",
      ord: "a1",
      title: "order cabinets",
      changed: STAMP,
    })
    expect(result.summary).toBe("rename: order cabinets")
  })

  test("a note is set and removed; `null` means there is no key at all", () => {
    const written = planned(house(), { op: "desc", id: "order", desc: "measure first" })
    expect(record(fileOf(written, "house.olai"), "order").desc).toBe("measure first")

    const cleared = planned(setOf({
      "a.olai": `{"id":"x","ord":"a0","title":"x","desc":"gone"}`,
    }), { op: "desc", id: "x", desc: null })
    expect("desc" in record(fileOf(cleared, "a.olai"), "x")).toBe(false)
  })

  test("a conditional retitle writes while the title still says what it expected", () => {
    const result = planned(house(), {
      op: "title",
      id: "order",
      title: "order cabinets",
      was: "order the cabinets",
    })
    expect(record(fileOf(result, "house.olai"), "order").title).toBe("order cabinets")
  })

  test("and is refused, naming what is there, when somebody else wrote first", () => {
    const moved = setOf({
      "house.olai": KITCHEN.replace(
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
    expect(
      record(
        fileOf(
          planned(house(), { op: "desc", id: "order", desc: "measure first", was: null }),
          "house.olai",
        ),
        "order",
      ).desc,
    ).toBe("measure first")

    const noted = setOf({ "a.olai": `{"id":"x","ord":"a0","title":"x","desc":"theirs"}` })
    expect(refused(noted, { op: "desc", id: "x", desc: "mine", was: null }).message)
      .toContain("has changed since")
  })

  test("no condition at all is last-one-wins, which is what typing means", () => {
    const moved = setOf({
      "house.olai": KITCHEN.replace(
        `"title":"order the cabinets"`,
        `"title":"order the walnut ones"`,
      ),
    })
    expect(
      record(
        fileOf(planned(moved, { op: "title", id: "order", title: "mine" }), "house.olai"),
        "order",
      ).title,
    ).toBe("mine")
  })

  test("a date says it is a date, cleared included", () => {
    expect(planned(house(), { op: "date", id: "order", date: "2026-08-10" }).summary).toBe(
      "date: order the cabinets -> 2026-08-10",
    )
    expect(planned(house(), { op: "date", id: "order", date: null }).summary).toBe(
      "date: order the cabinets -> (cleared)",
    )
  })
})

describe("repeat", () => {
  const CHORES = [
    `{"id":"chores","ord":"a0","title":"Chores"}`,
    `{"id":"bins","parent":"chores","ord":"a0","title":"put the bins out",` +
      `"todo":true,"date":"2026-08-17","repeat":"every week on monday","desc":"blue one"}`,
    `{"id":"floor","parent":"chores","ord":"a1","title":"mop the floor","todo":true}`,
  ].join("\n")

  const chores = (): OutlineSet => setOf({ "chores.olai": CHORES })

  const spawnedBy = (result: Plan): RegularNode => {
    const made = result.captured?.[0]
    if (made === undefined) throw new Error("the plan captured nothing")
    return record(fileOf(result, "chores.olai"), made.id)
  }

  test("a rule is set and cleared like the date it repeats from", () => {
    const set = planned(chores(), { op: "repeat", id: "bins", repeat: "every month" })
    expect(record(fileOf(set, "chores.olai"), "bins").repeat).toBe("every month")
    expect(set.summary).toBe("repeat: put the bins out -> every month")

    const cleared = planned(chores(), { op: "repeat", id: "bins", repeat: null })
    expect("repeat" in record(fileOf(cleared, "chores.olai"), "bins")).toBe(false)
    expect(cleared.summary).toBe("repeat: put the bins out -> (cleared)")
  })

  test("a rule is stored in the grammar's own spelling, however it was typed", () => {
    for (const typed of ["every monday", "every week on MON", "  Every   Monday "]) {
      expect(
        record(
          fileOf(planned(chores(), { op: "repeat", id: "bins", repeat: typed }), "chores.olai"),
          "bins",
        ).repeat,
      ).toBe("every week on monday")
    }
  })

  test("text the grammar cannot read is written back verbatim, and refused as sent", () => {
    expect(() => after(chores(), { op: "repeat", id: "bins", repeat: "every 2 weeks" }))
      .toThrow("`every 2 weeks`")
  })

  test("a rule the grammar does not have writes bytes the gate will not take", () => {
    expect(() => after(chores(), { op: "repeat", id: "bins", repeat: "every 2 weeks" }))
      .toThrow("every week on <weekday>")
  })

  test("a rule over a node with no date is refused, naming the field it needs", () => {
    expect(() => after(house(), { op: "repeat", id: "order", repeat: "every month" }))
      .toThrow("no `date` to repeat from")
  })

  test("completing a repeating node stamps it AND makes the next occurrence", () => {
    const result = planned(chores(), { op: "done", id: "bins" })
    const nodes = fileOf(result, "chores.olai")

    const finished = record(nodes, "bins")
    expect(finished.done).toBe(STAMP)
    expect(finished.date).toBe("2026-08-17")

    expect("repeat" in finished).toBe(false)

    const next = spawnedBy(result)
    expect(next.title).toBe("put the bins out")
    expect(next.date).toBe("2026-08-24")
    expect(next.repeat).toBe("every week on monday")
    expect(next.desc).toBe("blue one")
    expect(next.todo).toBe(true)
    expect("done" in next).toBe(false)
    expect(next.created).toBe(STAMP)
    expect(next.parent).toBe("chores")
    expect(childOrder(nodes, "chores")).toEqual(["bins", next.id, "floor"])
  })

  test("the answer names the occurrence it made, and says which day it is on", () => {
    const result = planned(chores(), { op: "done", id: "bins" })
    expect(result.captured).toEqual([
      { id: spawnedBy(result).id, title: "put the bins out" },
    ])
    expect(result.nudge).toContain("2026-08-24")
    expect(result.summary).toContain("(next: 2026-08-24)")
  })

  test("un-doing leaves the occurrence, and re-doing makes no second one", () => {
    const once = after(chores(), { op: "done", id: "bins" })
    const undone = after(once, { op: "done", id: "bins", undo: true })
    expect(nodesOf(derive(TEST_CLAIMS, recordsOf(undone)), "chores.olai").length).toBe(4)

    const again = planned(undone, { op: "done", id: "bins" })
    expect(again.captured).toBeUndefined()
    expect(again.summary).toBe("done: put the bins out")
    expect(nodesOf(derive(TEST_CLAIMS, recordsOf(after(undone, { op: "done", id: "bins" }))), "chores.olai").length)
      .toBe(4)
  })

  test("a dated node with no rule is completed exactly as it always was", () => {
    const result = planned(chores(), { op: "done", id: "floor" })
    expect(result.captured).toBeUndefined()
    expect(fileOf(result, "chores.olai").length).toBe(3)
  })

  test("the occurrence re-opens a finished ancestor, and the answer says so", () => {
    const set = setOf({
      "chores.olai": CHORES
        .replace(`{"id":"chores","ord":"a0","title":"Chores"}`, `{"id":"chores","ord":"a0","title":"Chores","done":"2026-08-01"}`)
        .replace(`"title":"mop the floor","todo":true`, `"title":"mop the floor"`),
    })
    const result = planned(set, { op: "done", id: "bins" })
    expect("done" in record(fileOf(result, "chores.olai"), "chores")).toBe(false)
    expect(result.summary).toContain("reopened: Chores")
    expect(result.nudge).toContain("marked done over work that is not finished")
    expect(result.nudge).toContain("2026-08-24")
  })

  test("no nudge claims the parent is finished when this write just filled it", () => {
    const set = setOf({
      "chores.olai": CHORES.replace(`"title":"mop the floor","todo":true`, `"title":"mop the floor"`),
    })
    const result = planned(set, { op: "done", id: "bins" })
    expect(result.nudge).not.toContain("mark it done too")
    expect(result.nudge).toContain("2026-08-24")
  })

  test("a set holding an unreadable rule does not parse, so no plan ever sees one", () => {
    expect(() =>
      setOf({ "chores.olai": CHORES.replace(`"every week on monday"`, `"every 2 weeks"`) })
    ).toThrow("bad-repeat")
  })

  test("clearing the date out from under a rule writes bytes the gate will not take", () => {
    expect(() => after(chores(), { op: "date", id: "bins", date: null }))
      .toThrow("no `date` to repeat from")
    expect(record(
      fileOf(planned(chores(), { op: "date", id: "bins", date: "2026-08-31" }), "chores.olai"),
      "bins",
    ).date).toBe("2026-08-31")
  })

  test("`update` can stop a recurrence and clear the date in one call", () => {
    const result = planned(chores(), { op: "update", id: "bins", date: null, repeat: null })
    const written = record(fileOf(result, "chores.olai"), "bins")
    expect("date" in written).toBe(false)
    expect("repeat" in written).toBe(false)
  })

  test("`update` writes the date and the rule in one call, in that order", () => {
    const result = planned(house(), {
      op: "update",
      id: "order",
      date: "2026-08-17",
      repeat: "every month",
    })
    const written = record(fileOf(result, "house.olai"), "order")
    expect(written.date).toBe("2026-08-17")
    expect(written.repeat).toBe("every month")
    expect(result.summary).toContain("date, repeat")
  })
})

describe("prop", () => {
  const customOf = (set: OutlineSet, request: Request): Record<string, unknown> => ({
    ...record(fileOf(planned(set, request), "house.olai"), "order").custom,
  })

  test("a key goes into `custom`, holding whatever it was given", () => {
    expect(customOf(house(), { op: "prop", id: "order", key: "pr", value: "https://x/1" }))
      .toEqual({ pr: "https://x/1" })
    expect(planned(house(), { op: "prop", id: "order", key: "pr", value: "https://x/1" }).summary)
      .toBe("prop: order the cabinets -> pr=https://x/1")
  })

  test("`null` removes it, and so does the empty string", () => {
    const carrying = setOf({
      "house.olai": KITCHEN.replace(
        `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
        `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets",` +
          `"custom":{"pr":"https://x/1","agent":"claude-opus"}}`,
      ),
    })
    expect(customOf(carrying, { op: "prop", id: "order", key: "pr", value: null }))
      .toEqual({ agent: "claude-opus" })
    expect(customOf(carrying, { op: "prop", id: "order", key: "pr", value: "" }))
      .toEqual({ agent: "claude-opus" })
    expect(planned(carrying, { op: "prop", id: "order", key: "pr", value: null }).summary)
      .toBe("prop: order the cabinets -> pr (cleared)")
  })

  test("a key spelled like a field is refused, naming what writes that fact", () => {
    const fields = [
      "id",
      "parent",
      "ord",
      "title",
      "mirror",
      "done",
      "doing",
      "todo",
      "status",
      "date",
      "desc",
      "after",
      "blocks",
      "see",
      "created",
      "changed",
      "custom",
    ]
    for (const key of fields) {
      const failure = refused(house(), { op: "prop", id: "order", key, value: "x" })
      expect({ key, tag: failure._tag }).toEqual({ key, tag: "UsageFailure" })
      expect({ key, named: failure.message.includes(`\`${key}\``) })
        .toEqual({ key, named: true })
    }
    expect(refused(house(), { op: "prop", id: "order", key: "Done", value: "x" })._tag)
      .toBe("UsageFailure")
  })

  test("the bank is fenced off toward the settles that count it", () => {
    const failure = refused(house(), { op: "prop", id: "order", key: "worked", value: "600" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`worked`")
    expect(failure.message).toContain("`outlines_done`")
    expect(failure.message).toContain("`outlines_cancelled`")
  })

  test("the refusal does not call `status` a field, because it is not one", () => {
    const status = refused(house(), { op: "prop", id: "order", key: "status", value: "done" })
    expect(status.message).not.toContain("with a field of its own")
    expect(status.message).toContain("`status` is what a node's own fields already answer")
    expect(status.message).toContain("`outlines_done`")
    expect(refused(house(), { op: "prop", id: "order", key: "date", value: "x" }).message)
      .toContain("with a field of its own")
  })

  test("setting a property to what it already holds is refused", () => {
    const carrying = setOf({
      "house.olai": KITCHEN.replace(
        `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
        `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets",` +
          `"custom":{"pr":"https://x/1"}}`,
      ),
    })
    const failure = refused(carrying, {
      op: "prop",
      id: "order",
      key: "pr",
      value: "https://x/1",
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("nothing would change")
    expect(failure.message).toContain("`pr`")
  })

  test("removing a property that is not there is refused", () => {
    const failure = refused(house(), { op: "prop", id: "order", key: "stage", value: null })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("carries no `stage`")
  })

  test("a value that DIFFERS is not refused, however similar", () => {
    const carrying = setOf({
      "house.olai": KITCHEN.replace(
        `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
        `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets",` +
          `"custom":{"pr":"https://x/1","tags":["a","b"]}}`,
      ),
    })
    expect(customOf(carrying, { op: "prop", id: "order", key: "pr", value: "https://x/2" }))
      .toMatchObject({ pr: "https://x/2" })
    expect(customOf(carrying, { op: "prop", id: "order", key: "tags", value: "a" }))
      .toMatchObject({ tags: "a" })
  })

  test("a key that is nothing but space is not a key", () => {
    expect(refused(house(), { op: "prop", id: "order", key: "  ", value: "x" }).message)
      .toBe("a property needs a key")
  })

  test("a key is trimmed, and otherwise spelled however it was typed", () => {
    expect(customOf(house(), { op: "prop", id: "order", key: " Due-Owner ", value: "@rahul" }))
      .toEqual({ "Due-Owner": "@rahul" })
  })

  const staged = (custom: string): OutlineSet =>
    setOf({
      "house.olai": KITCHEN.replace(
        `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
        `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets",${custom}}`,
      ),
    })

  test("a conditional prop write lands while the key still says what it expected", () => {
    expect(
      customOf(staged(`"custom":{"stage":"review"}`), {
        op: "prop",
        id: "order",
        key: "stage",
        value: "submitted",
        was: "review",
      }),
    ).toEqual({ stage: "submitted" })
  })

  test("and is refused, naming what is there, when somebody else wrote first", () => {
    const failure = refused(staged(`"custom":{"stage":"audit"}`), {
      op: "prop",
      id: "order",
      key: "stage",
      value: "submitted",
      was: "review",
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`review`")
    expect(failure.message).toContain("`audit`")
    expect(failure.message).toContain("so nothing was written")
  })

  test("`null` expects the key GONE — which is what an add is", () => {
    expect(
      customOf(house(), { op: "prop", id: "order", key: "stage", value: "review", was: null }),
    ).toEqual({ stage: "review" })
    const failure = refused(staged(`"custom":{"stage":"review"}`), {
      op: "prop",
      id: "order",
      key: "stage",
      value: "submitted",
      was: null,
    })
    expect(failure.message).toContain(
      "had no `stage` when this write was readied, and it now says `review` — " +
        "it has been written since, so nothing was written",
    )
  })

  test("a condition on a key that is GONE refuses, saying that — never 'nothing would change'", () => {
    const failure = refused(house(), {
      op: "prop",
      id: "order",
      key: "stage",
      value: "submitted",
      was: "review",
    })
    expect(failure.message).toContain(
      "expected to replace (`review`) — the key is gone, so nothing was written",
    )
  })

  test("no condition at all is last-one-wins, unchanged — which is what typing means", () => {
    expect(
      customOf(staged(`"custom":{"stage":"review"}`), {
        op: "prop",
        id: "order",
        key: "stage",
        value: "submitted",
      }),
    ).toEqual({ stage: "submitted" })
  })

  const declaring = (custom: string): OutlineSet =>
    setOf({
      "_olai/Properties.olai":
        `{"id":"prop-dispatched","ord":"a0","title":"dispatched","custom":{"type":"date"}}`,
      "house.olai": KITCHEN.replace(
        `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
        `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets",${custom}}`,
      ),
    })

  test("the condition refuses before the typed gate spends its work — one refusal per gesture", () => {
    const failure = refused(declaring(`"custom":{"dispatched":"2026-08-21"}`), {
      op: "prop",
      id: "order",
      key: "dispatched",
      value: "next thursdayish",
      was: "2026-08-20",
    })
    expect(failure.message)
      .toContain("expected to replace (`2026-08-20`) — it now says `2026-08-21`")
  })

  test("a LIST's condition compares as the members joined — the wire's `was` has no other shape", () => {
    expect(
      customOf(staged(`"custom":{"reviewers":["pi","grok"]}`), {
        op: "prop",
        id: "order",
        key: "reviewers",
        value: null,
        was: "pi, grok",
      }),
    ).toEqual({})
    const failure = refused(staged(`"custom":{"reviewers":["pi","grok"]}`), {
      op: "prop",
      id: "order",
      key: "reviewers",
      value: null,
      was: "pi",
    })
    expect(failure.message).toContain("expected to replace (`pi`) — it now says `pi, grok`")
  })

  test("a typed key's condition compares as the value the gate STORES", () => {
    expect(
      customOf(declaring(`"custom":{"dispatched":"2026-08-22"}`), {
        op: "prop",
        id: "order",
        key: "dispatched",
        value: "2026-08-23",
        was: "2026-8-22",
      }),
    ).toEqual({ dispatched: "2026-08-23" })
    const failure = refused(declaring(`"custom":{"dispatched":"2026-08-22"}`), {
      op: "prop",
      id: "order",
      key: "dispatched",
      value: "2026-08-24",
      was: "2026-8-23",
    })
    expect(failure.message).toContain("it now says `2026-08-22`")
  })
})

describe("stamps", () => {
  const stampsOf = (set: OutlineSet, request: Request, id = "order") => {
    const node = record(fileOf(planned(set, request), "house.olai"), id)
    return { created: node.created, changed: node.changed }
  }

  test("a capture is created and not changed", () => {
    const captured = record(
      fileOf(planned(house(), { op: "add", file: "house.olai", title: "a new one" }), "house.olai"),
      "n1",
    )
    expect({ created: captured.created, changed: captured.changed })
      .toEqual({ created: STAMP, changed: undefined })
  })

  test("every write that rewrites a node stamps `changed`", () => {
    const writes: ReadonlyArray<Request> = [
      { op: "title", id: "order", title: "order the walnut ones" },
      { op: "desc", id: "order", desc: "measure first" },
      { op: "date", id: "order", date: "2026-08-10" },
      { op: "prop", id: "order", key: "pr", value: "https://x/1" },
      { op: "doing", id: "order" },
      { op: "see", id: "order", add: ["demo"] },
      { op: "after", id: "order", add: ["demo"] },
      { op: "move", id: "order", before: "demo" },
    ]
    for (const request of writes) {
      expect({ op: request.op, ...stampsOf(house(), request) })
        .toEqual({ op: request.op, created: undefined, changed: STAMP })
    }
  })

  test("a write does not invent a `created` for a node that had none", () => {
    expect(stampsOf(house(), { op: "title", id: "order", title: "x" }).created)
      .toBeUndefined()
  })

  test("archiving stamps nothing, because archiving is not writing", () => {
    const archived = planned(house(), { op: "trash", id: "order" })
    const moved = archived.files.flatMap((one) => one.nodes).find((one) => one.id === "order")
    expect(moved).toBeDefined()
    expect((moved as RegularNode).changed).toBeUndefined()
  })
})

describe("move", () => {
  test("reorders within a parent", () => {
    const nodes = fileOf(
      planned(house(), { op: "move", id: "install", before: "order" }),
      "house.olai",
    )
    expect(childOrder(nodes, "kitchen")).toEqual(["demo", "install", "order"])
  })

  test("reparents, appending under the new parent", () => {
    const nodes = fileOf(
      planned(house(), { op: "move", id: "order", parent: "loose" }),
      "house.olai",
    )
    expect(childOrder(nodes, "kitchen")).toEqual(["demo", "install"])
    expect(childOrder(nodes, "loose")).toEqual(["order"])
  })

  test("`parent: null` lifts a node to top level", () => {
    const nodes = fileOf(
      planned(house(), { op: "move", id: "order", parent: null }),
      "house.olai",
    )
    expect(record(nodes, "order").parent).toBeUndefined()
  })

  test("a parent in another file is a MOVE now, not a refusal", () => {
    const set = setOf({
      "a.olai": `{"id":"x","ord":"a0","title":"x"}`,
      "b.olai": `{"id":"y","ord":"a0","title":"y"}`,
    })
    const result = planned(set, { op: "move", id: "x", parent: "y" })
    expect(fileOf(result, "a.olai")).toEqual([])
    expect(record(fileOf(result, "b.olai"), "x").parent).toBe("y")
  })

  test("moving a node under its own descendant is refused before the validator sees it", () => {
    const failure = refused(house(), { op: "move", id: "kitchen", parent: "order" })
    expect(failure.message).toContain("loop")
    expect(failure.message).toContain("`order` → `kitchen`")
  })

  test("moving a branch under what a PLACEMENT inside it shows is refused too", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"now","ord":"a0","title":"Now"}`,
        `{"id":"now-install","parent":"now","ord":"a0","mirror":"install"}`,
        `{"id":"kitchen","ord":"a1","title":"kitchen"}`,
        `{"id":"install","parent":"kitchen","ord":"a0","title":"install them"}`,
        `{"id":"handles","parent":"install","ord":"a0","title":"the handles"}`,
      ].join("\n"),
    })
    const failure = refused(set, { op: "move", id: "now", parent: "install" })
    expect(failure.message).toContain("`now` → `now-install` → `install`")
    expect(failure.message).toContain("never ends")
    expect(refused(set, { op: "move", id: "now", parent: "handles" }).message)
      .toContain("`now` → `now-install` → `install` → `handles`")
    expect(record(fileOf(planned(set, { op: "move", id: "now", parent: "kitchen" }), "house.olai"), "now").parent)
      .toBe("kitchen")
  })

  test("a MIRROR moved under what it shows is refused by the same walk", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"kitchen"}`,
        `{"id":"install","parent":"kitchen","ord":"a0","title":"install them"}`,
        `{"id":"echo","parent":"kitchen","ord":"a1","mirror":"install"}`,
      ].join("\n"),
    })
    expect(refused(set, { op: "move", id: "echo", parent: "install" }).message)
      .toContain("`echo` → `install`")
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


const OWNER = `{"id":"prop-owner","ord":"a0","title":"owner","custom":{"type":"node"}}`

const PINS = [
  `{"id":"pin-bare","ord":"a0","title":"/#install"}`,
  `{"id":"pin-qualified","ord":"a1","title":"/house.olai#install"}`,
].join("\n")

const crossing = (): OutlineSet =>
  setOf({
    "_olai/Properties.olai": OWNER,
    "_olai/Pins.olai": PINS,
    "house.olai": [
      `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
      `{"id":"install","parent":"kitchen","ord":"a0","title":"install the cabinets"}`,
      `{"id":"handles","parent":"install","ord":"a0","title":"choose the handles","todo":true}`,
      `{"id":"knobs","parent":"install","ord":"a1","title":"pick the knobs","todo":true,"date":"2026-08-20"}`,
      `{"id":"demo","parent":"kitchen","ord":"a1","title":"take out the old counters"}`,
    ].join("\n"),
    "garden.olai": [
      `{"id":"garden","ord":"a0","title":"the garden"}`,
      `{"id":"beds","parent":"garden","ord":"a0","title":"the raised beds","see":["install"],"after":["knobs"]}`,
      `{"id":"paths","parent":"garden","ord":"a1","title":"the paths","todo":true,"blocks":["handles"],"custom":{"owner":"install"}}`,
      `{"id":"garden-install","parent":"garden","ord":"a2","mirror":"install"}`,
    ].join("\n"),
  })

const namersOf = (set: OutlineSet, id: string): ReadonlyArray<string> =>
  (derive(TEST_CLAIMS, recordsOf(set)).namedBy.get(id) ?? [])
    .flatMap((naming) => naming.fields.map((field) => `${naming.at.node.id}.${field}`))
    .slice()
    .sort()

const SUBTREE = ["install", "handles", "knobs"] as const

describe("move across outlines", () => {
  test("a parent in another outline carries the subtree there, ids intact", () => {
    const result = planned(crossing(), { op: "move", id: "install", parent: "garden" })
    expect(result.files.map((one) => one.file).slice().sort())
      .toEqual(["garden.olai", "house.olai"])
    expect(result.file).toBe("garden.olai")
    expect(result.summary).toBe("move: install the cabinets")

    expect(fileOf(result, "house.olai").map((one) => one.id)).toEqual(["kitchen", "demo"])

    const arrived = fileOf(result, "garden.olai")
    expect(record(arrived, "install").parent).toBe("garden")
    expect(childOrder(arrived, "install")).toEqual(["handles", "knobs"])
    expect(childOrder(arrived, "garden"))
      .toEqual(["beds", "paths", "garden-install", "install"])
  })

  test("`file` alone lands it LAST at the top level of that outline", () => {
    const arrived = fileOf(
      planned(crossing(), { op: "move", id: "install", file: "garden.olai" }),
      "garden.olai",
    )
    expect(record(arrived, "install").parent).toBeUndefined()
    expect(childOrder(arrived, "install")).toEqual(["handles", "knobs"])
    expect(childOrder(arrived, undefined)).toEqual(["garden", "install"])
  })

  test("`before` / `after` name siblings in the outline it is going TO", () => {
    const arrived = fileOf(
      planned(crossing(), { op: "move", id: "install", parent: "garden", before: "paths" }),
      "garden.olai",
    )
    expect(childOrder(arrived, "garden"))
      .toEqual(["beds", "install", "paths", "garden-install"])
  })

  test("every reference into the subtree resolves, and says the same thing", () => {
    const before = crossing()
    const was = Object.fromEntries(SUBTREE.map((id) => [id, namersOf(before, id)]))
    expect(was).toEqual({
      install: ["beds.see", "garden-install.mirror"],
      handles: ["paths.blocks"],
      knobs: ["beds.after"],
    })

    const now = after(before, { op: "move", id: "install", parent: "garden" })
    expect(Object.fromEntries(SUBTREE.map((id) => [id, namersOf(now, id)]))).toEqual(was)

    const verdict = validate(TEST_CLAIMS, now)
    if (Result.isFailure(verdict)) {
      throw new Error(
        `the set is invalid after the move: ${
          verdict.failure.findings.map((one) => `${one.code} — ${one.message}`).join("; ")
        }`,
      )
    }
    expect(record(nodesOf(verdict.success.derived, "garden.olai").map((one) => one.node), "paths").custom)
      .toEqual({ owner: "install" })

    for (const id of SUBTREE) {
      expect(verdict.success.derived.byId.get(id)?.file).toBe("garden.olai")
    }
  })

  test("a pin aimed into the subtree draws the same row afterwards", () => {
    const before = crossing()
    const now = after(before, { op: "move", id: "install", parent: "garden" })

    const shelf = (set: OutlineSet) => shelfOf(derive(TEST_CLAIMS, recordsOf(set)))
    const was = shelf(before)
    expect(was).toEqual([
      { id: "pin-bare", title: "/#install", shows: { id: "install", name: "install the cabinets" } },
      {
        id: "pin-qualified",
        title: "/house.olai#install",
        shows: { id: "install", name: "install the cabinets" },
      },
    ])
    expect(shelf(now)).toEqual(was)

    for (const title of ["/#install", "/house.olai#install"]) {
      expect(pinTargetIn(TEST_CLAIMS, title)).toBe("install")
    }
  })

  test("a dated node that crossed files is still on its day, under the new outline", () => {
    const before = crossing()
    const now = after(before, { op: "move", id: "install", parent: "garden" })
    const day = (set: OutlineSet) => datedOn(derive(TEST_CLAIMS, recordsOf(set)), "2026-08-20")

    const was = day(before)
    expect(was).toHaveLength(1)
    expect(was[0]?.file).toBe("house.olai")
    expect(was[0]?.nodes.map((one) => one.shows.node.id)).toEqual(["knobs"])

    const then = day(now)
    expect(then).toHaveLength(1)
    expect(then[0]?.file).toBe("garden.olai")
    expect(then[0]?.nodes.map((one) => one.shows.node.id)).toEqual(["knobs"])
    expect(then[0]?.nodes[0]).toMatchObject({
      date: was[0]?.nodes[0]?.date as string,
      occasion: was[0]?.nodes[0]?.occasion as string,
    })
  })

  test("the ordering graph was file-agnostic already, and the move proves it", () => {
    const derived = (set: OutlineSet) => derive(TEST_CLAIMS, recordsOf(set))
    const ids = (rows: ReadonlyArray<{ at: { node: { id: string } } }>) =>
      rows.map((one) => one.at.node.id).slice().sort()
    const before = crossing()
    const now = after(before, { op: "move", id: "install", parent: "garden" })

    expect(ids(blockersOf(derived(before), "handles"))).toEqual(["paths"])
    expect(ids(blockersOf(derived(now), "handles"))).toEqual(["paths"])

    expect(ids(standingBefore(derived(before), "beds"))).toEqual(["knobs"])
    expect(ids(standingBefore(derived(now), "beds"))).toEqual(["knobs"])
  })

  test("a note link keeps its written spelling when its record moves", () => {
    const set = setOf({
      "house.olai": `{"id":"install","ord":"a0","title":"install the cabinets","desc":"[document](finishes.md)"}`,
      "notes/garden.olai": `{"id":"garden","ord":"a0","title":"the garden"}`,
    }, ["finishes.md"])
    const arrived = fileOf(
      planned(set, { op: "move", id: "install", parent: "garden" }),
      "notes/garden.olai",
    )
    expect(record(arrived, "install").desc).toBe("[document](finishes.md)")
  })

  test("nothing is re-stamped but the record that moved", () => {
    const arrived = fileOf(
      planned(crossing(), { op: "move", id: "install", parent: "garden" }),
      "garden.olai",
    )
    expect(record(arrived, "install").changed).toBe(STAMP)
    expect(record(arrived, "handles")).toEqual({
      id: "handles",
      parent: "install",
      ord: "a0",
      title: "choose the handles",
      todo: true,
    })
  })

  test("a subtree of unfinished work re-opens a `done` it lands under, across files", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"install","ord":"a0","title":"install the cabinets"}`,
        `{"id":"handles","parent":"install","ord":"a0","title":"choose the handles","todo":true}`,
      ].join("\n"),
      "garden.olai": `{"id":"garden","ord":"a0","title":"the garden","done":"2026-08-03"}`,
    })
    const result = planned(set, { op: "move", id: "install", parent: "garden" })
    expect(record(fileOf(result, "garden.olai"), "garden").done).toBeUndefined()
    expect(result.nudge).toContain("marked done over work that is not finished")
    expect(result.summary).toContain("reopened: the garden")
  })


  test("a `doc`-typed PROPERTY is not retargeted — and `trash` says the same thing", () => {
    const set = setOf({
      "_olai/Properties.olai": `{"id":"prop-brief","ord":"a0","title":"brief","custom":{"type":"doc"}}`,
      "house.olai": `{"id":"install","ord":"a0","title":"install","custom":{"brief":"finishes.md"}}`,
      "notes/garden.olai": `{"id":"garden","ord":"a0","title":"the garden"}`,
    }, ["finishes.md"])

    const refusalOf = (request: Request): ReadonlyArray<string> =>
      findingsIn(judged(after(set, request)))
        .map((one) => `${one.code} ${one.message}`)

    expect(refusalOf({ op: "move", id: "install", parent: "garden" }))
      .toEqual([
        "bad-prop `brief` names a document — `finishes.md` resolves to " +
        "`notes/finishes.md`, and no such `.md` file is served",
      ])

    expect(refusalOf({ op: "trash", id: "install" }))
      .toEqual([
        "bad-prop `brief` names a document — `finishes.md` resolves to " +
        "`_olai/finishes.md`, and no such `.md` file is served",
      ])

    const withLink = setOf({
      "house.olai": `{"id":"install","ord":"a0","title":"install","desc":"[document](finishes.md)"}`,
      "notes/garden.olai": `{"id":"garden","ord":"a0","title":"the garden"}`,
    }, ["finishes.md"])
    expect(Result.isSuccess(validate(TEST_CLAIMS, after(withLink, { op: "move", id: "install", parent: "garden" }))))
      .toBe(true)
  })

  const ROSTERED = (): OutlineSet =>
    setOf({
      "_olai/Properties.olai":
        `{"id":"prop-agent","ord":"a0","title":"agent","custom":{"type":"ref","under":"roster"}}`,
      "agents.olai": [
        `{"id":"roster","ord":"a0","title":"the agents"}`,
        `{"id":"claude","parent":"roster","ord":"a0","title":"Claude"}`,
      ].join("\n"),
      "lanes.olai": [
        `{"id":"lane","ord":"a0","title":"a lane","custom":{"agent":"claude"}}`,
        `{"id":"elsewhere","ord":"a1","title":"somewhere else entirely"}`,
      ].join("\n"),
    })

  test("a `ref` ROOT crossing outlines takes its variants with it, and every `ref` holds", () => {
    const now = after(ROSTERED(), { op: "move", id: "roster", parent: "elsewhere" })
    expect(Result.isSuccess(validate(TEST_CLAIMS, now))).toBe(true)
    const derived = derive(TEST_CLAIMS, recordsOf(now))
    expect(derived.byId.get("claude")?.file).toBe("lanes.olai")
    expect(derived.byId.get("claude")?.node.parent).toBe("roster")
  })

  test("a `ref` VARIANT moved OUT of its root breaks the file that names it", () => {
    const set = judged(after(ROSTERED(), { op: "move", id: "claude", parent: "elsewhere" }))
    const rows = findingsIn(set)
    expect(rows.map((one) => one.code)).toEqual(["bad-prop"])
    expect(rows[0]?.message).toContain("`agent`")
    expect(rows[0]?.message).toContain("`roster`")
    expect(rows[0]?.message).toContain(`"claude"`)
    expect(admits(set.broken, [rows[0]?.file as string])._tag).toBe("implicated")
  })

  test("an outline the set does not hold is refused, never minted", () => {
    const failure = refused(crossing(), { op: "move", id: "install", file: "shed.olai" })
    expect(failure._tag).toBe("NotFoundFailure")
    expect(failure.message).toContain("`shed.olai` is not an outline")
  })

  test("moving INTO the trash is refused toward `outlines_trash`", () => {
    const set = setOf({
      "house.olai": `{"id":"install","ord":"a0","title":"install the cabinets"}`,
      "_olai/Trash.olai": `{"id":"tiles","ord":"a0","title":"the tiles nobody liked"}`,
    })
    for (
      const request of [
        { op: "move", id: "install", file: "_olai/Trash.olai" },
        { op: "move", id: "install", parent: "tiles" },
      ] as const
    ) {
      expect(refused(set, request).message).toContain("`outlines_trash`")
    }
  })

  test("moving OUT of the trash is refused toward `trash_restore`", () => {
    const set = setOf({
      "house.olai": `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
      "_olai/Trash.olai": `{"id":"tiles","ord":"a0","title":"the tiles nobody liked"}`,
    })
    expect(refused(set, { op: "move", id: "tiles", parent: "kitchen" }).message)
      .toContain("`trash_restore`")
  })

  test("...but reordering INSIDE the trash still works, because nothing crosses", () => {
    const set = setOf({
      "_olai/Trash.olai": [
        `{"id":"tiles","ord":"a0","title":"the tiles nobody liked"}`,
        `{"id":"grout","ord":"a1","title":"the grout"}`,
      ].join("\n"),
    })
    const nodes = fileOf(
      planned(set, { op: "move", id: "grout", before: "tiles" }),
      "_olai/Trash.olai",
    )
    expect(childOrder(nodes, undefined)).toEqual(["grout", "tiles"])
  })

  test("a cross-file parent inside what the row DRAWS is still a loop", () => {
    const set = setOf({
      "now.olai": [
        `{"id":"now","ord":"a0","title":"Now"}`,
        `{"id":"now-install","parent":"now","ord":"a0","mirror":"install"}`,
      ].join("\n"),
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
        `{"id":"install","parent":"kitchen","ord":"a0","title":"install the cabinets"}`,
        `{"id":"handles","parent":"install","ord":"a0","title":"choose the handles"}`,
      ].join("\n"),
    })
    const failure = refused(set, { op: "move", id: "now", parent: "handles" })
    expect(failure.message).toContain("`now` → `now-install` → `install` → `handles`")
    expect(failure.message).toContain("never ends")
    const moved = fileOf(planned(set, { op: "move", id: "now", parent: "kitchen" }), "house.olai")
    expect(record(moved, "now").parent).toBe("kitchen")
    expect(record(moved, "now-install").parent).toBe("now")
  })

  test("a sibling anchor that is not one of the DESTINATION's rows is not-found", () => {
    expect(
      refused(crossing(), { op: "move", id: "install", parent: "garden", before: "demo" })._tag,
    ).toBe("NotFoundFailure")
  })

  test("an outline that did not parse is not written from a set that lost it", () => {
    const broken = setOf(
      { "house.olai": `{"id":"install","ord":"a0","title":"install the cabinets"}` },
      [],
      { "garden.olai": `{"id":"garden","ord":"a0"` },
    )
    expect(refused(broken, { op: "move", id: "install", file: "garden.olai" }).message)
      .toContain("Fix the file first")

    const leaving = setOf(
      { "garden.olai": `{"id":"garden","ord":"a0","title":"the garden"}` },
      [],
      { "house.olai": `{"id":"install","ord":"a0"` },
    )
    expect(refused(leaving, { op: "move", id: "install", file: "garden.olai" })._tag)
      .toBe("NotFoundFailure")
  })
})

describe("create", () => {
  test("an empty outline is a file with no records, named in the commit line", () => {
    const result = planned(house(), { op: "create", file: "shed.olai" })
    expect(fileOf(result, "shed.olai")).toEqual([])
    expect(result).toMatchObject({
      file: "shed.olai",
      id: "shed.olai",
      title: "shed.olai",
      summary: "create: shed.olai",
    })
  })

  test("a seed is one top-level node, minted the way a capture is", () => {
    const result = planned(house(), {
      op: "create",
      file: "notes/ideas.olai",
      seed: { title: "an idea #later", desc: "write it down", date: "2026-08-10" },
    })
    expect(fileOf(result, "notes/ideas.olai")).toEqual([
      {
        id: "n1",
        ord: "a0",
        title: "an idea #later",
        desc: "write it down",
        date: "2026-08-10",
        created: STAMP,
      },
    ])
    expect(result.summary).toBe("capture: an idea #later")
    expect(result.id).toBe("n1")
  })

  test("a seed is a whole capture — the outline is born holding its tree", () => {
    const result = planned(house(), {
      op: "create",
      file: "shed.olai",
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

    expect(result.files).toHaveLength(1)
    const nodes = fileOf(result, "shed.olai")
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
    for (
      const seed of [
        {
          title: "The shed",
          children: [{ title: "clear it out", children: [{ title: "x", id: "order" }] }],
        },
        { title: "The shed", children: [{ title: "clear it out" }, { title: " " }] },
      ]
    ) {
      const failure = refused(house(), { op: "create", file: "shed.olai", seed })
      expect(failure._tag).toBe("UsageFailure")
    }

    const failure = refused(house(), {
      op: "create",
      file: "shed.olai",
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
        file: "new.olai",
        seed: { title: "x", id: "paint" },
      }),
      "new.olai",
    )
    expect(record(nodes, "paint").title).toBe("x")

    expect(
      refused(house(), {
        op: "create",
        file: "new.olai",
        seed: { title: "x", id: "order" },
      })._tag,
    ).toBe("UsageFailure")
  })

  test("an absolute path is refused", () => {
    const failure = refused(house(), { op: "create", file: "/tmp/out.olai" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("relative")
  })

  test("a traversal is refused, never resolved under the root", () => {
    for (const file of [
      "../secret.olai",
      "notes/../../secret.olai",
      "notes/./out.olai",
      "notes//out.olai",
      "a\\b.olai",
    ]) {
      expect(refused(house(), { op: "create", file })._tag).toBe("UsageFailure")
    }
  })

  test("a non-`.olai` name is refused", () => {
    expect(refused(house(), { op: "create", file: "notes.md" })._tag).toBe("UsageFailure")
    expect(refused(house(), { op: "create", file: "notes" })._tag).toBe("NotFoundFailure")
  })

  test("an outline the directory already holds is refused rather than overwritten", () => {
    const failure = refused(house(), { op: "create", file: "house.olai" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("already")
    expect(failure.message).toContain("outlines_add")
  })

  test("an empty seed title is refused — a node is its title", () => {
    expect(
      refused(house(), { op: "create", file: "new.olai", seed: { title: "  " } })._tag,
    ).toBe("UsageFailure")
  })
})

describe("split", () => {
  test("the head keeps the row and the tail follows it as a sibling", () => {
    const result = planned(house(), {
      op: "split",
      id: "order",
      title: "order ",
      rest: "the cabinets",
    })
    const nodes = fileOf(result, "house.olai")
    expect(record(nodes, "order").title).toBe("order ")
    expect(record(nodes, "n1").title).toBe("the cabinets")
    expect(childOrder(nodes, "kitchen")).toEqual(["demo", "order", "n1", "install"])
    expect(result.id).toBe("n1")
    expect(result.title).toBe("the cabinets")
    expect(result.captured).toEqual([{ id: "n1", title: "the cabinets" }])
    expect(result.summary).toBe("split: order the cabinets")
  })

  test("an `under` split lands the tail as the head's FIRST CHILD", () => {
    const nodes = fileOf(
      planned(house(), { op: "split", id: "kitchen", title: "Kit", rest: "chen", under: true }),
      "house.olai",
    )
    expect(record(nodes, "kitchen").title).toBe("Kit")
    expect(record(nodes, "n1").parent).toBe("kitchen")
    expect(childOrder(nodes, "kitchen")).toEqual(["n1", "demo", "order", "install"])
  })

  test("an `under` split of a childless head makes the tail its only child", () => {
    const nodes = fileOf(
      planned(house(), { op: "split", id: "loose", title: "a node", rest: " of no use", under: true }),
      "house.olai",
    )
    expect(record(nodes, "n1").parent).toBe("loose")
    expect(childOrder(nodes, "loose")).toEqual(["n1"])
  })

  test("everything that DESCRIBED the node stays with the head", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order it","done":"2026-08-01","date":"2026-09-01","desc":"walnut","see":["kitchen"]}`,
        `{"id":"quote","parent":"order","ord":"a0","title":"get a quote"}`,
      ].join("\n"),
    })
    const nodes = fileOf(
      planned(set, { op: "split", id: "order", title: "order", rest: " it" }),
      "house.olai",
    )
    const head = record(nodes, "order")
    expect(head).toMatchObject({
      done: "2026-08-01",
      date: "2026-09-01",
      desc: "walnut",
      see: ["kitchen"],
    })
    expect(record(nodes, "quote").parent).toBe("order")
    expect(record(nodes, "n1")).toEqual({
      id: "n1",
      parent: "kitchen",
      ord: record(nodes, "n1").ord,
      title: " it",
      created: STAMP,
    })
  })

  test("a top-level node splits into a top-level sibling", () => {
    const nodes = fileOf(
      planned(house(), { op: "split", id: "loose", title: "a node", rest: " with no children" }),
      "house.olai",
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
      "house.olai": KITCHEN,
      "week.olai": `{"id":"m","ord":"a0","mirror":"order"}`,
    })
    expect(refused(set, { op: "split", id: "m", title: "a", rest: "b" }).message)
      .toContain("is a mirror")
  })
})

describe("merge", () => {
  const merged = (set: OutlineSet, id: string) => {
    const result = planned(set, { op: "merge", id })
    return {
      result,
      source: fileOf(result, "house.olai"),
      archive: fileOf(result, "_olai/Trash.olai"),
    }
  }

  test("the titles run together and the record goes to the archive", () => {
    const { archive, result, source } = merged(house(), "install")

    expect(record(source, "order").title).toBe("order the cabinetsinstall them")
    expect(source.map((node) => node.id)).toEqual(["kitchen", "demo", "order", "loose"])
    expect(record(archive, "install").title).toBe("install them")
    expect(result.id).toBe("order")
    expect(result.title).toBe("order the cabinetsinstall them")
    expect(result.summary).toBe("merge: order the cabinetsinstall them")
    expect(result.nudge).toBeUndefined()
  })

  test("a CARRIED title joins instead of the record's own", () => {
    const result = planned(house(), { op: "merge", id: "install", title: "" })
    expect(record(fileOf(result, "house.olai"), "order").title)
      .toBe("order the cabinets")
    expect(record(fileOf(result, "_olai/Trash.olai"), "install").title)
      .toBe("install them")
    expect(result.id).toBe("order")
    expect(result.title).toBe("order the cabinets")
  })

  test("the children move, in order, to the end of the survivor's own", () => {
    const set = setOf({
      "house.olai": [
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
    expect(record(source, "fit").parent).toBe("order")
  })

  test("the notes join a blank line apart, and one note alone simply moves", () => {
    const both = setOf({
      "house.olai": [
        `{"id":"a","ord":"a0","title":"a","desc":"the first"}`,
        `{"id":"b","ord":"a1","title":"b","desc":"the second"}`,
      ].join("\n"),
    })
    expect(record(fileOf(planned(both, { op: "merge", id: "b" }), "house.olai"), "a").desc)
      .toBe("the first\n\nthe second")

    const only = setOf({
      "house.olai": [
        `{"id":"a","ord":"a0","title":"a"}`,
        `{"id":"b","ord":"a1","title":"b","desc":"the second"}`,
      ].join("\n"),
    })
    expect(record(fileOf(planned(only, { op: "merge", id: "b" }), "house.olai"), "a").desc)
      .toBe("the second")
  })

  test("a mark, a date or an edge goes with the record — and is said out loud", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"a","ord":"a0","title":"a"}`,
        `{"id":"b","ord":"a1","title":"b","done":"2026-08-01","date":"2026-09-01","desc":"[document](finishes.md)","see":["a"]}`,
      ].join("\n"),
    })
    const result = planned(set, { op: "merge", id: "b" })
    expect(record(fileOf(result, "_olai/Trash.olai"), "b")).toMatchObject({
      done: "2026-08-01",
      date: "2026-09-01",
      desc: "[document](finishes.md)",
      see: ["a"],
    })
    expect(record(fileOf(result, "house.olai"), "a").done).toBeUndefined()
    expect(result.nudge).toContain("`done` mark")
    expect(result.nudge).toContain("its date")
    expect(result.nudge).toContain("its edges")
  })


  test("the first of its siblings joins into the row ON the page above it — its parent", () => {
    const result = planned(house(), { op: "merge", id: "demo" })
    expect(record(fileOf(result, "house.olai"), "kitchen").title)
      .toBe("Kitchen remodeldemolition")
    expect(record(fileOf(result, "_olai/Trash.olai"), "demo").title).toBe("demolition")
    expect(fileOf(result, "house.olai").some((node) => node.id === "demo")).toBe(false)
  })

  test("the top of the page has nothing above it to merge into", () => {
    expect(refused(house(), { op: "merge", id: "kitchen" }).message)
      .toContain("no row above it to merge into")
  })

  test("a mirror above has no title to merge into", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"a","ord":"a0","title":"a"}`,
        `{"id":"m","ord":"a1","mirror":"a"}`,
        `{"id":"b","ord":"a2","title":"b"}`,
      ].join("\n"),
    })
    expect(refused(set, { op: "merge", id: "b" }).message).toContain("is a mirror")
  })

  test("a placement cannot be merged either", () => {
    const set = setOf({
      "house.olai": KITCHEN,
      "week.olai": [
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
    const after = setOf({ "house.olai": serializeOutline(fileOf(split, "house.olai")) })
    const back = planned(after, { op: "merge", id: "n1" })
    const unstamped = (nodes: ReadonlyArray<Node>): string =>
      serializeOutline(nodes.map((node) => {
        const { changed: _dropped, ...rest } = node as RegularNode
        return rest as Node
      }))
    expect(unstamped(fileOf(back, "house.olai")))
      .toBe(unstamped(nodesOf(derive(TEST_CLAIMS, recordsOf(before)), "house.olai").map((at) => at.node)))
    expect(record(fileOf(back, "house.olai"), "order").changed).toBe(STAMP)
  })
})

describe("archive", () => {
  const archived = (set: OutlineSet, id: string) => {
    const result = planned(set, { op: "trash", id })
    return {
      result,
      source: fileOf(result, "house.olai"),
      archive: fileOf(result, "_olai/Trash.olai"),
    }
  }

  test("the subtree leaves the outline and lands under a rebuilt title chain", () => {
    const { archive, result, source } = archived(house(), "order")

    expect(source.map((node) => node.id)).toEqual(["kitchen", "demo", "install", "loose"])
    expect(archive).toEqual([
      { id: "n1", ord: "a0", title: "house.olai" },
      { id: "n2", parent: "n1", ord: "a0", title: "Kitchen remodel" },
      { id: "order", parent: "n2", ord: "a0", title: "order the cabinets" },
    ])
    expect(result.file).toBe("_olai/Trash.olai")
    expect(result.summary).toBe("trash: order the cabinets")
  })

  test("a note link stays verbatim through trash and restore", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"install","parent":"kitchen","ord":"a0","title":"install them","desc":"[document](finishes.md)"}`,
      ].join("\n"),
    }, [["finishes.md", "# Finishes\n"]])
    const { archive } = archived(set, "install")
    expect(record(archive, "install").desc).toBe("[document](finishes.md)")
    const back = fileOf(
      planned(after(set, { op: "trash", id: "install" }), { op: "untrash", id: "install" }),
      "house.olai",
    )
    expect(record(back, "install").desc).toBe("[document](finishes.md)")
  })

  test("descendants come along, shaped as they were", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order"}`,
        `{"id":"quote","parent":"order","ord":"a0","title":"get a quote","done":"2026-07-01"}`,
        `{"id":"sign","parent":"quote","ord":"a0","title":"sign it"}`,
      ].join("\n"),
    })
    const { archive, source } = archived(set, "order")
    expect(source.map((node) => node.id)).toEqual(["kitchen"])
    expect(archive.map((node) => node.id)).toEqual(["n1", "n2", "order", "quote", "sign"])
    expect(record(archive, "quote").done).toBe("2026-07-01")
    expect(record(archive, "sign").done).toBeUndefined()
    expect(record(archive, "quote").parent).toBe("order")
  })

  test("ids move with the nodes, so a mirror pointing at one keeps resolving", () => {
    const set = setOf({
      "house.olai": KITCHEN,
      "week.olai": `{"id":"m","ord":"a0","mirror":"order"}`,
    })
    const { archive } = archived(set, "order")
    expect(record(archive, "order").id).toBe("order")
    expect(archive.map((node) => node.id)).not.toContain("kitchen")
  })

  test("a chain the archive already has is merged into, not duplicated", () => {
    const set = setOf({
      "house.olai": KITCHEN,
      "_olai/Trash.olai": [
        `{"id":"from","ord":"a0","title":"house.olai"}`,
        `{"id":"old","parent":"from","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"gone","parent":"old","ord":"a0","title":"something earlier"}`,
      ].join("\n"),
    })
    const archive = fileOf(planned(set, { op: "trash", id: "order" }), "_olai/Trash.olai")
    expect(archive.filter((node) => node.parent === undefined).map((node) => node.id))
      .toEqual(["from"])
    expect(childOrder(archive, "from")).toEqual(["old"])
    expect(childOrder(archive, "old")).toEqual(["gone", "order"])
  })

  test("the archive sits beside the outline the node left, in its own directory", () => {
    const set = setOf({ "notes/house.olai": KITCHEN })
    const result = planned(set, { op: "trash", id: "order" })
    expect(result.files.map((entry) => entry.file).sort()).toEqual([
      "_olai/Trash.olai",
      "notes/house.olai",
    ])
  })

  test("archiving something already archived is refused", () => {
    const set = setOf({ "_olai/Trash.olai": `{"id":"x","ord":"a0","title":"x"}` })
    expect(refused(set, { op: "trash", id: "x" }).message).toContain("already in")
  })
})

describe("unarchive", () => {
  test("the subtree comes back out, where the recorded chain says it came from", () => {
    const set = after(house(), { op: "trash", id: "order" })
    const result = planned(set, { op: "untrash", id: "order" })

    const source = fileOf(result, "house.olai")
    expect(record(source, "order").parent).toBe("kitchen")
    expect(childOrder(source, "kitchen")).toEqual(["demo", "install", "order"])
    expect(fileOf(result, "_olai/Trash.olai")).toEqual([])
    expect(result.summary).toBe("untrash: order the cabinets")
    expect(result.file).toBe("house.olai")
  })

  test("descendants come back along, shaped as they were", () => {
    const start = setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order"}`,
        `{"id":"quote","parent":"order","ord":"a0","title":"get a quote","done":"2026-07-01"}`,
        `{"id":"sign","parent":"quote","ord":"a0","title":"sign it"}`,
      ].join("\n"),
    })
    const set = after(start, { op: "trash", id: "order" })
    const source = fileOf(planned(set, { op: "untrash", id: "order" }), "house.olai")
    expect(source.map((node) => node.id)).toEqual(["kitchen", "order", "quote", "sign"])
    expect(record(source, "quote").parent).toBe("order")
    expect(record(source, "sign").parent).toBe("quote")
    expect(record(source, "quote").done).toBe("2026-07-01")
    expect(record(source, "sign").done).toBeUndefined()
  })

  test("an explicit `parent` overrides the chain", () => {
    const set = after(house(), { op: "trash", id: "order" })
    const source = fileOf(
      planned(set, { op: "untrash", id: "order", parent: "loose" }),
      "house.olai",
    )
    expect(record(source, "order").parent).toBe("loose")
  })

  test("an explicit `file` lands it at top level", () => {
    const set = after(house(), { op: "trash", id: "order" })
    const source = fileOf(
      planned(set, { op: "untrash", id: "order", file: "house.olai" }),
      "house.olai",
    )
    expect(record(source, "order").parent).toBeUndefined()
    expect(source.filter((node) => node.parent === undefined).map((node) => node.id))
      .toEqual(["kitchen", "loose", "order"])
  })

  test("a node that was never put away is refused", () => {
    const failure = refused(house(), { op: "untrash", id: "order" })
    expect(failure.message).toContain("not the trash")
  })

  test("a mirror's id is refused, naming the node it shows", () => {
    const set = setOf({
      "_olai/Trash.olai": `{"id":"x","ord":"a0","title":"x"}`,
      "week.olai": `{"id":"m","ord":"a0","mirror":"x"}`,
    })
    expect(refused(set, { op: "untrash", id: "m" }).message).toContain("is a mirror")
  })

  test("a chain that matches nowhere is refused, naming the chain", () => {
    const set = setOf({
      "house.olai": KITCHEN,
      "_olai/Trash.olai": [
        `{"id":"from","ord":"a0","title":"house.olai"}`,
        `{"id":"n9","parent":"from","ord":"a0","title":"Old kitchen"}`,
        `{"id":"gone","parent":"n9","ord":"a0","title":"something"}`,
      ].join("\n"),
    })
    const failure = refused(set, { op: "untrash", id: "gone" })
    expect(failure.message).toContain("`Old kitchen`")
    expect(failure.message).toContain("matches nothing")
    expect(failure.message).toContain("`parent`")
  })

  test("a chain that matches more than one place is refused, naming each", () => {
    const set = setOf({
      "house.olai": [
        KITCHEN,
        `{"id":"twin","ord":"a4","title":"Kitchen remodel"}`,
      ].join("\n"),
      "_olai/Trash.olai": [
        `{"id":"from","ord":"a0","title":"house.olai"}`,
        `{"id":"n9","parent":"from","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"gone","parent":"n9","ord":"a0","title":"something"}`,
      ].join("\n"),
    })
    const failure = refused(set, { op: "untrash", id: "gone" })
    expect(failure.message).toContain("more than one place")
    expect(failure.message).toContain("`kitchen`")
    expect(failure.message).toContain("`twin`")
  })

  test("a top-level node goes back to the one outline beside its archive", () => {
    const set = after(house(), { op: "trash", id: "loose" })
    const source = fileOf(planned(set, { op: "untrash", id: "loose" }), "house.olai")
    expect(record(source, "loose").parent).toBeUndefined()
  })

  test("a top-level trash row with no source recorded is refused, not guessed at", () => {
    const set = setOf({
      "house.olai": KITCHEN,
      "flat.olai": `{"id":"other","ord":"a0","title":"elsewhere"}`,
      "_olai/Trash.olai": `{"id":"x","ord":"a0","title":"was top level"}`,
    })
    const failure = refused(set, { op: "untrash", id: "x" })
    expect(failure.message).toContain("no outline recorded")
    expect(failure.message).toContain("`parent`")
    expect(failure.message).toContain("`file`")
  })

  test("an archive is not a destination", () => {
    const set = setOf({
      "house.olai": KITCHEN,
      "_olai/Trash.olai": [
        `{"id":"kept","ord":"a0","title":"kept"}`,
        `{"id":"x","ord":"a1","title":"was top level"}`,
      ].join("\n"),
    })
    expect(refused(set, { op: "untrash", id: "x", file: "_olai/Trash.olai" }).message)
      .toContain("OUT of the trash")
    expect(refused(set, { op: "untrash", id: "x", parent: "kept" }).message)
      .toContain("OUT of the trash")
  })

  test("scaffold still holding a sibling stays; only the emptied chain goes", () => {
    const once = after(house(), { op: "trash", id: "order" })
    const set = after(once, { op: "trash", id: "install" })
    const archive = fileOf(planned(set, { op: "untrash", id: "order" }), "_olai/Trash.olai")
    expect(archive.map((node) => node.id)).toEqual(["n1", "n2", "install"])
    expect(record(archive, "install").parent).toBe("n2")
  })

  test("a scaffold record something still names is kept", () => {
    const set = setOf({
      "house.olai": [
        KITCHEN,
        `{"id":"note","parent":"kitchen","ord":"a3","title":"see the old plan","see":["n9"]}`,
      ].join("\n"),
      "_olai/Trash.olai": [
        `{"id":"n9","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"gone","parent":"n9","ord":"a0","title":"something"}`,
      ].join("\n"),
    })
    const archive = fileOf(
      planned(set, { op: "untrash", id: "gone", parent: "kitchen" }),
      "_olai/Trash.olai",
    )
    expect(archive.map((node) => node.id)).toEqual(["n9"])
  })

  const archived = (set: OutlineSet): ReadonlyArray<Node> =>
    nodesOf(derive(TEST_CLAIMS, recordsOf(set)), "_olai/Trash.olai").map((located) => located.node)

  test("the signpost the archive minted above a node is not restorable", () => {
    const set = after(house(), { op: "trash", id: "order" })
    expect(record(archived(set), "n1")).toMatchObject({ title: "house.olai" })
    expect(record(archived(set), "n2")).toMatchObject({ title: "Kitchen remodel" })

    const failure = refused(set, { op: "untrash", id: "n2" })
    expect(failure.message).toContain("Kitchen remodel")
    expect(failure.message).toContain("`kitchen`")
    expect(failure.message).toContain("what was put away")

    const fileSign = refused(set, { op: "untrash", id: "n1" })
    expect(fileSign.message).toContain("house.olai")
    expect(fileSign.message).toContain("no outline recorded above it")
  })

  test("a signpost part-way down the chain is refused the same way", () => {
    const deep = setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets"}`,
        `{"id":"quote","parent":"order","ord":"a0","title":"get a quote"}`,
      ].join("\n"),
    })
    const set = after(deep, { op: "trash", id: "quote" })
    expect(record(archived(set), "n3"))
      .toMatchObject({ title: "order the cabinets", parent: "n2" })

    const failure = refused(set, { op: "untrash", id: "n3" })
    expect(failure.message).toContain("order the cabinets")
    expect(failure.message).toContain("`order`")
  })

  test("a title-only node the archive MOVED is still restorable", () => {
    const set = after(house(), { op: "trash", id: "loose" })
    const source = fileOf(planned(set, { op: "untrash", id: "loose" }), "house.olai")
    expect(record(source, "loose").title).toBe("a node with no children")
  })

  test("an emptied ancestor that is not bare scaffold is kept — it is content", () => {
    const set = setOf({
      "house.olai": KITCHEN,
      "_olai/Trash.olai": [
        `{"id":"was-real","ord":"a0","title":"a whole archived branch","done":"2026-07-01"}`,
        `{"id":"leaf","parent":"was-real","ord":"a0","title":"its one leaf"}`,
      ].join("\n"),
    })
    const archive = fileOf(
      planned(set, { op: "untrash", id: "leaf", parent: "kitchen" }),
      "_olai/Trash.olai",
    )
    expect(archive.map((node) => node.id)).toEqual(["was-real"])
  })
})

describe("empty", () => {
  const filled = (): OutlineSet =>
    after(after(house(), { op: "trash", id: "order" }), { op: "trash", id: "install" })

  const twoPiles = (): OutlineSet => {
    const start = setOf({
      "house.olai": KITCHEN,
      "garden/plot.olai": [
        `{"id":"beds","ord":"a0","title":"the beds"}`,
        `{"id":"quote","parent":"beds","ord":"a0","title":"a quote"}`,
      ].join("\n"),
    })
    return after(after(start, { op: "trash", id: "order" }), { op: "trash", id: "beds" })
  }

  const crossPiles = (
    fromGarden: string,
    fromHouse: string,
  ): OutlineSet => {
    const start = setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order"${fromHouse}}`,
      ].join("\n"),
      "garden/plot.olai": [
        `{"id":"beds","ord":"a0","title":"the beds"}`,
        `{"id":"quote","parent":"beds","ord":"a0","title":"a quote",${fromGarden}}`,
      ].join("\n"),
    })
    return after(after(start, { op: "trash", id: "order" }), { op: "trash", id: "beds" })
  }

  test("every record in the archive goes, and the file stays behind empty", () => {
    const set = filled()
    expect(nodesOf(derive(TEST_CLAIMS, recordsOf(set)), "_olai/Trash.olai")).toHaveLength(4)

    const result = planned(set, { op: "empty", file: "_olai/Trash.olai" })
    expect(fileOf(result, "_olai/Trash.olai")).toEqual([])
    expect(result.files.map((entry) => entry.file)).toEqual(["_olai/Trash.olai"])
    expect(result.summary).toBe("empty: _olai/Trash.olai (4 records)")
    expect(result.id).toBe("_olai/Trash.olai")
    expect(result.file).toBe("_olai/Trash.olai")
  })

  test("an archive that holds nothing is refused rather than written as a no-op", () => {
    const set = after(
      after(house(), { op: "trash", id: "order" }),
      { op: "untrash", id: "order" },
    )
    expect(nodesOf(derive(TEST_CLAIMS, recordsOf(set)), "_olai/Trash.olai")).toEqual([])
    const failure = refused(set, { op: "empty", file: "_olai/Trash.olai" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("already empty")
  })

  test("a live outline is not deletable, and the refusal points at the put-away", () => {
    const failure = refused(filled(), { op: "empty", file: "house.olai" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("is not the trash")
    expect(failure.message).toContain("outlines_trash")
  })

  test("a file the set does not hold is a miss, naming what there is", () => {
    const failure = refused(filled(), { op: "empty", file: "notes/Archive.olai" })
    expect(failure._tag).toBe("NotFoundFailure")
    expect(failure.message).toContain("house.olai")
  })

  test("a live `see` pointed into the archive refuses it, naming the record", () => {
    const set = after(
      after(house(), { op: "see", id: "loose", add: ["order"] }),
      { op: "trash", id: "order" },
    )
    const failure = refused(set, { op: "empty", file: "_olai/Trash.olai" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`loose`")
    expect(failure.message).toContain("`see`")
    expect(failure.message).toContain("trash_restore")
  })

  test("an `after` edge and a mirror hold it just as a `see` does", () => {
    const held = (request: Request): string =>
      refused(
        after(after(house(), request), { op: "trash", id: "order" }),
        { op: "empty", file: "_olai/Trash.olai" },
      ).message
    expect(held({ op: "after", id: "loose", add: ["order"] })).toContain("`after`")
    expect(held({ op: "mirror", target: "order", parent: "loose" })).toContain("`mirror`")
  })

  test("references BETWEEN records in the same archive are not dependents", () => {
    const start = setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order"}`,
        `{"id":"quote","parent":"order","ord":"a0","title":"get a quote","after":["sign"]}`,
        `{"id":"sign","parent":"order","ord":"a1","title":"sign it"}`,
      ].join("\n"),
    })
    const set = after(start, { op: "trash", id: "order" })
    expect(fileOf(planned(set, { op: "empty", file: "_olai/Trash.olai" }), "_olai/Trash.olai"))
      .toEqual([])
  })

  test("a record naming ITSELF is not its own dependent", () => {
    const set = after(
      after(house(), { op: "see", id: "install", add: ["install"] }),
      { op: "trash", id: "install" },
    )
    expect(fileOf(planned(set, { op: "empty", file: "_olai/Trash.olai" }), "_olai/Trash.olai"))
      .toEqual([])
  })

  test("two outlines' piles empty as ONE trash, and a leftover Archive.olai is left", () => {
    const set = twoPiles()
    const result = planned(set, {
      op: "empty",
      file: "_olai/Trash.olai",
    })
    expect(fileOf(result, "_olai/Trash.olai")).toEqual([])
    expect(result.summary).toMatch(/^empty: _olai\/Trash\.olai \(\d+ records\)$/)

    const leftover = after(set, { op: "empty", file: "_olai/Trash.olai" })
    const stopped = refused(leftover, {
      op: "empty",
      file: "garden/plot.olai",
    })
    expect(stopped.message).toContain("is not the trash")
  })

  test("a `see` from one named archive INTO another is a record that goes, not a holder", () => {
    const set = crossPiles(`"see":["order"]`, "")
    const result = planned(set, {
      op: "empty",
      file: "_olai/Trash.olai",
    })
    expect(fileOf(result, "_olai/Trash.olai")).toEqual([])
  })

  test("two piles naming EACH OTHER empty too, which no ordering could reach", () => {
    const set = crossPiles(`"see":["order"]`, `,"see":["quote"]`)
    const result = planned(set, {
      op: "empty",
      file: "_olai/Trash.olai",
    })
    expect(fileOf(result, "_olai/Trash.olai")).toEqual([])
  })

  test("a namer left OUT of the list still holds, wherever it lives", () => {
    const set = setOf({
      "house.olai": KITCHEN,
      "Archive.olai": `{"id":"quote","ord":"a0","title":"a leftover quote","see":["order"]}`,
    })
    const trashed = after(set, { op: "trash", id: "order" })
    const failure = refused(trashed, { op: "empty", file: "_olai/Trash.olai" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`quote`")
    expect(failure.message).toContain("`see`")
  })

  test("`was` refuses a trash that has moved, and never a trash that has not", () => {
    const set = filled()
    expect(planned(set, { op: "empty", file: "_olai/Trash.olai", was: 4 }).summary)
      .toContain("(4 records)")

    const stale = refused(set, { op: "empty", file: "_olai/Trash.olai", was: 2 })
    expect(stale._tag).toBe("UsageFailure")
    expect(stale.message).toContain("held 2 records when this was asked for")
    expect(stale.message).toContain("holds 4 now")
  })

  test("`was` counts the one trash, because that is what the sentence names", () => {
    expect(
      planned(twoPiles(), {
        op: "empty",
        file: "_olai/Trash.olai",
        was: 6,
      }).files.map((entry) => entry.file),
    ).toEqual(["_olai/Trash.olai"])
    expect(
      refused(twoPiles(), {
        op: "empty",
        file: "_olai/Trash.olai",
        was: 2,
      }).message,
    ).toContain("holds 6 now")
  })

  test("a broken archive is refused before anything is deleted, in `writable`'s words", () => {
    const set = setOf(
      { "house.olai": KITCHEN },
      [],
      { "_olai/Trash.olai": `{"id":"sc","ord":"a0"` },
    )
    const failure = refused(set, { op: "empty", file: "_olai/Trash.olai" })
    expect(failure._tag).toBe("ValidationFailure")
    expect(failure.message).toContain("do not parse")
  })
})

describe("see", () => {
  test("adds targets, preserving any that were already there", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","see":["demo"]}`,
        `{"id":"demo","parent":"kitchen","ord":"a1","title":"demolition"}`,
        `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
      ].join("\n"),
    })
    const result = planned(set, { op: "see", id: "order", add: ["install"] })
    expect(record(fileOf(result, "house.olai"), "order").see).toEqual([
      "demo",
      "install",
    ])
    expect(result.summary).toBe("see: order the cabinets")
  })

  test("removes targets, and clears the field when none remain", () => {
    const set = setOf({
      "a.olai": [
        `{"id":"a","ord":"a0","title":"a","see":["b","c"]}`,
        `{"id":"b","ord":"a1","title":"b"}`,
        `{"id":"c","ord":"a2","title":"c"}`,
      ].join("\n"),
    })
    const partial = planned(set, { op: "see", id: "a", remove: ["b"] })
    expect(record(fileOf(partial, "a.olai"), "a").see).toEqual(["c"])

    const cleared = planned(set, { op: "see", id: "a", remove: ["b", "c"] })
    expect("see" in record(fileOf(cleared, "a.olai"), "a")).toBe(false)
  })

  test("add and remove in one call: removes first, then appends adds", () => {
    const set = setOf({
      "a.olai": [
        `{"id":"a","ord":"a0","title":"a","see":["b","c"]}`,
        `{"id":"b","ord":"a1","title":"b"}`,
        `{"id":"c","ord":"a2","title":"c"}`,
        `{"id":"d","ord":"a3","title":"d"}`,
      ].join("\n"),
    })
    const nodes = fileOf(
      planned(set, { op: "see", id: "a", add: ["d"], remove: ["b"] }),
      "a.olai",
    )
    expect(record(nodes, "a").see).toEqual(["c", "d"])
  })

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
    expect(failure.message).not.toContain("kitchen")
  })

  test("neither add nor remove is a usage refusal", () => {
    expect(refused(house(), { op: "see", id: "order" })._tag).toBe(
      "UsageFailure",
    )
  })

  test("a no-op — re-adding what is already there — is refused rather than rewritten", () => {
    const set = setOf({
      "a.olai": [
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
      "a.olai": `{"id":"x","ord":"a0","title":"x"}`,
      "b.olai": `{"id":"m","ord":"a0","mirror":"x"}`,
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

describe("after", () => {
  const CHAIN = (): OutlineSet =>
    setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition"}`,
        `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","after":["demo"]}`,
        `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
      ].join("\n"),
    })

  test("adds an edge, keeping the ones already written", () => {
    const result = planned(CHAIN(), { op: "after", id: "order", add: ["kitchen"] })
    expect(record(fileOf(result, "house.olai"), "order").after).toEqual([
      "demo",
      "kitchen",
    ])
    expect(result.summary).toBe("after: order the cabinets")
  })

  test("removes an edge, and clears the field when none remain", () => {
    const nodes = fileOf(
      planned(CHAIN(), { op: "after", id: "order", remove: ["demo"] }),
      "house.olai",
    )
    expect("after" in record(nodes, "order")).toBe(false)
  })

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

  test("a loop that closes through `blocks` is refused too", () => {
    const set = setOf({
      "a.olai": [
        `{"id":"a","ord":"a0","title":"a"}`,
        `{"id":"b","ord":"a1","title":"b","blocks":["a"]}`,
      ].join("\n"),
    })
    expect(refused(set, { op: "after", id: "b", add: ["a"] }).message)
      .toContain("`b` → `a` → `b`")
  })

  test("a loop that closes through a mirror is one loop", () => {
    const set = setOf({
      "a.olai": [
        `{"id":"a","ord":"a0","title":"a"}`,
        `{"id":"b","ord":"a1","title":"b","after":["mirror-of-a"]}`,
      ].join("\n"),
      "b.olai": `{"id":"mirror-of-a","ord":"a0","mirror":"a"}`,
    })
    const failure = refused(set, { op: "after", id: "a", add: ["b"] })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`a` → `b` → `a`")
  })

  test("adding an edge to a mirror is adding it to the node it shows", () => {
    const set = setOf({
      "a.olai": [
        `{"id":"a","ord":"a0","title":"a"}`,
        `{"id":"b","ord":"a1","title":"b","after":["a"]}`,
      ].join("\n"),
      "b.olai": `{"id":"mirror-of-b","ord":"a0","mirror":"b"}`,
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

describe("mirror", () => {
  const TWO = (): OutlineSet =>
    setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition"}`,
        `{"id":"install","parent":"kitchen","ord":"a1","title":"install them"}`,
        `{"id":"handles","parent":"install","ord":"a0","title":"choose the handles"}`,
      ].join("\n"),
      "now.olai": [
        `{"id":"now","ord":"a0","title":"Now"}`,
        `{"id":"now-demo","parent":"now","ord":"a0","mirror":"demo"}`,
      ].join("\n"),
    })

  test("places a mirror under a parent, last among its siblings", () => {
    const result = planned(TWO(), { op: "mirror", target: "install", parent: "now" })
    const nodes = fileOf(result, "now.olai")
    expect(childOrder(nodes, "now")).toEqual(["now-demo", "n1"])
    expect(result.id).toBe("n1")
    expect(nodes.find((node) => node.id === "n1")).toEqual({
      id: "n1",
      parent: "now",
      ord: expect.any(String),
      mirror: "install",
    })
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
      "now.olai",
    )
    expect(childOrder(nodes, "now")).toEqual(["n1", "now-demo"])
  })

  test("`file` puts it at the top level of an outline", () => {
    const nodes = fileOf(
      planned(TWO(), { op: "mirror", target: "install", file: "now.olai" }),
      "now.olai",
    )
    expect(nodes.find((node) => node.id === "n1")).toMatchObject({ mirror: "install" })
    expect("parent" in (nodes.find((node) => node.id === "n1") as Node)).toBe(false)
  })

  test("a chosen id names the PLACEMENT, and a taken one refuses", () => {
    const nodes = fileOf(
      planned(TWO(), {
        op: "mirror",
        target: "install",
        parent: "now",
        id: "now-install",
      }),
      "now.olai",
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

  test("a chain is allowed, and the reply names what it shows", () => {
    const result = planned(TWO(), {
      op: "mirror",
      target: "now-demo",
      file: "house.olai",
    })
    expect(fileOf(result, "house.olai").find((node) => node.id === "n1"))
      .toMatchObject({ mirror: "now-demo" })
    expect(result.summary).toBe("mirror: demolition")
  })

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

  test("a mirror at the top of its target's own file is fine", () => {
    const nodes = fileOf(
      planned(TWO(), { op: "mirror", target: "demo", file: "house.olai" }),
      "house.olai",
    )
    expect(nodes.find((node) => node.id === "n1")).toMatchObject({ mirror: "demo" })
  })

  test("neither parent nor file is a usage refusal", () => {
    expect(refused(TWO(), { op: "mirror", target: "install" })._tag).toBe("UsageFailure")
  })

  test("a parent in an outline whose lines do not parse is refused", () => {
    const set = setOf(
      { "good.olai": `{"id":"x","ord":"a0","title":"x"}` },
      [],
      { "bad.olai": `{"id":"y","ord":"a0"` },
    )
    expect(refused(set, { op: "mirror", target: "x", file: "bad.olai" })._tag)
      .toBe("ValidationFailure")
  })
})

describe("unmirror", () => {
  const PLACED = (): OutlineSet =>
    setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01"}`,
      ].join("\n"),
      "now.olai": [
        `{"id":"now","ord":"a0","title":"Now"}`,
        `{"id":"now-demo","parent":"now","ord":"a0","mirror":"demo"}`,
        `{"id":"now-kitchen","parent":"now","ord":"a1","mirror":"kitchen"}`,
      ].join("\n"),
    })

  test("takes the placement out and leaves the node alone", () => {
    const result = planned(PLACED(), { op: "unmirror", id: "now-demo" })
    expect(result.files.map((file) => file.file)).toEqual(["now.olai"])
    const nodes = fileOf(result, "now.olai")
    expect(nodes.map((node) => node.id)).toEqual(["now", "now-kitchen"])
    expect(result.summary).toBe("unmirror: demolition")
    expect(result.title).toBe("demolition")
    expect(result.id).toBe("now-demo")
  })

  test("every other placement of the same node stays", () => {
    const set = setOf({
      "now.olai": [
        `{"id":"x","ord":"a0","title":"x"}`,
        `{"id":"one","ord":"a1","mirror":"x"}`,
        `{"id":"two","ord":"a2","mirror":"x"}`,
      ].join("\n"),
    })
    expect(
      fileOf(planned(set, { op: "unmirror", id: "one" }), "now.olai")
        .map((node) => node.id),
    ).toEqual(["x", "two"])
  })

  test("refuses on a regular node, and says what does put a node away", () => {
    const failure = refused(PLACED(), { op: "unmirror", id: "demo" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("is a node, not a mirror")
    expect(failure.message).toContain("outlines_trash")
  })

  test("a placement another mirror chains onto is refused, naming it", () => {
    const set = setOf({
      "now.olai": [
        `{"id":"x","ord":"a0","title":"x"}`,
        `{"id":"one","ord":"a1","mirror":"x"}`,
      ].join("\n"),
      "focus.olai": `{"id":"two","ord":"a0","mirror":"one"}`,
    })
    const failure = refused(set, { op: "unmirror", id: "one" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`two`")
    expect(failure.message).toContain("`mirror`")
    expect(failure.message).toContain("focus.olai:1")
    expect(failure.message).toContain("`x`")
  })

  test("a placement an edge names is refused too, whichever edge it is", () => {
    for (const edge of ["after", "blocks", "see"]) {
      const set = setOf({
        "now.olai": [
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

describe("documents", () => {
  const NOTES = "# Notes\n\nwhat was here before\n"
  const vault = (): OutlineSet =>
    setOf({ "house.olai": KITCHEN }, [["notes/notes.md", NOTES], "flat.md"])

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
    expect(failure.message).not.toContain("vim got there")
  })

  test("a path the set does not hold is refused with the closest one that exists", () => {
    const near = refused(vault(), { op: "doc", file: "notes/notez.md", text: "x" })
    expect(near._tag).toBe("NotFoundFailure")
    expect(near.message).toContain("notes/notes.md")

    const far = refused(vault(), { op: "doc", file: "elsewhere.md", text: "x" })
    expect(far._tag).toBe("NotFoundFailure")
    expect(far.message).toContain("markdown_create")
  })

  test("a `.html` the set holds is not a document this verb may write", () => {
    const set = setOf({ "house.olai": KITCHEN }, [["notes/notes.md", NOTES], "report.html"])
    const failure = refused(set, { op: "doc", file: "report.html", text: "<h1>no</h1>" })
    expect(failure._tag).toBe("NotFoundFailure")
    expect(failure.message).toContain("is not a document under the served directory")
    expect(failure.message).not.toContain("report.html —")
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
    expect(failure.message).toContain("markdown_write")
  })

  test("create judges the path the way every minted path is judged", () => {
    for (const path of ["/etc/notes.md", "../up.md", "a/./b.md", ""]) {
      const failure = refused(vault(), { op: "create-doc", file: path })
      expect(failure._tag).toBe("UsageFailure")
      expect(failure.message).toContain("is not a relative file path")
    }
  })

  test("create refuses a path under a directory the serve's walk prunes", () => {
    for (const path of [".archive/note.md", "notes/.scratch/draft.md", "node_modules/readme.md"]) {
      const failure = refused(vault(), { op: "create-doc", file: path })
      expect(failure._tag).toBe("UsageFailure")
      expect(failure.message).toContain("the serve's walk prunes")
    }
  })
})

describe("delete", () => {
  const DOCS_REFS = [
    `{"id":"renovate","ord":"a0","title":"Renovate the kitchen","desc":"[document](notes/instructions.md)"}`,
    `{"id":"polish","parent":"renovate","ord":"a0","title":"polish the cabinets"}`,
  ].join("\n")
  const docsVault = (): OutlineSet =>
    setOf(
      { "house.olai": DOCS_REFS, "empty.olai": "" },
      [["notes/instructions.md", "# Instructions\n"], "flat.md"],
    )

  test("a document named by nothing goes, whole, and only it", () => {
    const outcome = planned(docsVault(), { op: "delete", file: "flat.md" })
    expect(outcome.files).toEqual([])
    expect(outcome.documents).toBeUndefined()
    expect(outcome.removed).toEqual(["flat.md"])
    expect(outcome.summary).toBe("delete: flat.md")
    expect(outcome.id).toBe("flat.md")
  })

  test("an outline holding NO records goes — the file, not a move", () => {
    const outcome = planned(docsVault(), { op: "delete", file: "empty.olai" })
    expect(outcome.removed).toEqual(["empty.olai"])
    expect(outcome.files).toEqual([])
  })

  test("an outline still carrying records is refused, naming them", () => {
    const failure = refused(docsVault(), { op: "delete", file: "house.olai" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("house.olai")
    expect(failure.message).toContain("still holds")
    expect(failure.message).toContain("`renovate`")
    expect(failure.message).toContain("Renovate the kitchen")
    expect(failure.message).toContain("`polish`")
    expect(failure.message).toContain("outlines_trash")
  })

  test("a document a note still links to is refused, naming the record that names it", () => {
    const failure = refused(docsVault(), { op: "delete", file: "notes/instructions.md" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("still named by")
    expect(failure.message).toContain("`renovate`")
    expect(failure.message).toContain("`link`")
    expect(failure.message).toContain("house.olai:1")
    const busy = setOf(
      {
        "house.olai":
          [0, 1, 2, 3, 4, 5, 6].map((i) =>
            `{"id":"task${i}","ord":"${i >= 9 ? "" : "a0"}${i === 0 ? "" : i}","title":"task ${i}","desc":"[document](notes/instructions.md)"}`
          ).join("\n"),
      },
      ["notes/instructions.md"],
    )
    const many = refused(busy, { op: "delete", file: "notes/instructions.md" })
    expect(many.message).toContain("task4")
    expect(many.message).not.toContain("task5")
    expect(many.message).toContain("and 2 more")
    expect(many.message).toContain("those")
  })

  test("a document a `doc`-DECLARED value names is refused at the same gate", () => {
    const set = setOf(
      {
        "_olai/Properties.olai":
          `{"id":"prop-brief","ord":"a0","title":"brief","custom":{"type":"doc"}}`,
        "house.olai":
          `{"id":"install","ord":"a0","title":"install them","custom":{"brief":"notes/idea.md"}}`,
      },
      ["notes/idea.md"],
    )
    const failure = refused(set, { op: "delete", file: "notes/idea.md" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("still named by")
    expect(failure.message).toContain("`install`")
    expect(failure.message).toContain("`brief`")
    expect(failure.message).toContain("house.olai:1")
  })

  test("a path the set does not hold is refused, naming the closest one it does", () => {
    const near = refused(docsVault(), { op: "delete", file: "notes/instructionz.md" })
    expect(near._tag).toBe("NotFoundFailure")
    expect(near.message).toContain("notes/instructions.md")

    const far = refused(docsVault(), { op: "delete", file: "notes/nothing.this.md" })
    expect(far._tag).toBe("NotFoundFailure")
    expect(far.message).toContain("is not a file under the served directory")
  })

  test("a file olai only SHOWS stays out — it is that file's writer's, never ours", () => {
    const set = setOf({ "house.olai": DOCS_REFS }, ["report.html", "flat.md", "art/shot.png"])
    const failure = refused(set, { op: "delete", file: "report.html" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("only SHOWS")
    expect(failure.message).toContain("is a page")
    expect(failure.message).toContain("whatever put it there")
    expect(refused(set, { op: "delete", file: "art/shot.png" }).message).toContain("is an image")
  })

  test("a file the set could not read is refused with the validator's own words", () => {
    const set = setOf({}, [], { "broken.md": "anything at all" })
    const failure = refused(set, { op: "delete", file: "broken.md" })
    expect(failure._tag).toBe("ValidationFailure")
    expect(failure.message).toContain("Fix the file first")
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
      fileOf(planned(setOf({ "ledger.olai": LEDGER.join("\n") }), request), "ledger.olai"),
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
    expect(after).toContain(LEDGER[3] as string)
    expect(after).toContain(LEDGER[4] as string)
  })
})

test("a file whose lines do not parse is never rewritten from a set that lost them", () => {
  const set = setOf(
    { "good.olai": `{"id":"x","ord":"a0","title":"x"}` },
    [],
    { "bad.olai": `{"id":"y","ord":"a0"` },
  )
  const failure = refused(set, { op: "add", file: "bad.olai", title: "x" })
  expect(failure._tag).toBe("ValidationFailure")
  if (failure._tag !== "ValidationFailure") return
  expect(failure.verdict.findings.length).toBeGreaterThan(0)
  expect(failure.message).toContain("Fix the file first")
})

test("an id nothing declares is not-found and names what was asked for", () => {
  const failure = refused(house(), { op: "done", id: "nope" })
  expect(failure._tag).toBe("NotFoundFailure")
  if (failure._tag !== "NotFoundFailure") return
  expect(failure.named).toBe("nope")
})

test("a mistyped id is offered the one it was probably meant to be, on any op", () => {
  for (const request of [
    { op: "done", id: "instal" },
    { op: "move", id: "instal", parent: "kitchen" },
    { op: "unmirror", id: "instal" },
    { op: "after", id: "order", add: ["instal"] },
    { op: "mirror", target: "instal", file: "house.olai" },
  ] as ReadonlyArray<Request>) {
    const failure = refused(house(), request)
    expect(failure._tag).toBe("NotFoundFailure")
    if (failure._tag !== "NotFoundFailure") return
    expect(failure.named).toBe("instal")
    expect(failure.message).toContain("did you mean `install`")
  }
})

describe("duplicate", () => {
  const copied = (set: OutlineSet, id: string) => {
    const result = planned(set, { op: "duplicate", id })
    return { result, nodes: fileOf(result, "house.olai") }
  }

  const fresh = (
    set: OutlineSet,
    nodes: ReadonlyArray<Node>,
  ): ReadonlyArray<Node> => {
    const before = new Set(recordsOf(set).map((located) => located.node.id))
    return nodes.filter((node) => !before.has(node.id))
  }

  test("the copy lands immediately after the original, under the same parent", () => {
    const { nodes, result } = copied(house(), "order")
    const row = nodes
      .filter((node) => node.parent === "kitchen")
      .sort((a, b) => (a.ord < b.ord ? -1 : 1))
      .map((node) => node.id)
    expect(row).toEqual(["demo", "order", "n1", "install"])
    expect(result.id).toBe("n1")
    expect(result.title).toBe("order the cabinets")
    expect(result.summary).toBe("duplicate: order the cabinets")
    expect(result.captured).toEqual([{ id: "n1", title: "order the cabinets" }])
  })

  test("a deep subtree comes across whole, and every id in it is new", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order"}`,
        `{"id":"quote","parent":"order","ord":"a0","title":"get a quote"}`,
        `{"id":"sign","parent":"quote","ord":"a0","title":"sign it"}`,
        `{"id":"file","parent":"sign","ord":"a0","title":"file the copy"}`,
        `{"id":"pay","parent":"order","ord":"a1","title":"pay the deposit"}`,
      ].join("\n"),
    })
    const { nodes, result } = copied(set, "order")
    const made = fresh(set, nodes)

    expect(made.map((node) => node.id)).toEqual(["n1", "n2", "n3", "n4", "n5"])
    expect(result.summary).toBe("duplicate: order (+4)")

    const parents = Object.fromEntries(made.map((node) => [node.id, node.parent]))
    expect(parents).toEqual({
      n1: "kitchen",
      n2: "n1",
      n3: "n2",
      n4: "n3",
      n5: "n1",
    })
    expect(made.map((node) => (node as RegularNode).title)).toEqual([
      "order",
      "get a quote",
      "sign it",
      "file the copy",
      "pay the deposit",
    ])
    const ids = nodes.map((node) => node.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test("the ords below the root are the originals', because the siblings are all copies", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"order","ord":"a0","title":"order"}`,
        `{"id":"one","parent":"order","ord":"a0","title":"one"}`,
        `{"id":"two","parent":"order","ord":"a1","title":"two"}`,
        `{"id":"three","parent":"order","ord":"a2","title":"three"}`,
      ].join("\n"),
    })
    const { nodes } = copied(set, "order")
    expect(fresh(set, nodes).map((node) => node.ord)).toEqual(["a1", "a0", "a1", "a2"])
  })

  test("every field but the ids and the stamps comes across verbatim", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"order","ord":"a0","title":"order the cabinets","done":"2026-08-01T09:00:00-04:00","date":"2026-08-01","desc":"two\\nlines","custom":{"pr":"https://example/1"},"created":"2020-01-01T00:00:00-04:00","changed":"2021-01-01T00:00:00-04:00"}`,
      ].join("\n"),
    })
    const { nodes } = copied(set, "order")
    const copy = record(fresh(set, nodes), "n1")

    expect(copy.done).toBe("2026-08-01T09:00:00-04:00")
    expect(copy.date).toBe("2026-08-01")
    expect(copy.desc).toBe("two\nlines")
    expect(copy.custom).toEqual({ pr: "https://example/1" })
    expect(copy.created).toBe(STAMP)
    expect(copy.changed).toBeUndefined()
  })

  test("a repeat rule and its date come across, so the copy is its own recurrence", () => {
    const set = setOf({
      "house.olai":
        `{"id":"bins","ord":"a0","title":"put the bins out","date":"2026-08-03","repeat":"every week on monday","todo":true}`,
    })
    const copy = record(fresh(set, copied(set, "bins").nodes), "n1")
    expect(copy.repeat).toBe("every week on monday")
    expect(copy.date).toBe("2026-08-03")
    expect(copy.todo).toBe(true)
  })

  test("an `after` edge INSIDE the subtree is re-aimed at the copy", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"job","ord":"a0","title":"the job"}`,
        `{"id":"order","parent":"job","ord":"a0","title":"order","todo":true}`,
        `{"id":"install","parent":"job","ord":"a1","title":"install","todo":true,"after":["order"]}`,
      ].join("\n"),
    })
    const { nodes } = copied(set, "job")
    const made = fresh(set, nodes)
    expect(record(made, "n3").after).toEqual(["n2"])
    expect(record(nodes, "install").after).toEqual(["order"])
  })

  test("an edge that LEAVES the subtree keeps its target", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"permit","ord":"a0","title":"the permit","todo":true}`,
        `{"id":"job","ord":"a1","title":"the job"}`,
        `{"id":"order","parent":"job","ord":"a0","title":"order","todo":true,"after":["permit"],"see":["permit"]}`,
      ].join("\n"),
    })
    const made = fresh(set, copied(set, "job").nodes)
    expect(record(made, "n2").after).toEqual(["permit"])
    expect(record(made, "n2").see).toEqual(["permit"])
  })

test("an edge pointing INTO the subtree stays on the original", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"job","ord":"a0","title":"the job"}`,
        `{"id":"order","parent":"job","ord":"a0","title":"order","todo":true}`,
        `{"id":"watcher","ord":"a1","title":"the watcher","see":["order"],"after":["order"]}`,
      ].join("\n"),
    })
    const { nodes } = copied(set, "job")
    expect(record(nodes, "watcher").see).toEqual(["order"])
    expect(record(nodes, "watcher").after).toEqual(["order"])
    const made = fresh(set, nodes)
    expect(made.map((node) => (node as RegularNode).title)).toEqual(["the job", "order"])
    for (const node of made) expect((node as RegularNode).see).toBeUndefined()
  })


  test("a mirror under the subtree is copied as a PLACEMENT, target and all", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"now","ord":"a0","title":"Now"}`,
        `{"id":"m","parent":"now","ord":"a0","mirror":"live"}`,
        `{"id":"live","ord":"a1","title":"the live item"}`,
      ].join("\n"),
    })
    const { nodes, result } = copied(set, "now")
    const made = fresh(set, nodes)
    expect(made).toEqual([
      { id: "n1", ord: "a0V", title: "Now", created: STAMP },
      { id: "n2", parent: "n1", ord: "a0", mirror: "live" },
    ])
    expect(result.captured).toEqual([{ id: "n1", title: "Now" }])
    expect(result.summary).toBe("duplicate: Now (+1)")
  })

  test("a mirror whose target is INSIDE the subtree shows the copy", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"week","ord":"a0","title":"This week"}`,
        `{"id":"task","parent":"week","ord":"a0","title":"the task"}`,
        `{"id":"now","parent":"week","ord":"a1","title":"Now"}`,
        `{"id":"m","parent":"now","ord":"a0","mirror":"task"}`,
      ].join("\n"),
    })
    const made = fresh(set, copied(set, "week").nodes)
    expect(made.find((node) => node.id === "n4")).toEqual({
      id: "n4",
      parent: "n3",
      ord: "a0",
      mirror: "n2",
    })
  })

  test("a `see` between two nodes of the subtree follows the copy, both ends", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"plan","ord":"a0","title":"the plan"}`,
        `{"id":"a","parent":"plan","ord":"a0","title":"a","see":["b"]}`,
        `{"id":"b","parent":"plan","ord":"a1","title":"b","see":["a"]}`,
      ].join("\n"),
    })
    const made = fresh(set, copied(set, "plan").nodes)
    expect(record(made, "n2").see).toEqual(["n3"])
    expect(record(made, "n3").see).toEqual(["n2"])
  })

  test("the original is untouched — every record it had, unchanged", () => {
    const before = house()
    const { nodes } = copied(before, "kitchen")
    for (const located of recordsOf(before)) {
      expect(nodes.find((node) => node.id === located.node.id)).toEqual(located.node)
    }
  })

  test("a `done` parent standing over copied open work is re-opened, and says so", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel","done":"2026-08-01"}`,
        `{"id":"order","parent":"kitchen","ord":"a0","title":"order","todo":true}`,
      ].join("\n"),
    })
    const result = planned(set, { op: "duplicate", id: "order" })
    expect(record(fileOf(result, "house.olai"), "kitchen").done).toBeUndefined()
    expect(result.nudge).toContain("Kitchen remodel")
    expect(result.summary).toContain("reopened: Kitchen remodel")
  })

  test("a mirror cannot be duplicated — it is a placement, and it says which node to name", () => {
    const set = setOf({
      "house.olai": KITCHEN,
      "week.olai": `{"id":"m","ord":"a0","mirror":"order"}`,
    })
    expect(refused(set, { op: "duplicate", id: "m" }).message).toContain("`m` is a mirror")
    expect(refused(set, { op: "duplicate", id: "m" }).message).toContain("`order`")
  })

  test("an id nothing declares is refused with the closest one that exists", () => {
    const failure = refused(house(), { op: "duplicate", id: "ordr" })
    expect(failure._tag).toBe("NotFoundFailure")
    expect(failure.message).toContain("order")
  })

  test("it is one op in a batch, and the ids it minted are the batch's to name", () => {
    const result = planned(house(), {
      op: "apply",
      ops: [
        { op: "duplicate", id: "order" },
        { op: "title", id: "n1", title: "order the handles" },
      ],
    })
    expect(record(fileOf(result, "house.olai"), "n1").title).toBe("order the handles")
  })
})

test("whatever an op plans, the bytes are one record per line", () => {
  for (const request of [
    { op: "add", parent: "kitchen", title: "with a note", desc: "two\nlines" },
    { op: "done", id: "order" },
    { op: "move", id: "install", before: "demo" },
    { op: "trash", id: "order" },
    { op: "duplicate", id: "kitchen" },
  ] as ReadonlyArray<Request>) {
    for (const file of planned(house(), request).files) {
      const text = serializeOutline(file.nodes)
      expect(text.split("\n")).toHaveLength(file.nodes.length + 1)
      expect(text.endsWith("\n\n")).toBe(false)
    }
  }
})

const DECLARED = {
  "_olai/Properties.olai": [
    `{"id":"prop-merge","ord":"a0","title":"merge","custom":{"type":"ref"}}`,
    `{"id":"auto","parent":"prop-merge","ord":"a0","title":"automatic"}`,
    `{"id":"human","parent":"prop-merge","ord":"a1","title":"the human merges"}`,
    `{"id":"prop-dispatched","ord":"a1","title":"dispatched","custom":{"type":"date"}}`,
    `{"id":"prop-pr","ord":"a2","title":"pr","custom":{"type":"int"}}`,
    `{"id":"prop-brief","ord":"a3","title":"brief","custom":{"type":"doc"}}`,
    `{"id":"prop-agent","ord":"a4","title":"agent","custom":{"type":"ref","under":"roster"}}`,
  ].join("\n"),
  "agents.olai": [
    `{"id":"roster","ord":"a0","title":"the agents"}`,
    `{"id":"claude","parent":"roster","ord":"a0","title":"Claude"}`,
    `{"id":"grok","parent":"roster","ord":"a1","title":"Grok"}`,
  ].join("\n"),
  "lanes.olai": `{"id":"lane","ord":"a0","title":"the props lane"}`,
}

const board = (): OutlineSet => setOf(DECLARED, ["briefs/pdb.md"])

const laneAfter = (request: Request): RegularNode =>
  record(fileOf(planned(board(), request), "lanes.olai"), "lane")

describe("typed properties", () => {
  test("outlines_prop refuses a value that does not fit, naming what the key may hold", () => {
    expect(
      refused(board(), {
        op: "prop",
        id: "lane",
        key: "merge",
        value: "AUTO: grok review folded + CI green",
      }).message,
    ).toContain("`merge` is `auto` | `human`")
    expect(
      refused(board(), {
        op: "prop",
        id: "lane",
        key: "dispatched",
        value: "2026-08-25 10:06 (sweep queue #5)",
      }).message,
    ).toContain("the story goes in the note")
    expect(
      refused(board(), { op: "prop", id: "lane", key: "agent", value: "claude-opus" }).message,
    ).toContain("names a node under `roster`")
  })

  test("...and the refusal offers the variant a value is a typo of", () => {
    expect(
      refused(board(), { op: "prop", id: "lane", key: "agent", value: "clade" }).message,
    ).toContain("did you mean `claude`?")
  })

  test("outlines_prop STORES the one spelling, folding the obvious ones into it", () => {
    expect(
      laneAfter({ op: "prop", id: "lane", key: "dispatched", value: "2026-08-25 10:06" })
        .custom?.dispatched,
    ).toBe("2026-08-25T10:06:00-04:00")
    expect(
      laneAfter({ op: "prop", id: "lane", key: "pr", value: "  193  " }).custom?.pr,
    ).toBe("193")
  })

  test("a REMOVAL is not a value, so a declared key is still removable", () => {
    const held = setOf({
      ...DECLARED,
      "lanes.olai": `{"id":"lane","ord":"a0","title":"the props lane","custom":{"pr":"193"}}`,
    }, ["briefs/pdb.md"])
    const plan = planned(held, { op: "prop", id: "lane", key: "pr", value: null })
    expect(record(fileOf(plan, "lanes.olai"), "lane").custom?.pr).toBeUndefined()
  })

  test("an undeclared key is untouched — typing is opt-in per key", () => {
    expect(
      laneAfter({
        op: "prop",
        id: "lane",
        key: "terminal",
        value: "  a uuid, and a remark about it  ",
      }).custom?.terminal,
    ).toBe("  a uuid, and a remark about it  ")
  })

  test("a doc value is resolved against the outline that names it", () => {
    expect(
      laneAfter({ op: "prop", id: "lane", key: "brief", value: "briefs/pdb.md" })
        .custom?.brief,
    ).toBe("briefs/pdb.md")
    expect(
      refused(board(), { op: "prop", id: "lane", key: "brief", value: "briefs/nope.md" })
        .message,
    ).toContain("no such `.md` file is served")
  })

  test("a bad type in a Properties declaration is refused naming the legal vocabulary", () => {
    const held = setOf({
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
    })
    const failure = refused(held, {
      op: "add",
      file: "_olai/Properties.olai",
      title: "took",
      props: { type: "took" },
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`type` is `took`, which is not a property type")
    expect(failure.message).toContain("`text` (anything)")
    expect(failure.message).toContain("`date` (an ISO day or instant)")
    expect(failure.message).toContain("`int` (a digit run)")
    expect(failure.message).toContain("`path` (no whitespace; optional `base`)")
    expect(failure.message).toContain("`doc` (a served `.md`; optional `base`)")
    expect(failure.message).toContain("`ref` (a child's id; `under` names the parent)")
    expect(failure.message).toContain("`node` (any node id)")
  })

  test("a Properties declaration missing its type is refused naming the same vocabulary", () => {
    const held = setOf({
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
    })
    const failure = refused(held, {
      op: "add",
      file: "_olai/Properties.olai",
      title: "musts",
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("does not say its `type`")
    expect(failure.message).toContain("`text` (anything)")
    expect(failure.message).toContain("`ref` (a child's id; `under` names the parent)")
    expect(failure.message).toContain("`int` (a digit run)")
  })

  test("outlines_prop of a bad type on a declaration is the same refusal", () => {
    const held = setOf({
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
    })
    const failure = refused(held, {
      op: "prop",
      id: "prop-pr",
      key: "type",
      value: "colour",
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`type` is `colour`, which is not a property type")
    expect(failure.message).toContain("`ref` (a child's id; `under` names the parent)")
  })

  test("a ref declaration without `under` is still legal — variants hang under it", () => {
    const held = setOf({
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
    })
    const plan = planned(held, {
      op: "add",
      file: "_olai/Properties.olai",
      title: "merge",
      props: { type: "ref" },
    })
    expect(record(fileOf(plan, "_olai/Properties.olai"), "n1").custom).toEqual({ type: "ref" })
  })

  test("a type declaration refuses while existing values do not fit, naming the offenders", () => {
    const held = setOf({
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
      "lanes.olai": [
        `{"id":"a","ord":"a0","title":"first","custom":{"brainstorm":"not a path"}}`,
        `{"id":"b","ord":"a1","title":"second","custom":{"brainstorm":"also prose"}}`,
        `{"id":"c","ord":"a2","title":"third","custom":{"brainstorm":"still not"}}`,
      ].join("\n"),
    }, ["briefs/one.md", "briefs/two.md", "briefs/three.md"])
    const failure = refused(held, {
      op: "add",
      file: "_olai/Properties.olai",
      title: "brainstorm",
      props: { type: "doc" },
    })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`brainstorm` cannot be declared `doc`")
    expect(failure.message).toContain("3 existing values do not fit")
    expect(failure.message).toContain("`lanes.olai` `first` (`a`) holds \"not a path\"")
    expect(failure.message).toContain("`lanes.olai` `second` (`b`) holds \"also prose\"")
    expect(failure.message).toContain("`lanes.olai` `third` (`c`) holds \"still not\"")
    expect(failure.message).toContain("one `apply` can write them all")
    expect(failure.message).toContain("Nothing was written")
  })

  test("...and passes once those values fit", () => {
    const held = setOf({
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
      "lanes.olai": [
        `{"id":"a","ord":"a0","title":"first","custom":{"brainstorm":"briefs/one.md"}}`,
        `{"id":"b","ord":"a1","title":"second","custom":{"brainstorm":"briefs/two.md"}}`,
        `{"id":"c","ord":"a2","title":"third","custom":{"brainstorm":"briefs/three.md"}}`,
      ].join("\n"),
    }, ["briefs/one.md", "briefs/two.md", "briefs/three.md"])
    const plan = planned(held, {
      op: "add",
      file: "_olai/Properties.olai",
      title: "brainstorm",
      props: { type: "doc" },
    })
    expect(record(fileOf(plan, "_olai/Properties.olai"), "n1").custom).toEqual({ type: "doc" })
    expect(Result.isSuccess(validate(TEST_CLAIMS, after(held, {
      op: "add",
      file: "_olai/Properties.olai",
      title: "brainstorm",
      props: { type: "doc" },
    })))).toBe(true)
  })

  test("outlines_prop of type on a declaration is the same existing-values fence", () => {
    const held = setOf({
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
      "lanes.olai": `{"id":"lane","ord":"a0","title":"a lane","custom":{"pr":"193"}}`,
    }, ["briefs/one.md"])
    const failure = refused(held, { op: "prop", id: "prop-pr", key: "type", value: "doc" })
    expect(failure.message).toContain("`pr` cannot be declared `doc`")
    expect(failure.message).toContain("`lanes.olai` `a lane` (`lane`) holds \"193\"")
  })

  test("renaming a declaration onto a key that has unfit values is the same fence", () => {
    const held = setOf({
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"doc"}}`,
      "lanes.olai":
        `{"id":"lane","ord":"a0","title":"a lane","custom":{"brainstorm":"not a path"}}`,
    }, ["briefs/one.md"])
    const failure = refused(held, { op: "title", id: "prop-pr", title: "brainstorm" })
    expect(failure.message).toContain("`brainstorm` cannot be declared `doc`")
    expect(failure.message).toContain("`lanes.olai` `a lane` (`lane`) holds \"not a path\"")
  })

  test("a new ref may land over values that name variants minted in the same capture", () => {
    const held = setOf({
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
      "lanes.olai": `{"id":"lane","ord":"a0","title":"a lane","custom":{"merge":"auto"}}`,
    })
    const plan = planned(held, {
      op: "add",
      file: "_olai/Properties.olai",
      title: "merge",
      props: { type: "ref" },
      children: [
        { id: "auto", title: "automatic" },
        { id: "human", title: "the human merges" },
      ],
    })
    expect(record(fileOf(plan, "_olai/Properties.olai"), "n1").custom).toEqual({ type: "ref" })
  })

  test("...and over a list whose members are those minted variants", () => {
    const held = setOf({
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
      "lanes.olai":
        `{"id":"lane","ord":"a0","title":"a lane","custom":{"merge":["auto","human"]}}`,
    })
    const plan = planned(held, {
      op: "add",
      file: "_olai/Properties.olai",
      title: "merge",
      props: { type: "ref" },
      children: [
        { id: "auto", title: "automatic" },
        { id: "human", title: "the human merges" },
      ],
    })
    expect(record(fileOf(plan, "_olai/Properties.olai"), "n1").custom).toEqual({ type: "ref" })
  })

  test("a ref with under naming another node does not treat minted children as variants", () => {
    const held = setOf({
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
      "agents.olai": [
        `{"id":"roster","ord":"a0","title":"the agents"}`,
        `{"id":"gpt","parent":"roster","ord":"a0","title":"GPT"}`,
      ].join("\n"),
      "lanes.olai": `{"id":"lane","ord":"a0","title":"a lane","custom":{"agent2":"claude"}}`,
    })
    const failure = refused(held, {
      op: "add",
      file: "_olai/Properties.olai",
      title: "agent2",
      props: { type: "ref", under: "roster" },
      children: [{ id: "claude", title: "Claude" }],
    })
    expect(failure.message).toContain("`agent2` cannot be declared `ref`")
    expect(failure.message).toContain("`lanes.olai` `a lane` (`lane`) holds \"claude\"")
  })

  test("outlines_move into Properties is the same existing-values fence", () => {
    const held = setOf({
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
      "draft.olai":
        `{"id":"prop-brief","ord":"a0","title":"brainstorm","custom":{"type":"doc"}}`,
      "lanes.olai":
        `{"id":"lane","ord":"a0","title":"a lane","custom":{"brainstorm":"not a path"}}`,
    }, ["briefs/one.md"])
    const failure = refused(held, {
      op: "move",
      id: "prop-brief",
      file: "_olai/Properties.olai",
    })
    expect(failure.message).toContain("`brainstorm` cannot be declared `doc`")
    expect(failure.message).toContain("`lanes.olai` `a lane` (`lane`) holds \"not a path\"")
  })

  test("...and a ref with under naming another node does not treat its children as variants", () => {
    const held = setOf({
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
      "draft.olai": [
        `{"id":"agent2","ord":"a0","title":"agent2","custom":{"type":"ref","under":"roster"}}`,
        `{"id":"claude","parent":"agent2","ord":"a0","title":"Claude"}`,
      ].join("\n"),
      "agents.olai": [
        `{"id":"roster","ord":"a0","title":"the agents"}`,
        `{"id":"gpt","parent":"roster","ord":"a0","title":"GPT"}`,
      ].join("\n"),
      "lanes.olai": `{"id":"lane","ord":"a0","title":"a lane","custom":{"agent2":"claude"}}`,
    })
    const failure = refused(held, {
      op: "move",
      id: "agent2",
      file: "_olai/Properties.olai",
    })
    expect(failure.message).toContain("`agent2` cannot be declared `ref`")
    expect(failure.message).toContain("`lanes.olai` `a lane` (`lane`) holds \"claude\"")
  })

  test("trash_restore into Properties is the same fence", () => {
    const held = setOf({
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
      "lanes.olai":
        `{"id":"lane","ord":"a0","title":"a lane","custom":{"brainstorm":"not a path"}}`,
      "_olai/Trash.olai":
        `{"id":"prop-brief","ord":"a0","title":"brainstorm","custom":{"type":"doc"}}`,
    }, ["briefs/one.md"])
    const failure = refused(held, {
      op: "untrash",
      id: "prop-brief",
      file: "_olai/Properties.olai",
    })
    expect(failure.message).toContain("`brainstorm` cannot be declared `doc`")
    expect(failure.message).toContain("`lanes.olai` `a lane` (`lane`) holds \"not a path\"")
  })

  test("outlines_duplicate of a declaration is the same fence — the key is already claimed", () => {
    const failure = refused(board(), { op: "duplicate", id: "prop-merge" })
    expect(failure.message).toContain("`merge` is already declared by an earlier node")
  })

  test("outlines_split of a Properties root that renames onto a key with unfit values is the same fence", () => {
    const held = setOf({
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
      "lanes.olai":
        `{"id":"lane","ord":"a0","title":"a lane","custom":{"brainstorm":"not a path"}}`,
    }, ["briefs/one.md"])
    const failure = refused(held, {
      op: "split",
      id: "prop-pr",
      title: "brainstorm",
      rest: " leftover",
    })
    expect(failure.message).toContain("`brainstorm` cannot be declared `int`")
    expect(failure.message).toContain("`lanes.olai` `a lane` (`lane`) holds \"not a path\"")
  })

  test("outlines_split of a Properties root still refuses the typeless tail", () => {
    const held = setOf({
      "_olai/Properties.olai":
        `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
    })
    const failure = refused(held, {
      op: "split",
      id: "prop-pr",
      title: "pr",
      rest: "tail",
    })
    expect(failure.message).toContain("`tail` declares a property key but does not say its `type`")
  })

  test("outlines_merge of a Properties root is the same existing-values fence", () => {
    const held = setOf({
      "_olai/Properties.olai": [
        `{"id":"brain","ord":"a0","title":"brain","custom":{"type":"doc"}}`,
        `{"id":"storm","ord":"a1","title":"storm","custom":{"type":"doc"}}`,
      ].join("\n"),
      "lanes.olai":
        `{"id":"lane","ord":"a0","title":"a lane","custom":{"brainstorm":"not a path"}}`,
    }, ["briefs/one.md"])
    const failure = refused(held, { op: "merge", id: "storm" })
    expect(failure.message).toContain("`brainstorm` cannot be declared `doc`")
    expect(failure.message).toContain("`lanes.olai` `a lane` (`lane`) holds \"not a path\"")
  })

  test("files_create of Properties.olai is the same fence over the rest of the set", () => {
    const held = setOf({
      "lanes.olai":
        `{"id":"lane","ord":"a0","title":"a lane","custom":{"brainstorm":"not a path"}}`,
    }, ["briefs/one.md"])
    const failure = refused(held, {
      op: "create",
      file: "_olai/Properties.olai",
      seed: { title: "brainstorm", props: { type: "doc" } },
    })
    expect(failure.message).toContain("`brainstorm` cannot be declared `doc`")
    expect(failure.message).toContain("`lanes.olai` `a lane` (`lane`) holds \"not a path\"")
  })

  test("one apply fixing every bad value in a file succeeds where a single write would leave the set invalid", () => {
    const broken = setOf({
      "_olai/Properties.olai":
        `{"id":"prop-brief","ord":"a0","title":"brainstorm","custom":{"type":"doc"}}`,
      "lanes.olai": [
        `{"id":"a","ord":"a0","title":"first","custom":{"brainstorm":"not a path"}}`,
        `{"id":"b","ord":"a1","title":"second","custom":{"brainstorm":"also prose"}}`,
        `{"id":"c","ord":"a2","title":"third","custom":{"brainstorm":"still not"}}`,
      ].join("\n"),
    }, ["briefs/one.md", "briefs/two.md", "briefs/three.md"])
    expect(findingsIn(judged(broken)).map((row) => row.code))
      .toEqual(["bad-prop", "bad-prop", "bad-prop"])
    expect(judged(broken).broken.map((one) => one.file)).toEqual(["lanes.olai"])

    const one = after(broken, {
      op: "prop",
      id: "a",
      key: "brainstorm",
      value: "briefs/one.md",
    })
    const stillBroken = judged(one)
    expect(findingsIn(stillBroken).map((row) => row.code)).toEqual([
      "bad-prop",
      "bad-prop",
    ])
    expect(admits(stillBroken.broken, ["lanes.olai"])._tag).toBe("implicated")

    const all = after(broken, {
      op: "apply",
      ops: [
        { op: "prop", id: "a", key: "brainstorm", value: "briefs/one.md" },
        { op: "prop", id: "b", key: "brainstorm", value: "briefs/two.md" },
        { op: "prop", id: "c", key: "brainstorm", value: "briefs/three.md" },
      ],
    })
    expect(judged(all).broken).toEqual([])
    expect(admits(judged(all).broken, ["lanes.olai"])._tag).toBe("admitted")
    expect(customOf(all, "a")).toEqual({ brainstorm: "briefs/one.md" })
    expect(customOf(all, "b")).toEqual({ brainstorm: "briefs/two.md" })
    expect(customOf(all, "c")).toEqual({ brainstorm: "briefs/three.md" })
  })

  test("apply can reach a value on a trashed node", () => {
    const held = setOf({
      "house.olai": `{"id":"live","ord":"a0","title":"still here"}`,
      "_olai/Trash.olai":
        `{"id":"filed","ord":"a0","title":"put away","custom":{"brainstorm":"old prose"}}`,
    })
    const plan = planned(held, {
      op: "apply",
      ops: [{ op: "prop", id: "filed", key: "brainstorm", value: "new prose" }],
    })
    expect(record(fileOf(plan, "_olai/Trash.olai"), "filed").custom).toEqual({
      brainstorm: "new prose",
    })
  })

  test("outlines_add refuses a bad value on the node being born", () => {
    expect(
      refused(board(), {
        op: "add",
        file: "lanes.olai",
        title: "a new lane",
        props: { pr: "#194" },
      }).message,
    ).toContain("`pr` is a whole number")
  })

  test("...and on a CHILD of it, which is the door the walk reaches", () => {
    expect(
      refused(board(), {
        op: "add",
        file: "lanes.olai",
        title: "a new lane",
        children: [{ title: "a step", props: { merge: "maybe" } }],
      }).message,
    ).toContain("`merge` is `auto` | `human`")
  })

  test("a captured node stores the normalised value, not the one that was sent", () => {
    const plan = planned(board(), {
      op: "add",
      file: "lanes.olai",
      title: "a new lane",
      props: { dispatched: "2026-08-25 10:06", pr: "194" },
    })
    const born = record(fileOf(plan, "lanes.olai"), "n1")
    expect(born.custom).toEqual({ dispatched: "2026-08-25T10:06:00-04:00", pr: "194" })
  })

  test("files_create's seed is the same capture, so it is the same refusal", () => {
    expect(
      refused(board(), {
        op: "create",
        file: "more.olai",
        seed: { title: "a lane", props: { agent: "claude-opus" } },
      }).message,
    ).toContain("names a node under `roster`")
  })

  test("update writes properties through outlines_prop's own planner, in its words", () => {
    expect(
      refused(board(), { op: "update", id: "lane", props: { merge: "maybe" } }).message,
    ).toContain("`merge` is `auto` | `human`")
    const plan = planned(board(), {
      op: "update",
      id: "lane",
      props: { dispatched: "2026-08-25 10:06" },
    })
    expect(record(fileOf(plan, "lanes.olai"), "lane").custom?.dispatched)
      .toBe("2026-08-25T10:06:00-04:00")
  })

  test("apply refuses the whole list, naming which op did it", () => {
    const failure = refused(board(), {
      op: "apply",
      ops: [
        { op: "prop", id: "lane", key: "pr", value: "194" },
        { op: "prop", id: "lane", key: "pr", value: "one hundred and ninety four" },
      ],
    })
    expect(failure.message).toContain("`pr` is a whole number")
    expect(failure.message).toContain("`ops[1]` (`prop`) was refused, so nothing in this batch was written")
  })

  test("apply's `prop` is outlines_prop's whole arm — the `was` included, refused as itself", () => {
    const failure = refused(board(), {
      op: "apply",
      ops: [
        { op: "prop", id: "lane", key: "stage", value: "audit" },
        { op: "prop", id: "lane", key: "stage", value: "submitted", was: "review" },
      ],
    })
    expect(failure.message).toContain("`ops[1]` (`prop`) was refused, so nothing in this batch was written")
    expect(failure.message).toContain(
      "is not the value this write expected to replace (`review`) — it now says `audit`",
    )
  })

  test("outlines_duplicate copies a declared value and stays legal", () => {
    const held = setOf({
      ...DECLARED,
      "lanes.olai": `{"id":"lane","ord":"a0","title":"the props lane","custom":{"merge":"auto"}}`,
    }, ["briefs/pdb.md"])
    const plan = planned(held, { op: "duplicate", id: "lane" })
    const copy = fileOf(plan, "lanes.olai").filter((node) => node.id !== "lane")
    expect((copy[0] as RegularNode).custom).toEqual({ merge: "auto" })
  })
})

describe("typed properties, further", () => {
  test("trash_empty names the records that point into the archive by a typed property", () => {
    const held = setOf({
      ...DECLARED,
      "lanes.olai":
        `{"id":"lane","ord":"a0","title":"the props lane","custom":{"agent":"grok"}}`,
    }, ["briefs/pdb.md"])
    const emptied = after(held, { op: "trash", id: "grok" })
    const failure = refused(emptied, { op: "empty", file: "_olai/Trash.olai" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("still has a record pointed INTO it")
    expect(failure.message).toContain("`lane` (`agent`, lanes.olai:1)")
  })

  test("...and a vault that declares no reference key pays no walk and refuses nothing", () => {
    const values = setOf({
      "_olai/Properties.olai": `{"id":"prop-pr","ord":"a0","title":"pr","custom":{"type":"int"}}`,
      "agents.olai": [
        `{"id":"roster","ord":"a0","title":"the agents"}`,
        `{"id":"grok","parent":"roster","ord":"a0","title":"Grok"}`,
      ].join("\n"),
      "lanes.olai": `{"id":"lane","ord":"a0","title":"a lane","custom":{"agent":"grok"}}`,
    })
    const emptied = after(values, { op: "trash", id: "grok" })
    expect(planned(emptied, { op: "empty", file: "_olai/Trash.olai" }).id)
      .toBe("_olai/Trash.olai")
  })

  test("a birth refusal names WHICH node of the capture it is about", () => {
    const failure = refused(board(), {
      op: "add",
      file: "lanes.olai",
      title: "a new lane",
      children: [{ title: "the second step", props: { merge: "maybe" } }],
    })
    expect(failure.message).toStartWith("`the second step` carries a property this vault refuses")
    expect(failure.message).toContain("`merge` is `auto` | `human`")
    expect(failure.message).toContain("Nothing was written.")
  })

  test("what every door writes, the validator accepts — the whole lifecycle", () => {
    const born = after(board(), {
      op: "add",
      file: "lanes.olai",
      id: "fresh",
      title: "a fresh lane",
      props: { dispatched: "2026-8-30", pr: "  194  ", merge: "human" },
    })
    expect(Result.isSuccess(validate(TEST_CLAIMS, born))).toBe(true)
    expect(customOf(born, "fresh")).toEqual({
      dispatched: "2026-08-30",
      pr: "194",
      merge: "human",
    })
    const edited = after(born, {
      op: "update",
      id: "fresh",
      props: { dispatched: "2026-08-31T09:00:00-04:00" },
    })
    expect(Result.isSuccess(validate(TEST_CLAIMS, edited))).toBe(true)
    const copied = after(edited, { op: "duplicate", id: "fresh" })
    expect(Result.isSuccess(validate(TEST_CLAIMS, copied))).toBe(true)
    const cleared = after(copied, { op: "prop", id: "fresh", key: "pr", value: null })
    expect(Result.isSuccess(validate(TEST_CLAIMS, cleared))).toBe(true)
    expect(customOf(cleared, "fresh")["pr"]).toBeUndefined()
  })
})

const customOf = (set: OutlineSet, id: string): Record<string, unknown> => {
  const found = recordsOf(set).find((at) => at.node.id === id)
  if (found === undefined) throw new Error(`no node \`${id}\` in the set`)
  return { ...(found.node as RegularNode).custom }
}

test("a pin rename precondition is rechecked when the row leaves the active shelf", () => {
  const pin = { id: "pin", ord: "a0", title: "/#order" }
  const request = { op: "title", id: "pin", title: "[Renamed](/#order)", was: pin.title, pinned: true } as const
  const initial = setOf({ "_olai/Pins.olai": JSON.stringify(pin) })
  expect(record(fileOf(planned(initial, request), "_olai/Pins.olai"), "pin").title).toBe(request.title)
  const moved: ReadonlyArray<Record<string, string>> = [
    { "_olai/Pins.olai": "", "_olai/Trash.olai": JSON.stringify(pin) },
    { "_olai/Pins.olai": JSON.stringify({ id: "folder", ord: "a0", title: "folder" }) + "\n" + JSON.stringify({ ...pin, parent: "folder" }) },
    { "_olai/Pins.olai": JSON.stringify(pin), "_olai/pins.olai": JSON.stringify({ id: "other", ord: "a0", title: "/garden.olai" }) },
  ]
  for (const files of moved) {
    expect(refused(setOf(files), request).message).toContain("no longer pinned")
  }
})

describe("dead-link nudges", () => {
  const set = () => setOf({ "projects/olai.olai": '{"id":"a","ord":"a0","title":"A"}' }, [["notes/nix-flakes.md", "# Nix"], ["projects/readme.md", "before"]])
  for (const op of ["title", "desc"] as const) {
    test(`${op} names a new dead link without refusing the write`, () => {
      const request = op === "title" ? { op, id: "a", title: "[x](nix-flakes.md)" } : { op, id: "a", desc: "[x](nix-flakes.md)" }
      expect(planned(set(), request).nudge).toContain("did you mean `../notes/nix-flakes.md`?")
    })
  }
  test("capture and document writes carry the same nudge", () => {
    expect(planned(set(), { op: "add", file: "projects/olai.olai", title: "[x](nix-flakes.md)" }).nudge).toContain("projects/nix-flakes.md")
    expect(planned(set(), { op: "doc", file: "projects/readme.md", text: "[x](nix-flakes.md)" }).nudge).toContain("../notes/nix-flakes.md")
    expect(planned(set(), { op: "create-doc", file: "projects/new.md", text: "[x](nix-flakes.md)" }).nudge).toContain("../notes/nix-flakes.md")
  })
  test("a note cannot finish an incomplete link in the title", () => {
    const existing = setOf({ "a.olai": '{"id":"a","ord":"a0","title":"[unfinished"}' })
    expect(planned(existing, { op: "desc", id: "a", desc: "](missing.md)" }).nudge).toBeUndefined()
  })
  test("creating an outline with a seed warns, including the first Inbox capture", () => {
    expect(planned(setOf({}), { op: "create", file: "_olai/Inbox.olai", seed: { title: "[missing](../missing.md)" } }).nudge).toContain("missing.md")
  })
  test("document frontmatter and code do not warn", () => {
    const text = '---\nexample: "[x](yaml.md)"\n---\n`[x](code.md)`'
    expect(planned(set(), { op: "doc", file: "projects/readme.md", text }).nudge).toBeUndefined()
  })
  test("an unchanged dead link is not nudged again", () => {
    const existing = setOf({ "a.olai": '{"id":"a","ord":"a0","title":"A","desc":"[x](missing.md)"}' })
    expect(planned(existing, { op: "desc", id: "a", desc: "[x](missing.md) again" }).nudge).toBeUndefined()
  })
})

describe("files held by prose links", () => {
  test("a live title, note and document body each hold the named file", () => {
    for (const field of ["title", "desc"] as const) {
      const set = setOf({ "projects/a.olai": JSON.stringify({ id: "a", ord: "a0", title: "A", [field]: "[target](../target.md#scope)" }) }, ["target.md"])
      const failure = refused(set, { op: "delete", file: "target.md" })
      expect(failure.message).toContain("`a` (`link`, projects/a.olai:1)")
    }
    const set = setOf({}, [["notes/source.md", "[target](../target.md#scope)"], "target.md"])
    expect(refused(set, { op: "delete", file: "target.md" }).message).toContain("`notes/source.md` (`link`)")
  })
  test("trashed records and a document's self-link do not hold it", () => {
    const set = setOf({ "_olai/Trash.olai": '{"id":"old","ord":"a0","title":"[target](../target.md)"}' }, [["target.md", "[self](target.md)"]])
    expect(planned(set, { op: "delete", file: "target.md" }).removed).toEqual(["target.md"])
  })
  test("declared document properties keep their fence in trash", () => {
    const set = setOf({
      "_olai/Properties.olai": '{"id":"brief","ord":"a0","title":"brief","custom":{"type":"doc"}}',
      "_olai/Trash.olai": '{"id":"old","ord":"a0","title":"Old","custom":{"brief":"../target.md"}}',
    }, ["target.md"])
    expect(refused(set, { op: "delete", file: "target.md" }).message).toContain("`old` (`brief`, _olai/Trash.olai:1)")
  })
  test("doc is now an ordinary custom key", () => {
    const result = planned(house(), { op: "prop", id: "order", key: "doc", value: "missing.md" })
    expect(record(fileOf(result, "house.olai"), "order").custom).toEqual({ doc: "missing.md" })
  })
})
