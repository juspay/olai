import { type Adapter, adapterFrom, type NotHere } from "@kolu/acp/engine"
import { Agents, definePlugin, type Registering } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { name } from "./index.ts"
import { INSTALL, NAME } from "./install.ts"
import { CODEX } from "./leg.ts"

export { name } from "./index.ts"

export const CODEX_AGENT_ENV = "OLAI_ACP_CODEX"

const MEMORIES_OFF = { features: { memories: false } }

export const CODEX_CONFIG_ENV = "CODEX_CONFIG"

export const memoryOff = (base?: string): string => {
  let parsed: Record<string, unknown> = {}
  try {
    const value: unknown = base === undefined ? null : JSON.parse(base)
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      parsed = value as Record<string, unknown>
    }
  } catch {
  }
  return JSON.stringify({ ...parsed, features: { ...objectOf(parsed.features), ...MEMORIES_OFF.features } })
}

const objectOf = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

export const ENGINE: Registering = {
  name: NAME,
  leg: CODEX,
  at: (where): Adapter | NotHere => {
    const adapter = adapterFrom(where.env[CODEX_AGENT_ENV])
    if (adapter === null) return INSTALL
    return {
      ...adapter,
      env: { [CODEX_CONFIG_ENV]: memoryOff(where.env[CODEX_CONFIG_ENV]) },
    }
  },
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
