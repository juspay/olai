/**
 * WHAT A FENCED DOOR MAY AND MAY NOT WRITE.
 *
 * Value in, value out — a set and a plan, both of which {@link ./plan.ts}
 * produces without a disk, which is the same shape {@link ./sorted.test.ts}
 * next door is written in and for the same reason: the fence is asked of the
 * two readings a write is made of, so a case is a fixture vault and a request
 * rather than a server.
 *
 * EVERY CASE HERE IS A RULING, and the ones that read as costs are stated as
 * costs: an agent cannot undo its own trash, cannot write a `.md`, cannot mint
 * an outline, and cannot seat a conversation anywhere — including on the node
 * it IS. Each of those is a line in the PR body as well as an assertion here.
 */

import {
  inboxIn,
  NO_KINDS,
  type OutlineSet,
  outlineNames,
  outlinePaths,
  type WriteRequest as Request,
} from "@olai/format"
import { readingOf } from "@olai/format/testlib"
import { describe, expect, test } from "bun:test"
import { Result } from "effect"

import { type Fence, type Outside, outsideFence } from "./fenced.ts"
import { setOf, steady } from "./fixtures.testlib.ts"
import { plan, scoping } from "./plan.ts"
import { fenceRefusal } from "./refusals.ts"

/** THE WORD THAT SEATS A CONVERSATION, as a fence receives it: data. The chat
 *  plugin's composed kind, spelled here only because a fixture has to spell
 *  something — `@olai/ops` compares two strings and knows nothing else. */
const BOUND = "chat-agent-session"

const HOUSE = [
  `{"id":"house","ord":"a0","title":"House"}`,
  `{"id":"kitchen","parent":"house","ord":"a0","title":"Kitchen"}`,
  `{"id":"sink","parent":"kitchen","ord":"a0","title":"the sink"}`,
  // A PLACEMENT of the garden, hung inside the fenced subtree by somebody else.
  // The whole point of the fence and `under:` sharing one predicate.
  `{"id":"kitchen-garden","parent":"kitchen","ord":"a1","mirror":"garden"}`,
  `{"id":"roof","parent":"house","ord":"a1","title":"the roof"}`,
].join("\n")

const GARDEN = [
  `{"id":"garden","ord":"a0","title":"Garden"}`,
  `{"id":"basil","parent":"garden","ord":"a0","title":"sow the basil"}`,
].join("\n")

const vault = (): OutlineSet =>
  setOf({
    "house.olai": HOUSE,
    "garden.olai": GARDEN,
    "_olai/Inbox.olai": `{"id":"note","ord":"a0","title":"an old line","todo":true}`,
    "_olai/Trash.olai":
      `{"id":"gone","ord":"a0","title":"the old table","done":"2026-06-01","custom":{"olai-from":"house.olai"}}`,
  })

/** ...and the same vault with no inbox at all, which is the only vault in which
 *  a capture MINTS one. */
const bare = (): OutlineSet => setOf({ "house.olai": HOUSE, "garden.olai": GARDEN })

/** The door a session bound to `kitchen` is handed. `ask` answers what the
 *  chat plugin will answer — the nearest node agent above — and is spent only
 *  on a refusal. */
const kitchen: Fence = {
  under: "kitchen",
  ask: () => "“House” (`house`)",
  forbidden: new Set([BOUND]),
}

/**
 * Plan the request against the set and ask the fence about the plan — exactly
 * as {@link ./ops.ts}' round does, off the reading the plan was judged against.
 *
 * The planner's own refusals are THROWN with the request in them rather than
 * returned, because a case that meant to test the fence and silently tested the
 * planner instead is a green test about nothing.
 */
const asked = (
  set: OutlineSet,
  request: Request,
  fence: Fence = kitchen,
): Outside | null => {
  const at = readingOf(set)
  const planned = plan(scoping(at, steady(), NO_KINDS), request)
  if (Result.isFailure(planned)) {
    throw new Error(
      `expected \`${request.op}\` to plan, and it refused: ${planned.failure.message}`,
    )
  }
  return outsideFence(
    fence,
    at.derived,
    outlineNames(at.set),
    inboxIn(outlinePaths(at.set)),
    planned.success,
  )
}

