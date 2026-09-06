/**
 * THE TOOL WALK, as a harness — one maximal fixture, one call list, and the
 * answers a read door gives over them.
 *
 * It was the top half of {@link ./tools.test.ts}, and it moved here when the
 * matcher became a row. The claim it carries is that every read answers the
 * shape its own entry declares, over a fixture MAXIMAL enough that the check is
 * not vacuous — the drift it exists against is
 * https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/surface-mcp-positions.md,
 * where a field dropped from a declaration still compiled at the one place it
 * was produced and every consumer then encoded it away in silence.
 *
 * IT IS PARAMETERISED TWICE NOW, and each parameter is a thing that left this
 * package:
 *
 *   - the SEARCH DOOR, since the matcher became a row: `NO_SEARCH` is what a
 *     serve minus that row answers with, and the real matcher is what reaches
 *     the hit shapes at all;
 *   - the TABLE, since #546 sent every tool out to the row that owns it. There
 *     is no closed `TOOLS` here to walk, so a caller hands its OWN table:
 *     `olai-plugin-outlines` walks the three node reads, `olai-plugin-markdown`
 *     the two document ones, `olai-plugin-search` its one — each over this same
 *     fixture and this same call list.
 *
 * A HARNESS rather than a copy per package, because those runs must be the same
 * walk over the same set or the later ones prove nothing about the first. Two
 * copies of a maximal fixture is two things to keep maximal.
 */

import { NO_KINDS, type OutlineSet, type Reading } from "@olai/format"
import { Effect } from "effect"

import { readingOf, setOf, steady } from "./fixtures.testlib.ts"
import type { Search } from "./ops.ts"
import { asking, type Tool } from "./tools.ts"

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
 * Several, because a read's answer is not one shape: `outlines_read` answers a
 * detail or the id it does not hold, a search answers hits or a refusal, and a
 * walk answers truncated or finished. Each of those is a decode of its own.
 */
/**
 * KEYED BY THE AGENT-VISIBLE NAME — `<row>_<verb>`, which is what a tool is
 * called on the wire and in every doc.
 *
 * A row's own table declares the verb RELATIVE to the row (`list`, `read`), and
 * composition puts the row in front (juspay/kolu#2234) — so `list` alone is
 * three different reads here (`outlines_map`, `markdown_map`) and a flat map
 * keyed by the declared word could not hold them. The walkers below take the
 * row and compose the key, which is the same composition the served face makes.
 */
