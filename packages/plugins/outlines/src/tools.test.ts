/**
 * EVERY READ THIS ROW DECLARES ANSWERS WHAT ITS OWN ENTRY SAYS IT ANSWERS.
 *
 * The three node reads' answer shapes are declared in `@olai/format` and
 * produced in `@olai/ops`, which the compiler already checks in one direction —
 * a reader that omits a required field, or builds an envelope the declaration
 * has never heard of, does not build. What it cannot check is the other
 * direction, and the other direction is the one search's drift arrived through:
 * object-literal freshness is lost through a `.map`, so a field DROPPED from a
 * declaration still compiles at the one place it is produced, and every consumer
 * encoding against the declaration would drop it in silence
 * (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/surface-mcp-positions.md,
 * position (a)).
 *
 * So this walks {@link ./tools.ts}, asks every read of an `asking` door over one
 * maximal set, and decodes each answer through the `answers` schema it carries,
 * with `onExcessProperty: "error"` — the same setting `parseOutline` reads
 * records under, and for the same reason. A field the floor does not declare
 * fails here; a field the floor declares and the walk stopped producing fails
 * here; and a value of the wrong KIND — a count that is not an integer, a stamp
 * that is neither `true` nor a string — fails here too, which no type can say.
 *
 * THE WALK IS A HARNESS (`@olai/ops/testlib/tools`) and the table is this row's,
 * which is the shape the whole suite took when the tools left `@olai/ops` for
 * the rows that own them (juspay/olai#546). The fixture and the call list stay
 * one thing over there, because two copies of a maximal set is two things to
 * keep maximal; `olai-plugin-markdown` and `olai-plugin-search` run the same
 * walk over their own tables.
 *
 * OFF THE TABLE rather than off a hand-picked list of functions, and that is
 * the difference worth having: `Query.detail` is not what an agent calls,
 * `outlines_read` is, and the envelope between them (`?? { missing: id }`) is
 * exactly the part a test against the function would not see. A fourth read on
 * this row is covered the moment it is added, or the closure test below fails
 * naming it.
 *
 * The set is deliberately MAXIMAL, and the second test is why: an optional field
 * nothing produces is a field this file cannot say anything about, so what the
 * fixture actually reaches is asserted rather than assumed.
 *
 * WHEN THIS FAILS, read the whole list. `errors: "all"` reports every key that
 * did not match, in the order the decoder walked them rather than the order the
 * declaration is written in — so a field dropped from the floor shows up
 * SOMEWHERE in the report and not necessarily first, usually with the whole
 * arm's other keys beside it (a union arm that fails one key fails all of them).
 * The name you are looking for is in there; it is not the first line.
 */

import type { Placed, Placement, Subtree } from "@olai/format"
import { NO_SEARCH } from "@olai/ops"
import {
  escapedIn,
  gaveOf,
  paragraphsIn,
  readsOf,
  uncalled,
} from "@olai/ops/testlib/tools"
import { expect, test } from "bun:test"
import { Schema } from "effect"

import { tools } from "./tools.ts"

/** No matcher, because this row declares no search: `search_nodes` is
 *  `olai-plugin-search`'s tool and its own test runs this walk with the real
 *  matcher behind the door. */
const answers = () => gaveOf(NO_SEARCH, tools, "outlines")

test("every read this row declares is called here", () => {
  expect(uncalled(tools, "outlines")).toEqual([])
})

test("every answer decodes through the shape its own entry declares", () => {
  const of = answers()
  for (const tool of readsOf(tools)) {
    if (tool.kind !== "read") continue
    const decode = Schema.decodeUnknownSync(
      tool.answers as Schema.Codec<unknown, unknown, never, never>,
      { errors: "all", onExcessProperty: "error" },
    )
    for (const answer of of(tool.name)) {
      // Compared with what went in, so the assertion is "this IS the shape"
      // rather than "this parses" — a decode that dropped a field would
      // otherwise pass.
      expect({ [tool.name]: decode(answer) }).toEqual({ [tool.name]: answer })
    }
  }
})

