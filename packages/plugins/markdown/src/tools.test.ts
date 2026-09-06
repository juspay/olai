/**
 * THE TWO DOCUMENT READS ANSWER WHAT THEIR OWN ENTRIES SAY THEY ANSWER.
 *
 * The same walk `olai-plugin-outlines` runs over the node reads, over this
 * row's table — the harness, the fixture and the call list are
 * `@olai/ops/testlib/tools`', because two copies of a maximal set is two things
 * to keep maximal. The claim and the incident behind it are that file's:
 * object-literal freshness is lost through a `.map`, so a field DROPPED from a
 * declaration still compiles at the one place it is produced, and every consumer
 * encoding against the declaration then drops it in silence
 * (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/surface-mcp-positions.md).
 *
 * OFF THE TABLE rather than off `Query.documents` directly: what an agent calls
 * is `markdown_map`, and the envelope between the two is exactly the part a
 * test against the function would not see.
 *
 * THE READS THAT REFUSE ARE NOT CALLED HERE: this walk decodes ANSWERS, and a
 * refusal has none. What `markdown_read` says about a path the set does not hold
 * is the MCP face's own test and `an_external_agent.feature`'s, where the
 * refusal travels as a tool result rather than being discharged by an `orDie`
 * that would simply throw.
 */

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

/** No matcher: this row declares no search, and the fixture's documents are read
 *  from the snapshot rather than through the matcher door. */
const answers = () => gaveOf(NO_SEARCH, tools, "markdown")

test("every read this row declares is called here", () => {
  expect(uncalled(tools, "markdown")).toEqual([])
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

  // The document listing is the outline listing's twin, torn row and all: a
  // `.md` the set could not read is its errors and nothing else — matching
  // the outline arm — and the `.html` beside it is not in this answer at all:
  // nothing kept its body, so there is nothing to name or measure.
  const documents = of("map")[0]?.["documents"] as ReadonlyArray<
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

  // And one body, whole — the text a `markdown_write` guard is judged against.
  expect(of("read")[0]).toEqual({
    file: "notes/finishes.md",
    text: "# Finishes\n\nDoors: matte.\n",
  })
})

/** WHAT AN AGENT ACTUALLY READS — the flat ban {@link escapedIn} argues, over
 *  this row's whole table. These two descriptions are the ones that provoked it:
 *  both shipped to review with `\\n\\n` in them, two characters where every
 *  other entry has a real paragraph break, and the only reader who would ever
 *  have seen it is the model reading `tools/list`. */
test("no tool describes itself with an escaped newline", () => {
  expect(escapedIn(tools)).toEqual([])
  expect(paragraphsIn(tools, "map")).toBeGreaterThan(0)
  expect(paragraphsIn(tools, "read")).toBeGreaterThan(0)
})
