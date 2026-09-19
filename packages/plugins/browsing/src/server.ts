import { definePlugin, Env, SessionStart } from "@olai/plugin-api/services"
import { Effect } from "effect"
import { name } from "./index.ts"
import { probing } from "./probe.ts"
import { ownProbe } from "./owned.ts"
import { openScratch } from "./scratch.ts"
export { name } from "./index.ts"

export default definePlugin({
  name,
  environment: [
    {"key": "OLAI_BROWSER_MCP", "secret": false, "says": "the absolute Playwright MCP executable; empty disables browser tools"},
  ],
  needs: [Env, SessionStart],
  apply: Effect.gen(function*() {
    const env = yield* Env
    const opening = yield* SessionStart
    const output = yield* openScratch(env.vars["XDG_RUNTIME_DIR"])
    // Env supplies runtime placement, as it does for mail; it is not a row knob.
    const ask = yield* ownProbe(Effect.scoped(probing(env.vars, output)))
    yield* opening.ask(ask)
  }),
})
