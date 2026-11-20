import { type Adapter, adapterFrom, type NotHere } from "@kolu/acp/engine"
import { Agents, definePlugin, type Registering } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { name } from "./index.ts"
import { ADAPTER_GONE, INSTALL, NAME } from "./install.ts"
import { PI } from "./leg.ts"

export { name } from "./index.ts"

export const PI_AGENT_ENV = "OLAI_ACP_PI"

const WRAPS = "PI_ACP_PI_COMMAND"

export const ENGINE: Registering = {
  name: NAME,
  leg: PI,
  at: (where): Adapter | NotHere => {
    const adapter = adapterFrom(where.env[PI_AGENT_ENV])
    if (adapter === null) return ADAPTER_GONE
    const bin = where.found("pi")
    if (bin === null) return INSTALL
    return { ...adapter, env: { [WRAPS]: bin } }
  },
  prompt: { kind: "first-turn" },
}

export default definePlugin({
  environment: [
    {"key": "OLAI_ACP_PI", "secret": false, "says": "the Pi ACP adapter"},
  ],
  name,
  needs: [Agents],
  apply: Effect.gen(function*() {
    const agents = yield* Agents
    yield* agents.register(ENGINE)
  }),
})
