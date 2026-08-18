/**
 * Every read answers what the TABLE says it answers.
 *
 * The four read shapes are declared in `@olai/format` and produced here, which
 * the compiler already checks in one direction — a reader that omits a required
 * field, or builds an envelope the declaration has never heard of, does not
 * build. What it cannot check is the other direction, and the other direction
 * is the one search's drift arrived through: object-literal freshness is lost
 * through a `.map`, so a field DROPPED from a declaration still compiles at the
 * one place it is produced, and every consumer encoding against the declaration
 * would drop it in silence (docs/brainstorming/surface-mcp-positions.md,
 * position (a)).
 *
 * So this walks {@link TOOLS}, asks every read of an {@link asking} door over
 * one maximal set, and decodes each answer through the `answers` schema it
 * carries,
 * with `onExcessProperty: "error"` — the same setting `parseOutline` reads
 * records under, and for the same reason. A field the floor does not declare
 * fails here; a field the floor declares and the walk stopped producing fails
 * here; and a value of the wrong KIND — a count that is not an integer, a stamp
 * that is neither `true` nor a string — fails here too, which no type can say.
 *
 * OFF THE TABLE rather than off a hand-picked list of functions, and that is
 * the difference worth having: `Query.detail` is not what an agent calls,
 * `read_node` is, and the envelope between them (`?? { missing: id }`) is
 * exactly the part a test against the function would not see. A fifth read tool
 * is covered the moment it is added, or the fixture list below fails naming it.
 *
 * That envelope now lives in `asking`, one declaration serving the local layer
 * and the surface procedure a bridged agent reaches — so this walk covers the
 * bridged answer too, which is the reason it goes through the door rather than
 * around it.
 *
 * The set is deliberately MAXIMAL, and the last test is why: an optional field
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

import {
  CommitRequest,
  CreateRequest,
  NodeAnswer,
  NodeRequest,
  type OutlineSet,
  type Placed,
  type Placement,
  type Reading,
  type SearchRequest,
  type Subtree,
} from "@olai/format"
import { expect, test } from "bun:test"
import { Effect, Schema } from "effect"

import { readingOf, setOf, steady } from "./fixtures.testlib.ts"
import { act, asking, read, TOOLS, write } from "./tools.ts"

/** One house, and everything a read can carry: both marker kinds, a note, a
 *  date, both tag sigils, a placement with a parent and one without, a child
 *  deep enough to truncate a walk, and a file that does not parse. */
const EVERYTHING = (): OutlineSet =>
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
  }, [], { "torn.olai": "{ not a record" })

const at = (): Reading => readingOf(EVERYTHING())

/**
 * The read door, over that fixture — the SAME `asking` the ops layer builds
 * over its own gated read, so what this walks is the envelope an agent
 * actually receives and not a `Query` call the envelope is made of.
 *
 * `Effect.sync` rather than `succeed` so each question gets its own set,
 * exactly as the per-call `at()` this replaced did. Nothing here can fail —
 * the read is a fixture — so every answer is `runSync`-able.
 */
const ASKING = asking(Effect.sync(at), steady().now)

/** One read, answered. The tools' own effects never fail over a fixture that
 *  loaded, so the failure channel is discharged here rather than threaded
 *  through three tests that have nothing to say about it. */
const answerOf = (
  tool: Extract<(typeof TOOLS)[number], { kind: "read" }>,
  args: unknown,
): unknown => Effect.runSync(Effect.orDie(tool.ask(ASKING, args as never)))

/**
 * What each read is CALLED with, one entry per tool and several calls per
 * entry.
 *
 * Several, because a read's answer is not one shape: `read_node` answers a
 * detail or the id it does not hold, a search answers hits or a refusal, and a
 * walk answers truncated or finished. Each of those is a decode of its own.
 */
const CALLS: Record<string, ReadonlyArray<unknown>> = {
  list_outlines: [{}],
  search_nodes: [
    { text: "hall" },
    { text: "is:open" },
    { text: "" },
    { text: "date:today" },
    { text: `"paint the hall" OR nothing-is-called-this` },
  ],
  read_node: [{ id: "house" }, { id: "paint" }, { id: "shed" }],
  read_subtree: [{ id: "house", depth: 1 }, { id: "house" }, { id: "shed" }],
}

const READS = TOOLS.filter((tool) => tool.kind === "read")

/** Every answer the fixture can provoke, paired with the tool that gave it. */
const answered = (): ReadonlyArray<{ name: string; answer: unknown }> =>
  READS.flatMap((tool) =>
    (CALLS[tool.name] ?? []).map((args) => ({
      name: tool.name,
      answer: tool.kind === "read" ? answerOf(tool, args) : undefined,
    }))
  )

test("every read in the table is called here", () => {
  // The closure, and the reason the fixtures are a lookup rather than a list:
  // a fifth read tool is a missing key, named — not a shape nothing checks.
  expect(READS.map((tool) => tool.name).filter((name) => CALLS[name] === undefined))
    .toEqual([])
})

test("every answer decodes through the shape its own entry declares", () => {
  for (const tool of READS) {
    if (tool.kind !== "read") continue
    const decode = Schema.decodeUnknownSync(
      tool.answers as Schema.Codec<unknown, unknown, never, never>,
      { errors: "all", onExcessProperty: "error" },
    )
    for (const args of CALLS[tool.name] ?? []) {
      const answer = answerOf(tool, args)
      // Compared with what went in, so the assertion is "this IS the shape"
      // rather than "this parses" — a decode that dropped a field would
      // otherwise pass.
      expect({ [tool.name]: decode(answer) }).toEqual({ [tool.name]: answer })
    }
  }
})

