/**
 * THE PI ENGINE'S SERVER HALF — one registration, and everything olai knows
 * about this agent behind it.
 *
 * ## BOTH HALVES AT ONCE, which is what makes this row different from the other
 * two
 *
 * pi's ADAPTER — svkozak/pi-acp, the ACP bridge that spawns `pi --mode rpc` — is
 * olai's to pin, so olai ships it exactly the way it ships the Claude Code one:
 * {@link PI_AGENT_ENV} names it, every documented start bakes the pin in, and a
 * floating `npx -y pi-acp` is never run (the npm world would hand back a
 * different build every day, and the wire facts {@link ./leg.ts} is written
 * against are one revision's).
 *
 * But pi-acp is not an agent — it WRAPS one. A machine HAS pi only when the `pi`
 * executable is found on the agent search path, so this row is the pair: adapter
 * from the variable, agent from the probe, and the found `pi` handed to the
 * adapter as `PI_ACP_PI_COMMAND` so that the one the probe found is the one the
 * session runs. Without that last part the adapter's own lookup would resolve
 * the word `pi` against a THIRD path — its child's, which is olai's, which is
 * not your shell's — and `OLAI_AGENT_PATH` would have been answered for nothing.
 *
 * The picker's promise is that a row it draws is an agent this machine has, so
 * either half missing is a row that is simply not offered: a pi-acp with no `pi`
 * behind it would fail at every `session/new`.
 */

import { adapterFrom } from "@olai/acp/engine"
import { Agents, definePlugin, type Registering } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { name } from "./index.ts"
import { NAME } from "./install.ts"
import { PI } from "./leg.ts"

/** The plugin's word, re-exported for the reason every tenant's server door
 *  re-exports it: one entry per plugin, and one spelling of the key — and
 *  because `@olai/bundle` reads it off the module its ROW names to prove that a
 *  plugin answers to the id its fiber is bound under. */
export { name } from "./index.ts"

/**
 * WHICH EXECUTABLE SPEAKS ACP FOR PI — the pi-acp adapter, pinned and baked into
 * the packaged binary's wrapper beside the Claude Code one.
 *
 * ONE VARIABLE PER ADAPTER rather than a pair syntax on `OLAI_ACP_AGENT`, and it
 * is THIS PLUGIN'S rather than core's: `OLAI_ACP_AGENT` is core's because its
 * empty value is the whole off switch, and this one has no such second meaning —
 * it is one engine's door onto one pin, and it belongs in that engine's
 * directory the way that engine's patches do.
 */
export const PI_AGENT_ENV = "OLAI_ACP_PI"

/** ...and the environment key the adapter reads for the agent it wraps. The
 *  adapter's own name for it; spelled once, beside the probe that fills it. */
const WRAPS = "PI_ACP_PI_COMMAND"

/** THIS ENGINE, as a VALUE — exported for the reason `olai-plugin-claude`'s is:
 *  what a plugin registers is data, and data is a thing a unit test can hold.
 *  This row is the one where that pays most, because it is the pair. */
export const ENGINE: Registering = {
  name: NAME,
  leg: PI,
  at: (where) => {
    // The ADAPTER first: like the claude row, it is shipped and not found, so
    // the variable is the whole of its door.
    const adapter = adapterFrom(where.env[PI_AGENT_ENV])
    if (adapter === null) return null
    // ...and then the AGENT the adapter wraps — see the header.
    const bin = where.found("pi")
    if (bin === null) return null
    return { ...adapter, env: { [WRAPS]: bin } }
  },
  // pi-acp carries no system-prompt field either, so the standing instruction
  // rides the first turn, like every engine olai ships (`@olai/acp/engine`'s
  // `PromptChannel`).
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