export const CALLS: Record<string, ReadonlyArray<unknown>> = {
  outlines_map: [{}],
  search_nodes: [
    { text: "hall" },
    { text: "is:open" },
    { text: "" },
    { text: "date:today" },
    { text: `"paint the hall" OR nothing-is-called-this` },
    // The one field of a record a hit does not carry unless it is asked for.
    { text: "House", withDesc: true },
  ],
  outlines_read: [
    { id: "house" },
    { id: "paint" },
    { id: "shed" },
    // The caller SHAPED its children — the one new arm of the answer.
    { id: "house", fields: ["title", "status", "done"] },
  ],
  // All three arms of the answer: one node walked, the WHOLE outline walked,
  // and an id the set does not hold — and both walks SHAPED, since `fields`
  // joined the answer's union.
  outlines_subtree: [
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
  markdown_map: [{}],
  // The reads that REFUSE are not called here: this walk decodes ANSWERS, and
  // a refusal has none. What `markdown_read` says about a path the set does not
  // hold — and what `outlines_subtree` says about one, and about a call naming both
  // ways in or neither — is the MCP face's own test and
  // `an_external_agent.feature`'s, where the refusal travels as a tool result
  // rather than being discharged by an `orDie` that would simply throw.
  markdown_read: [{ file: "notes/finishes.md" }, { file: "plain.md" }],
}

/** The read arms of ONE ROW'S table — narrowed, so a caller gets `answers` and
 *  `ask` rather than having to re-test the tag it just filtered on. It used to
 *  be a constant over the one closed table; a row hands its own now. */
export const readsOf = (tools: ReadonlyArray<Tool>) =>
  tools.filter((tool) => tool.kind === "read")

/**
 * WHICH OF A ROW'S READS THIS HARNESS HAS NO CALLS FOR — the closure, and the
 * reason {@link CALLS} is a lookup rather than a list: a read added to a row
 * without a fixture here is a NAMED miss rather than a shape nothing checks.
 *
 * A row asserts this is empty. The other direction — a call list entry for a
 * tool no row declares — is deliberately not checked, because no package can
 * see every row's table and a check that only some rows could run is a check
 * nobody runs.
 */
export const uncalled = (tools: ReadonlyArray<Tool>, row: string): ReadonlyArray<string> =>
  readsOf(tools).map((tool) => tool.name).filter((name) => CALLS[`${row}_${name}`] === undefined)

/**
 * WHICH TOOLS DESCRIBE THEMSELVES WITH AN ESCAPED NEWLINE — over a row's whole
 * table, because the way this breaks is per-description and silent.
 *
 * `markdown_map` and `markdown_read` shipped to review with `\\n\\n` in their
 * descriptions: two characters, a backslash and an `n`, where every other entry
 * has a real paragraph break. Nothing catches that. It compiles, the prose
 * assertions elsewhere still pass (they look for words, not shape), and the only
 * reader who ever sees it is the model reading `tools/list` — which gets
 * `lists it.\n\nREAD BEFORE YOU WRITE` run together with a stray escape in the
 * middle of it. These descriptions are long and structured, so the breaks are
 * load-bearing: they are what separates "what this answers" from "what it
 * refuses".
 *
 * A BACKSLASH-N IS NEVER RIGHT in one of these, so this is a flat ban rather
 * than a count — and it covers a description written next year as readily as the
 * two that provoked it. Titles too, which have no business holding a newline of
 * either kind. It is here rather than in one test because the tables are the
 * ROWS' now: every row runs the same ban over its own.
 */
export const escapedIn = (tools: ReadonlyArray<Tool>): ReadonlyArray<string> =>
  tools
    .filter((tool) => tool.description.includes("\\n") || tool.title.includes("\\n"))
    .map((tool) => tool.name)

/** How many REAL paragraph breaks one tool's description has — the other half of
 *  {@link escapedIn}'s claim, since a description with neither spelling would
 *  pass the ban by saying nothing. */
export const paragraphsIn = (tools: ReadonlyArray<Tool>, name: string): number =>
  (tools.find((tool) => tool.name === name)?.description.match(/\n\n/g) ?? []).length

/**
 * ONE WALK OF A ROW'S TABLE, over one door — every read asked with every entry
 * in {@link CALLS}, grouped by the tool that answered.
 *
 * The door is the SAME `asking` the ops layer builds over its own gated read,
 * so what this walks is the envelope an agent actually receives and not a
 * `Query` call the envelope is made of. It is built over the WHOLE fixture
 * whichever row is walking, so a row's reads are asked against the same set
 * every other row's are.
 *
 * ## Why the door is built ONCE, and why this is one function
 *
 * It was four, and two different questions find the same seam in that — which
 * is usually the sign it is real.
 *
 * WHAT CHANGES WHEN. The envelope's lifetime is the RUN's: `./ops.ts`'s `make`
 * builds one `asking` per served directory, and every tool call for the life of
 * that process goes through it. The version this replaced built one per CALL,
 * which modelled something production never does and quietly made the clock and
 * the kind vocabulary per-question values when they are per-directory facts. It
 * is built on the same clock production builds it on now.
 *
 * WHAT IS TANGLED. "Call every read" and "group the answers by tool" were two
 * passes over one list, and the second took apart exactly what the first had
 * just flattened. They are one walk: it groups as it goes, so there is no
 * flattened intermediate left lying around for a caller to reach for instead.
 *
 * `Effect.sync` rather than `succeed` so each question gets its own set,
 * exactly as the per-call `at()` this replaced did. Nothing here can fail — the
 * read is a fixture — so every answer is `runSync`-able, and the failure
 * channel is discharged here rather than threaded through tests that have
 * nothing to say about it.
 */
export const gaveOf = (search: Search, tools: ReadonlyArray<Tool>, row: string) => {
  const door = asking(Effect.sync(at), steady().now, NO_KINDS, search)
  const gave = new Map<string, ReadonlyArray<Record<string, unknown>>>()
  for (const tool of readsOf(tools)) {
    if (tool.kind !== "read") continue
    gave.set(
      tool.name,
      (CALLS[`${row}_${tool.name}`] ?? []).map((args) =>
        Effect.runSync(Effect.orDie(tool.ask(door, args as never))) as Record<string, unknown>
      ),
    )
  }
  /** The answers one tool gave — what every assertion indexes into, in both
   *  packages that run this walk. */
  return (name: string): ReadonlyArray<Record<string, unknown>> => gave.get(name) ?? []
}