test("the fixture reaches every optional field, so the check is not vacuous", () => {
  const answers = answered()
  const of = (name: string): ReadonlyArray<Record<string, unknown>> =>
    answers.filter((one) => one.name === name).map((one) =>
      one.answer as Record<string, unknown>
    )

  const outlines = of("list_outlines")[0]?.["outlines"] as ReadonlyArray<
    Record<string, unknown>
  >
  // Two rows, one of each kind: a file that parsed, and one that did not. The
  // torn row carries `unreadable` BESIDE a zero count and an empty root list —
  // the flat shape `OutlineSummary` holds knowingly, and pinned here so a
  // change to it is a decision somebody makes rather than one that happens.
  expect(outlines[0]).toEqual({
    file: "house.olai",
    // Four REGULAR nodes; the two mirrors are placements and do not count.
    nodes: 4,
    roots: ["House #home @sam"],
  })
  expect(outlines[1]).toEqual({
    file: "torn.olai",
    nodes: 0,
    roots: [],
    unreadable: [expect.any(String)],
  })

  const searches = of("search_nodes")
  expect(searches[0]?.["hits"]).toMatchObject([{ id: "paint", matched: "title" }])
  // A query the grammar could not read carries the reason rather than an
  // empty list with nothing to say.
  expect(searches[1]?.["refusals"]).toBeArrayOfSize(1)
  // And a relative word is counted from THIS LAYER'S CLOCK — the one a `done`
  // is stamped with, which is what the door hands the grammar. `paint` was
  // finished at the fixture clock's own instant, so `date:today` finds it: a
  // door that read a clock of its own would answer this with nothing.
  expect(searches[3]?.["hits"]).toMatchObject([{ id: "paint" }])
  expect(searches[3]).not.toHaveProperty("refusals")
  // A quoted PHRASE and an `OR` group reach this door too — the tool's own
  // `text` prose spells both, and a schema that decoded the words and not
  // these would be the door advertising a grammar it does not answer.
  expect(searches[4]?.["hits"]).toMatchObject([{ id: "paint", matched: "title" }])

  const [house, paint, gone] = of("read_node")
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
  expect(paint).toMatchObject({ done: "2026-08-09T10:15:00-04:00" })
  // A placement with a parent and one without, on the one node both show.
  expect((paint?.["mirrors"] as ReadonlyArray<Placement>).map((one) => one.parent))
    .toEqual(["house", undefined])
  expect(gone).toEqual({ missing: "shed" })

  const [cut, whole, absent] = of("read_subtree")
  expect((cut?.["children"] as ReadonlyArray<Subtree>)[1])
    .toMatchObject({ id: "sand", truncated: true })
  expect(whole).not.toHaveProperty("truncated")
  expect(absent).toEqual({ missing: "shed" })

  // `placed` carries the node each row SHOWS, situated — the half of a mirror
  // a curated list is read with.
  const placed = house?.["placed"] as ReadonlyArray<Placed>
  expect(placed[0]?.shows).toMatchObject({ id: "paint", status: "done", path: ["House #home @sam"] })
})

/**
 * EVERY TOOL'S SECOND DECLARATION IS CHECKED AGAINST ITS SCHEMA — and only the
 * compiler can check it, which is why this test is written the way it is.
 *
 * Each entry in the table says one thing twice: the schema an agent fills in,
 * and then something ABOUT that schema — a read's asker takes the request, an
 * act's does too, a write names the field its own name already decides
 * (`{ op: "create" }`). The walks above cannot see any of it: the table erases
 * every entry to a `Tool`, whose `ask` takes `never` and whose `fixed` is a bag
 * of `unknown`, so nothing that RUNS can tell what the constructor was handed.
 * The three constructors are exported for exactly this.
 *
 * FOUR CALLS, AND THE FIRST IS THE POINT. It annotates nothing and hands `args`
 * straight to a door that wants a `NodeRequest`: if inference were lost —
 * `unknown`, which is what the request parameter's old `| Schema.Top` union
 * left behind — that line would not compile, and everything below it would be
 * pinning a type nobody derived. The other three are each expected to be
 * REFUSED, and `@ts-expect-error` fails the build when the line it guards
 * compiles: that is what rules out the other way this can go wrong, since an
 * `any` would swallow the wrong annotation, leave the directive unused, and
 * `tsc` reports exactly that.
 *
 * None of the four is a tool and none reaches {@link TOOLS}; what is under test
 * is the constructors, and the table is only how they are normally called.
 */
test("what a tool says twice has to agree with its own schema", () => {
  const tool = read(
    "read_node",
    "Read a node",
    "One node in full.",
    NodeRequest,
    NodeAnswer,
    (asking, args) => asking.node(args),
  )
  expect(tool.kind).toBe("read")

  read(
    "read_node",
    "Read a node",
    "One node in full.",
    NodeRequest,
    NodeAnswer,
    // @ts-expect-error — the schema beside it says `NodeRequest`, so an asker
    // that claims to take a `SearchRequest` is not a reader of this tool.
    (asking, args: SearchRequest) => asking.search(args),
  )

  act(
    "commit",
    "Commit what you changed",
    "Record what is waiting as one git commit.",
    CommitRequest,
    // @ts-expect-error — same rule on the act arm, whose `args` are its
    // schema's for the same reason a read's are.
    (ops, args: NodeRequest) => ops.commit(args),
  )

  write(
    "create_outline",
    "Create an outline",
    "Start a new outline file.",
    CreateRequest,
    // @ts-expect-error — a write's `fixed` is a field of the request beside
    // it: `CreateRequest`'s `op` is `"create"`, and a table that misspelled
    // the verb would otherwise advertise this tool and ask the planner for one
    // nothing has ever heard of.
    { op: "creat" },
  )
})
