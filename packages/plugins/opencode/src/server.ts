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

import { type Adapter, type NotHere } from "@olai/acp/engine"
import { Agents, definePlugin, type Registering } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { name } from "./index.ts"
import { INSTALL, NAME } from "./install.ts"
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
  at: (where): Adapter | NotHere => {
    const bin = where.found("opencode")
    // Nothing on the search path is the ORDINARY state of most machines, and
    // the answer is this engine's own sentence rather than a dropped row —
    // the roster publishes it, the picker draws it greyed.
    if (bin === null) return INSTALL
    // No `--cwd`: opencode 2 dropped the flag and answers it with its usage
    // text on stdout, which is not ACP. The spawn already runs the child in
    // the served directory (`olai-plugin-chat`'s `agent.ts`), and opencode
    // reads its directory from there — for where to run AND for which stored
    // conversations to list. Verified against 2.2.7: `session/list` takes a
    // `cwd` and answers that directory's sessions alone, with a paging cursor
    // carrying the directory inside it. Olai's own client-side filter stays
    // either way, because what it guards is an agent answering more broadly
    // than it was asked (`agent.ts` and its `storedFor`).
    return { command: bin, args: ["acp"] }
  },
  // There is no system-prompt door on this wire, so the standing instruction
  // rides the first turn, like every engine olai ships (`@olai/acp/engine`'s
  // `PromptChannel`). Steering is a different question and opencode 2 has it
  // (`./leg.ts`), but steering carries a person's words into a running turn —
  // never olai's standing instruction into a session.
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
