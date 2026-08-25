/**
 * THE FOLD AS IT STOOD — the reference arm `./following.equivalence.test.ts`
 * holds the carried one to.
 *
 * `perf-batch-assemble` changed how a batch produces the set its next op is
 * judged against: it used to take the whole directory APART into a map on its
 * first op and put it back TOGETHER on every one (a fresh path sort of every
 * served file, per op), and it now splices the files the op wrote into the set
 * the op before it left (`@olai/format`'s `withDocuments`). It also stopped
 * re-asking the directory its three questions per op, carrying the answers
 * instead ({@link ./asked.ts}).
 *
 * Both are equalities, so the old computation stays in the tree as the other
 * side of a differential rather than as a paragraph in a commit message — the
 * shape `committed.testlib.ts` and `@olai/server`'s `published.testlib.ts`
 * already have, for the same reason: a reader re-running the suite gets the
 * pair, and a divergence names the op it happened at instead of turning up as a
 * refusal months later.
 *
 * IT IS THE OLD CODE, unchanged except for the two things it cannot avoid: it
 * answers a {@link Scope} (the type the fold hands back now, since the asking
 * travels with the reading) and it builds that scope's context the way the old
 * planner did — freshly, per op, which is exactly the cost the node named and
 * therefore exactly what the counterpart must be measured against.
 *
 * Not a suite: `bun test` collects only `*.test.ts`.
 */

import {
  apart,
  assemble,
  bodiedDocument,
  type Document,
  type OutlineError,
  parseOutline,
  reading,
  serializeOutline,
  type SetDelta,
} from "@olai/format"
import { Result } from "effect"

import { askedOf } from "./asked.ts"
import type { Folding } from "./following.ts"
import type { Scope } from "./plan.ts"

/** One decoded file, as `assemble` takes it — the map this arm carries between
 *  ops is a map of them. */
type Decoded = Result.Result<Document, ReadonlyArray<OutlineError>>

export const assembling = (from: Scope): Folding => {
  // LAZY, as it was: `folded` breaks before folding the LAST op, so a one-op run
  // never took the directory apart at all.
  let files: Map<string, Decoded> | undefined
  let at: Scope = from

  return (made) => {
    files ??= apart(at.set)
    const upserts: Array<SetDelta["upserts"][number]> = []
    for (const planned of made.files) {
      const text = serializeOutline(planned.nodes)
      const read = parseOutline(planned.file, text)
      if (Result.isFailure(read)) {
        // The live fold answers a refusal here, naming the defect. This arm is
        // driven only by plans the live one accepted, so reaching it means the
        // two are being compared over something neither can express — a throw
        // says so at the moment it happens rather than as a difference.
        throw new Error(`\`${planned.file}\` did not read back after being planned`)
      }
      files.set(planned.file, Result.succeed(read.success))
      upserts.push([planned.file, { nodes: read.success.nodes }])
    }
    for (const document of made.documents ?? []) {
      files.set(document.file, Result.succeed(bodiedDocument(document.file, document.text)))
    }

    const next = reading(assemble(files), { read: at, delta: { upserts, removes: [] } })
    // THE ASKING, FRESH — one per op, which is what the carried arm replaces.
    at = { ...next, context: at.context, asked: askedOf(next.set) }
    return Result.succeed(at)
  }
}
