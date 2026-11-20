import { Effect, Scope } from "effect"

export type RunUntilExit = <A>(work: Effect.Effect<A, never, Scope.Scope>) => Promise<A>

export const standing = (): RunUntilExit => {
  const scope = Scope.makeUnsafe()
  return (work) => Effect.runPromise(Scope.provide(work, scope))
}
