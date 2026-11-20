import { Effect, Scope } from "effect"

export const standing = (): <A>(work: Effect.Effect<A, never, Scope.Scope>) => Promise<A> => {
  const scope = Scope.makeUnsafe()
  return (work) => Effect.runPromise(Scope.provide(work, scope))
}
