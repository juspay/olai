/**
 * THE SAME IDS IN THE SAME ORDER — the equality a list of node ids is compared
 * by when it is the INPUT to something expensive.
 *
 * Two places in this client hold such a list, both of them arrays minted fresh
 * by the thing that produces them, and both of them read by a door that asks
 * the server: the move picker's destinations, which are the argument of a
 * subscription (`./move/moving.tsx`), and the composer's subjects, which are
 * the argument of a lookup (`./chat/Composer.tsx`). Compared by REFERENCE, each
 * of them re-asks on every frame or every keystroke that rebuilds the array
 * without changing what is in it — which is what `equals` is for, and what an
 * accessor without one silently is not (a kolu stream re-subscribes when its
 * input notifies, not when its input changes: `@kolu/surface`'s
 * `createReactiveSubscription`).
 *
 * ORDER MATTERS, so this is not a set comparison. Both callers pair their ids
 * back up with an answer positionally — the picker with the verdicts, which
 * come back in the order asked — so a list re-ordered is a different question
 * and has to read as one.
 *
 * NOT HAND-ROLLED: it is `effect`'s own array equivalence, which is the same
 * law (same length, elements pairwise equivalent) written where nobody here has
 * to maintain it — the move the format makes one door over, deriving
 * `sameMoving` from the schema rather than spelling its fields twice.
 *
 * A module of its own rather than a private line in either caller, because a
 * rule two modules keep is a rule that drifts in one of them (`./ref.ts` makes
 * the same move for the same reason, and a `.ts` is what lets the law be unit
 * tested without a JSX runtime behind it).
 */

import { Array, Equivalence } from "effect"

export const sameIds: (
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
) => boolean = Array.makeEquivalence(Equivalence.String)