test("the fixture reaches every optional field, so the check is not vacuous", () => {
  const of = answers()

  const outlines = of("map")[0]?.["outlines"] as ReadonlyArray<
    Record<string, unknown>
  >
  // Two rows, one of each kind: a file that parsed is a count and its roots,
  // a file that did not is its errors and NOTHING ELSE — no `nodes: 0` for a
  // count nobody counted, and no empty `roots` claiming the outline is about
  // nothing. Pinned here so a change to the shape is a decision somebody makes
  // rather than one that happens.
  expect(outlines[0]).toEqual({
    file: "house.olai",
    // Four REGULAR nodes; the two mirrors are placements and do not count.
    nodes: 4,
    roots: ["House #home @sam"],
  })
  expect(outlines[1]).toEqual({
    file: "torn.olai",
    unreadable: [expect.any(String)],
  })

  const [house, paint, gone] = of("read")
  expect(house).toMatchObject({
    // Both marker kinds: `true` here, an ISO instant on `paint` below.
    doing: true,
    date: "2026-08-14",
    desc: "the note",
    tags: ["#home", "@sam"],
    progress: { done: 1, total: 2 },
    see: ["paint"],
    after: ["paint"],
    placed: [{ id: "in-house", shows: { id: "paint" } }],
  })
  // A root has no parent; a child carries the id a write would take.
  expect(house).not.toHaveProperty("parent")
  expect(paint).toMatchObject({
    done: "2026-08-09T10:15:00-04:00",
    parent: "house",
  })
  // A placement with a parent and one without, on the one node both show.
  expect((paint?.["mirrors"] as ReadonlyArray<Placement>).map((one) => one.parent))
    .toEqual(["house", undefined])
  expect(gone).toEqual({ missing: "shed" })

  const [cut, whole, outline, outlineCut, absent, lean, shaped, shapedOutline] = of("subtree")
  expect((cut?.["children"] as ReadonlyArray<Subtree>)[1])
    .toMatchObject({ id: "sand", truncated: true })
  expect(whole).not.toHaveProperty("truncated")
  expect(absent).toEqual({ missing: "shed" })
  // Default walk keeps the note; the lean walk takes it off and keeps the
  // children — `truncated` is a fact about depth, not about prose.
  expect(whole).toMatchObject({ desc: "the note" })
  expect(lean).not.toHaveProperty("desc")
  expect((lean?.["children"] as ReadonlyArray<Subtree>).map((child) => child.id))
    .toEqual(["paint", "sand"])
  // The whole outline: the fixture's one top-level root, and NOT the
  // placement sitting beside it as a root — named on the answer instead.
  expect(outline?.["file"]).toBe("house.olai")
  expect((outline?.["roots"] as ReadonlyArray<Subtree>).map((root) => root.id))
    .toEqual(["house"])
  // …and `truncated` is per ROOT, reached here so the arm's own optional field
  // is not a shape nothing produces.
  expect((outlineCut?.["roots"] as ReadonlyArray<Subtree>)[0]?.children[1])
    .toMatchObject({ id: "sand", truncated: true })

  // And `placed` rides a walk row across every shape the walk answers in —
  // named, never walked, so a board of mirrors is an answer and not a blank.
  // Reached here on the default walk, the lean one and BOTH shaped arms, so
  // the new field's decode above is vacuous on none of them: a walk shape
  // that forgot to declare it would strip it where the wire is.
  const placedIds = (row: Record<string, unknown> | undefined): ReadonlyArray<string> =>
    ((row?.["placed"] ?? []) as ReadonlyArray<Placed>).map((entry) => entry.id)
  expect(placedIds(whole)).toEqual(["in-house"])
  expect(placedIds(lean)).toEqual(["in-house"])
  expect(placedIds(shaped)).toEqual(["in-house"])
  expect(placedIds((outline?.["roots"] as ReadonlyArray<Record<string, unknown>>)[0]))
    .toEqual(["in-house"])
  expect(placedIds((shapedOutline?.["roots"] as ReadonlyArray<Record<string, unknown>>)[0]))
    .toEqual(["in-house"])
  expect(placedIds(outline)).toEqual(["loose"])
  expect(placedIds(shapedOutline)).toEqual(["loose"])

  // `placed` carries the node each row SHOWS, situated — the half of a mirror
  // a curated list is read with.
  const placed = house?.["placed"] as ReadonlyArray<Placed>
  expect(placed[0]?.shows).toMatchObject({ id: "paint", status: "done", path: ["House #home @sam"] })
})

/** WHAT AN AGENT ACTUALLY READS — the flat ban {@link escapedIn} argues, run
 *  over this row's whole table rather than over one closed list, since there is
 *  no closed list any more. The paragraph check beside it is the other half of
 *  the same claim: a description with neither spelling would pass the ban by
 *  saying nothing, and `outlines_map` is the tool the two `.md` listings were
 *  written against. */
test("no tool describes itself with an escaped newline", () => {
  expect(escapedIn(tools)).toEqual([])
  expect(paragraphsIn(tools, "map")).toBeGreaterThan(0)
})
