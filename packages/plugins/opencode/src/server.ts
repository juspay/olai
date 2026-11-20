import { type Adapter, type NotHere } from "@kolu/acp/engine"
import { Agents, definePlugin, type Registering } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { name } from "./index.ts"
import { INSTALL, NAME } from "./install.ts"
import { OPENCODE } from "./leg.ts"

export { name } from "./index.ts"

export const ENGINE: Registering = {
  name: NAME,
  leg: OPENCODE,
  at: (where): Adapter | NotHere => {
    const bin = where.found("opencode")
    if (bin === null) return INSTALL
    // No `--cwd`: opencode 2 dropped the flag and answers it with its usage
    // text on stdout, which is not ACP. It reads the directory it was started
    // in, both for where to run and for which stored conversations to list
    // (2.2.7: `session/list` takes a `cwd`, answers that directory's sessions
    // alone, and pages with a cursor carrying the directory inside it).
    return { command: bin, args: ["acp"] }
  },
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
