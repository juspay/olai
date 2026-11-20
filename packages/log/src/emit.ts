import { Effect } from "effect"

export type Emit = (line: Effect.Effect<void>) => void

export const emitter: Effect.Effect<Emit> = Effect.map(
  Effect.context<never>(),
  (services) => {
    const run = Effect.runForkWith(services)
    return (line) => {
      run(line)
    }
  },
)