/** The same, as the sentence a caller would actually be handed. */
const refusal = (set: OutlineSet, request: Request, fence: Fence = kitchen): string => {
  const reached = asked(set, request, fence)
  if (reached === null) throw new Error(`expected \`${request.op}\` to be refused, and it was not`)
  return fenceRefusal(readingOf(set).derived, fence, reached)
}

describe("inside the subtree", () => {
  test("an edit inside the subtree lands", () => {
    expect(asked(vault(), { op: "done", id: "sink" })).toBeNull()
    expect(asked(vault(), { op: "desc", id: "sink", desc: "it drips" })).toBeNull()
    expect(asked(vault(), { op: "add", parent: "sink", title: "buy a washer" })).toBeNull()
  })

  test("…and so does one on the node the session IS", () => {
    // AT or under, ruled: `scoping` and `descendedFrom` both spell it that way
    // and one harness holds them equal, so a fence that excluded the corner
    // would make an agent's memory mean one thing to `search under:` and
    // another to the write gate — and the roster row draws this title live.
    expect(asked(vault(), { op: "title", id: "kitchen", title: "Kitchen remodel" })).toBeNull()
    expect(asked(vault(), { op: "done", id: "kitchen" })).toBeNull()
  })

  test("a whole-file rewrite that moved no record is not a write to anything", () => {
    // Every planner in this package emits WHOLE files, so the plan for a write
    // inside the subtree carries every record in `house.olai` — the ones above
    // the fence included. If the fence read paths instead of records this would
    // be the case that failed, which is why it is written down.
    const at = readingOf(vault())
    const nodes = at.derived.byFile.get("house.olai")?.map((one) => one.node) ?? []
    expect(nodes.length).toBeGreaterThan(1)
    expect(
      outsideFence(
        kitchen,
        at.derived,
        outlineNames(at.set),
        inboxIn(outlinePaths(at.set)),
        {
          files: [{ file: "house.olai", nodes }],
          id: "house",
          title: "House",
          file: "house.olai",
          summary: "no-op",
        },
      ),
    ).toBeNull()
  })

  test("a duplicate inside is an ordinary write, however many records it mints", () => {
    // No arm mentions `duplicate_node`, and none needs to: every record it
    // writes arrives under a node inside the fence, so the after-side climb
    // answers about all of them at once.
    expect(asked(vault(), { op: "duplicate", id: "sink" })).toBeNull()
    expect(asked(vault(), { op: "add", parent: "kitchen", title: "the tap" })).toBeNull()
  })
})

describe("outside it", () => {
  test("a write to a record above the session's node is refused, naming it", () => {
    expect(asked(vault(), { op: "done", id: "roof" })).toEqual({
      why: "record",
      id: "roof",
      title: "the roof",
      file: "house.olai",
    })
    expect(asked(vault(), { op: "title", id: "house", title: "The House" })?.why).toBe("record")
  })

  test("a move OUT is refused by the after side, and a move IN by the before side", () => {
    // The two halves of one rule, and they need both sides: a node leaving the
    // subtree is inside before and outside after, and one arriving is the
    // reverse. Either alone lets half of `move_node` through.
    expect(asked(vault(), { op: "move", id: "sink", parent: "roof" })?.why).toBe("record")
    expect(asked(vault(), { op: "move", id: "roof", parent: "kitchen" })?.why).toBe("record")
  })

  test("an add under a parent outside the subtree is refused", () => {
    // The arriving record has no before side at all, so this is answered by the
    // after-side climb over the PLAN's own records — the ancestry that does not
    // exist in the derivation yet.
    expect(asked(vault(), { op: "add", parent: "roof", title: "re-tile it" })?.why).toBe("record")
  })

  test("a subtree does not reach through a mirror hung inside it", () => {
    // `kitchen-garden` places the garden under the kitchen. If the fence
    // descended through placements, an agent could rewrite anybody's subtree by
    // waiting for somebody to mirror it inside their own — which is the one
    // thing a fourth containment walk would have got wrong.
    expect(asked(vault(), { op: "done", id: "basil" })?.why).toBe("record")
    expect(asked(vault(), { op: "title", id: "garden", title: "The Garden" })?.why).toBe("record")
  })
})

