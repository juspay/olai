/**
 * THE CODEX ENGINE'S SERVER HALF.
 *
 * Codex is SHIPPED rather than found on PATH: every documented launch path
 * sets OLAI_ACP_CODEX to the Nix-built codex-acp wrapper. Keeping its variable
 * separate from OLAI_ACP_AGENT gives each engine its own executable resource.
 * Enablement belongs to the engine’s node in the vault configuration file.
 */
import { type Adapter, adapterFrom, type NotHere } from "@olai/acp/engine"
import { Agents, definePlugin, type Registering } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { name } from "./index.ts"
import { INSTALL, NAME } from "./install.ts"
import { CODEX } from "./leg.ts"

export { name } from "./index.ts"

export const CODEX_AGENT_ENV = "OLAI_ACP_CODEX"

/** THE CODEX CONFIG OVERLAY, as a value — `features.memories` forced OFF. */
const MEMORIES_OFF = { features: { memories: false } }

/** The environment variable that carries the overlay — exported so tests and
 *  docs share one spelling. */
export const CODEX_CONFIG_ENV = "CODEX_CONFIG"

/** THE ADAPTER'S OWN MEMORY IS OFF — the node's subtree is the only memory,
 *  and a second one the panel cannot see would drift from it. `CODEX_CONFIG`
 *  is a JSON object the pinned codex-acp (1.13.1) merges into the Codex
 *  session config, and this engine's own `features.memories` setting is
 *  forced false in it: a user-level `~/.codex/config.toml` may have enabled
 *  it (Codex CLI has no environment switch of its own), and the overlay is
 *  the one place a spawn can win. Every other key an operator set survives —
 *  the merge keeps the whole object and overrides only this one field — and
 *  a `CODEX_CONFIG` that is not a JSON object is treated as absent rather
 *  than as something an operator meant. */
export const memoryOff = (base?: string): string => {
  let parsed: Record<string, unknown> = {}
  try {
    const value: unknown = base === undefined ? null : JSON.parse(base)
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      parsed = value as Record<string, unknown>
    }
  } catch {
    // Not JSON: treat as absent and keep the forced value.
  }
  return JSON.stringify({ ...parsed, features: { ...objectOf(parsed.features), ...MEMORIES_OFF.features } })
}

/** Read `features` as a record, whatever an operator's JSON had there. */
const objectOf = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

export const ENGINE: Registering = {
  name: NAME,
  leg: CODEX,
  // SHIPPED, NOT FOUND: the variable is the whole of this row's door, and an
  // absent or empty pin is an absence rather than a fault — answered with this
  // engine's own sentence ({@link ./install.ts}'s `INSTALL`) so the roster
  // publishes the row rather than dropping it. Never falls through to PATH.
  at: (where): Adapter | NotHere => {
    const adapter = adapterFrom(where.env[CODEX_AGENT_ENV])
    if (adapter === null) return INSTALL
    return {
      ...adapter,
      // THE ADAPTER'S OWN MEMORY IS OFF — the merge {@link memoryOff} does,
      // over every key the operator set.
      env: { [CODEX_CONFIG_ENV]: memoryOff(where.env[CODEX_CONFIG_ENV]) },
    }
  },
  // ACP has no system-prompt field. The shared standing instruction therefore
  // rides visibly with the first prompt, as it does for every other engine.
  prompt: { kind: "first-turn" },
}

export default definePlugin({
  environment: [
    {"key": "OLAI_ACP_CODEX", "secret": false, "says": "the Codex ACP adapter"},
    {"key": "OPENAI_API_KEY", "secret": true, "says": "the provider credential read by Codex"},
    {"key": "CODEX_CONFIG", "secret": false, "says": "a JSON overlay olai merges into the Codex session config on every spawn — an operator's `features.memories` is switched OFF, every other key survives"},
  ],
  name,
  needs: [Agents],
  apply: Effect.gen(function*() {
    const agents = yield* Agents
    yield* agents.register(ENGINE)
  }),
})
