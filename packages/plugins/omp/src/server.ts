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
    // NOTHING ABOUT THE DIRECTORY ON THE COMMAND LINE: omp reads the directory
    // it was STARTED in, which is the served directory olai spawns every child
    // in, and its `session/new` and `session/list` both take an absolute `cwd`
    // of their own (it asserts on the shape). So there is nothing here the
    // command line has to say about where this conversation is.
    //
    // `--approval-mode yolo` BEFORE the subcommand, because it is a launch
    // flag omp forwards to `acp` rather than an option `acp` takes.
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
