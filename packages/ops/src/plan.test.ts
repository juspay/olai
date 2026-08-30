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
  blockersOf,
  datedOn,
  derive,
  type Node,
  markdownIn,
  nodesOf,
  type OpFailure,
  type OutlineSet,
  type RegularNode,
  outlinePaths,
  pinTargetIn,
  serializeOutline,
  shelfOf,
  standingBefore,
  stopping,
  validate,
  AddRequest,
  type WriteRequest as Request,
} from "@olai/format"
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

/** The set a plan leaves behind: every file re-serialized through the format's
 *  own writer and re-parsed, which is the path a real write takes.
 *
 *  What needs it is any test whose subject is a SEQUENCE of writes. The
 *  unarchive block uses it for the archive op's OWN output — a hand-written
 *  archive that drifted from what `planTrash` writes would test a fixture
 *  rather than the inverse — and the door-two block replays the sequence that
 *  can legally mint a contradiction inside the archive. */
const after = (set: OutlineSet, request: Request): OutlineSet =>
  performed(set, planned(set, request))

/** The set a validation ANSWERS with — the same directory with whatever it
 *  found withheld, which is where a finding lives now that none of them refuses
 *  a load (`@olai/format`'s `validate`, and the per-file ruling). */
const judged = (set: OutlineSet): OutlineSet => {
  const verdict = validate(set)
  if (Result.isFailure(verdict)) throw new Error("a validation answers with a set")
  return verdict.success.set
}

/** The set a plan's FILES make of a set: every file re-serialized through
 *  the format's own writer and re-parsed, which is the path a real write
 *  takes. THE DOCUMENTS COME ACROSS TOO, and that is not decoration: a
 *  `doc` field and a `doc`-typed property are both PATHS the validator
 *  resolves against the files the set actually serves, so a rebuilt set
 *  that dropped them would report every such path as missing — and a test
 *  about retargeting one would pass because nothing was served rather than
 *  because the path is right (found while pinning the typed-`doc` boundary
 *  below). */
const performed = (set: OutlineSet, result: Plan): OutlineSet => {
  const texts = Object.fromEntries(
    outlinePaths(set).map((file) => [
      file,
      serializeOutline(nodesOf(derive(recordsOf(set)), file).map((located) => located.node)),
    ]),
  )
  for (const file of result.files) {
    texts[file.file] = serializeOutline(file.nodes)
  }
  return setOf(texts, markdownIn(set).map((one) => [one.path, one.body] as const))
}

/** `after` with the one degree of freedom it pins, handed back: the
 *  INSTANT. The shared helper drives every write with the fixture's one
 *  stamp — exactly the equality a test about WHICH instant a write used
 *  cannot see past — so the rounds below are driven minutes apart, each op
 *  at its own `now`. `mint` is never asked (these sequences mark, they do
 *  not capture), and it answers one id, so a capture accidentally asked in
 *  one of these chains names the same thing twice and trips its own
 *  refusal. */
const at = (set: OutlineSet, now: string, request: Request): OutlineSet =>
  performed(
    set,
    succeeded(
      plan(scoping(readingOf(set), { mint: () => "n1", now: () => now }), request),
      `\`${request.op}\` to plan`,
    ),
  )

/** The children of a node, in the order the format sorts them — which is what
 *  a placement assertion is actually about. */
const childOrder = (
  nodes: ReadonlyArray<Node>,
  /** `undefined` is the top level of the file, which is a row like any other. */
  parent: string | undefined,
): ReadonlyArray<string> =>
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
        (derive(recordsOf(before)).byId.get(id)?.node as RegularNode).ord,
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
      file: "shed.olai",
      seed: { title: "clear out the shed", id: "shed", mark: "todo" },
    })
    expect(result.captured).toEqual([{ id: "shed", title: "clear out the shed" }])
    expect(fileOf(result, "shed.olai")[0]).toMatchObject({ id: "shed", todo: true })

    // And the id rule is `add`'s, spelled once: a chosen id the set holds is
    // refused with the same words.
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
    // `done` records the instant; the other two say `true` — the same rule the
    // mark ops read, so a captured mark and a marked capture agree.
    expect(record(nodes, "n2").done).toBe(STAMP)
    expect(record(nodes, "n3").doing).toBe(true)
    // …and that agreement includes the STAMP, or "exactly as set_doing would"
    // is the sentence the door would be lying with: a node BORN `doing` is
    // work born under way, so it carries its `started` from birth — the only
    // door it has, since `set_doing` refuses a node already doing. This is
    // the orchestrator's shape: a lane is captured with its mark in one call.
    expect(record(nodes, "n3").started).toBe(STAMP)
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

  // What a cycle attempt looks like when every node is being born at once: a
  // child naming an id one of its own ancestors chose. There is no live node to
  // parent onto, so this is a collision — and it is refused before the
  // validator ever sees a set with two `bath` records in it.
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

  // The cap is the JSON Schema's, not the format's (`@olai/format`'s `writing.ts`'s
  // NESTING), and the floor of the unrolled schema exists so that going past it
  // is a REFUSAL rather than a level the decoder quietly drops.
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
    // Named, so the caller knows where to cut the tree in half.
    expect(failure.message).toContain("`four`")
    expect(failure.message).toContain("second `add_node`")

    // The same tree without its last generation is the deepest one that lands:
    // the node being added, and three levels under it.
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

  // Why the floor of the unrolled schema exists at all. An Effect struct DROPS
  // a key it does not declare, so a schema that simply stopped after the last
  // level would decode a four-deep capture into a three-deep one and report
  // success — a capture quietly missing its leaves. Decoded here through the
  // REAL schema, the one the MCP surface advertises and decodes against: the
  // level past the floor survives, and the planner refuses it by name.
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

// ── done / doing ───────────────────────────────────────────────────────

