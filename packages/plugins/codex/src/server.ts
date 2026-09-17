/**
 * THE CODEX ENGINE'S SERVER HALF.
 *
 * Codex is SHIPPED rather than found on PATH: every documented launch path
 * sets OLAI_ACP_CODEX to the Nix-built codex-acp wrapper. Keeping its variable
 * separate from OLAI_ACP_AGENT gives each engine its own executable resource.
 * Enablement belongs to the engine’s node in the vault configuration file.
 */
import { type Adapter, adapterFrom } from "@olai/acp/engine"
import { Agents, definePlugin, type Registering } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { name } from "./index.ts"
import { INSTALL, NAME } from "./install.ts"
import { CODEX } from "./leg.ts"

export { name } from "./index.ts"

export const CODEX_AGENT_ENV = "OLAI_ACP_CODEX"

export const ENGINE: Registering = {
  name: NAME,
  leg: CODEX,
  // SHIPPED, NOT FOUND: the variable is the whole of this row's door, and an
  // absent or empty pin is an absence rather than a fault — answered with this
  // engine's own sentence ({@link ./install.ts}'s `INSTALL`) so the roster
  // publishes the row rather than dropping it. Never falls through to PATH.
  at: (where): Adapter | typeof INSTALL => adapterFrom(where.env[CODEX_AGENT_ENV]) ?? INSTALL,
  // ACP has no system-prompt field. The shared standing instruction therefore
  // rides visibly with the first prompt, as it does for every other engine.
  prompt: { kind: "first-turn" },
}

export default definePlugin({
  environment: [
    {"key": "OLAI_ACP_CODEX", "secret": false, "says": "the Codex ACP adapter"},
    {"key": "OPENAI_API_KEY", "secret": true, "says": "the provider credential read by Codex"},
  ],
  name,
  needs: [Agents],
  apply: Effect.gen(function*() {
    const agents = yield* Agents
    yield* agents.register(ENGINE)
  }),
})
