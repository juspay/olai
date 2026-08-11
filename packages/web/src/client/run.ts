/**
 * The one place the client runs an Effect.
 *
 * A surface procedure is an `Effect`; a click is a DOM event. Something has to
 * be the boundary, and having exactly one of them named is the whole point:
 * `Effect.run*` is the edge where a program stops composing, so an app that
 * scatters them has as many places to forget an error handler.
 *
 * At the client's root rather than inside the panel that used to be its only
 * caller: the sentence above is about THIS APP, not about chat, and the moment
 * a second surface verb existed — the Commit button — the file's own claim
 * would have been false where it stood.
 *
 * The signature is what enforces that. There is no overload without
 * `onFailure`: a procedure's DECLARED failures are the interesting half of its
 * type, and a caller that could ignore them would be a caller whose refusals
 * vanish — which is exactly the thing chat is not allowed to do (only a
 * succeeding `StaleWrite` retry is invisible; every genuine failure renders).
 * A DEFECT is different and is deliberately not caught: it is a bug, and it
 * belongs in the console loudly.
 */

import { BusyFailure, isOpFailure, type OpFailure } from "@olai/surface"
import { Effect, Result } from "effect"

/** Anything a bound procedure hands back: a declared `OpFailure`, or one of the
 *  framework's own transport failures, which have no place in the panel and are
 *  reported as trouble. */
export type Call<A> = Effect.Effect<A, unknown>

export const run = <A>(
  effect: Call<A>,
  onFailure: (failure: OpFailure) => void,
  onSuccess?: (value: A) => void,
): void => {
  void Effect.runPromise(Effect.result(effect)).then((outcome) => {
    if (Result.isSuccess(outcome)) {
      onSuccess?.(outcome.success)
      return
    }
    onFailure(asFailure(outcome.failure))
  })
}

/** A failure the panel can draw. The declared ones already are one — recognised
 *  against the format's own closed table, not by the shape of a tag — and a
 *  transport failure is re-said as `busy`, which is what it means to a reader:
 *  the server did not take it, try again. */
const asFailure = (failure: unknown): OpFailure =>
  isOpFailure(failure)
    ? failure
    : new BusyFailure({
      reason: failure instanceof Error ? failure.message : String(failure),
    })