describe("done and doing", () => {
  test("marking a leaf stamps the instant and says so in the commit line", () => {
    const result = planned(house(), { op: "done", id: "order" })
    expect(record(fileOf(result, "house.olai"), "order").done).toBe(STAMP)
    expect(result.summary).toBe("done: order the cabinets")
  })

  // A plan re-emits every record of the file it touches, and the format is
  // validated AS TEXT because a writer must reproduce what it read
  // (docs/format.md). So a neighbour's day-only `done` — and every `true` still
  // out there — comes back exactly as written: the op stamps the node it was
  // asked about and nothing else.
  test("the dates on the other records come back as they were written", () => {
    const nodes = fileOf(planned(house(), { op: "done", id: "order" }), "house.olai")
    expect(record(nodes, "demo").done).toBe("2026-08-01")
  })

  // Resolved 2026-08-11 by the human, and it is a decision about the JOURNAL
  // rather than about symmetry between three ops: a date on a mark puts the
  // node on that day (docs/format.md's Days), so a stamped `todo` would file
  // every capture onto the day it was written down and `/today` would stop
  // being about what happened. Finishing is the event a day page is about;
  // starting and filing are not.
  test("the SETTLING marks carry an instant — the other two say `true`", () => {
    const marked = (op: "done" | "cancelled" | "doing" | "todo"): RegularNode =>
      record(fileOf(planned(house(), { op, id: "order" }), "house.olai"), "order")
    expect(marked("done").done).toBe(STAMP)
    // `cancelled` is stamped for `done`'s reason, read once more: deciding to
    // stop is an EVENT the day is about, and the mark exists precisely so the
    // vault can say when it was taken (the human, 2026-08-25). Clearing a mark
    // — what "not happening" used to be — left a bullet with no instant on it.
    expect(marked("cancelled").cancelled).toBe(STAMP)
    expect(marked("doing").doing).toBe(true)
    expect(marked("todo").todo).toBe(true)
  })

  // Starting records its instant one FIELD over, never on the mark — `doing`
  // stays `true`, because a dated mark is a day the journal would otherwise
  // have to read, and the start belongs on no day.
  test("`doing` stamps `started` — and settling, un-marking and re-filing do not", () => {
    const doing = record(fileOf(planned(house(), { op: "doing", id: "order" }), "house.olai"), "order")
    expect(doing.started).toBe(STAMP)
    expect(doing.doing).toBe(true)
    // The field is the marks' neighbour, and the only one of these verbs that
    // mints it is the one that starts: a settle, a filing and an un-doing
    // write the node without inventing a start it never had — and a settle
    // with no round to close mints no BANK either.
    for (const op of ["done", "cancelled", "todo"] as const) {
      const node = record(fileOf(planned(house(), { op, id: "order" }), "house.olai"), "order")
      expect(node.started).toBeUndefined()
      expect(node.worked).toBeUndefined()
    }
  })

  // Rule two of the stamp — EVERY START IS A FRESH ROUND: a plan over a
  // record that already carries one writes the instant of THIS start. The
  // fixture's hand-written `started` is one no op here could have minted,
  // so a re-stamp is what a carry could never be told apart from — and
  // what the earlier round was worth is in the bank the settle wrote (the
  // moving-clock tests below), never in this field.
  test("a `started` already on the record is re-stamped — the round just settled is banked", () => {
    const set = setOf({
      "a.olai": `{"id":"x","ord":"a0","title":"x","todo":true,"started":"2026-08-01T07:00:00-04:00"}`,
    })
    const node = record(fileOf(planned(set, { op: "doing", id: "x" }), "a.olai"), "x")
    expect(node.doing).toBe(true)
    expect(node.started).toBe(STAMP)
  })

  // The pieces of the rule itself leave the record's other fields alone: a
  // settle keeps the `started` it found AND BANKS THE ROUND IT CLOSED — at
  // the fixture's one instant the round is an honest zero, and the field is
  // minted either way, because the round did close — and an UNDO keeps
  // both: the mark comes off, the bank stands, because the work did happen.
  test("settling banks the round it closed, and un-marking keeps the `started` and the bank", () => {
    const read = (set: OutlineSet): RegularNode =>
      nodesOf(derive(recordsOf(set)), "house.olai")
        .map((located) => located.node)
        .find((node) => node.id === "order") as RegularNode
    const doing = after(house(), { op: "doing", id: "order" })
    const settled = after(doing, { op: "done", id: "order" })
    expect(read(settled).started).toBe(STAMP)
    expect(read(settled).worked).toBe(0)
    const unmarked = after(settled, { op: "done", id: "order", undo: true })
    expect(read(unmarked)).toMatchObject({ started: STAMP, worked: 0 })
    expect(read(unmarked).done).toBeUndefined()
    // …and un-doing the START itself CLOSES THE ROUND AT THE PEEL: the
    // bank says the round was measured (an honest zero at the fixture's
    // one instant), and the stamp goes with the `doing` — minutes live
    // only on a record that can still close them.
    const notDoing = after(doing, { op: "doing", id: "order", undo: true })
    expect(read(notDoing).started).toBeUndefined()
    expect(read(notDoing).worked).toBe(0)
    // Re-opened after the settle, the record says what the rule reads as:
    // the bank kept, the start re-stamped — here to a value identical
    // BECAUSE the clock says one instant, which is exactly why the
    // distinguishable halves of the rule live in the two adjacent tests.
    const reopened = after(unmarked, { op: "doing", id: "order" })
    expect(read(reopened)).toMatchObject({ doing: true, started: STAMP, worked: 0 })
  })

  // …and the jump has NO span: a todo→done stores no `started`, so no `took`
  // can be derived — and it BANKS NOTHING, because it closed no round.
  // Falling back to `created` would measure the node's age rather than the
  // work — the one rule the chip and the answer share.
  test("a todo→done jump stores no `started`, and banks none", () => {
    const once = after(house(), { op: "done", id: "order" })
    const node = nodesOf(derive(recordsOf(once)), "house.olai")
      .map((located) => located.node)
      .find((one) => one.id === "order") as RegularNode
    expect(node.started).toBeUndefined()
    expect(node.worked).toBeUndefined()
    expect(node.done).toBe(STAMP)
  })

  // THE WHOLE RULE, told at a moving clock: instants picked per write, so
  // the banked seconds and the fresh start are NUMBERS and not the one stamp
  // landing everywhere. Ten minutes of first round, 36 minutes of pause a
  // chip must not count, eight minutes of second round.
  test("every settle banks its round, a re-start stamps fresh, and the pause is nobody's", () => {
    const read = (set: OutlineSet): RegularNode =>
      nodesOf(derive(recordsOf(set)), "house.olai")
        .map((located) => located.node)
        .find((node) => node.id === "order") as RegularNode
    // The first round: 09:00 to 09:10 is 600 banked seconds.
    let set = at(house(), "2026-08-29T09:00:00-04:00", { op: "doing", id: "order" })
    expect(read(set).started).toBe("2026-08-29T09:00:00-04:00")
    set = at(set, "2026-08-29T09:10:00-04:00", { op: "done", id: "order" })
    expect(read(set)).toMatchObject({ done: "2026-08-29T09:10:00-04:00", worked: 600 })
    // Undone 36 minutes later: the BARE UNDO leaves the bank alone — and
    // leaves the start alone, because re-stamping is the next start's job.
    set = at(set, "2026-08-29T09:46:00-04:00", { op: "done", id: "order", undo: true })
    expect(read(set)).toMatchObject({ started: "2026-08-29T09:00:00-04:00", worked: 600 })
    expect(read(set).done).toBeUndefined()
    // The work resumes at 09:50: a FRESH `started` — the pause between the
    // rounds (09:10 → 09:50) is held by neither field, which is the whole
    // point of the bank.
    set = at(set, "2026-08-29T09:50:00-04:00", { op: "doing", id: "order" })
    expect(read(set)).toMatchObject({ doing: true, started: "2026-08-29T09:50:00-04:00", worked: 600 })
    // …and the second settle banks BOTH rounds — 600 + 480 — and nothing of
    // the 36 minutes between them.
    set = at(set, "2026-08-29T09:58:00-04:00", { op: "done", id: "order" })
    expect(read(set).worked).toBe(600 + 480)
  })

  // THE SECOND DOOR the reviews probed: undo walks a settle back to a
  // BULLET, and from a bullet the same `started` would answer every later
  // settle — the round counted twice, and the pause with it, forever. The
  // choreography the reviewers walked: 09:00 doing, 09:10 done, 10:00 undo,
  // 10:00:05 done (no `set_doing` in between) — and what the bank must say
  // at the end is still 600, with the stamp BURIED: the second settle
  // closed no round (the `doing` that made one closable went with the undo),
  // and a kept stamp would draw [09:00, 10:00:05] against 600 banked
  // seconds. The third beat pins that the growth stays bounded: another
  // undo, another settle, the answer unchanged.
  test("settle → undo → settle mints nothing again: the stamp is buried, the bank stands", () => {
    const read = (set: OutlineSet): RegularNode =>
      nodesOf(derive(recordsOf(set)), "house.olai")
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

  // The SAME door by way of `todo` (the reviewers' other walk): undone,
  // back on the queue, then called off — the call-off banks nothing either
  // and buries the stamp just the same. The verdict of the dance is one
  // sentence: a settle banks what a live `doing` opened and nothing else.
  test("…and the `todo` detour mints nothing: back on the queue, called off, the bank stands", () => {
    const read = (set: OutlineSet): RegularNode =>
      nodesOf(derive(recordsOf(set)), "house.olai")
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

  // THE PEEL'S SEALS (the third probe's walks): the doing comes off
  // WITHOUT a settle and the round still closes — ten banked minutes for
  // the undo-of-doing walk, thirty for the queue — so the LATER settle is
  // an ordinary jump, and nothing was ever buried live.
  test("undo of a `doing` banks the round at the peel — the later settle is a jump", () => {
    const read = (set: OutlineSet): RegularNode =>
      nodesOf(derive(recordsOf(set)), "house.olai")
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
      nodesOf(derive(recordsOf(set)), "house.olai")
        .map((located) => located.node)
        .find((node) => node.id === "order") as RegularNode
    let set = at(house(), "2026-08-29T10:00:00-04:00", { op: "doing", id: "order" })
    set = at(set, "2026-08-29T10:30:00-04:00", { op: "todo", id: "order" })
    expect(read(set)).toMatchObject({ todo: true, worked: 1800 })
    expect(read(set).started).toBeUndefined()
    // …and the queue-closes straight to done: 1800 stands, no fresh round.
    set = at(set, "2026-08-29T10:45:00-04:00", { op: "done", id: "order" })
    expect(read(set)).toMatchObject({ done: "2026-08-29T10:45:00-04:00", worked: 1800 })
    expect(read(set).started).toBeUndefined()
  })

  // …and queue → re-open → settle: the re-stamp is the gap's whole
  // confession — the queue's thirty banked, the round's five banked, the
  // queue-gap never.
  test("queued, re-opened, settled: the bank says 1800 + 300 and nothing of the queue's wait", () => {
    const read = (set: OutlineSet): RegularNode =>
      nodesOf(derive(recordsOf(set)), "house.olai")
        .map((located) => located.node)
        .find((node) => node.id === "order") as RegularNode
    let set = at(house(), "2026-08-29T10:00:00-04:00", { op: "doing", id: "order" })
    set = at(set, "2026-08-29T10:30:00-04:00", { op: "todo", id: "order" })
    set = at(set, "2026-08-29T11:00:00-04:00", { op: "doing", id: "order" })
    expect(read(set)).toMatchObject({ doing: true, started: "2026-08-29T11:00:00-04:00", worked: 1800 })
    set = at(set, "2026-08-29T11:05:00-04:00", { op: "done", id: "order" })
    expect(read(set).worked).toBe(1800 + 300)
  })

  // A call-off is a settle: it banks the round it closed exactly as a finish
  // does — the time sunk is the whole of what there is to keep.
  test("calling it off banks the round too", () => {
    let set = at(house(), "2026-08-29T09:00:00-04:00", { op: "doing", id: "order" })
    set = at(set, "2026-08-29T09:41:00-04:00", { op: "cancelled", id: "order" })
    const ended = nodesOf(derive(recordsOf(set)), "house.olai")
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
    // Straight to `doing` is refused; undo first, as the message says.
    expect(refused(set, { op: "doing", id: "x" }).message).toContain("Undo that first")

    const undone = setOf({ "a.olai": `{"id":"x","ord":"a0","title":"x"}` })
    const node = record(fileOf(planned(undone, { op: "doing", id: "x" }), "a.olai"), "x")
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
    expect(record(fileOf(result, "house.olai"), "order").todo).toBe(true)
    expect(result.summary).toBe("todo: order the cabinets")

    // Started, then put back on the pile: `doing` goes, `todo` arrives.
    const under = setOf({
      "a.olai": `{"id":"x","ord":"a0","title":"x","doing":"2026-08-01"}`,
    })
    const node = record(fileOf(planned(under, { op: "todo", id: "x" }), "a.olai"), "x")
    expect(node.todo).toBe(true)
    expect(node.doing).toBeUndefined()

    // A done node is not quietly un-finished, whichever mark is asked for.
    const finished = setOf({
      "a.olai": `{"id":"x","ord":"a0","title":"x","done":"2026-08-01"}`,
    })
    expect(refused(finished, { op: "todo", id: "x" }).message).toContain("Undo that first")

    // And taking it off says so in the commit line, like its two siblings.
    const marked = setOf({ "a.olai": `{"id":"x","ord":"a0","title":"x","todo":true}` })
    const cleared = planned(marked, { op: "todo", id: "x", undo: true })
    expect(record(fileOf(cleared, "a.olai"), "x").todo).toBeUndefined()
    expect(cleared.summary).toBe("not-todo: x")
  })

  /**
   * `set_cancelled`, the fourth mark's own verb — what it writes, what it
   * refuses, and the two things it deliberately does NOT do.
   */
  test("`cancelled` is a mark that SETTLES, and is gated like one", () => {
    const result = planned(house(), { op: "cancelled", id: "order" })
    expect(record(fileOf(result, "house.olai"), "order").cancelled).toBe(STAMP)
    expect(result.summary).toBe("cancelled: order the cabinets")

    // It clears whatever was there, like every other mark: the format allows
    // one, so this is what makes the write valid rather than tidy.
    expect(record(fileOf(result, "house.olai"), "order").doing).toBeUndefined()

    // Taking it off says so in the commit line, off the same table.
    const off = planned(
      setOf({ "a.olai": `{"id":"x","ord":"a0","title":"x","cancelled":"2026-08-01"}` }),
      { op: "cancelled", id: "x", undo: true },
    )
    expect(record(fileOf(off, "a.olai"), "x").cancelled).toBeUndefined()
    expect(off.summary).toBe("uncancelled: x")

    // A node that is already cancelled is not quietly re-marked, whichever
    // mark is asked for — the `done` rule read one settling mark over, and it
    // exists for the same reason: the instant it was called off at is on that
    // day's journal page, and nothing overwrites one on your behalf.
    const called = setOf({
      "a.olai": `{"id":"x","ord":"a0","title":"x","cancelled":"2026-08-01"}`,
    })
    for (const op of ["todo", "doing", "done"] as const) {
      expect(refused(called, { op, id: "x" }).message).toContain("is cancelled. Undo that first")
    }
    expect(refused(called, { op: "cancelled", id: "x" }).message).toContain("already cancelled")

    // …and the pair the old spelling would have let through: a DONE node may
    // not be quietly called off either, which would have thrown away the
    // instant the work was finished at.
    const finished = setOf({
      "a.olai": `{"id":"x","ord":"a0","title":"x","done":"2026-08-01"}`,
    })
    expect(refused(finished, { op: "cancelled", id: "x" }).message)
      .toContain("is done. Undo that first")

    // THE ORDER IS NOT A LAW FOR IT. `set_doing` is the one verb the `after`
    // graph gates, and calling work off is a decision rather than an
    // instruction to start: a blocked node can always be cancelled.
    const blocked = setOf({
      "a.olai": `{"id":"one","ord":"a0","title":"one","todo":true}\n` +
        `{"id":"two","ord":"a1","title":"two","todo":true,"after":["one"]}`,
    })
    expect(record(fileOf(planned(blocked, { op: "cancelled", id: "two" }), "a.olai"), "two")
      .cancelled).toBe(STAMP)
  })

  /**
   * THE FOURTH MARK'S SECOND RULING at the write gate: it is NOT gated on the
   * branch below it, and it does not re-open a stale mark above it.
   *
   * Both of `set_done`'s doors exist because done-HIDING sweeps a done row with
   * its subtree, and nothing hides a cancelled row. So there is nothing for a
   * refusal to protect and nothing for an arrival to repair — what is left
   * standing stays on the page, and the answer NAMES it instead.
   */
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
    // The remark, in door one's own two vocabularies — and saying out loud
    // that nothing was hidden and nothing refused.
    expect(result.nudge).toContain("`the trip` is cancelled, but 1 task under it is")
    expect(result.nudge).toContain("`pack` (`c1`, todo)")
    expect(result.nudge).toContain("Nothing was hidden and nothing was refused")
    // The bullet is not among them: it is not work.
    expect(result.nudge).not.toContain("a note")

    // Nothing left standing, nothing to say.
    const settled = setOf({
      "a.olai": [
        `{"id":"p","ord":"a0","title":"the trip","todo":true}`,
        `{"id":"c1","parent":"p","ord":"a0","title":"pack","done":true}`,
      ].join("\n"),
    })
    expect(planned(settled, { op: "cancelled", id: "p" }).nudge).toBeUndefined()
  })

  /**
   * DOOR TWO does not fire for it: a settling mark is not open work ARRIVING,
   * so a `done` above stays exactly as it was.
   *
   * The predicate is `unfinished` rather than `mark !== "done"`, which is the
   * whole of the fix — spelled the old way, cancelling a row under a finished
   * branch would have taken that branch's `done` off, re-opening work somebody
   * finished because somebody else called one row in it off.
   */
  test("cancelling under a done ancestor leaves that mark alone", () => {
    const set = setOf({
      "a.olai": [
        `{"id":"p","ord":"a0","title":"the trip","done":"2026-08-01"}`,
        `{"id":"c1","parent":"p","ord":"a0","title":"pack","todo":true}`,
      ].join("\n"),
    })
    // The set is one a git merge can produce (a mark in one branch, a task
    // under it in another) — which is exactly the shape door two repairs, and
    // exactly the shape it must not repair for a mark that settles.
    const result = planned(set, { op: "cancelled", id: "c1" })
    expect(record(fileOf(result, "a.olai"), "p").done).toBe("2026-08-01")
    expect(result.nudge).toBeUndefined()

    // …where the same write with `todo` DOES re-open it, which is the contrast
    // that says this is a decision rather than a gap.
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

  /**
   * A RECURRENCE STOPS rather than rolling forward, which is the one place the
   * two settling marks part company at this verb.
   *
   * Finishing this week's occurrence says the chore goes on; calling it off
   * says it does not. The rule stays ON the record, so the decision is
   * reversible: un-cancelling gives back a dated node with its rule intact.
   */
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

  /**
   * The 2026-08-11 change, in the layer that used to refuse it: a mark is a
   * stored fact on ANY node. The three shapes the old `derived` refusal had a
   * sentence for — over unfinished tasks, over finished ones, over children
   * that are all notes — are three ordinary writes.
   */
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

  // The case the model could not express at all, and the one that filed the
  // item: the node IS the work, its children are findings about it. Nothing
  // under it is a task, and it is `todo`.
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
    // Nothing under it is a task, so there is nothing to remark on either.
    expect(result.nudge).toBeUndefined()
  })

  // The nudge that used to say this is a refusal now (`done-over-open-work`,
  // 2026-08-16); the whole of that gate is its own block below.

  // The other nudge, and the one that replaces the old escape hatch: finishing
  // the last open task under a parent is the moment to consider ticking the
  // parent, which is now something a person can actually do.
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

    // Not while another task is still open, and not when the parent has
    // already SETTLED — neither is news, and the second is worse than not
    // news: it is a write the next call refuses.
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

    // …NOR WHEN THE PARENT IS CANCELLED, and this is the case the fourth mark
    // brought (grok, review of #391). The test above pinned `done` alone, and
    // the predicate under it was `!== "done"` — which a cancelled parent walks
    // straight through. The state is not hypothetical: it is the one this
    // lane's own no-cascade ruling PRODUCES. Cancel a branch, and the rows
    // under it keep their marks and stay owed; finish the last of them and the
    // old spelling said "mark it done too" about a node `set_done` refuses
    // outright — "is cancelled. Undo that first" — which is a suggestion whose
    // only possible outcome is the refusal it walks into.
    const calledOff = setOf({
      "a.olai": [
        `{"id":"p","ord":"a0","title":"the trip","cancelled":"2026-08-25"}`,
        `{"id":"c1","parent":"p","ord":"a0","title":"pack","doing":true}`,
      ].join("\n"),
    })
    const finished = planned(calledOff, { op: "done", id: "c1" })
    expect(record(fileOf(finished, "a.olai"), "c1").done).toBe(STAMP)
    expect(finished.nudge).toBeUndefined()
    // …and the sentence it would have suggested really is refused, which is
    // what makes the silence above the right answer rather than a missing one.
    expect(refused(calledOff, { op: "done", id: "p" }).message)
      .toContain("is cancelled. Undo that first")

    // And not while something DEEPER under the parent is open. The suggestion
    // must never name a write the gate below would refuse: `the trip` cannot
    // be marked done while `find the tickets` is todo, so suggesting it would
    // be an invitation to a refusal.
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

  // A nudge is about a mark going ON, and only `done`: nothing is finished by
  // starting a task, and taking a mark off is never news about the parent.
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

// ── doing refuses what the order forbids ───────────────────────────────

/**
 * The DAG stops being a drawing and becomes a mechanism: `set_doing` on a node
 * whose `after` targets are unfinished work refuses, naming them.
 *
 * The asymmetry is what most of this block is about. `set_done` keeps its
 * allow-with-nudge — finishing out of order is sometimes true — and `set_todo`
 * is untouched, because filing work is not starting it. Only the STARTING verb
 * says no.
 */
describe("starting what is blocked", () => {
  /** `install` waits on `order`; `order` waits on nothing that is unfinished. */
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
    // The title a person recognises, the id an agent has to type next, and the
    // mark that says which kind of waiting this is.
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

  /**
   * The hole the DRAWN reading leaves, and the reason the gate asks
   * `standingBefore` rather than `blockersOf`: an unmarked node is not drawn
   * blocked — a bullet is not work — but `set_doing` is about to make it work,
   * and its `after` edges said what comes first. Asking the drawn reading here
   * would make "start it from a bullet" the way round the whole law.
   */
  test("a bullet with unfinished work before it is refused too", () => {
    const bullet = chain(
      `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","todo":true}`,
      `{"id":"install","parent":"kitchen","ord":"a1","title":"install them","after":["order"]}`,
    )
    expect(refused(bullet, { op: "doing", id: "install" }).message)
      .toContain("`order the cabinets`")
    // And it is only the STARTING verb: the same bullet takes both other marks.
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

  /**
   * The derivation is the source of truth and this is what reading it rather
   * than respelling it buys: three targets that stand in nobody's way, and not
   * one of them needed a line of its own in the planner.
   */
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

  /** `a blocks b` means `b after a`, normalised in the derivation — so the
   *  refusal reads one graph and the sugar is not a way round it. */
  test("`blocks` is the same edge from the other end, and refuses the same", () => {
    const sugar = chain(
      `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","todo":true,"blocks":["install"]}`,
      `{"id":"install","parent":"kitchen","ord":"a1","title":"install them"}`,
    )
    expect(refused(sugar, { op: "doing", id: "install" }).message)
      .toContain("`order the cabinets`")
  })

  // THE ASYMMETRY, stated as a test rather than only as a comment: the verb
  // that records what happened is not the verb that instructs what to do next.
  test("`set_done` still lands on a blocked node, with its nudge unchanged", () => {
    const result = planned(WAITING, { op: "done", id: "install" })
    expect(record(fileOf(result, "house.olai"), "install").done).toBe(STAMP)
    expect(result.summary).toBe("done: install them")
    // Nothing is under it, so there is nothing to remark on — the rollup's own
    // rule, untouched by this change.
    expect(result.nudge).toBeUndefined()
  })

  test("`set_todo` is untouched — filing work is not starting it", () => {
    expect(record(fileOf(planned(WAITING, { op: "todo", id: "install" }), "house.olai"), "install")
      .todo).toBe(true)
  })

  test("un-starting needs no gate: the undo of a blocked `doing` goes through", () => {
    // The node started before its blocker came back, and putting the mark down
    // is the thing a blocked node SHOULD be able to do.
    const started = chain(
      `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","todo":true}`,
      `{"id":"install","parent":"kitchen","ord":"a1","title":"install them","doing":true,"after":["order"]}`,
    )
    const result = planned(started, { op: "doing", id: "install", undo: true })
    expect(record(fileOf(result, "house.olai"), "install").doing).toBeUndefined()
    expect(result.summary).toBe("not-doing: install them")
  })

  /**
   * The first deliberate non-gate, as a TEST rather than a claim in a comment
   * (grok, review of a41e74cc). Wiring an `after` edge onto a node that is
   * already `doing` records a discovery — "I picked this up and have just
   * realised it needs X first" — and the row then truthfully draws blocked.
   * What is refused is the INSTRUCTION to start, never the correction of the
   * graph, so gating this verb would make the order unsayable exactly when
   * somebody has learned what it is.
   */
  test("`set_after` onto an already-doing node lands: the graph is not immutable", () => {
    const started = chain(
      `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets","todo":true}`,
      `{"id":"install","parent":"kitchen","ord":"a1","title":"install them","doing":true}`,
    )
    const result = planned(started, { op: "after", id: "install", add: ["order"] })
    const node = record(fileOf(result, "house.olai"), "install")
    expect(node.after).toEqual(["order"])
    // Still doing, and now drawn blocked — both facts at once, which is what
    // docs/format.md means by blockedness being a SECOND fact about a node.
    expect(node.doing).toBe(true)
    // The edge the write just added IS what the gate would have refused, had
    // this been a start — so the two verbs are looking at one graph.
    expect(
      standingBefore(derive(recordsOf(setOf({ "house.olai": serializeOutline(fileOf(result, "house.olai")) }))), "install")
        .map((one) => one.at.node.id),
    ).toEqual(["order"])
  })

  /**
   * The second, and this one is a property of the FORMAT rather than a choice:
   * a captured node cannot arrive blocked, because a capture has no way to
   * spell an edge. `AddRequest`'s `after` is the sibling ANCHOR — where among
   * its siblings the row lands — and the capture schema carries no `after` or
   * `blocks` field at any depth. Asserted on the RECORD the plan writes, so a
   * field quietly gaining an edge shape here fails rather than opening a way
   * to mint a blocked `doing` in one call.
   */
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
        // The `after` an `add` takes: WHERE among its siblings, never an edge.
        after: "order",
      }),
      "house.olai",
    )
    const born = record(nodes, "n1")
    expect(born.doing).toBe(true)
    expect(childOrder(nodes, "kitchen")).toEqual(["order", "n1"])
    // The anchor placed it and left no edge behind: nothing for the gate to
    // have been asked about, which is why the planner never asks.
    expect(born.after).toBeUndefined()
    expect(born.blocks).toBeUndefined()
    // Said the other way, over the derivation the gate reads: born `doing`,
    // waiting on nothing, however unfinished the row it was anchored after.
    expect(
      standingBefore(derive(recordsOf(setOf({ "house.olai": serializeOutline(nodes) }))), "n1"),
    ).toEqual([])
  })

  // The two refusals that were already there still come first: neither is
  // about the order, and both are about the node's own mark.
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

// ── done must not come to stand over open work ─────────────────────────

/**
 * `done-over-open-work` (the human, 2026-08-16), both doors.
 *
 * The state made unreachable is one state — a node storing `done` with
 * unfinished tasks in the branch below it, which done-hiding sweeps off the
 * page — and the two doors onto it are answered differently on purpose: the
 * CLAIM (`set_done`) is refused, the ARRIVAL (a task turning up under a mark
 * that has gone stale) re-opens what stood over it and says so.
 */
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
    // Title for the person, id and mark for the agent — {@link heldUp}'s shape.
    expect(failure.message).toContain("`pack` (`c2`, todo)")
    expect(failure.message).toContain("Done-hidden hides a done node WITH its subtree")
    // The other half of the ruling: the way out is to SETTLE what is not
    // happening, and since 2026-08-25 there is a mark for that — the refusal
    // names it, with clearing the mark kept as the second way (an unmarked
    // bullet is not unfinished work either).
    expect(failure.message).toContain("or cancel it if it is not happening")
    expect(failure.message).toContain("take the mark off")
  })

  // The whole branch, which is exactly what the sweep takes: a task two levels
  // down is hidden by a mark on the root as surely as a child is.
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
    // Under a done node already — and still named, because a second mark above
    // would hide it harder and this gate is what stops the state being made.
    expect(failure.message).toContain("`reserve a cabin` (`g2`, doing)")
  })

  // #90's creed, and the line the ruling drew explicitly: a node is a task
  // because somebody said so. Nothing here is a task, so nothing blocks.
  test("bullets never block it, however many there are", () => {
    const notes = trip(
      `{"id":"c1","parent":"p","ord":"a0","title":"ferry times"}`,
      `{"id":"g1","parent":"c1","ord":"a0","title":"the 9:40 is cheapest"}`,
      `{"id":"c2","parent":"p","ord":"a1","title":"what to take","done":true}`,
    )
    expect(record(fileOf(planned(notes, { op: "done", id: "p" }), "a.olai"), "p").done)
      .toBe(STAMP)
  })

  // A placement is not containment (`@olai/format`'s `derive.ts`). The work the
  // mirror draws keeps its own row where it really lives, so hiding this
  // branch hides no work — and `add_mirror` is therefore not gated either.
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

  /**
   * THE FOURTH MARK'S FIRST RULING, at this door: a cancelled child does not
   * hold a parent's `done` up (the human, 2026-08-25).
   *
   * It is the refusal's own sentence taken at its word. The gate has always
   * said the way past it is to settle what is not happening — and "clear the
   * mark" was the only spelling of that, which left a bullet: no mark, no
   * instant, no day, indistinguishable from a line nobody ever called work.
   * `cancelled` is the honest spelling, and the branch below reads exactly as
   * settled to this walk as a `done` does.
   */
  test("a cancelled child settles, so the parent's `done` is not refused", () => {
    const set = trip(
      `{"id":"c1","parent":"p","ord":"a0","title":"book the ferry","done":true}`,
      `{"id":"c2","parent":"p","ord":"a1","title":"pack the tent","cancelled":"2026-08-25"}`,
      `{"id":"c3","parent":"p","ord":"a2","title":"a note about ferries"}`,
    )
    expect(record(fileOf(planned(set, { op: "done", id: "p" }), "a.olai"), "p").done)
      .toBe(STAMP)

    // Deep, too, and through a cancelled branch: this walk reads each node's
    // OWN stored mark at every level, so a `todo` under a cancelled parent is
    // still unfinished work and still names itself in the refusal. Cancelling
    // a parent is not a cascade — a mark is a stored fact, never computed from
    // what hangs below (docs/format.md's Status).
    const deep = trip(
      `{"id":"c1","parent":"p","ord":"a0","title":"the tent","cancelled":true}`,
      `{"id":"g1","parent":"c1","ord":"a0","title":"find the poles","todo":true}`,
    )
    const failure = refused(deep, { op: "done", id: "p" })
    expect(failure.message).toContain("1 unfinished task")
    expect(failure.message).toContain("`find the poles` (`g1`, todo)")
  })

  // Archived work is over: nothing in an `_olai/Trash.olai` is open work, and
  // nothing in one is hidden by a mark, so the gate does not run there — the
  // same exemption blockedness takes at both ends of an arrow.
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

  // Taking a mark off is never gated: the whole point of the refusal is that
  // the state must be fixable, and undoing a `done` is one of the two fixes.
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

  // A refusal holding two hundred titles has buried the one that would have
  // been read — the same argument `notFound` makes about listing every id.
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

  // The same door, spelled in a capture: both halves written in one call, by
  // one caller, who can simply write it differently — so it is refused rather
  // than repaired, and nothing lands.
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

  // The floor of the unrolled capture schema declares `children` as anything
  // at all (`@olai/format`'s `writing.ts`: "it exists to be refused"), so a
  // fourth level arrives typed `Capture` by a CAST and validated by nothing.
  // Every rule here therefore has to let the nesting refusal speak first — a
  // gate that walked that level would be reading unchecked JSON, and `null` in
  // it is a crash rather than an answer.
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
            // The last level the schema spells out. Its `children` is the one
            // that accepts anything, so this is what an unvalidated level can
            // actually hold — and the cast is how it arrives typed.
            title: "four",
            children: [null],
          }],
        }],
      }],
    } as unknown as Request
    expect(refused(house(), tooDeep).message).toContain("nests at most 3 levels")
  })

  // A seed is a capture, so it meets the same door through the other verb.
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
  /** `attic` is finished, and everything under it is finished with it. */
  const shut = (...records: ReadonlyArray<string>): OutlineSet =>
    setOf({
      "a.olai": [
        `{"id":"house","ord":"a0","title":"the house","done":"2026-08-01"}`,
        `{"id":"attic","parent":"house","ord":"a0","title":"the attic","done":"2026-08-02"}`,
        ...records,
      ].join("\n"),
    })

  // THE INCIDENT ITSELF, one op wide: a task filed under a branch somebody
  // called finished last week.
  test("`set_todo` under a done ancestor takes the mark off it, and says so", () => {
    const set = shut(`{"id":"leak","parent":"attic","ord":"a0","title":"the leak"}`)
    const result = planned(set, { op: "todo", id: "leak" })
    const nodes = fileOf(result, "a.olai")

    expect(record(nodes, "leak").todo).toBe(true)
    // EVERY done ancestor, root first: any one of them hides the branch alone.
    expect(record(nodes, "attic").done).toBeUndefined()
    expect(record(nodes, "house").done).toBeUndefined()
    // A write to them, so they are stamped like any other write.
    expect(record(nodes, "attic").changed).toBe(STAMP)
    // Never silently: the answer says it, and so does the commit subject.
    expect(result.nudge).toContain("`the house`, `the attic` were marked done")
    expect(result.nudge).toContain("those marks are off now")
    expect(result.summary).toBe("todo: the leak (reopened: the house, the attic)")
  })

  test("`set_doing` arrives the same way, and an undo never does", () => {
    const set = shut(`{"id":"leak","parent":"attic","ord":"a0","title":"the leak","todo":true}`)
    expect(record(fileOf(planned(set, { op: "doing", id: "leak" }), "a.olai"), "attic").done)
      .toBeUndefined()
    // Clearing a mark leaves a bullet, which is not unfinished work — so there
    // is nothing to re-open for, and the ancestor keeps what it says.
    expect(record(fileOf(planned(set, { op: "todo", id: "leak", undo: true }), "a.olai"), "attic")
      .done).toBe("2026-08-02")
  })

  test("finishing work under a done ancestor changes nothing above it", () => {
    const set = shut(`{"id":"leak","parent":"attic","ord":"a0","title":"the leak","todo":true}`)
    const nodes = fileOf(planned(set, { op: "done", id: "leak" }), "a.olai")
    expect(record(nodes, "leak").done).toBe(STAMP)
    expect(record(nodes, "attic").done).toBe("2026-08-02")
  })

  // An ancestor that says nothing is not re-opened — there is nothing to take
  // off it — and one that is `doing` keeps its mark: only `done` hides.
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
    // Somewhere else entirely in the same file: untouched.
    expect(record(nodes, "shed").done).toBe("2026-08-01")
  })

  // The door this incident walked through, in the shape that filed it: work
  // captured under a root whose mark froze five days ago.
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

  // The mark may be anywhere in the captured tree: what arrives is the whole
  // tree, and any unfinished task in it is work that would land hidden.
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
    // The moving node is a BULLET; what makes this an arrival of open work is
    // the task underneath it, which travels with it.
    expect(record(nodes, "attic").done).toBeUndefined()
    expect(result.summary).toContain("(reopened:")
  })

  /** The three writes that reach `attic` without bringing it open work, and
   *  the one assertion all three are about: the branch stays shut. One test
   *  each, so a failure names which of the three it was. */
  const untouched = (request: Request): void => {
    const set = shut(
      `{"id":"note","ord":"a1","title":"a note about the house"}`,
      `{"id":"open","ord":"a2","title":"something open","todo":true}`,
      `{"id":"first","parent":"attic","ord":"a0","title":"one","done":true}`,
      `{"id":"second","parent":"attic","ord":"a1","title":"two","done":true}`,
    )
    expect(record(fileOf(planned(set, request), "a.olai"), "attic").done).toBe("2026-08-02")
  }

  // Nothing unfinished is arriving: a bullet and the done work under it.
  test("a move of bullets leaves it alone", () => {
    untouched({ op: "move", id: "note", parent: "attic" })
  })

  // A reorder among the same siblings arrives under nothing it was not
  // already under, so an ancestor's mark is not this write's business.
  test("a reorder leaves it alone", () => {
    untouched({ op: "move", id: "second", before: "first" })
  })

  // A PLACEMENT is not containment, at this door exactly as at the other.
  test("a placement of open work leaves it alone", () => {
    untouched({ op: "mirror", target: "open", parent: "attic" })
  })

  // The arrival nobody would think to look for: a Backspace at the start of a
  // line hands one row's children to the row above it, and the row above may
  // be finished. The merged node's own mark goes to the archive with its
  // record, so what this asks about is what it hands over.
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
    // Named as it was READ, which is the row somebody watching just saw go
    // from ticked to empty — the joined title is what it becomes.
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

  // The archive exemption is about where a node LIVES, so it ends the moment
  // the node stops living there — which is what `unarchive` is.
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

  /**
   * THE HOLE grok found in the first round, replayed exactly.
   *
   * The archive is exempt at both doors, so the contradiction can legally be
   * BORN in there — and `unarchive` used to carry it into the live set, where
   * door two was only ever looking above the landing. It is an ops write that
   * lands the hidden state, which is the one thing these gates promise cannot
   * happen; the git-merge residual the docs carve out is a set that arrived
   * some other way.
   */
  test("a contradiction born in the archive is re-opened on the way back out", () => {
    const start = setOf({
      "a.olai": [
        `{"id":"jobs","ord":"a0","title":"jobs"}`,
        `{"id":"roof","parent":"jobs","ord":"a0","title":"the roof"}`,
        `{"id":"slates","parent":"roof","ord":"a0","title":"re-lay the slates","todo":true}`,
      ].join("\n"),
    })
    // 1. Put it away. 2. Mark it done in there — legal, and refused nowhere,
    // because work in an archive is over.
    const away = after(start, { op: "trash", id: "roof" })
    expect(record(fileOf(planned(away, { op: "done", id: "roof" }), "_olai/Trash.olai"), "roof").done)
      .toBe(STAMP)
    const shut = after(away, { op: "done", id: "roof" })

    // 3. Take it back out. The mark that was true in the trash is false the
    // moment it is live again, so it comes off — loudly, exactly as an
    // ancestor's does.
    const result = planned(shut, { op: "untrash", id: "roof", parent: "jobs" })
    const nodes = fileOf(result, "a.olai")
    expect(record(nodes, "roof").parent).toBe("jobs")
    expect(record(nodes, "roof").done).toBeUndefined()
    expect(record(nodes, "roof").changed).toBe(STAMP)
    // The work it was hiding came back with it, untouched.
    expect(record(nodes, "slates").todo).toBe(true)
    expect(result.nudge).toContain("`the roof` was marked done over work that is not finished")
    expect(result.summary).toBe("untrash: the roof (reopened: the roof)")
  })

  // Every one of them, not just the root: two claims hide the same task, and
  // door one refuses both when they are made in the live set.
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
    // `gutter` is done over a BULLET, which is not unfinished work — its claim
    // is still true, so nothing touches it.
    expect(record(nodes, "gutter").done).toBe("2026-08-03")
    expect(result.summary).toBe("untrash: the roof (reopened: the roof, the slates)")
  })

  // Both halves at once: the branch it lands under, and the branch itself.
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
    // Outside-in, which is the order a reader walks them in.
    expect(result.summary)
      .toBe("untrash: the roof (reopened: the house, the attic, the roof)")
  })

  // A restored branch whose own marks are honest is left exactly as it was —
  // the archive does not restamp, and this must not either.
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

  // ...and inside the archive itself, neither door runs: a `todo` filed under
  // a done node in there is work that is over, filed where work that is over
  // goes.
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

