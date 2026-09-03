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
 * ## THE THIRD EXIT, which this file did not have a name for
 *
 * A fiber can also be INTERRUPTED, and that is neither of the two above: not a
 * declared failure, because nothing refused; not a defect, because nothing is
 * wrong. `Effect.result` folds a declared failure into data and leaves an
 * interrupt alone, so an interrupted call rejected the promise underneath, and
 * the `.then` that read the outcome had no rejection handler — the tab reported
 * `All fibers interrupted without error`, with nothing but Effect's own frames
 * under it, on a scenario that had no idea it had made a call.
 *
 * It became reachable when the tab started FOLLOWING THE ROSTER. A redial
 * supersedes the connection, and everything still in flight on the old one is
 * interrupted at that moment — the ordinary end of a roster change, and of
 * every boot whose roster lands after the first paint. So the edge runs
 * `runPromiseExit`, which cannot reject, and each of the three exits is decided
 * here: a failure is data, a defect is rethrown to the console, and an
 * interrupt is `busy` — the server did not take it, try again.
 *
 * It lived in `chat/` while the conversation was the only thing with verbs.
 * The palette's `>` ask was the second caller and the row editor is the third,
 * so it sits at the client's root now — one edge, named once, wherever a
 * procedure is called from.
 */

import { BusyFailure, isOpFailure, type OpFailure } from "@olai/surface"
import { Cause, Effect, Exit, Result } from "effect"

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
    // `runPromiseExit` rather than `runPromise`, so this edge cannot REJECT and
    // the three exits below are all decided here — see the header's third
    // section on the one that used to escape.
    Effect.runPromiseExit(Effect.result(effect)).then((exit) => {
      if (Exit.isSuccess(exit)) {
        const outcome = exit.value
        return Result.isSuccess(outcome)
          ? Result.succeed(outcome.success)
          : Result.fail(asFailure(outcome.failure))
      }
      // A DEFECT, rethrown — the header's rule, kept exactly: it is a bug and it
      // belongs in the console loudly, so this arm puts it back on the floor it
      // was already reaching before the interrupt arm was written.
      if (!Cause.hasInterruptsOnly(exit.cause)) throw Cause.squash(exit.cause)
      // ...and INTERRUPTED, which is the arm that was missing. `Effect.result`
      // turns a declared failure into data and an interrupt into nothing at
      // all, so an interrupted call rejected the promise below it, `run`'s
      // `.then` had no rejection handler, and the tab reported an uncaught
      // `All fibers interrupted without error` with no application frame on it.
      //
      // It is reachable because a REDIAL supersedes the wire: every call still
      // in flight on the old connection is interrupted at that moment (see
      // `./wire.ts`), which is the ordinary end of a roster change and of every
      // boot whose roster lands after the first paint. Nothing was wrong, and a
      // tab that says `All fibers interrupted` at a person is worse than one
      // that says nothing.
      //
      // `busy` and not silence, because a caller that SEQUENCES calls has to be
      // told: `runAsync` exists for the row editor, which commits a title and
      // then moves the row, and a first step that never landed must not be
      // followed by a second judged against it. "The server did not take it,
      // try again" is exactly what happened.
      return Result.fail(
        new BusyFailure({
          reason: "the connection this call was on was replaced before the server answered it",
        }),
      )
    }),
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