describe("the trash", () => {
  test("putting a node inside the subtree away works", () => {
    // The after side is EXEMPT for a record that landed in the trash, because
    // putting a node away is the only way to take one out of a subtree and it
    // necessarily writes a file that is under no node. The before side is what
    // proves it was the agent's to put away.
    expect(asked(vault(), { op: "trash", id: "sink" })).toBeNull()
  })

  test("…and putting somebody else's away does not", () => {
    expect(asked(vault(), { op: "trash", id: "roof" })?.why).toBe("record")
  })

  test("an untrash is refused, in every case and with no table entry", () => {
    // THE STATED COST: an agent cannot undo its own trash, and a person can.
    // Permitting it would let a fenced agent pull ANYBODY's trashed record into
    // its own subtree, which is a write to somebody else's record with extra
    // steps — and refusing it is what makes `empty_trash` fall out for free.
    expect(asked(vault(), { op: "untrash", id: "gone", parent: "kitchen" })?.why).toBe("record")
  })

  test("emptying the trash is refused for the same one reason", () => {
    // No arm in this module mentions `empty_trash`. Every record departs from
    // the trash, so every one of them fails the before side.
    expect(asked(vault(), { op: "empty", file: "_olai/Trash.olai" })?.why).toBe("record")
  })
})

describe("files, which are inside nobody's subtree", () => {
  test("minting an outline is refused even when it holds nothing at all", () => {
    // THE CASE THE PLAN-SHAPE LAYER EXISTS FOR. `create_outline` with no seed
    // mints an empty `.olai`, which "compares as nothing at all" (./sorted.ts
    // says so in its own words), so a pure per-record fence passes it
    // vacuously — the sharpest file-shaped write, invisible to the diff.
    expect(asked(vault(), { op: "create", file: "shed.olai" })).toEqual({
      why: "file",
      path: "shed.olai",
    })
    // ...and with a seed, where the records WOULD be visible, for the same
    // reason and by the same line.
    expect(asked(vault(), { op: "create", file: "shed.olai", seed: { title: "Shed" } })).toEqual({
      why: "file",
      path: "shed.olai",
    })
  })

  test("writing or making a document is refused", () => {
    // A fenced agent cannot write a `.md`. The escape inside the fence is
    // `set_desc` and a node under a node — the subtree IS the memory — and
    // document ownership is the named follow-up, not an oversight.
    expect(asked(vault(), { op: "create-doc", file: "notes/plan.md", text: "hello" })).toEqual({
      why: "document",
      path: "notes/plan.md",
    })
  })

  test("deleting a file is refused", () => {
    const held = setOf({ "house.olai": HOUSE, "empty.olai": "" })
    expect(asked(held, { op: "delete", file: "empty.olai" })).toEqual({
      why: "file",
      path: "empty.olai",
    })
  })
})

describe("the inbox, which is the one place a fenced door may reach upward", () => {
  test("a capture into the inbox this vault keeps lands", () => {
    // What `captureInto` resolves to when the directory has one: an `add` at
    // the top level of the inbox file, which is outside every subtree. The
    // carve-out is the PLACE and not the verb — `capture` never reaches this
    // layer as an op at all.
    expect(
      asked(vault(), {
        op: "add",
        file: "_olai/Inbox.olai",
        title: "the roof needs re-tiling",
        mark: "todo",
      }),
    ).toBeNull()
  })

  test("…and so does the mint, in a vault that keeps none", () => {
    // The other arm of the same fork, and the reason the two layers read one
    // expression: a mint the file layer permitted and the record layer then
    // refused would leave a fenced agent in an inbox-less vault with no upward
    // channel at all.
    expect(
      asked(bare(), {
        op: "create",
        file: "_olai/Inbox.olai",
        seed: { title: "the roof needs re-tiling", mark: "todo" },
      }),
    ).toBeNull()
  })

  test("EDITING what is already in the inbox is refused", () => {
    // An outbox, not a hole. The exemption is for ARRIVALS, and an existing
    // inbox record has a before side that is outside the fence like any other.
    expect(asked(vault(), { op: "title", id: "note", title: "not what it said" })?.why)
      .toBe("record")
    expect(asked(vault(), { op: "done", id: "note" })?.why).toBe("record")
  })
})