// ── title / desc / date ────────────────────────────────────────────────

describe("title, note and date", () => {
  test("a retitle keeps everything else", () => {
    const result = planned(house(), { op: "title", id: "order", title: "order cabinets" })
    expect(record(fileOf(result, "house.olai"), "order")).toEqual({
      id: "order",
      parent: "kitchen",
      ord: "a1",
      title: "order cabinets",
      // ...plus the stamp every write leaves, which is not "everything else"
      // being kept — it is the write saying when it happened (./plan.ts's
      // `touched`).
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
    expect(record(fileOf(result, "house.olai"), "order").title).toBe("order cabinets")
  })

  test("and is refused, naming what is there, when somebody else wrote first", () => {
    // This IS the retry, in the shape the planner sees it: the same request,
    // planned a second time against a set where the title has moved on.
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
    // The reason the check is on the FIELD being given rather than on its
    // content: "expects no note" is a real expectation, and it is not "not
    // checking".
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
    // What `set_title` has always meant, unchanged: a request with no `was`
    // overwrites whatever is there.
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

// ── the repeat rule, and what completing one does ──────────────────────

/**
 * A recurrence is a CHAIN of occurrences with exactly one live head, and the
 * rule rides the head. Every assertion below is that one sentence read from a
 * different side — which is why the churn edge needs no flag to police it:
 * completing hands the rule forward, so the node that was completed no longer
 * has one to spawn from.
 */
describe("repeat", () => {
  /** A weekly chore, dated on a Monday, under a parent that is not finished. */
  const CHORES = [
    `{"id":"chores","ord":"a0","title":"Chores"}`,
    `{"id":"bins","parent":"chores","ord":"a0","title":"put the bins out",` +
      `"todo":true,"date":"2026-08-17","repeat":"every week on monday","desc":"blue one"}`,
    `{"id":"floor","parent":"chores","ord":"a1","title":"mop the floor","todo":true}`,
  ].join("\n")

  const chores = (): OutlineSet => setOf({ "chores.olai": CHORES })

  /** The one record a completion added — the plan says which ids it minted, so
   *  a test never has to guess at one. */
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

  // Reading a rule is forgiving and writing one is not: `every monday` is the
  // same rule as `every week on monday` with nothing to tell the two apart, so
  // one of them reaches disk. What that buys is the format's own bet — two
  // files meaning the same thing must not differ byte for byte, or a merge
  // conflicts over which way somebody spelled Monday.
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

  // …and text that is NOT a rule passes through untouched, so the refusal the
  // gate then makes quotes what the caller actually sent.
  test("text the grammar cannot read is written back verbatim, and refused as sent", () => {
    expect(() => after(chores(), { op: "repeat", id: "bins", repeat: "every 2 weeks" }))
      .toThrow("`every 2 weeks`")
  })

  // THE PLANNER JUDGES NEITHER HALF OF THE PAIR, and that is the whole of what
  // this verb had to be taught: a rule the grammar cannot read, and a rule with
  // no date under it, are per-line rules of the FORMAT's — so what refuses them
  // is the write gate, over the bytes this plan would produce, in the
  // validator's own words and whichever verb moved which half. `after` is that
  // path (serialize the plan, parse it back), which is what makes these
  // assertions the refusal rather than a description of it.
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

    // The completed record keeps its own day and its `done` instant, so the
    // journal shows the work on the day it was finished.
    const finished = record(nodes, "bins")
    expect(finished.done).toBe(STAMP)
    expect(finished.date).toBe("2026-08-17")

    // …and the rule has moved on, which is what makes the churn edge below
    // unrepresentable rather than policed.
    expect("repeat" in finished).toBe(false)

    const next = spawnedBy(result)
    expect(next.title).toBe("put the bins out")
    expect(next.date).toBe("2026-08-24")
    expect(next.repeat).toBe("every week on monday")
    expect(next.desc).toBe("blue one")
    // Born `todo`, because it is work that has not started — and because an
    // unmarked occurrence could never be overdue.
    expect(next.todo).toBe(true)
    expect("done" in next).toBe(false)
    expect(next.created).toBe(STAMP)
    // A sibling of the node that was finished, immediately after it.
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

  // THE CHURN EDGE, and it is structural: the rule travelled, so there is
  // nothing left on this node to spawn from.
  test("un-doing leaves the occurrence, and re-doing makes no second one", () => {
    const once = after(chores(), { op: "done", id: "bins" })
    const undone = after(once, { op: "done", id: "bins", undo: true })
    // The occurrence the completion made is still there — it is owed whatever
    // anybody says about the one before it.
    expect(nodesOf(derive(recordsOf(undone)), "chores.olai").length).toBe(4)

    const again = planned(undone, { op: "done", id: "bins" })
    expect(again.captured).toBeUndefined()
    expect(again.summary).toBe("done: put the bins out")
    expect(nodesOf(derive(recordsOf(after(undone, { op: "done", id: "bins" }))), "chores.olai").length)
      .toBe(4)
  })

  test("a dated node with no rule is completed exactly as it always was", () => {
    const result = planned(chores(), { op: "done", id: "floor" })
    expect(result.captured).toBeUndefined()
    expect(fileOf(result, "chores.olai").length).toBe(3)
  })

  // Door two, read once more: the occurrence is open work ARRIVING under
  // whatever stands over the node that was just finished, so a `done` ancestor
  // is re-opened. Without it, a finished branch would go on hiding the next
  // occurrence of everything under it.
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
    // …and the recurrence's own news is still on the answer, behind it.
    expect(result.nudge).toContain("2026-08-24")
  })

  // The rollup's remark reads the SNAPSHOT, which cannot see a record this
  // write is about to make — so "every task under `Chores` is done now" would
  // be a sentence the same write makes untrue.
  test("no nudge claims the parent is finished when this write just filled it", () => {
    const set = setOf({
      "chores.olai": CHORES.replace(`"title":"mop the floor","todo":true`, `"title":"mop the floor"`),
    })
    const result = planned(set, { op: "done", id: "bins" })
    expect(result.nudge).not.toContain("mark it done too")
    expect(result.nudge).toContain("2026-08-24")
  })

  // The planner never has to ask whether a rule is readable, and this is why:
  // a `repeat` the grammar cannot read, or one with no `date` beside it, is a
  // `bad-repeat` per LINE, so the file never parses into a set at all. The
  // fixture builder is the same parser, which is what makes this assertion the
  // real one rather than a claim about it.
  test("a set holding an unreadable rule does not parse, so no plan ever sees one", () => {
    expect(() =>
      setOf({ "chores.olai": CHORES.replace(`"every week on monday"`, `"every 2 weeks"`) })
    ).toThrow("bad-repeat")
  })

  // The same pair, refused from the other side, by the same gate and in the
  // same words — which is the point of it being the format's rule rather than
  // one each verb carries a copy of.
  test("clearing the date out from under a rule writes bytes the gate will not take", () => {
    expect(() => after(chores(), { op: "date", id: "bins", date: null }))
      .toThrow("no `date` to repeat from")
    // …and changing it to another day is not: a recurrence is free to move.
    expect(record(
      fileOf(planned(chores(), { op: "date", id: "bins", date: "2026-08-31" }), "chores.olai"),
      "bins",
    ).date).toBe("2026-08-31")
  })

  // Stopping a recurrence and clearing the date is a perfectly sensible thing
  // to say in one call, and it is the one place `update`'s fixed field order
  // bends: removal before addition, so no step of the fold sees a rule with no
  // date under it.
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

// ── prop ───────────────────────────────────────────────────────────────

describe("prop", () => {
  const customOf = (set: OutlineSet, request: Request): Record<string, unknown> => ({
    ...record(fileOf(planned(set, request), "house.olai"), "order").custom,
  })

  test("a key goes into `custom`, holding whatever it was given", () => {
    expect(customOf(house(), { op: "prop", id: "order", key: "pr", value: "https://x/1" }))
      .toEqual({ pr: "https://x/1" })
    // The summary names the KEY, because the key is what changed: a subject
    // reading `prop: order the cabinets` would leave the reader to diff the
    // line to find out which fact moved.
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
    // The other key is untouched: this op is about ONE property, and a write
    // that rebuilt the map would take the rest of it with whatever it knew.
    expect(customOf(carrying, { op: "prop", id: "order", key: "pr", value: null }))
      .toEqual({ agent: "claude-opus" })
    expect(customOf(carrying, { op: "prop", id: "order", key: "pr", value: "" }))
      .toEqual({ agent: "claude-opus" })
    expect(planned(carrying, { op: "prop", id: "order", key: "pr", value: null }).summary)
      .toBe("prop: order the cabinets -> pr (cleared)")
  })

  /**
   * The one refusal, and it is about SHADOWING rather than about reach: this op
   * writes inside `custom` and could not touch a field if it tried. What it must
   * not do is let a node say `done` twice with two meanings.
   *
   * The list is the RATIFIED one, written out: these are the words a reader
   * would take for a fact about the node. That a FIELD cannot be added to the
   * format without a sentence here is the other half, and it is a compile error
   * rather than a test — `shadowFor`'s table is keyed by the record's own
   * fields.
   */
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
      "doc",
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
    // Folded, because the confusion it prevents is a human one and humans do
    // not read case.
    expect(refused(house(), { op: "prop", id: "order", key: "Done", value: "x" })._tag)
      .toBe("UsageFailure")
  })

  /** `worked`'s door is the settles themselves: the bank is counted by
   *  `set_done` / `set_cancelled` and written by nothing else, so the
   *  refusal names them and not a verb that does not exist. */
  test("the bank is fenced off toward the settles that count it", () => {
    const failure = refused(house(), { op: "prop", id: "order", key: "worked", value: "600" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`worked`")
    expect(failure.message).toContain("`set_done`")
    expect(failure.message).toContain("`set_cancelled`")
  })

  /** `status` is the one shadowed word that is NOT a field — three fields
   *  answer it — so the sentence may not tell somebody a node carries one
   *  (Grok, review of #179). */
  test("the refusal does not call `status` a field, because it is not one", () => {
    const status = refused(house(), { op: "prop", id: "order", key: "status", value: "done" })
    expect(status.message).not.toContain("with a field of its own")
    expect(status.message).toContain("`status` is what a node's own fields already answer")
    expect(status.message).toContain("`set_done`")
    // ...and a word that IS a field still says so.
    expect(refused(house(), { op: "prop", id: "order", key: "date", value: "x" }).message)
      .toContain("with a field of its own")
  })

  /**
   * A write that would change nothing is REFUSED, which is the rule every other
   * op in this file already follows — `set_done` on a done node, `set_see` with
   * a target it already names — and the one this op was missing.
   *
   * It matters more here than it looks, because of the stamps. Such a write
   * still rewrote the record (`changed` is stamped on every write), so it
   * landed on disk, dirtied git, counted as an op in the chat transcript, and
   * reported `edited` — while the pending panel, which does not compare stamps,
   * listed nothing at all for a tree git called dirty. One gesture, two faces,
   * neither of them true. Disclosed by opencode in review of #179.
   */
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
    // A key holding a LIST is not "already that value" for any text: the write
    // replaces the list, which is a real change and the caller's to make.
    expect(customOf(carrying, { op: "prop", id: "order", key: "tags", value: "a" }))
      .toMatchObject({ tags: "a" })
  })

  test("a key that is nothing but space is not a key", () => {
    expect(refused(house(), { op: "prop", id: "order", key: "  ", value: "x" }).message)
      .toBe("a property needs a key")
  })

  test("a key is trimmed, and otherwise spelled however it was typed", () => {
    // NOT case-folded, not slugged: `custom` takes any key, and a rule here
    // about spelling would be this op inventing one the format does not have.
    expect(customOf(house(), { op: "prop", id: "order", key: " Due-Owner ", value: "@rahul" }))
      .toEqual({ "Due-Owner": "@rahul" })
  })

  // ── the condition a prop write may carry ─────────────────────────────
  //
  // `was` is what the caller expects the key to hold, and it is checked HERE
  // rather than by whoever built the request — the text verbs' own rule, for
  // their reason: the write gate re-plans this same request whenever the store
  // moves under it, so every attempt plans and every attempt tests. Its
  // ABSENCE is unchanged: last-one-wins is what a plain `set_prop` has always
  // meant.

  /** The one-node vault every conditional-prop test varies one record of. */
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
    // This IS the retry, in the shape the planner sees it: the same request,
    // planned a second time against a set where the key has moved on.
    const failure = refused(staged(`"custom":{"stage":"audit"}`), {
      op: "prop",
      id: "order",
      key: "stage",
      value: "submitted",
      was: "review",
    })
    expect(failure._tag).toBe("UsageFailure")
    // The sentence names both halves — the expectation and what is THERE —
    // which is the "read again" half of the refusal's shape.
    expect(failure.message).toContain("`review`")
    expect(failure.message).toContain("`audit`")
    expect(failure.message).toContain("so nothing was written")
  })

  test("`null` expects the key GONE — which is what an add is", () => {
    expect(
      customOf(house(), { op: "prop", id: "order", key: "stage", value: "review", was: null }),
    ).toEqual({ stage: "review" })
    // ...and is refused the moment the key is no longer missing — the drawer's
    // add chip sends exactly this when a property appeared under an open
    // editor.
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
    // The resurrect, met at the gate: the commit the unmount-blur sends was
    // readied against a key whose whole value has been removed since.
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

  /** A vault that DECLARES `dispatched` a date, so the typed gate has work to
   *  spend: a declared key's values are judged, and stored as one spelling. */
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
    // BOTH halves of this request are wrong: the value fits no type, and the
    // premise has moved. One gesture gets ONE answer, and it is the
    // condition's: the premise moving voids the write whole, where a value
    // that does not fit is a fact about the payload either way.
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
    // The clearing half of the chip's list rule: the box is seeded with the
    // members joined, so the spellable condition for a list-carrying key is
    // that one text — and its movement is asked for in the same spelling.
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
    // The undo of a normalising write carries the TYPED spelling as its `was`
    // — the server's inverse re-sends what the write asked — and it must meet
    // the stored spelling as the same value, or the undo of `2026-8-22` is
    // refused by its own write's canonical `2026-08-22`.
    expect(
      customOf(declaring(`"custom":{"dispatched":"2026-08-22"}`), {
        op: "prop",
        id: "order",
        key: "dispatched",
        value: "2026-08-23",
        was: "2026-8-22",
      }),
    ).toEqual({ dispatched: "2026-08-23" })
    // ...without normalising a DIFFERENT day into a pass: `2026-8-23` CANON
    // is `2026-08-23`, not the `2026-08-22` the key holds.
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

// ── the stamps ─────────────────────────────────────────────────────────

/**
 * `created` and `changed`: the two fields nobody asks for.
 *
 * There is no verb and no request field — a caller asks for a title, a mark, a
 * date, an edge or a property, and the stamp rides along. What is tested here
 * is that it rides along EVERYWHERE, because the failure mode is silent: one
 * planner that forgot would leave a node whose `changed` is a lie, and nothing
 * would ever say so.
 */
describe("stamps", () => {
  const stampsOf = (set: OutlineSet, request: Request, id = "order") => {
    const node = record(fileOf(planned(set, request), "house.olai"), id)
    return { created: node.created, changed: node.changed }
  }

  test("a capture is created and not changed", () => {
    // The honest pair for a node nobody has written to since it was born.
    const captured = record(
      fileOf(planned(house(), { op: "add", file: "house.olai", title: "a new one" }), "house.olai"),
      "n1",
    )
    expect({ created: captured.created, changed: captured.changed })
      .toEqual({ created: STAMP, changed: undefined })
  })

  test("every write that rewrites a node stamps `changed`", () => {
    // One test over the ops that touch a record, because the failure mode is a
    // planner that quietly does not.
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

  /** NO BACKFILL: a node that carried no `created` before the write does not
   *  acquire one, because nobody saw it being made. The ledger does not invent
   *  a past — `git log` is the archaeologist's tool. */
  test("a write does not invent a `created` for a node that had none", () => {
    expect(stampsOf(house(), { op: "title", id: "order", title: "x" }).created)
      .toBeUndefined()
  })

  test("archiving stamps nothing, because archiving is not writing", () => {
    // `trash_node`'s own promise — "nothing is stamped: archiving is not
    // finishing" — read across to the other stamp. A whole subtree's worth of
    // `changed` for one gesture that changed nothing anybody wrote would be
    // noise in every future reading.
    const archived = planned(house(), { op: "trash", id: "order" })
    const moved = archived.files.flatMap((one) => one.nodes).find((one) => one.id === "order")
    expect(moved).toBeDefined()
    expect((moved as RegularNode).changed).toBeUndefined()
  })
})

// ── move ───────────────────────────────────────────────────────────────

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
    // The sentence that used to stand here ("every outline is an independent
    // tree, so a parent is always in the same file; archiving is what moves a
    // subtree between them") was a fact about this planner rather than about
    // the format — the block below is what it became.
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
    // …and it NAMES the ancestry, the way the other two loop refusals do: the
    // chain by which the proposed parent already sits inside the node.
    expect(failure.message).toContain("`order` → `kitchen`")
  })

  test("moving a branch under what a PLACEMENT inside it shows is refused too", () => {
    // The loop the parent walk above cannot see, and the one the write gate
    // used to catch as a `mirror-cycle` about a file that was never written: a
    // Now section is mirrors of live work, so `now` DRAWS `install` — and
    // moving `now` under `install` draws it inside itself for ever. The graph
    // is `drawnFrom`, the walk is the validator's own, and the refusal names
    // the chain like every other one about a loop.
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
    // …one level deeper, which is the same walk one hop further.
    expect(refused(set, { op: "move", id: "now", parent: "handles" }).message)
      .toContain("`now` → `now-install` → `install` → `handles`")
    // …and a SIBLING of what the placement shows is a legal move, which is
    // what keeps the rule a rule rather than a fence: `kitchen` is where
    // `install` lives, not something `now` draws.
    expect(record(fileOf(planned(set, { op: "move", id: "now", parent: "kitchen" }), "house.olai"), "now").parent)
      .toBe("kitchen")
  })

  test("a MIRROR moved under what it shows is refused by the same walk", () => {
    // The other way into the same cycle, and the one `add_mirror` has always
    // refused for a placement being CREATED: the record moving is the
    // placement itself, so what it draws is its target's whole subtree.
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


// ── move, across outlines ──────────────────────────────────────────────
//
// THE PROMISE, tested as a DIFFERENTIAL rather than as a list of assertions:
// the ids do not change, so what points at the subtree must go on pointing at
// it and must say the same thing about it — `file` being the one answer that
// moved. That is the property the ops-expressible cross-file move never had
// (recreate under fresh ids, trash the original: the ids cannot even be reused,
// since one is unique across the set INCLUDING the trash, so every inbound
// reference detaches in silence).
//
// The corpus therefore aims one of every inbound relation the format has at the
// subtree, from another outline in each case, so a rule that quietly dropped
// one is visible here rather than in somebody's vault six weeks later.
//
// FOUR OF THEM ARE `namedBy`'s AND FOUR ARE NOT, and the second four are the
// ones a differential written off the reverse index alone would pass over
// without noticing (found on review, grok, 2026-08-25):
//
//   - `see`, `after`, `blocks` and a `mirror` placement ARE `targetsOf`
//     read backwards, so `namersOf` below carries them;
//   - a typed `node` / `ref` PROPERTY is a reference the validator resolves
//     and the index does not carry (the value is text in `custom`);
//   - a PIN is a node whose TITLE is an address (`/#install`), which is not a
//     field at all — so nothing about it is a `TargetField` and the index is
//     structurally blind to it;
//   - a DAY PAGE is the set asked from the other end (`byDay` / `datedOn`),
//     where the node is what a query finds rather than what a record names —
//     and its GROUP HEADING is the outline, which is the one thing this write
//     moves.
//
// Each of the four blind kinds is pinned by the reading that actually answers
// it, beside the index differential rather than through it.

/** A vault that DECLARES a `node` key, so a property naming a node is a
 *  reference the set RESOLVES rather than a string that looks like one — the
 *  kind `empty_trash` already refuses a deletion for, and the one an id-changing
 *  recreation would strand without a word.
 *
 *  `node` AND NOT `ref`, and the two are different promises rather than two
 *  spellings (grok, on review): `node` is EXISTENCE, which an id surviving a
 *  move is exactly enough for; `ref` additionally asserts ANCESTRY under a
 *  named root, which a move genuinely can break. That one has its own block
 *  below, where the refusal is the subject. */
const OWNER = `{"id":"prop-owner","ord":"a0","title":"owner","custom":{"type":"node"}}`

/** THE SHELF, aimed into the subtree in both spellings the grammar has for a
 *  node — the bare id, and the QUALIFIED one whose file half is about to go
 *  stale. A pin is an ordinary node whose TITLE is an address, so nothing here
 *  is a field and `namedBy` cannot see it; what the address grammar promises is
 *  that a node spelling normalises to the ID either way, which is what makes a
 *  move harmless to both rows (`@olai/format`'s `address.ts`, `shelf.ts`). */
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

/** Who NAMES this id, and with which field — `@olai/format`'s own reverse
 *  index, which is "does anything still point at this record" asked the way the
 *  ops layer asks it. Flattened to strings so two readings of two sets compare
 *  by value rather than by identity. */
const namersOf = (set: OutlineSet, id: string): ReadonlyArray<string> =>
  (derive(recordsOf(set)).namedBy.get(id) ?? [])
    .flatMap((naming) => naming.fields.map((field) => `${naming.at.node.id}.${field}`))
    .slice()
    .sort()

/** The subtree that travels, root first. */
const SUBTREE = ["install", "handles", "knobs"] as const

describe("move across outlines", () => {
  test("a parent in another outline carries the subtree there, ids intact", () => {
    const result = planned(crossing(), { op: "move", id: "install", parent: "garden" })
    // BOTH ENDS IN ONE PLAN, which is what makes it atomic: the outline it left
    // and the outline it arrived in are the two files this write touches, and
    // the write gate judges the whole set they make.
    expect(result.files.map((one) => one.file).slice().sort())
      .toEqual(["garden.olai", "house.olai"])
    expect(result.file).toBe("garden.olai")
    expect(result.summary).toBe("move: install the cabinets")

    expect(fileOf(result, "house.olai").map((one) => one.id)).toEqual(["kitchen", "demo"])

    const arrived = fileOf(result, "garden.olai")
    // Shaped exactly as it left: only the ROOT is re-parented, and what hung
    // under it still hangs under it.
    expect(record(arrived, "install").parent).toBe("garden")
    expect(childOrder(arrived, "install")).toEqual(["handles", "knobs"])
    // …LAST among its new siblings, which is `move_node`'s own default.
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
    // …and WHERE among the top-level rows, which is the same `placed` default
    // the parent arm is pinned on and was unpinned here (grok, on review): a
    // top level is a sibling row like any other, so an arrival goes last in it.
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

  /**
   * THE PROMISE. Every referrer answers the same after the write as before it —
   * same records, same fields — because nothing was re-pointed and nothing had
   * to be: an id is unique across the whole set, so the node never left the
   * namespace those references are written in.
   */
  test("every reference into the subtree resolves, and says the same thing", () => {
    const before = crossing()
    const was = Object.fromEntries(SUBTREE.map((id) => [id, namersOf(before, id)]))
    // The differential is only worth what the corpus names, so what it names is
    // pinned: a fixture that quietly stopped pointing at the subtree would make
    // every assertion below pass over nothing.
    expect(was).toEqual({
      install: ["beds.see", "garden-install.mirror"],
      handles: ["paths.blocks"],
      knobs: ["beds.after"],
    })

    const now = after(before, { op: "move", id: "install", parent: "garden" })
    expect(Object.fromEntries(SUBTREE.map((id) => [id, namersOf(now, id)]))).toEqual(was)

    // …and the SET IS VALID, which is the half a reverse index cannot say: the
    // validator resolves `mirror`, `after`, `blocks` and `see` targets, and the
    // typed `node` property this vault declares — which is a reference
    // `namedBy` does not carry, and the one an id-changing recreation would
    // strand without a word.
    const verdict = validate(now)
    if (Result.isFailure(verdict)) {
      throw new Error(
        `the set is invalid after the move: ${
          verdict.failure.findings.map((one) => `${one.code} — ${one.message}`).join("; ")
        }`,
      )
    }
    expect(record(nodesOf(verdict.success.derived, "garden.olai").map((one) => one.node), "paths").custom)
      .toEqual({ owner: "install" })

    // The `file` is the ONLY answer that moved.
    for (const id of SUBTREE) {
      expect(verdict.success.derived.byId.get(id)?.file).toBe("garden.olai")
    }
  })

  /**
   * THE SHELF, before ≡ after — the inbound kind the index above is
   * structurally blind to, and the one this differential was missing (grok, on
   * review).
   *
   * A pin is an ordinary node whose TITLE is an address, so there is no
   * `TargetField` anywhere in it and `namersOf` could not fail if address
   * titles stopped resolving. What holds them is the grammar rather than this
   * op: a node address normalises to the ID it names, so the FILE half of a
   * qualified spelling is dropped before anything is looked up
   * (`@olai/format`'s `addressOf`). Both spellings are in the corpus for
   * exactly that reason — `/house.olai#install` is a title that now names an
   * outline the node has left, and it must go on drawing the node anyway.
   *
   * Asserted as the WHOLE shelf rather than as two lookups: `shelfOf` is what
   * the sidebar draws, ids and live titles included, so an equality over it is
   * the reader's answer rather than a proxy for it.
   */
  test("a pin aimed into the subtree draws the same row afterwards", () => {
    const before = crossing()
    const now = after(before, { op: "move", id: "install", parent: "garden" })

    const shelf = (set: OutlineSet) => shelfOf(derive(recordsOf(set)))
    const was = shelf(before)
    // Pinned, so a corpus that stopped aiming at the subtree cannot make the
    // equality below pass over two rows that address nothing.
    expect(was).toEqual([
      { id: "pin-bare", title: "/#install", shows: { id: "install", name: "install the cabinets" } },
      {
        id: "pin-qualified",
        title: "/house.olai#install",
        shows: { id: "install", name: "install the cabinets" },
      },
    ])
    expect(shelf(now)).toEqual(was)

    // …and the ADDRESS half said on its own, because that is the promise the
    // grammar makes and the shelf merely spends: both spellings name the id,
    // and neither is re-written by the move.
    for (const title of ["/#install", "/house.olai#install"]) {
      expect(pinTargetIn(title)).toBe("install")
    }
  })

  /**
   * THE DAY PAGE — the set asked from the OTHER end, which is the fourth kind
   * `namedBy` cannot carry: nothing NAMES a dated node, a day query FINDS it.
   *
   * Dates travel untouched (the stamp test below), so what a crossing moves is
   * the one thing a day page groups by: `byOutline` heads each group with the
   * file, because a `parent` never crosses one and two outlines have no common
   * ancestry to draw under. So the row keeps its date, its occasion and its
   * place in the day — and changes heading, which is the file moving and is the
   * whole of what should differ.
   */
  test("a dated node that crossed files is still on its day, under the new outline", () => {
    const before = crossing()
    const now = after(before, { op: "move", id: "install", parent: "garden" })
    const day = (set: OutlineSet) => datedOn(derive(recordsOf(set)), "2026-08-20")

    const was = day(before)
    expect(was).toHaveLength(1)
    expect(was[0]?.file).toBe("house.olai")
    expect(was[0]?.nodes.map((one) => one.shows.node.id)).toEqual(["knobs"])

    const then = day(now)
    expect(then).toHaveLength(1)
    // The row is still on the day, and the heading is the outline it went to.
    expect(then[0]?.file).toBe("garden.olai")
    expect(then[0]?.nodes.map((one) => one.shows.node.id)).toEqual(["knobs"])
    // …wearing the same date and the same occasion, because a crossing writes
    // no journal of its own: a day is a question over the set, not a file.
    expect(then[0]?.nodes[0]).toMatchObject({
      date: was[0]?.nodes[0]?.date as string,
      occasion: was[0]?.nodes[0]?.occasion as string,
    })
  })

  test("the ordering graph was file-agnostic already, and the move proves it", () => {
    // `beds` waits on `knobs`, and `paths` blocks `handles` — two edges written
    // in `garden.olai` about nodes that live in `house.olai`. After the move
    // both ends of both are in one file, and the derivation says exactly what
    // it said before, which is the point: an `after` never knew what it crossed.
    //
    // BOTH READINGS, because they are two questions and only one of them is
    // what a page draws (grok, on review). `blockersOf` is what a node IS
    // waiting on — the reading behind the dim and the `blocked by` line — and
    // it is empty for a plain bullet, since a bullet is not work being told it
    // cannot start. `standingBefore` is what a node WOULD wait on the moment it
    // became work, which is the write side's (`set_doing`'s gate). A
    // differential over the second alone would have passed on an unmarked node
    // by saying nothing about either.
    const derived = (set: OutlineSet) => derive(recordsOf(set))
    const ids = (rows: ReadonlyArray<{ at: { node: { id: string } } }>) =>
      rows.map((one) => one.at.node.id).slice().sort()
    const before = crossing()
    const now = after(before, { op: "move", id: "install", parent: "garden" })

    // THE DRAWING READING, over a node that is actually work: `handles` is a
    // `todo` and `paths` — a `todo` in the other outline — declares it blocks
    // it. Non-empty on both sides is what makes this an assertion.
    expect(ids(blockersOf(derived(before), "handles"))).toEqual(["paths"])
    expect(ids(blockersOf(derived(now), "handles"))).toEqual(["paths"])

    // …and the write side's, over the `after` edge, whose target is a node the
    // move carried. `beds` is a bullet, so this is the reading that has an
    // answer about it at all.
    expect(ids(standingBefore(derived(before), "beds"))).toEqual(["knobs"])
    expect(ids(standingBefore(derived(now), "beds"))).toEqual(["knobs"])
  })

  test("a `doc` is re-aimed at the outline it arrived in", () => {
    // The one field that is RELATIVE to the file naming it, which is why this
    // is the archive's own `carryingDoc` rather than a second answer: the path
    // is rewritten so it still names the same document, and the document is not
    // touched at all.
    const set = setOf({
      "house.olai": `{"id":"install","ord":"a0","title":"install the cabinets","doc":"finishes.md"}`,
      "notes/garden.olai": `{"id":"garden","ord":"a0","title":"the garden"}`,
    }, ["finishes.md"])
    const arrived = fileOf(
      planned(set, { op: "move", id: "install", parent: "garden" }),
      "notes/garden.olai",
    )
    expect(record(arrived, "install").doc).toBe("../finishes.md")
  })

  test("nothing is re-stamped but the record that moved", () => {
    // A same-file move stamps `changed` on the row it moved, and a crossing is
    // that same write with a second file in it — so the root is stamped and the
    // subtree travels untouched, exactly as an archive carries one. Marks,
    // dates and `created` are nobody's to rewrite here: moving is not editing.
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
    // DOOR TWO, which never cared which file the landing was in: `handles` is a
    // `todo`, `garden` is a branch somebody called finished, and done-hidden
    // would sweep the arriving work straight off the page.
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


  /**
   * THE `doc` FIELD is retargeted; a `doc`-typed PROPERTY is not — and that
   * boundary is the door family's rather than this verb's.
   *
   * Both are paths resolved against the outline that names them
   * (`@olai/format`'s `wrongDoc` calls `resolveRelative(from, value)`, exactly
   * as the field's own rule does), so a record that changes DIRECTORY changes
   * what either one points at. {@link carryingDoc} rewrites the field, because
   * the field is the format's and every mover already shared one answer about
   * it; it does not rewrite a custom value, because knowing WHICH keys hold
   * paths means reading the vault's declarations — the typed-properties seam,
   * not the mover's.
   *
   * WHAT HAPPENS IS A REFUSAL, not a dangling path: the write gate validates
   * the whole set, so the move is refused `bad-prop` naming the key and what
   * the value resolved to, with neither file written.
   *
   * AND IT IS NOT THIS PR'S, which is the half worth pinning rather than
   * asserting: `trash_node` takes the identical subtree on the identical
   * arithmetic today and is refused in the identical words. Both arms are
   * below, side by side, so a change that teaches one mover about typed paths
   * and not the others fails here.
   */
  test("a `doc`-typed PROPERTY is not retargeted — and `trash` says the same thing", () => {
    const set = setOf({
      "_olai/Properties.olai": `{"id":"prop-brief","ord":"a0","title":"brief","custom":{"type":"doc"}}`,
      "house.olai": `{"id":"install","ord":"a0","title":"install","custom":{"brief":"finishes.md"}}`,
      "notes/garden.olai": `{"id":"garden","ord":"a0","title":"the garden"}`,
    }, ["finishes.md"])

    /** What the validator finds in the tree this request leaves behind. Off the
     *  SET the validation answers with, since a finding no longer refuses one:
     *  the rows ride on the files they break, and this is the directory's whole
     *  report read back (`@olai/format/testlib`'s `findingsIn`). */
    const refusalOf = (request: Request): ReadonlyArray<string> =>
      findingsIn(judged(after(set, request)))
        .map((one) => `${one.code} ${one.message}`)

    // The move: `finishes.md` beside `house.olai` is `notes/finishes.md` beside
    // `notes/garden.olai`, and nothing serves that.
    expect(refusalOf({ op: "move", id: "install", parent: "garden" }))
      .toEqual([
        "bad-prop `brief` names a document — `finishes.md` resolves to " +
        "`notes/finishes.md`, and no such `.md` file is served",
      ])

    // …and the trash, which has always crossed a directory boundary, is the
    // same sentence with the same arithmetic. This behaviour predates this
    // verb; what would be new is one door quietly disagreeing with the others.
    expect(refusalOf({ op: "trash", id: "install" }))
      .toEqual([
        "bad-prop `brief` names a document — `finishes.md` resolves to " +
        "`_olai/finishes.md`, and no such `.md` file is served",
      ])

    // The FIELD, on the same journey, is retargeted and lands clean — which is
    // what makes the pair above a boundary rather than an oversight.
    const withField = setOf({
      "house.olai": `{"id":"install","ord":"a0","title":"install","doc":"finishes.md"}`,
      "notes/garden.olai": `{"id":"garden","ord":"a0","title":"the garden"}`,
    }, ["finishes.md"])
    expect(Result.isSuccess(validate(after(withField, { op: "move", id: "install", parent: "garden" }))))
      .toBe(true)
  })

  // ── the one typed reference a crossing can genuinely break ───────────
  //
  // `node` and `ref` are two promises, not two spellings, and the difference is
  // exactly what a move touches (grok, on review — the PR said `ref` while the
  // corpus above declared `node`).
  //
  //   - `node` is EXISTENCE: the value names a regular record of the set
  //     (`wrongNode`). An id surviving a move is precisely enough, so the
  //     promise holds unchanged and is what the differential above pins.
  //   - `ref` additionally asserts ANCESTRY: the value must be a child of the
  //     declaration's `under` root (`wrongRef` / `variantsOf`, direct children).
  //     A move CAN break that, and does — so the promise is corrected rather
  //     than widened, and both halves of what actually happens are pinned here.
  //
  // What makes the broken half safe rather than a hole is the standing law:
  // the whole set is validated before either file is written, so a move that
  // would strand a `ref` is REFUSED with `bad-prop` and nothing lands. That is
  // the write gate, and this asks the same question the gate asks — `validate`
  // over the records the plan would write.

  /** A vault whose `agent` key is a `ref` under a roster, plus a lane naming
   *  one of the variants. The shape `_olai/Properties.olai` uses in this
   *  repository's own board. */
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
    // The subtree travels whole and only the ROOT is re-parented, so the
    // variants are still children of `roster` — in another file, under another
    // parent, and still exactly what `variantsOf` walks.
    const now = after(ROSTERED(), { op: "move", id: "roster", parent: "elsewhere" })
    expect(Result.isSuccess(validate(now))).toBe(true)
    const derived = derive(recordsOf(now))
    expect(derived.byId.get("claude")?.file).toBe("lanes.olai")
    expect(derived.byId.get("claude")?.node.parent).toBe("roster")
  })

  test("a `ref` VARIANT moved OUT of its root breaks the file that names it", () => {
    // `claude` leaves `roster`, so `lane`'s `agent` names something that is no
    // longer a variant — the value did not move, the ANCESTRY did. The planner
    // builds it (nothing about one record says this) and the write gate is what
    // turns it back, which is the whole point of validating both files before
    // writing either: the outline it left is not rewritten, and neither is the
    // one it was going to.
    //
    // WHICH FILE the gate names is what this pins, and since the per-file
    // ruling it is a fact the set carries rather than a whole-vault refusal:
    // the file holding the bad value goes dark and everything else stays live,
    // so `stopping` on that file is what the commit hears.
    const set = judged(after(ROSTERED(), { op: "move", id: "claude", parent: "elsewhere" }))
    const rows = findingsIn(set)
    expect(rows.map((one) => one.code)).toEqual(["bad-prop"])
    expect(rows[0]?.message).toContain("`agent`")
    expect(rows[0]?.message).toContain("`roster`")
    expect(rows[0]?.message).toContain(`"claude"`)
    expect(stopping(set, [rows[0]?.file as string])).not.toBeNull()
  })

  // ── the refusals ─────────────────────────────────────────────────────

  test("an outline the set does not hold is refused, never minted", () => {
    const failure = refused(crossing(), { op: "move", id: "install", file: "shed.olai" })
    expect(failure._tag).toBe("NotFoundFailure")
    expect(failure.message).toContain("`shed.olai` is not an outline")
  })

  test("moving INTO the trash is refused toward `trash_node`", () => {
    const set = setOf({
      "house.olai": `{"id":"install","ord":"a0","title":"install the cabinets"}`,
      "_olai/Trash.olai": `{"id":"tiles","ord":"a0","title":"the tiles nobody liked"}`,
    })
    // Both doors into it: the file named outright, and a parent that happens to
    // live there.
    for (
      const request of [
        { op: "move", id: "install", file: "_olai/Trash.olai" },
        { op: "move", id: "install", parent: "tiles" },
      ] as const
    ) {
      expect(refused(set, request).message).toContain("`trash_node`")
    }
  })

  test("moving OUT of the trash is refused toward `untrash_node`", () => {
    // Load-bearing rather than tidy. `untrash_node` tidies the scaffold the
    // archive wrote above the node and re-opens the `done` marks that were true
    // while the branch was over and stop being true the moment it is live
    // again; a move would leave both behind.
    const set = setOf({
      "house.olai": `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
      "_olai/Trash.olai": `{"id":"tiles","ord":"a0","title":"the tiles nobody liked"}`,
    })
    expect(refused(set, { op: "move", id: "tiles", parent: "kitchen" }).message)
      .toContain("`untrash_node`")
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
    // The rule that OUTLIVES the file rule, and the reason the two were never
    // one question. Containment is per-file, so a cross-file parent cannot fold
    // a branch into itself — but DRAWING crosses files by construction, and
    // that is exactly the cycle a crossing can make: a Now list lives in one
    // outline and mirrors work that lives in another.
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
    // …and a destination in that same other outline which the row does NOT
    // draw is an ordinary move, which is what keeps the rule a rule.
    const moved = fileOf(planned(set, { op: "move", id: "now", parent: "kitchen" }), "house.olai")
    expect(record(moved, "now").parent).toBe("kitchen")
    expect(record(moved, "now-install").parent).toBe("now")
  })

  test("a sibling anchor that is not one of the DESTINATION's rows is not-found", () => {
    // `demo` is a sibling in the outline the row is LEAVING, which is not the
    // row it is being placed among.
    expect(
      refused(crossing(), { op: "move", id: "install", parent: "garden", before: "demo" })._tag,
    ).toBe("NotFoundFailure")
  })

  test("an outline that did not parse is not written from a set that lost it", () => {
    // Both ends, because both are rewritten: a crossing re-emits the outline it
    // left as well as the one it arrived in, so a file whose records the set
    // does not hold has to stop the write from either side.
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
    // The record is not in the set at all when its own file did not parse, so
    // the refusal is the one about the ID rather than about the file.
    expect(refused(leaving, { op: "move", id: "install", file: "garden.olai" })._tag)
      .toBe("NotFoundFailure")
  })
})
// ── create ─────────────────────────────────────────────────────────────

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
        // A node coming into being is CREATED, and carries no `changed`: nothing
        // has been written to it since.
        created: STAMP,
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

    // ONE file plan: the outline and its contents are validated together and
    // renamed together.
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
      const failure = refused(house(), { op: "create", file: "shed.olai", seed })
      expect(failure._tag).toBe("UsageFailure")
    }

    // And the seed nests exactly as far as a capture does, refused by the same
    // rule rather than by a second one.
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
    expect(refused(house(), { op: "create", file: "notes" })._tag).toBe("UsageFailure")
  })

  test("an outline the directory already holds is refused rather than overwritten", () => {
    const failure = refused(house(), { op: "create", file: "house.olai" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("already")
    expect(failure.message).toContain("add_node")
  })

  test("an empty seed title is refused — a node is its title", () => {
    expect(
      refused(house(), { op: "create", file: "new.olai", seed: { title: "  " } })._tag,
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
    const nodes = fileOf(result, "house.olai")
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
    // And the tail is a BULLET: a node with no mark is not an unstarted task,
    // so a split may not invent one.
    expect(record(nodes, "n1")).toEqual({
      id: "n1",
      parent: "kitchen",
      ord: record(nodes, "n1").ord,
      title: " it",
      // A node coming into being: `created`, and no `changed` — nothing has
      // been written to it since it was born a moment ago.
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

// ── merge ──────────────────────────────────────────────────────────────

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
    // The write is about the row that SURVIVED, which is where the caret goes.
    expect(result.id).toBe("order")
    expect(result.title).toBe("order the cabinetsinstall them")
    expect(result.summary).toBe("merge: order the cabinetsinstall them")
    // Nothing was carried off, so there is nothing to say about it.
    expect(result.nudge).toBeUndefined()
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
    // A mirror under the merged row is a placement and moves like any child.
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

  test("a mark, a date, a document or an edge goes with the record — and is said out loud", () => {
    // Every field a node carries ONE of, so the survivor's own answer stands
    // and this one leaves the live outline. None of them may go quietly —
    // `doc` was the one that did, for a review (2026-08-14).
    const set = setOf({
      "house.olai": [
        `{"id":"a","ord":"a0","title":"a"}`,
        `{"id":"b","ord":"a1","title":"b","done":"2026-08-01","date":"2026-09-01","doc":"finishes.md","see":["a"]}`,
      ].join("\n"),
    })
    const result = planned(set, { op: "merge", id: "b" })
    expect(record(fileOf(result, "_olai/Trash.olai"), "b")).toMatchObject({
      done: "2026-08-01",
      date: "2026-09-01",
      doc: "../finishes.md",
      see: ["a"],
    })
    expect(record(fileOf(result, "house.olai"), "a").done).toBeUndefined()
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
      "house.olai": [
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
    // EXCEPT FOR THE STAMP, and the exception is the honest half of the claim:
    // the node really was written twice, so it really does carry a `changed`
    // afterwards. What "inverse" means is that everything a person wrote is
    // back where it was — the titles, the note, the children, the ords — and
    // the ledger of when it happened is not part of that.
    const unstamped = (nodes: ReadonlyArray<Node>): string =>
      serializeOutline(nodes.map((node) => {
        const { changed: _dropped, ...rest } = node as RegularNode
        return rest as Node
      }))
    expect(unstamped(fileOf(back, "house.olai")))
      .toBe(unstamped(nodesOf(derive(recordsOf(before)), "house.olai").map((at) => at.node)))
    expect(record(fileOf(back, "house.olai"), "order").changed).toBe(STAMP)
  })
})

// ── archive ────────────────────────────────────────────────────────────

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
    // One scaffold node per ancestor, carrying the TITLE and nothing else.
    expect(archive).toEqual([
      { id: "n1", ord: "a0", title: "house.olai" },
      { id: "n2", parent: "n1", ord: "a0", title: "Kitchen remodel" },
      { id: "order", parent: "n2", ord: "a0", title: "order the cabinets" },
    ])
    expect(result.file).toBe("_olai/Trash.olai")
    expect(result.summary).toBe("trash: order the cabinets")
  })

  test("a `doc` is rewritten so it still names the same file from the trash", () => {
    const set = setOf({
      "house.olai": [
        `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
        `{"id":"install","parent":"kitchen","ord":"a0","title":"install them","doc":"finishes.md"}`,
      ].join("\n"),
    }, [["finishes.md", "# Finishes\n"]])
    const { archive } = archived(set, "install")
    expect(record(archive, "install").doc).toBe("../finishes.md")
    const back = fileOf(
      planned(after(set, { op: "trash", id: "install" }), { op: "untrash", id: "install" }),
      "house.olai",
    )
    expect(record(back, "install").doc).toBe("finishes.md")
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
    // Nothing is stamped: archiving is not finishing.
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
    // The scaffold gets a MINTED id rather than a copy of `kitchen`'s: an id is
    // unique across the set, and a copy would collide with the live node.
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

// ── unarchive ──────────────────────────────────────────────────────────

describe("unarchive", () => {
  test("the subtree comes back out, where the recorded chain says it came from", () => {
    const set = after(house(), { op: "trash", id: "order" })
    const result = planned(set, { op: "untrash", id: "order" })

    const source = fileOf(result, "house.olai")
    expect(record(source, "order").parent).toBe("kitchen")
    // Last among its new siblings: the archive does not record where in the
    // row it sat, and the honest answer is the one every other arrival gets.
    expect(childOrder(source, "kitchen")).toEqual(["demo", "install", "order"])
    // The scaffold the removal left empty is tidied away, so archive-then-
    // unarchive leaves the archive as it stood.
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
    // Nothing was stamped on the way in, and nothing is on the way out.
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
    // `install` is still put away under the same merged chain, so the scaffold
    // above it is not empty and is not tidied.
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
    nodesOf(derive(recordsOf(set)), "_olai/Trash.olai").map((located) => located.node)

  test("the signpost the archive minted above a node is not restorable", () => {
    const set = after(house(), { op: "trash", id: "order" })
    // `n1` is the source-file signpost; `n2` is the live ancestor's title.
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
    // A two-deep chain, so the inner husk is the one that would duplicate a
    // live node that is not the root.
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

  /** And the fence does NOT catch content that merely looks like scaffold: a
   *  node carrying only a title kept its own id when `archive` moved it, and
   *  nothing live is called what it is called. `loose` is exactly that. */
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

// ── empty the trash ────────────────────────────────────────────────────

describe("empty", () => {
  /** A house with two things put away — the archive as `archive` actually
   *  writes it, scaffold and all, rather than a hand-typed fixture that could
   *  drift from what the op produces. */
  const filled = (): OutlineSet =>
    after(after(house(), { op: "trash", id: "order" }), { op: "trash", id: "install" })

  /** TWO archives, one beside each outline's own directory — which is the
   *  shape that makes "empty the trash" more than one file, and the whole
   *  reason this op names a list. Two records go into each. */
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

  /**
   * The same two piles, with an edge written BETWEEN them before either is put
   * away — grok's topology (#250), parameterised because the cycle is the same
   * fixture with the second arrow added.
   *
   * The edges go on the live records and the archives are made by the op, so
   * what is being tested is what `trash_node` actually writes rather than a
   * hand-typed archive that could drift from it.
   */
  const crossPiles = (
    /** What `quote` (bound for `_olai/Trash.olai`) points at, as record
     *  fields — the `see` INTO the other pile. */
    fromGarden: string,
    /** …and what `order` (bound for `_olai/Trash.olai`) points back with, which is
     *  what closes the loop. Empty for the acyclic case. */
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
    // What is being deleted, counted off the set the plan is judged against:
    // two subtrees plus the one scaffold title they share.
    expect(nodesOf(derive(recordsOf(set)), "_olai/Trash.olai")).toHaveLength(4)

    const result = planned(set, { op: "empty", file: "_olai/Trash.olai" })
    expect(fileOf(result, "_olai/Trash.olai")).toEqual([])
    // ONE file, which is the whole blast radius: the live outline is not in
    // the plan at all, so nothing outside the archive can be touched.
    expect(result.files.map((entry) => entry.file)).toEqual(["_olai/Trash.olai"])
    expect(result.summary).toBe("empty: _olai/Trash.olai (4 records)")
    // A file op answers with its PATH, `create_outline`'s own shape — there is
    // no node left for an id to name.
    expect(result.id).toBe("_olai/Trash.olai")
    expect(result.file).toBe("_olai/Trash.olai")
  })

  test("an archive that holds nothing is refused rather than written as a no-op", () => {
    // The put-away and the put-back, so the file exists and is empty — which
    // is the state `unarchive`'s scaffold tidying leaves behind.
    const set = after(
      after(house(), { op: "trash", id: "order" }),
      { op: "untrash", id: "order" },
    )
    expect(nodesOf(derive(recordsOf(set)), "_olai/Trash.olai")).toEqual([])
    const failure = refused(set, { op: "empty", file: "_olai/Trash.olai" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("already empty")
  })

  test("a live outline is not deletable, and the refusal points at the put-away", () => {
    const failure = refused(filled(), { op: "empty", file: "house.olai" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("is not the trash")
    expect(failure.message).toContain("trash_node")
  })

  test("a file the set does not hold is a miss, naming what there is", () => {
    const failure = refused(filled(), { op: "empty", file: "notes/Archive.olai" })
    expect(failure._tag).toBe("NotFoundFailure")
    expect(failure.message).toContain("house.olai")
  })

  test("a live `see` pointed into the archive refuses it, naming the record", () => {
    // The edge is written FIRST and the node archived after, which is the real
    // sequence: ids move with a node, so the reference goes on resolving into
    // the archive and is exactly what deleting would break.
    const set = after(
      after(house(), { op: "see", id: "loose", add: ["order"] }),
      { op: "trash", id: "order" },
    )
    const failure = refused(set, { op: "empty", file: "_olai/Trash.olai" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("`loose`")
    expect(failure.message).toContain("`see`")
    // The way through is said, in the vocabulary of the thing to do.
    expect(failure.message).toContain("untrash_node")
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
    // `quote` waits on `sign`, and both go in together. Nothing is left
    // pointing at anything, so the pile deletes.
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
    // A `see` inside the subtree pointing at the subtree's own root: it goes
    // when it goes, exactly as `remove_mirror` reads the same index.
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
    // GROK'S TOPOLOGY (#250), and the defect it caught. `quote` is archived
    // into `_olai/Trash.olai` carrying a `see` at `order`, which is
    // archived into `_olai/Trash.olai`. Both are records this write deletes, and
    // the set it leaves has no unknown-target in it.
    //
    // Judged one file at a time — which is what an `apply` of one `empty` per
    // archive does, since each op is planned against the set the one before it
    // left — `quote` reads as a holder of `_olai/Trash.olai`, because it is
    // outside THAT pile. So the same two archives refused in path order and
    // planned in the reverse. The union is what makes the order mean nothing.
    const set = crossPiles(`"see":["order"]`, "")
    const result = planned(set, {
      op: "empty",
      file: "_olai/Trash.olai",
    })
    expect(fileOf(result, "_olai/Trash.olai")).toEqual([])
  })

  test("two piles naming EACH OTHER empty too, which no ordering could reach", () => {
    // The proof that a sort was never the fix. Each archive holds a record
    // pointing into the other, so whichever is judged first is held by the
    // other — a trash that could not be emptied in any order, over records the
    // write was going to delete anyway.
    const set = crossPiles(`"see":["order"]`, `,"see":["quote"]`)
    const result = planned(set, {
      op: "empty",
      file: "_olai/Trash.olai",
    })
    expect(fileOf(result, "_olai/Trash.olai")).toEqual([])
  })

  test("a namer left OUT of the list still holds, wherever it lives", () => {
    // The rule read from the other side, and the reason the union is the list
    // rather than every archive there is: what is "inside the emptying" is
    // what this call names. Empty only the pile `order` is in, and `quote` —
    // in an archive nobody named — is outside it and says so.
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
    // The window this closes is the RETRY's: a write re-planned against a
    // newer snapshot silently widens, so a node archived between the frame
    // somebody read and the write landing is one this would delete under a
    // sentence that named a smaller number.
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
    // The one refusal `empty` gets by delegation rather than by its own
    // sentence (`landsIn` → `writable`): a file whose lines do not parse holds
    // records nobody has loaded, and rewriting it empty would drop them
    // without ever having read them. Stated here because this is the op whose
    // whole identity is destruction.
    // A file that did not decode is the fixture builder's third argument, for
    // the reason it is a separate one at all: a set carries what did NOT parse
    // beside what did, which is exactly the state this refusal is about.
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

// ── see ────────────────────────────────────────────────────────────────

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
      "a.olai": [
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

  /** …including when the ADD is the one addressing the placement. */
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

  /** A mirror of a mirror is legal — the format says the chain is followed to
   *  the node at its end — and every answer here is about that node. */
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

  /** The whole semantic: a placement goes, the node does not. */
  test("takes the placement out and leaves the node alone", () => {
    const result = planned(PLACED(), { op: "unmirror", id: "now-demo" })
    expect(result.files.map((file) => file.file)).toEqual(["now.olai"])
    const nodes = fileOf(result, "now.olai")
    expect(nodes.map((node) => node.id)).toEqual(["now", "now-kitchen"])
    // The target's own record is in another file the plan does not even write.
    expect(result.summary).toBe("unmirror: demolition")
    expect(result.title).toBe("demolition")
    expect(result.id).toBe("now-demo")
  })

  /** Removing one placement is not a claim about any other. */
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
    expect(failure.message).toContain("trash_node")
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
    // The node the placement shows is what a re-point should name.
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

  // The verb takes what it is named for. The set's bodied list is wider than
  // the documents — a `.html` is read by the same probe and carried in the same
  // field — so membership alone would have made `write_document` a way to
  // overwrite a saved page, and the refusal a caller gets would have been about
  // nothing. It is the same sentence a path the directory does not hold gets,
  // because from the caller's side it is the same thing: this verb has no such
  // document. The web's own page reads the same rule from the other end — a
  // `.html` page has no Edit control, since it would be a door onto this.
  test("a `.html` the set holds is not a document this verb may write", () => {
    const set = setOf({ "house.olai": KITCHEN }, [["notes/notes.md", NOTES], "report.html"])
    const failure = refused(set, { op: "doc", file: "report.html", text: "<h1>no</h1>" })
    expect(failure._tag).toBe("NotFoundFailure")
    expect(failure.message).toContain("is not a document under the served directory")
    // …and the near-miss offered is a document, never the file it just refused.
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
    // Its neighbours keep the spellings they were read with — a `true` marker
    // and a day-only `todo` come back exactly as they were written.
    expect(after).toContain(LEDGER[3] as string)
    expect(after).toContain(LEDGER[4] as string)
  })
})

// ── what no op may do ──────────────────────────────────────────────────

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

/** ONE refusal for an id nothing declares, whatever the id was doing: the node
 *  an op is ABOUT gets the same did-you-mean as a target it was asked to point
 *  at, because an agent that mistyped is in the same position either way. */
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
    // The id that was not found travels as DATA beside the sentence, whichever
    // field of whichever op named it.
    expect(failure.named).toBe("instal")
    expect(failure.message).toContain("did you mean `install`")
  }
})

/**
 * The COPY, field by field.
 *
 * Every test here asks the same question from a different side: what does the
 * copy differ from the original in? The answer the op promises is "the ids, and
 * the two stamps" — so the assertions are mostly about what came across
 * UNCHANGED, which is the half a passing `✔` on a shorter test would not have
 * held.
 */
describe("duplicate", () => {
  const copied = (set: OutlineSet, id: string) => {
    const result = planned(set, { op: "duplicate", id })
    return { result, nodes: fileOf(result, "house.olai") }
  }

  /** The records the plan ADDED — everything the set did not already hold. */
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
    // What the write MADE, so a caller can mark or capture under it without a
    // search for an id nobody chose.
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

    // Six records in, four generations deep — nothing about this op caps the
    // depth, because nothing here is DESCRIBING a tree.
    expect(made.map((node) => node.id)).toEqual(["n1", "n2", "n3", "n4", "n5"])
    expect(result.summary).toBe("duplicate: order (+4)")

    // The shape, read off the copies: the same four generations.
    const parents = Object.fromEntries(made.map((node) => [node.id, node.parent]))
    expect(parents).toEqual({
      n1: "kitchen",
      n2: "n1",
      n3: "n2",
      n4: "n3",
      n5: "n1",
    })
    // …and the titles, in the order the file reads.
    expect(made.map((node) => (node as RegularNode).title)).toEqual([
      "order",
      "get a quote",
      "sign it",
      "file the copy",
      "pay the deposit",
    ])
    // THE FRESH-ID GUARANTEE, stated as the thing it is: no id appears twice in
    // the file the write would produce.
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

    // THE MARK, with the instant it was stamped at. Re-stamping it would say
    // the copy was finished today; dropping it would say it was never a task.
    expect(copy.done).toBe("2026-08-01T09:00:00-04:00")
    expect(copy.date).toBe("2026-08-01")
    expect(copy.desc).toBe("two\nlines")
    expect(copy.custom).toEqual({ pr: "https://example/1" })
    // The two the LEDGER writes: born now, and written to since by nobody.
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
    // `n2` is the copy of `order`, `n3` the copy of `install` — and the copy
    // waits on the copy, not on the original.
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
    // THE THIRD CASE of the point-at rule, and the one neither of the two
    // above states: an edge whose far end is outside what was copied is a
    // claim made by a record this write was not asked to touch. Copying it
    // would invent a second claim nobody made; swinging it onto the copy
    // would take one away.
    const set = setOf({
      "house.olai": [
        `{"id":"job","ord":"a0","title":"the job"}`,
        `{"id":"order","parent":"job","ord":"a0","title":"order","todo":true}`,
        `{"id":"watcher","ord":"a1","title":"the watcher","see":["order"],"after":["order"]}`,
      ].join("\n"),
    })
    const { nodes } = copied(set, "job")
    // The outsider still names the ORIGINAL, on both of its edges…
    expect(record(nodes, "watcher").see).toEqual(["order"])
    expect(record(nodes, "watcher").after).toEqual(["order"])
    // …and nothing was minted pointing at the copy of it.
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
    // Two records made, and the second is a mirror with a fresh id showing the
    // SAME node — not a twin of it.
    expect(made).toEqual([
      { id: "n1", ord: "a0V", title: "Now", created: STAMP },
      { id: "n2", parent: "n1", ord: "a0", mirror: "live" },
    ])
    // `captured` names NODES, so the placement is not in it.
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
    // `n2` is the copy of `task`; the copied placement shows it, so the copied
    // week is a week of its own rather than a second view of the first one's.
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

// ── typed properties ───────────────────────────────────────────────────
//
// A key a vault DECLARES has a type, and the write gate refuses a value that
// does not fit it — the same fence `set_doing` and the duplicate-id rule
// already are (`@olai/format`'s `typing.ts`). Every door that writes a property
// is here, because the whole claim of the design is that the check sits at the
// plan seam and so covers all of them rather than the one somebody remembered:
// `set_prop`, `add_node`'s `props` (children included), `apply`, `update`, and
// the capture the inbox lands.

/** A board that declares one of every kind that can refuse something, with the
 *  roster the ref points at and a document for the `doc`. */
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

/** One lane record out of a plan — every assertion below is about what it
 *  CARRIES, since a normalised value is the point as much as a refusal is. */
const laneAfter = (request: Request): RegularNode =>
  record(fileOf(planned(board(), request), "lanes.olai"), "lane")

describe("typed properties", () => {
  test("set_prop refuses a value that does not fit, naming what the key may hold", () => {
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

  test("set_prop STORES the one spelling, folding the obvious ones into it", () => {
    // `2026-08-25 10:06` is what a person types and what the day page already
    // accepts; what lands is the instant `set_done` writes, stamped with the
    // offset of the clock this write is being made on.
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

  // ── the births ───────────────────────────────────────────────────────

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

  test("set_prop of a bad type on a declaration is the same refusal", () => {
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
    expect(Result.isSuccess(validate(after(held, {
      op: "add",
      file: "_olai/Properties.olai",
      title: "brainstorm",
      props: { type: "doc" },
    })))).toBe(true)
  })

  test("set_prop of type on a declaration is the same existing-values fence", () => {
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

  test("move_node into Properties is the same existing-values fence", () => {
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

  test("untrash_node into Properties is the same fence", () => {
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

  test("duplicate_node of a declaration is the same fence — the key is already claimed", () => {
    const failure = refused(board(), { op: "duplicate", id: "prop-merge" })
    expect(failure.message).toContain("`merge` is already declared by an earlier node")
  })

  test("split_node of a Properties root that renames onto a key with unfit values is the same fence", () => {
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

  test("split_node of a Properties root still refuses the typeless tail", () => {
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

  test("merge_node of a Properties root is the same existing-values fence", () => {
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

  test("create_outline of Properties.olai is the same fence over the rest of the set", () => {
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
    // WHAT "INVALID" MEANS SINCE THE PER-FILE RULING: the set loads and
    // `lanes.olai` is withheld from it, carrying its three rows. The claim this
    // test makes is unchanged — one write leaves the file broken, one `apply`
    // mends it — and what it is read off moved from a refusal to the set.
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
    // …and the file is still the one a write to it would be stopped by, which
    // is what "a single write would leave the set invalid" costs a caller now.
    expect(stopping(stillBroken, ["lanes.olai"])).not.toBeNull()

    const all = after(broken, {
      op: "apply",
      ops: [
        { op: "prop", id: "a", key: "brainstorm", value: "briefs/one.md" },
        { op: "prop", id: "b", key: "brainstorm", value: "briefs/two.md" },
        { op: "prop", id: "c", key: "brainstorm", value: "briefs/three.md" },
      ],
    })
    expect(judged(all).broken).toEqual([])
    expect(stopping(judged(all), ["lanes.olai"])).toBeNull()
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

  test("add_node refuses a bad value on the node being born", () => {
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

  test("create_outline's seed is the same capture, so it is the same refusal", () => {
    expect(
      refused(board(), {
        op: "create",
        file: "more.olai",
        seed: { title: "a lane", props: { agent: "claude-opus" } },
      }).message,
    ).toContain("names a node under `roster`")
  })

  test("update writes properties through set_prop's own planner, in its words", () => {
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
    // ...and nothing landed: a batch is one plan, so the first op's write is
    // gone with the second one's refusal.
    expect(failure.message).toContain("`ops[1]` (`prop`) was refused, so nothing in this batch was written")
  })

  test("apply's `prop` is set_prop's whole arm — the `was` included, refused as itself", () => {
    // grok's SHOULD and Opus's SHOULD, the one ask on the batch door: the
    // CONDITION half of `prop` rides the batch too, and its failure is
    // dressed the same as any other — `ops[1]` naming the CONDITION'S own
    // sentence, not some typed miss. The FOLD rather than the original set
    // is what this claim locks: op [0]'s write is what moved the later
    // condition's answer, so a `was` judged against the pre-batch set is
    // the bug this going red would mean.
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

  // A copy of an ordinary subtree is isomorphic to something the validator
  // has already approved, so it can carry no value the set did not already
  // hold — a Properties ROOT is the other case, and is the declaration
  // door above.
  test("duplicate_node copies a declared value and stays legal", () => {
    const held = setOf({
      ...DECLARED,
      "lanes.olai": `{"id":"lane","ord":"a0","title":"the props lane","custom":{"merge":"auto"}}`,
    }, ["briefs/pdb.md"])
    const plan = planned(held, { op: "duplicate", id: "lane" })
    const copy = fileOf(plan, "lanes.olai").filter((node) => node.id !== "lane")
    expect((copy[0] as RegularNode).custom).toEqual({ merge: "auto" })
  })
})

// ── the review's corners ───────────────────────────────────────────────

describe("typed properties, further", () => {
  // grok's MUST. `namedBy` is `targetsOf` read backwards, and `targetsOf` is
  // the FORMAT's list of fields — so a reference living inside `custom` under a
  // declared `ref`/`node` key is invisible to it. Without this, `empty_trash`
  // deletes a node a live lane still names and answers SUCCESS, leaving the
  // very dangling value the validator refuses on the next load.
  test("empty_trash names the records that point into the archive by a typed property", () => {
    const held = setOf({
      ...DECLARED,
      "lanes.olai":
        `{"id":"lane","ord":"a0","title":"the props lane","custom":{"agent":"grok"}}`,
    }, ["briefs/pdb.md"])
    const emptied = after(held, { op: "trash", id: "grok" })
    const failure = refused(emptied, { op: "empty", file: "_olai/Trash.olai" })
    expect(failure._tag).toBe("UsageFailure")
    expect(failure.message).toContain("still has a record pointed INTO it")
    // The KEY is the field, so the entry reads exactly as a `see` or an `after`
    // one beside it and names the word to re-point.
    expect(failure.message).toContain("`lane` (`agent`, lanes.olai:1)")
  })

  test("...and a vault that declares no reference key pays no walk and refuses nothing", () => {
    // The guard, asked as a behaviour rather than as a comment: the same
    // removal on a board whose only declared keys are values goes through.
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

  // pi's SHOULD. A capture is a TREE, and a sentence about a key with no title
  // in front of it is a sentence whose subject the caller has to go and find.
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

  // pi's NIT, and the one this whole design rests on: what a DOOR writes is
  // what the VALIDATOR accepts. Asserted over the SET a plan produces rather
  // than over the string it returns, which is the half a unit test of the
  // normaliser cannot reach.
  test("what every door writes, the validator accepts — the whole lifecycle", () => {
    // BORN carrying loose spellings...
    const born = after(board(), {
      op: "add",
      file: "lanes.olai",
      id: "fresh",
      title: "a fresh lane",
      props: { dispatched: "2026-8-30", pr: "  194  ", merge: "human" },
    })
    expect(Result.isSuccess(validate(born))).toBe(true)
    expect(customOf(born, "fresh")).toEqual({
      dispatched: "2026-08-30",
      pr: "194",
      merge: "human",
    })
    // ...EDITED through the other door class...
    const edited = after(born, {
      op: "update",
      id: "fresh",
      props: { dispatched: "2026-08-31T09:00:00-04:00" },
    })
    expect(Result.isSuccess(validate(edited))).toBe(true)
    // ...COPIED, which carries approved values and can invent none...
    const copied = after(edited, { op: "duplicate", id: "fresh" })
    expect(Result.isSuccess(validate(copied))).toBe(true)
    // ...and REMOVED, which is not a value and is never fenced.
    const cleared = after(copied, { op: "prop", id: "fresh", key: "pr", value: null })
    expect(Result.isSuccess(validate(cleared))).toBe(true)
    expect(customOf(cleared, "fresh")["pr"]).toBeUndefined()
  })
})

/** One node's property map, off a set — the disk half of the lifecycle claim
 *  above, read through the format's own accessor rather than by reaching into
 *  a record this file assembled. */
const customOf = (set: OutlineSet, id: string): Record<string, unknown> => {
  const found = recordsOf(set).find((at) => at.node.id === id)
  if (found === undefined) throw new Error(`no node \`${id}\` in the set`)
  return { ...(found.node as RegularNode).custom }
}
