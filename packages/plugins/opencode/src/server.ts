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
