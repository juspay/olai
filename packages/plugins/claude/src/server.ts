/**
 * THE CLAUDE CODE ENGINE'S SERVER HALF — one registration, and everything olai
 * knows about this agent behind it.
 *
 * ## What this replaced
 *
 * A row of a hardcoded `KINDS` table in `olai-plugin-chat/src/agents/roster.ts`,
 * beside two others, under an `AGENTS` record in `@olai/surface` that made every
 * agent id a closed union. Adding an engine was a core PR in two general
 * packages; bumping THIS adapter's pin was an edit in a file the other two
 * shared. Both are gone: this engine is one directory, one row in `olai.yml`,
 * and one `--plugins` word.
 *
 * ## What is on THIS side of the wall, and what is not
 *
 * Here: how to find this adapter on a host, how to read its wire
 * ({@link ./leg.ts}), what its model picker calls things ({@link ./models.ts}),
 * where a person gets it, and the mark it wears ({@link ./browser.tsx}, on the
 * other door). Not here, and never: a session, a prompt, a transcript. An engine
 * plugin hands over data and pure functions; `olai-plugin-chat` does the talking. That
 * is what makes every bet in this directory a thing with a unit test rather than
 * a branch reachable only by starting a subprocess.
 *
 * ## The variable is READ HERE and MEANS TWO THINGS
 *
 * `OLAI_ACP_AGENT` is this row's whole door — the pinned adapter is baked into
 * the packaged binary's wrapper with `--set-default`, and a person who points
 * the variable somewhere else is still saying *read that the way you read Claude
 * Code*, which is what the override has always meant. The EMPTY STRING is not
 * this plugin's to interpret: it is the whole off switch, core's, and it is read
 * before anything is probed (`olai-plugin-chat`'s `agents/roster.ts`). Both readings
 * are argued at the constant, in `@olai/acp/engine`, which is where they meet.
 */

import { adapterFrom, AGENT_ENV } from "@olai/acp/engine"
import { Agents, definePlugin, type Registering } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { NAME } from "./install.ts"
import { CLAUDE } from "./leg.ts"
import { name } from "./index.ts"

/** The plugin's word, re-exported for the reason every tenant's server door
 *  re-exports it: one entry per plugin, and one spelling of the key — and
 *  because `@olai/bundle` reads it off the module its ROW names to prove that a
 *  plugin answers to the id its fiber is bound under. */
export { name } from "./index.ts"

/**
 * THIS ENGINE, as a VALUE.
 *
 * Exported rather than written inline in {@link apply} for the reason every leg
 * in this directory is a pure function: what a plugin registers is data, and
 * data is a thing a unit test can hold. `./server.test.ts` asks {@link
 * Registering.at} what it makes of an environment; the alternative is a claim
 * about this row reachable only by mounting a runtime.
 */
export const ENGINE: Registering = {
  name: NAME,
  leg: CLAUDE,
  // SHIPPED, NOT FOUND, which is why the probe is a variable read and not a
  // PATH lookup: the adapter is a wrapper inside the nix store and is on
  // nobody's PATH. `null` is a hand-rolled start that went through neither
  // the packaged binary nor the justfile — an absence, not a fault.
  at: (where) => adapterFrom(where.env[AGENT_ENV]),
  // ACP has no system prompt on any wire, this one included, so the standing
  // instruction rides the first turn — where a person can read what their agent
  // was told. `@olai/acp/engine`'s `PromptChannel` argues it, and `olai-plugin-chat`
  // switches on it exhaustively.
  prompt: { kind: "first-turn" },
}

/**
 * ...AND OFFERED.
 *
 * `needs` is `[Agents]` and nothing else, which is worth reading as a claim
 * rather than as a small list: an engine plugin reaches for no vault, no
 * doorbell, no surface and no kind. It teaches the chat how to seat one agent
 * and has no other business in the process — so the runtime holds it PENDING
 * against one service, and the compiler computes this Effect's requirements
 * from the same list.
 *
 * A FAILURE HERE IS NOT A BOOT FAILURE. The fiber lands in `FAILED` having
 * installed nothing, and every other engine — and every tenant — goes on
 * running. A serve that lost this row is a serve whose picker has no Claude in
 * it, which is exactly what `--plugins=opencode,pi` asks for on purpose.
 */
export default definePlugin({
  name,
  needs: [Agents],
  apply: Effect.gen(function*() {
    const agents = yield* Agents
    yield* agents.register(ENGINE)
  }),
})
