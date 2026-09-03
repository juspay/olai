/**
 * THE CODEX ENGINE'S SERVER HALF.
 *
 * Codex is SHIPPED rather than found on PATH: every documented launch path
 * sets OLAI_ACP_CODEX to the Nix-built codex-acp wrapper. Keeping its variable
 * separate from OLAI_ACP_AGENT matters because the latter's empty value is the
 * whole chat off switch as well as the Claude row's historical override.
 */
import { adapterFrom } from "@olai/acp/engine"
import { Agents, definePlugin, type Registering } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { name } from "./index.ts"
import { NAME } from "./install.ts"
import { CODEX } from "./leg.ts"

export { name } from "./index.ts"

export const CODEX_AGENT_ENV = "OLAI_ACP_CODEX"

export const ENGINE: Registering = {
  name: NAME,
  leg: CODEX,
  at: (where) => adapterFrom(where.env[CODEX_AGENT_ENV]),
  // ACP has no system-prompt field. The shared standing instruction therefore
  // rides visibly with the first prompt, as it does for every other engine.
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