describe("the forbidden key", () => {
  test("the word that seats a conversation may not be written inside the subtree", () => {
    // Minting a sub-agent. Strictly inside the fence, and refused anyway —
    // which is what keeps phase 6's own "agency: not started" honest.
    expect(asked(vault(), { op: "prop", id: "sink", key: BOUND, value: "s-1" })).toEqual({
      why: "key",
      id: "sink",
      title: "the sink",
      key: BOUND,
    })
  })

  test("…nor on the node the session IS, which is the reason the place rule can be generous", () => {
    // Self-rebinding: the dangerous half of including the agent's own node. It
    // is closed by the KEY rather than by the place, which closes it everywhere
    // rather than at one corner.
    expect(asked(vault(), { op: "prop", id: "kitchen", key: BOUND, value: "s-2" })?.why).toBe("key")
  })

  test("clearing it is a write to it, and every other property is not", () => {
    const seated = setOf({
      "house.olai": HOUSE.replace(
        `{"id":"sink","parent":"kitchen","ord":"a0","title":"the sink"}`,
        `{"id":"sink","parent":"kitchen","ord":"a0","title":"the sink","custom":{"${BOUND}":"s-0"}}`,
      ),
      "garden.olai": GARDEN,
    })
    expect(asked(seated, { op: "prop", id: "sink", key: BOUND, value: null })?.why).toBe("key")
    expect(asked(vault(), { op: "prop", id: "sink", key: "pr", value: "176" })).toBeNull()
  })
})

describe("a door with nothing behind it", () => {
  test("a reaped session's door is closed, whatever it asks", () => {
    // A TOMBSTONE and not an absence: forgetting a released credential would
    // let reaping WIDEN what a stale one can do, which is the wrong direction
    // for reaping to move anything.
    const shut: Fence = { under: null, ask: () => null, forbidden: new Set() }
    expect(asked(vault(), { op: "done", id: "sink" }, shut)).toEqual({ why: "closed" })
  })

  test("a session whose node has gone has nothing left to write", () => {
    const orphan: Fence = { under: "vanished", ask: () => null, forbidden: new Set() }
    expect(asked(vault(), { op: "done", id: "sink" }, orphan)).toEqual({ why: "seat" })
  })
})

describe("what the refusal says", () => {
  test("it names the record, the seat and the ancestor to ask", () => {
    const said = refusal(vault(), { op: "done", id: "roof" })
    expect(said).toContain("`roof`")
    expect(said).toContain("“the roof”")
    expect(said).toContain("`house.olai`")
    expect(said).toContain("“Kitchen” (`kitchen`)")
    expect(said).toContain("Ask “House” (`house`), the nearest node agent above you")
  })

  test("…and says what to do instead when there is no node agent above", () => {
    // The COMMON case, since most node agents sit near a root: there is nobody
    // to ask, and the person reading the panel is who the agent is talking to.
    const alone: Fence = { under: "kitchen", ask: () => null, forbidden: new Set([BOUND]) }
    expect(refusal(vault(), { op: "done", id: "roof" }, alone))
      .toContain("There is no node agent above “Kitchen” (`kitchen`), so say what you need")
  })

  test("each shape says which kind of thing was reached for", () => {
    expect(refusal(vault(), { op: "create", file: "shed.olai" }))
      .toContain("`shed.olai` is a file, and a file is inside nobody's subtree")
    expect(refusal(vault(), { op: "create-doc", file: "notes/plan.md", text: "x" }))
      .toContain("`notes/plan.md` is a document, and a document is inside nobody's subtree")
    expect(refusal(vault(), { op: "prop", id: "sink", key: BOUND, value: "s-1" }))
      .toContain("`chat-agent-session` is a property this door may not write")
    const shut: Fence = { under: null, ask: () => null, forbidden: new Set() }
    expect(refusal(vault(), { op: "done", id: "sink" }, shut))
      .toContain("this conversation has been reaped")
  })

  test("the ancestor is asked only when a write is refused", () => {
    // A THUNK because who is above a node moves with the vault, and reading it
    // means walking the vault and intersecting it with a plugin's own roster.
    let asks = 0
    const counted: Fence = {
      under: "kitchen",
      ask: () => {
        asks++
        return null
      },
      forbidden: new Set([BOUND]),
    }
    expect(asked(vault(), { op: "done", id: "sink" }, counted)).toBeNull()
    expect(asks).toBe(0)
  })
})
