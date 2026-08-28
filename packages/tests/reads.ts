/**
 * What the read tools ANSWER, printed as a session — the third driver in this
 * package, and the one whose output is prose rather than a screenshot or a
 * byte count.
 *
 * `evidence.ts` photographs the app because what it is showing is a look;
 * `wire.ts` counts bytes because what it is showing is a cost. What a TOOL
 * SURFACE has to show is neither: the claim is "this question is one call
 * now", and the only honest exhibit is the call and the answer beside it. So
 * this connects to a running server's `/mcp` exactly as a `.mcp.json` client
 * does, runs a scripted session against a fixture vault, and prints every
 * request and every answer.
 *
 * NOT PART OF THE SUITE — nothing imports it and `just e2e` never runs it. The
 * promises live in `features/an_external_agent.feature` and in the unit tests
 * under `@olai/ops` and `@olai/server`; this is what a person reads.
 *
 * The CLIENT is the suite's own (`support/mcp.ts`), deliberately: a second
 * hand-rolled JSON-RPC client would be a second thing to keep speaking the
 * protocol, and this one is already exercised by every scenario in that
 * feature.
 *
 *   BASE=http://127.0.0.1:7788 bun reads.ts     # against a server you started
 *   bash reads.sh                               # …or one this brings up
 */

import { connectTerminalAgent, type TerminalAgent } from "./support/mcp.ts"

const BASE = process.env["BASE"] ?? "http://127.0.0.1:7788"

/** One tool call, printed. The REFUSALS are part of the exhibit, so this never
 *  throws on one — a refusal is an answer here exactly as it is over the wire,
 *  and the `isError` flag beside it is what says which kind of answer it is. */
const call = async (
  agent: TerminalAgent,
  name: string,
  args: Readonly<Record<string, unknown>>,
): Promise<void> => {
  const answered = await agent.call("tools/call", { name, arguments: args })
  if (answered.error !== undefined) {
    throw new Error(`\`${name}\` failed at the protocol level: ${answered.error.message}`)
  }
  const result = (answered.result ?? {}) as {
    structuredContent?: unknown
    isError?: boolean
  }
  console.log(`\n→ ${name} ${JSON.stringify(args)}`)
  console.log(
    `← ${result.isError === true ? "REFUSED" : "ok"}  ${
      JSON.stringify(result.structuredContent, null, 2).split("\n").join("\n  ")
    }`,
  )
}

const say = (line: string): void => console.log(`\n── ${line} ${"─".repeat(Math.max(0, 66 - line.length))}`)

const agent = await connectTerminalAgent(`${BASE}/mcp`)

say("the map: which outlines there are, and what their roots are CALLED")
// The call that names the roots and cannot descend into them. Two of them here,
// which used to mean two more calls.
await call(agent, "list_outlines", {})

say("(a) the WHOLE outline, in one call")
await call(agent, "read_subtree", { file: "plan.olai" })

say("(a) …and `depth` still applies, per root")
await call(agent, "read_subtree", { file: "plan.olai", depth: 1 })

say("(a) …and `withDesc: false` is the lean read — structure, no notes")
await call(agent, "read_subtree", { file: "plan.olai", withDesc: false })

say("(b) a selection, and the same selection WITH its notes")
await call(agent, "search_nodes", { text: "is:todo" })
await call(agent, "search_nodes", { text: "is:todo", withDesc: true })

say("(c) a node read carries the parent's id — `path` is titles")
await call(agent, "read_node", { id: "call" })

say("the refusals: a path that is not an outline")
await call(agent, "read_subtree", { file: "plans.olai" })

say("the refusals: nothing close enough to be a typo")
await call(agent, "read_subtree", { file: "nothing/like/it.olai" })

say("the refusals: an outline the set could not load")
await call(agent, "read_subtree", { file: "torn.olai" })

say("the refusals: both ways in, and neither")
await call(agent, "read_subtree", { id: "today", file: "plan.olai" })
await call(agent, "read_subtree", {})

say("…while an id the set does not hold is still an ANSWER")
await call(agent, "read_subtree", { id: "nope" })

agent.stop()
