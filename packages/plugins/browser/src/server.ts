import { definePlugin, Env, SessionStart } from "@olai/plugin-api/services"
import { Effect } from "effect"
import { name } from "./index.ts"
import { probing } from "./probe.ts"
import { openScratch } from "./scratch.ts"
export { name } from "./index.ts"

export default definePlugin({
  name,
  environment: [
    {"key": "OLAI_BROWSER_MCP", "secret": false, "says": "the absolute Playwright MCP executable; empty disables browser tools"},
    {"key": "XDG_RUNTIME_DIR", "secret": false, "says": "the base directory for temporary browser artifacts"},
  ],
  needs: [Env, SessionStart],
  apply: Effect.gen(function*() {
    const env = yield* Env
    const opening = yield* SessionStart
    const output = yield* openScratch(env.vars["XDG_RUNTIME_DIR"])
    // Register after acquiring scratch: withdrawal cuts and joins probes before
    // scratch is removed. No probe result survives its conversation opening.
    yield* opening.ask(Effect.scoped(probing(env.vars, output)))
  }),
})
