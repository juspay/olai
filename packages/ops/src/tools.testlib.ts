/**
 * THE TOOL WALK, as a harness — one maximal fixture, one call list, and the
 * answers a read door gives over them.
 *
 * It was the top half of {@link ./tools.test.ts}, and it moved here when the
 * matcher became a row. That file's whole claim is that every read in
 * {@link TOOLS} answers the shape its own entry declares, over a fixture
 * MAXIMAL enough that the check is not vacuous — and one of the six reads is
 * now answered by a door core does not stand behind (`search_nodes`, through
 * {@link ../ops.ts}'s `Search`). So the walk is parameterised by that door and
 * run twice, in two packages:
 *
 *   - `./tools.test.ts` runs it with `NO_SEARCH`, which is what a serve minus
 *     the `search` row answers with: the decode still has to hold, and the
 *     refusal envelope is a shape somebody reads.
 *   - `olai-plugin-search`'s `tools.test.ts` runs it with the real matcher and
 *     keeps every assertion about what a hit carries — which is exactly where
 *     the drift this whole file exists against arrived from
 *     (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/surface-mcp-positions.md).
 *
 * A HARNESS rather than two copies of a fixture, because the two runs must be
 * the same walk over the same set or the second proves nothing about the first.
 */

import { NO_KINDS, type OutlineSet, type Reading } from "@olai/format"
import { Effect } from "effect"

import { readingOf, setOf, steady } from "./fixtures.testlib.ts"
import type { Search } from "./ops.ts"
import { asking, type Tool, TOOLS } from "./tools.ts"

/** One house, and everything a read can carry: both marker kinds, a note, a
 *  date, both tag sigils, a placement with a parent and one without, a child
 *  deep enough to truncate a walk, and a file that does not parse — plus the
 *  documents beside it, which the two document reads answer over: one with a
 *  heading, one with none, a `.html` the set keeps no body for, and a `.md`
 *  that could not be read. */
export const EVERYTHING = (): OutlineSet =>
  setOf({
    "house.olai": [
      `{"id":"house","ord":"a0","title":"House #home @sam","desc":"the note","date":"2026-08-14","doing":true,"see":["paint"],"after":["paint"]}`,
      `{"id":"paint","parent":"house","ord":"a0","title":"paint the hall","done":"2026-08-09T10:15:00-04:00"}`,
      `{"id":"sand","parent":"house","ord":"a1","title":"sand the floor","todo":true}`,
      `{"id":"grain","parent":"sand","ord":"a0","title":"with the grain"}`,
      // Under a node, so `house` has a `placed` row…
      `{"id":"in-house","parent":"house","ord":"a2","mirror":"paint"}`,
      // …and at the top level, so one of `paint`'s placements has no parent.
      `{"id":"loose","ord":"a1","mirror":"paint"}`,
    ].join("\n"),
  }, [
    ["notes/finishes.md", "# Finishes\n\nDoors: matte.\n"],
    [
      "notes/plan.md",
      "---\nagent: claude-opus\nowners: [alice, bob]\n---\n# The plan\n",
    ],
    ["plain.md", "walnut, or birch\n"],
    // Bare, because the set holds this one's PATH and not its content — which
    // is exactly why no document read answers it.
    "saved/page.html",
  ], { "torn.olai": "{ not a record", "torn.md": "{ not a record" })

export const at = (): Reading => readingOf(EVERYTHING())

/**
 * What each read is CALLED with, one entry per tool and several calls per
 * entry.
 *
 * Several, because a read's answer is not one shape: `read_node` answers a
 * detail or the id it does not hold, a search answers hits or a refusal, and a
 * walk answers truncated or finished. Each of those is a decode of its own.
 */
export const CALLS: Record<string, ReadonlyArray<unknown>> = {
  list_outlines: [{}],
  search_nodes: [
    { text: "hall" },
    { text: "is:open" },
    { text: "" },
    { text: "date:today" },
    { text: `"paint the hall" OR nothing-is-called-this` },
    // The one field of a record a hit does not carry unless it is asked for.
    { text: "House", withDesc: true },
  ],
  read_node: [
    { id: "house" },
    { id: "paint" },
    { id: "shed" },
    // The caller SHAPED its children — the one new arm of the answer.
    { id: "house", fields: ["title", "status", "done"] },
  ],
  // All three arms of the answer: one node walked, the WHOLE outline walked,
  // and an id the set does not hold — and both walks SHAPED, since `fields`
  // joined the answer's union.
  read_subtree: [
    { id: "house", depth: 1 },
    { id: "house" },
    { file: "house.olai" },
    { file: "house.olai", depth: 1 },
    { id: "shed" },
    // The lean walk: notes off, structure on. Reached here so the decode
    // above is not vacuous about a `withDesc: false` answer.
    { id: "house", withDesc: false },
    // The shaped walks: one per way in, so both projected arms of the union
    // are actually decoded.
    { id: "house", fields: ["title", "status", "done"] },
    { file: "house.olai", depth: 1, fields: ["title", "status", "custom"] },
  ],
  list_documents: [{}],
  // The reads that REFUSE are not called here: this walk decodes ANSWERS, and
  // a refusal has none. What `read_document` says about a path the set does not
  // hold — and what `read_subtree` says about one, and about a call naming both
  // ways in or neither — is the MCP face's own test and
  // `an_external_agent.feature`'s, where the refusal travels as a tool result
  // rather than being discharged by an `orDie` that would simply throw.
  read_document: [{ file: "notes/finishes.md" }, { file: "plain.md" }],
}

export const READS = TOOLS.filter((tool) => tool.kind === "read")

/**
 * The read door, over that fixture — the SAME `asking` the ops layer builds
 * over its own gated read, so what this walks is the envelope an agent
 * actually receives and not a `Query` call the envelope is made of.
 *
 * `Effect.sync` rather than `succeed` so each question gets its own set,
 * exactly as the per-call `at()` this replaced did. Nothing here can fail —
 * the read is a fixture — so every answer is `runSync`-able.
 */
export const asked = (search: Search) => asking(Effect.sync(at), steady().now, NO_KINDS, search)

/** One read, answered. The tools' own effects never fail over a fixture that
 *  loaded, so the failure channel is discharged here rather than threaded
 *  through three tests that have nothing to say about it. */
export const answerOf = (
  search: Search,
  tool: Extract<Tool, { kind: "read" }>,
  args: unknown,
): unknown => Effect.runSync(Effect.orDie(tool.ask(asked(search), args as never)))

/** Every answer the fixture can provoke, paired with the tool that gave it. */
export const answered = (
  search: Search,
): ReadonlyArray<{ name: string; answer: unknown }> =>
  READS.flatMap((tool) =>
    (CALLS[tool.name] ?? []).map((args) => ({
      name: tool.name,
      answer: tool.kind === "read" ? answerOf(search, tool, args) : undefined,
    }))
  )

/** The answers one tool gave, as records — what every assertion below indexes
 *  into, in both packages that run this walk. */
export const gaveOf = (search: Search) => {
  const answers = answered(search)
  return (name: string): ReadonlyArray<Record<string, unknown>> =>
    answers.filter((one) => one.name === name).map((one) =>
      one.answer as Record<string, unknown>
    )
}
