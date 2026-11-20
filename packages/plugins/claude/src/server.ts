import { type Adapter, adapterFrom, AGENT_ENV, type NotHere } from "@kolu/acp/engine"
import { Agents, definePlugin, type Registering } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { CLAUDE, NAME, REMOTE_SIGNALS } from "@kolu/acp-claude"

import { INSTALL } from "./install.ts"
import { name } from "./index.ts"

export const DISABLE_AUTO_MEMORY_ENV = "CLAUDE_CODE_DISABLE_AUTO_MEMORY"

export { name } from "./index.ts"

export const ENGINE: Registering = {
  name: NAME,
  leg: CLAUDE,
  at: (where): Adapter | NotHere => {
    const adapter = adapterFrom(where.env[AGENT_ENV])
    if (adapter === null) return INSTALL
    return {
      ...adapter,
      unset: REMOTE_SIGNALS,

      env: { [DISABLE_AUTO_MEMORY_ENV]: "1" },
    }
  },
  prompt: { kind: "first-turn" },
}

export default definePlugin({
  environment: [
    {"key": "KOLU_ACP_AGENT", "secret": false, "says": "the Claude ACP adapter"},
    {"key": "ANTHROPIC_API_KEY", "secret": true, "says": "the provider credential read by Claude"},
  ],
  name,
  needs: [Agents],
  apply: Effect.gen(function*() {
    const agents = yield* Agents
    yield* agents.register(ENGINE)
  }),
})
