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
 * would drop it in silence (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/surface-mcp-positions.md,
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
  type Placed,
  type Placement,
  type Subtree,
} from "@olai/format"
import { expect, test } from "bun:test"
import { Effect, Schema } from "effect"

import { NO_SEARCH } from "./ops.ts"
import { act, read, TOOLS, write } from "./tools.ts"
import { CALLS, gaveOf, READS } from "./tools.testlib.ts"

/** WITH NO MATCHER MOUNTED, which is what this package can build: the walk
 *  is a harness now ({@link ./tools.testlib.ts}) and `olai-plugin-search`'s own
 *  `tools.test.ts` runs the identical one with the real matcher behind
 *  `search_nodes`. What is asserted here is every read core answers for
 *  itself, plus the refusal envelope a serve without that row hands an agent. */
const answers = () => gaveOf(NO_SEARCH)

test("every read in the table is called here", () => {
  // The closure, and the reason the fixtures are a lookup rather than a list:
  // a fifth read tool is a missing key, named — not a shape nothing checks.
  expect(READS.map((tool) => tool.name).filter((name) => CALLS[name] === undefined))
    .toEqual([])
})

test("every answer decodes through the shape its own entry declares", () => {
  const of = answers()
  for (const tool of READS) {
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

  // WHAT AN AGENT IS TOLD WHEN NOBODY IS SEARCHING — the same six queries,
  // through the same tool, over a serve that mounts no matcher. Every one of
  // them is no hits AND THE REASON, quoting what the reader typed: the shape a
  // door already draws for a query the grammar could not read, spent on a
  // serve that has no grammar to read it with.
  //
  // What each of those six queries FINDS is `olai-plugin-search`'s
  // `tools.test.ts`, which runs this identical walk with the real matcher
  // behind the door — the maximality of the hit shapes travelled there with
  // the function that produces them.
  for (const answer of of("search_nodes")) {
    expect(answer["hits"]).toEqual([])
    expect(answer["total"]).toBe(0)
    expect(answer["refusals"]).toBeArrayOfSize(1)
  }

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

  const [cut, whole, outline, outlineCut, absent, lean, shaped, shapedOutline] = of("read_subtree")
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
