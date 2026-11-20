import { Array, Equivalence } from "effect"

export const sameIds: (
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
) => boolean = Array.makeEquivalence(Equivalence.String)
