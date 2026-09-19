import { Effect } from "effect"
import { probing } from "./probe.ts"
import { openScratch } from "./scratch.ts"

await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
  const output = yield* openScratch(undefined)
  const answer = yield* probing({ ...process.env, OLAI_BROWSER_MCP: process.argv[2] }, output)
  if (!answer.server) throw new Error(answer.missing?.why ?? "No browser MCP executable was supplied.")
  console.log(`Browser MCP surface verified: ${answer.server.command}`)
})))
