import { type Adapter, type NotHere } from "@kolu/acp/engine"
import { Agents, definePlugin, type Registering } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { name } from "./index.ts"
import { INSTALL, NAME } from "./install.ts"
import { OMP } from "./leg.ts"

export { name } from "./index.ts"

export const ENGINE: Registering = {
  name: NAME,
  leg: OMP,
  at: (where): Adapter | NotHere => {
    const bin = where.found("omp")
    if (bin === null) return INSTALL
    // omp reads the directory it was started in — it takes no `--cwd` — and
    // `--approval-mode yolo` goes before the subcommand, being a launch flag
    // omp forwards to `acp` rather than an option `acp` takes.
    return { command: bin, args: ["--approval-mode", "yolo", "acp"] }
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
