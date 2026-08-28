/**
 * Every read answers what the TABLE says it answers.
 *
 * The six read shapes are declared in `@olai/format` and produced here, which
 * the compiler already checks in one direction — a reader that omits a required
 * field, or builds an envelope the declaration has never heard of, does not
 * build. What it cannot check is the other direction, and the other direction
 * is the one search's drift arrived through: object-literal freshness is lost
 * through a `.map`, so a field DROPPED from a declaration still compiles at the
 * one place it is produced, and every consumer encoding against the declaration
 * would drop it in silence (https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/surface-mcp-positions.md,
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
 * exactly the part a test against the function would not see. A seventh read
 * tool is covered the moment it is added, or the fixture list below fails
 * naming it.
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
 *  deep enough to truncate a walk, and a file that does not parse — plus the
 *  documents beside it, which the two document reads answer over: one with a
 *  heading, one with none, a `.html` the set keeps no body for, and a `.md`
 *  that could not be read. */
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
    // The one field of a record a hit does not carry unless it is asked for.
    { text: "House", withDesc: true },
  ],
  read_node: [{ id: "house" }, { id: "paint" }, { id: "shed" }],
  // All three arms of the answer: one node walked, the WHOLE outline walked,
  // and an id the set does not hold.
  read_subtree: [
    { id: "house", depth: 1 },
    { id: "house" },
    { file: "house.olai" },
    { file: "house.olai", depth: 1 },
    { id: "shed" },
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
  // And the note, when the query asked for it — the one field of a record a hit
  // does not carry by default, reached here so the decode above is not vacuous
  // about it.
  expect(searches[5]?.["hits"]).toMatchObject([{ id: "house", desc: "the note" }])

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

  // The document listing is the outline listing's twin, torn row and all: a
  // `.md` the set could not read is its errors and nothing else — matching
  // the outline arm — and the `.html` beside it is not in this answer at all:
  // nothing kept its body, so there is nothing to name or measure.
  const documents = of("list_documents")[0]?.["documents"] as ReadonlyArray<
    Record<string, unknown>
  >
  expect(documents).toEqual([
    { file: "notes/finishes.md", title: "Finishes", bytes: 26 },
    {
      file: "notes/plan.md",
      title: "The plan",
      bytes: 59,
      props: { agent: "claude-opus", owners: ["alice", "bob"] },
    },
    { file: "plain.md", title: "walnut, or birch", bytes: 17 },
    { file: "torn.md", unreadable: [expect.any(String)] },
  ])

  // And one body, whole — the text a `write_document` guard is judged against.
  expect(of("read_document")[0]).toEqual({
    file: "notes/finishes.md",
    text: "# Finishes\n\nDoors: matte.\n",
  })

  const [cut, whole, outline, outlineCut, absent] = of("read_subtree")
  expect((cut?.["children"] as ReadonlyArray<Subtree>)[1])
    .toMatchObject({ id: "sand", truncated: true })
  expect(whole).not.toHaveProperty("truncated")
  expect(absent).toEqual({ missing: "shed" })
  // The whole outline: both of this fixture's top-level roots, and NOT the
  // placement sitting between them — a mirror is a second view of a node that
  // lives elsewhere, and elsewhere is where this read answers it.
  expect(outline?.["file"]).toBe("house.olai")
  expect((outline?.["roots"] as ReadonlyArray<Subtree>).map((root) => root.id))
    .toEqual(["house"])
  // …and `truncated` is per ROOT, reached here so the arm's own optional field
  // is not a shape nothing produces.
  expect((outlineCut?.["roots"] as ReadonlyArray<Subtree>)[0]?.children[1])
    .toMatchObject({ id: "sand", truncated: true })

  // `placed` carries the node each row SHOWS, situated — the half of a mirror
  // a curated list is read with.
  const placed = house?.["placed"] as ReadonlyArray<Placed>
  expect(placed[0]?.shows).toMatchObject({ id: "paint", status: "done", path: ["House #home @sam"] })
})

