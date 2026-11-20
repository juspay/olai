import { connectTerminalAgent, type TerminalAgent } from "./support/mcp.ts"

const BASE = process.env["BASE"] ?? "http://127.0.0.1:7788"

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
await call(agent, "outlines_index", {})

say("(a) the WHOLE outline, in one call")
await call(agent, "outlines_subtree", { file: "plan.olai" })

say("(a) …and `depth` still applies, per root")
await call(agent, "outlines_subtree", { file: "plan.olai", depth: 1 })

say("(a) …and `withDesc: false` is the lean read — structure, no notes")
await call(agent, "outlines_subtree", { file: "plan.olai", withDesc: false })

say("(b) a selection, and the same selection WITH its notes")
await call(agent, "search_nodes", { text: "is:todo" })
await call(agent, "search_nodes", { text: "is:todo", withDesc: true })

say("(c) a node read carries the parent's id — `path` is titles")
await call(agent, "outlines_read", { id: "call" })

say("the refusals: a path that is not an outline")
await call(agent, "outlines_subtree", { file: "plans.olai" })

say("the refusals: nothing close enough to be a typo")
await call(agent, "outlines_subtree", { file: "nothing/like/it.olai" })

say("the refusals: an outline the set could not load")
await call(agent, "outlines_subtree", { file: "torn.olai" })

say("the refusals: both ways in, and neither")
await call(agent, "outlines_subtree", { id: "today", file: "plan.olai" })
await call(agent, "outlines_subtree", {})

say("…while an id the set does not hold is still an ANSWER")
await call(agent, "outlines_subtree", { id: "nope" })

agent.stop()
