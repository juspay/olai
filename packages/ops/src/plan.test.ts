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
import { Result } from "effect"

import { setOf, steady } from "./fixtures.testlib.ts"
import { plan, type Plan } from "./plan.ts"
import type { Request } from "./request.ts"

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
})

// ── done / doing ───────────────────────────────────────────────────────

describe("done and doing", () => {
  test("marking a leaf stamps today and says so in the commit line", () => {
    const result = planned(house(), { op: "done", id: "order" })
    expect(record(fileOf(result, "house.jsonl"), "order").done).toBe("2026-08-09")
    expect(result.summary).toBe("done: order the cabinets")
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
    expect(node.doing).toBe("2026-08-09")
    expect(node.done).toBeUndefined()
  })

  test("already marked is refused rather than rewritten", () => {
    expect(refused(house(), { op: "done", id: "demo" }).message).toContain("already done")
  })

  test("undoing a mark that is not there is refused", () => {
    expect(refused(house(), { op: "done", id: "order", undo: true }).message).toContain(
      "not marked done",
    )
  })

  /**
   * The refusal the whole error taxonomy exists for: a node whose status is
   * COMPUTED cannot store one, and saying so is only useful if it names the
   * children that are in the way — as data, so the agent can do them one at a
   * time and the panel can draw them as rows.
   */
  test("a node with children is refused, and the refusal lists the unfinished ones", () => {
    const failure = refused(house(), { op: "done", id: "kitchen" })
    expect(failure._tag).toBe("DerivedFailure")
    if (failure._tag !== "DerivedFailure") return
    expect(failure.id).toBe("kitchen")
    expect(failure.children).toEqual([
      { id: "order", title: "order the cabinets", status: "open" },
      { id: "install", title: "install them", status: "open" },
    ])
    // The finished child is not in the list: it is not what is in the way.
    expect(failure.children.map((child) => child.id)).not.toContain("demo")
  })

  test("a parent that already derives done is the same refusal with nothing to do", () => {
    const set = setOf({
      "a.jsonl": [
        `{"id":"p","ord":"a0","title":"parent"}`,
        `{"id":"c","parent":"p","ord":"a0","title":"child","done":true}`,
      ].join("\n"),
    })
    const failure = refused(set, { op: "done", id: "p" })
    expect(failure._tag).toBe("DerivedFailure")
    if (failure._tag !== "DerivedFailure") return
    expect(failure.children).toEqual([])
    expect(failure.message).toContain("already reads done")
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