/**
 * EVERY TOOL'S SECOND DECLARATION IS CHECKED AGAINST ITS SCHEMA — and only the
 * compiler can check it, which is what this test is.
 *
 * Each entry in the table says one thing twice: the schema an agent fills in,
 * and then something ABOUT that schema — a read's asker takes the request, an
 * act's does too, a write names the field its own name decides and is written
 * in the planner's vocabulary. The walks above can see none of it: the table
 * erases every entry to a `Tool`, whose `ask` takes `never` and whose `fixed`
 * is a bag of `unknown`. The three constructors are exported for this.
 *
 * THE FIRST CALL IS THE ONLY ONE THAT COMPILES. It annotates nothing and hands
 * `args` to a door wanting a `NodeRequest`, so a lost inference — `unknown`,
 * which is what the request parameter's old `| Schema.Top` union left — fails
 * here. (The table has that shape too, so it would fail there as well; this
 * says it where the refusals below can be read against it.)
 *
 * THE OTHER FOUR ARE EXPECTED TO BE REFUSED, and `@ts-expect-error` fails the
 * build when the line it guards compiles — which is what rules out the other
 * way this goes wrong, an `any` swallowing the wrong annotation and leaving the
 * directive unused. EACH BODY IS VALID ON ITS OWN, deliberately: a refusal that
 * would also be a refusal for some second reason proves nothing about the
 * first, so `asking.node({ id })` and `ops.commit({})` are calls that type-check
 * — leaving the parameter annotation as the only thing on the line that can
 * fail.
 *
 * None of the five is a tool and none reaches {@link TOOLS}; what is under test
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
    // claiming to take a `SearchRequest` is not a reader of this tool.
    (asking, args: SearchRequest) => asking.node({ id: "paint" }),
  )

  act(
    "commit",
    "Commit what you changed",
    "Record what is waiting as one git commit.",
    CommitRequest,
    // @ts-expect-error — the same rule on the act arm, which has its own
    // signature and could lose it on its own.
    (ops, args: NodeRequest) => ops.commit({}),
  )

  write(
    "create_outline",
    "Create an outline",
    "Start a new outline file.",
    CreateRequest,
    // @ts-expect-error — a write's `fixed` is a field of the request beside
    // it, and `CreateRequest`'s `op` is `"create"`.
    { op: "creat" },
  )

  write(
    "read_node",
    "Read a node",
    "Not a write at all.",
    // @ts-expect-error — and the schema itself has to be one the planner can
    // take: a read's request is not an arm of the write vocabulary, so this is
    // a tool `Running.run` could never answer.
    NodeRequest,
    {},
  )

  read(
    "read_node",
    "Read a node",
    "Not an object at all.",
    // @ts-expect-error — and it has to have FIELDS. This is the one bound the
    // table cannot speak for, and the reason it is here: every schema the floor
    // hands this file is a struct, so {@link Arguments} holding and
    // {@link Arguments} not being there look identical from the table. A call
    // arrives as a JSON object; a schema that is not one has nothing for
    // `argsOf` to take apart and nothing for an agent to fill in.
    Schema.String,
    NodeAnswer,
    (asking) => asking.node({ id: "paint" }),
  )
})

/**
 * WHAT AN AGENT ACTUALLY READS — over the whole table, because the way this
 * breaks is per-description and silent.
 *
 * `list_documents` and `read_document` shipped to review with `\\n\\n` in
 * their descriptions: two characters, a backslash and an `n`, where every
 * other entry has a real paragraph break. Nothing catches that. It compiles,
 * the prose assertions elsewhere in this suite still pass (they look for
 * words, not shape), and the only reader who ever sees it is the model reading
 * `tools/list` — which gets `lists it.\n\nREAD BEFORE YOU WRITE` run together
 * with a stray escape in the middle of it. The tool descriptions here are long
 * and structured, so the breaks are load-bearing: they are what separates
 * "what this answers" from "what it refuses".
 *
 * A BACKSLASH-N IS NEVER RIGHT in one of these. There is no case for writing
 * the two characters into prose an agent reads, so this is a flat ban rather
 * than a count — and it covers a description written next year as readily as
 * the two that provoked it. Titles too, which have no business holding a
 * newline of either kind.
 */
test("no tool describes itself with an escaped newline", () => {
  const escaped = TOOLS
    .filter((tool) => tool.description.includes("\\n") || tool.title.includes("\\n"))
    .map((tool) => tool.name)
  expect(escaped).toEqual([])

  // And the paragraph breaks are really there in the ones that mean to have
  // them — the other half of the same claim, since a description with neither
  // spelling would pass the ban above by saying nothing.
  const paragraphs = (name: string) =>
    (TOOLS.find((tool) => tool.name === name)?.description.match(/\n\n/g) ?? []).length
  expect(paragraphs("list_documents")).toBeGreaterThan(0)
  expect(paragraphs("read_document")).toBeGreaterThan(0)
  // The tool the two were written against, so the assertion is "the same shape
  // the table already had" rather than a number somebody chose.
  expect(paragraphs("list_outlines")).toBeGreaterThan(0)
})
