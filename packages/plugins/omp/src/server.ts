/**
 * THE OH-MY-PI ENGINE'S SERVER HALF — one registration, and everything olai
 * knows about this agent behind it.
 *
 * ## FOUND, NOT SHIPPED, which is the whole of how this row differs
 *
 * omp installs itself onto a PATH, so this engine is a PROBE rather than a
 * variable: a runnable `omp` on the agent search path is the machine saying it
 * has one, and its absence is the ordinary state of most machines rather than a
 * fault. Olai ships no pin for it and has no override variable of its own —
 * point olai at a different build by putting that build on the search path,
 * which is what `OLAI_AGENT_PATH` is for and is the same gesture as installing
 * it in the first place.
 *
 * ## WHY THE APPROVAL MODE IS ON THE COMMAND LINE
 *
 * `--approval-mode yolo` is passed at SPAWN, and it is the reason this row is
 * autonomous without a `bypassMode` ({@link ./leg.ts} answers `null` for that:
 * omp's ACP modes are `default` and `plan`, and `bypassPermissions` is refused).
 * `--approval-mode` is a LAUNCH-GLOBAL flag that omp forwards to its `acp`
 * subcommand, so it is spelled before the subcommand rather than after it. What
 * it skips is omp's ACP permission gate — for everything but `bash`, `edit`,
 * `delete` and `move`, none of which are olai's tools — and it is the same
 * decision the Claude and Codex rows make, one flag further along.
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
import { OMP } from "./leg.ts"

/** The plugin's word, re-exported for the reason every tenant's server door
 *  re-exports it: one entry per plugin, and one spelling of the key — and
 *  because `@olai/bundle` reads it off the module its ROW names to prove that a
 *  plugin answers to the id its fiber is bound under. */
export { name } from "./index.ts"

/** THIS ENGINE, as a VALUE — exported for the reason `olai-plugin-opencode`'s is:
 *  what a plugin registers is data, and data is a thing a unit test can hold. */
export const ENGINE: Registering = {
  name: NAME,
  leg: OMP,
  at: (where) => {
    const bin = where.found("omp")
    if (bin === null) return null
    // NO `--cwd`, unlike the opencode row next door: omp reads the directory it
    // was STARTED in, which is the served directory olai spawns every child in,
    // and its `session/new` and `session/list` both take an absolute `cwd` of
    // their own (it asserts on the shape). So there is nothing here the command
    // line has to say about where this conversation is.
    //
    // `--approval-mode yolo` BEFORE the subcommand, because it is a launch
    // flag omp forwards to `acp` rather than an option `acp` takes.
    return { command: bin, args: ["--approval-mode", "yolo", "acp"] }
  },
  // ACP has no system prompt (see `@olai/acp/engine`'s `PromptChannel`), and
  // omp is no exception: the standing instruction rides the first turn, like
  // every engine olai ships.
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
