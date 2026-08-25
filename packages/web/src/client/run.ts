/**
 * The one place the client runs an Effect.
 *
 * A surface procedure is an `Effect`; a click is a DOM event. Something has to
 * be the boundary, and having exactly one of them named is the whole point:
 * `Effect.run*` is the edge where a program stops composing, so an app that
 * scatters them has as many places to forget an error handler.
 *
 * The signature is what enforces that. There is no overload without
 * `onFailure`: a procedure's DECLARED failures are the interesting half of its
 * type, and a caller that could ignore them would be a caller whose refusals
 * vanish — which is exactly the thing chat is not allowed to do (only a
 * succeeding `StaleWrite` retry is invisible; every genuine failure renders).
 * A DEFECT is different and is deliberately not caught: it is a bug, and it
 * belongs in the console loudly.
 *
 * It lived in `chat/` while the conversation was the only thing with verbs.
 * The palette's `>` ask was the second caller and the row editor is the third,
 * so it sits at the client's root now — one edge, named once, wherever a
 * procedure is called from.
 */

import { BusyFailure, isOpFailure, type OpFailure } from "@olai/surface"
import { Effect, Result } from "effect"

import { quiescence } from "./quiescence.ts"

/** Anything a bound procedure hands back: a declared `OpFailure`, or one of the
 *  framework's own transport failures, which have no place in the panel and are
 *  reported as trouble. */
export type Call<A> = Effect.Effect<A, unknown>

export const run = <A>(
  effect: Call<A>,
  onFailure: (failure: OpFailure) => void,
  onSuccess?: (value: A) => void,
): void => {
  void runAsync(effect).then((outcome) => {
    if (Result.isSuccess(outcome)) onSuccess?.(outcome.success)
    else onFailure(outcome.failure)
  })
}

/**
 * The edge itself, awaited — and what {@link run} is written in terms of, so
 * `Effect.runPromise` appears once in this client rather than twice in the
 * file that claims to be the only place it appears at all.
 *
 * It exists for a caller that has to SEQUENCE calls rather than react to one.
 * The row editor is that caller: `Tab` commits the title and then moves the
 * row, in that order, because the second would otherwise be judged against a
 * record whose text is still the old one. It needs something to wait on, and
 * the answer it waits for is either outcome — so this hands back a `Result`
 * rather than rejecting, which is the same promise `run` makes about declared
 * failures being data.
 */
export const runAsync = <A>(effect: Call<A>): Promise<Result.Result<A, OpFailure>> =>
  // AND THE ONE PLACE A KEY'S CALL CAN BE RECOGNISED AS ONE. Being the single
  // edge is what makes that possible at all: a call started while a key is
  // being handled is that key's, and this tab has not finished with the key
  // until the server has answered it — which is what `./quiescence.ts`
  // publishes, and where the list of what it does and does not cover is. Every
  // other call is untouched, because it did not start inside a key's dispatch:
  // a subscription arriving, a pointer's write, an upload's chunk loop, the
  // traffic of a turn already running.
  quiescence.holding(
    Effect.runPromise(Effect.result(effect)).then((outcome) =>
      Result.isSuccess(outcome)
        ? Result.succeed(outcome.success)
        : Result.fail(asFailure(outcome.failure))
    ),
  )

/** A failure the panel can draw. The declared ones already are one — recognised
 *  against the format's own closed table, not by the shape of a tag — and a
 *  transport failure is re-said as `busy`, which is what it means to a reader:
 *  the server did not take it, try again.
 *
 *  Exported for the one caller that COMPOSES a procedure into a larger effect
 *  rather than running it ({@link ./attach.ts}, whose chunk loop is a sequence
 *  of calls): that caller needs the same translation, and a second one would be
 *  a second answer to "what kind of refusal is this". */
export const asFailure = (failure: unknown): OpFailure =>
  isOpFailure(failure)
    ? failure
    : new BusyFailure({
      reason: failure instanceof Error ? failure.message : String(failure),
    })
