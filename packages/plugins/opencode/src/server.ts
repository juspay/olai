/**
 * THE OPENCODE ENGINE'S SERVER HALF — one registration, and everything olai
 * knows about this agent behind it.
 *
 * ## FOUND, NOT SHIPPED, which is the whole of how this row differs
 *
 * opencode installs itself onto a PATH, so this engine is a PROBE rather than a
 * variable: a runnable `opencode` on the agent search path is the machine saying
 * it has one, and its absence is the ordinary state of most machines rather than
 * a fault. Olai ships no pin for it and has no override variable of its own —
 * point olai at a different build by putting that build on the search path,
 * which is what `OLAI_AGENT_PATH` is for and is the same gesture as installing
 * it in the first place.
 *
 * ## What is on THIS side of the wall, and what is not
 *
 * Here: how to find it, how to spawn it, how to read its wire ({@link ./leg.ts})
 * and the mark it wears ({@link ./browser.tsx}). Not here, and never: a session,
 * a prompt, a transcript. An engine plugin hands over data and pure functions;
 * `olai-plugin-chat` does the talking.
 */

import { Agents, definePlugin, type Registering } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { name } from "./index.ts"
import { NAME } from "./install.ts"
import { OPENCODE } from "./leg.ts"

/** The plugin's word, re-exported for the reason every tenant's server door
 *  re-exports it: one entry per plugin, and one spelling of the key — and
 *  because `@olai/bundle` reads it off the module its ROW names to prove that a
 *  plugin answers to the id its fiber is bound under. */
export { name } from "./index.ts"

/** THIS ENGINE, as a VALUE — exported for the reason `olai-plugin-claude`'s is:
 *  what a plugin registers is data, and data is a thing a unit test can hold. */
export const ENGINE: Registering = {
  name: NAME,
  leg: OPENCODE,
  at: (where) => {
    const bin = where.found("opencode")
    if (bin === null) return null
    // `--cwd` rather than the child's own working directory, because opencode
    // reads it for WHICH SESSIONS THE DIRECTORY HAS as well as for where to
    // run: `session/list` ignores the `cwd` a request carries, so the one on
    // the command line is the only one it hears. (The client-side filter over
    // that answer is mandatory either way — see `olai-plugin-chat`'s `agent.ts` and
    // its `storedFor`.)
    return { command: bin, args: ["acp", "--cwd", where.cwd] }
  },
  // `_session/steering` does not exist on this wire and neither does a system
  // prompt: the standing instruction rides the first turn, like every engine
  // olai ships (`@olai/acp/engine`'s `PromptChannel`).
  prompt: { kind: "first-turn" },
}

export default definePlugin({
  name,
  needs: [Agents],
  apply: Effect.gen(function*() {
    const agents = yield* Agents
    yield* agents.register(ENGINE)
  }),
})
