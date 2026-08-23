/**
 * A write whose REQUEST is chosen from a reading — run against that reading,
 * and chosen again if the set moved out from under the choice.
 *
 * TWO DOORS resolve a request rather than being handed one: the browser's
 * keystrokes and menu entries (`./runtime.ts`'s `applyEdit`, over `./edit.ts`)
 * and the `capture` TOOL, whose `plan` arm resolves the inbox convention
 * against the directory (`@olai/ops`' `tools.ts`, dispatched in
 * `./mcp/tools.ts`). Both are read → resolve → run, and both had the same hole
 * in the middle of it.
 *
 * The second one used to be an HTTP door of its own (`POST /capture`) and it
 * used this file already; as a tool it is reached over a socket as readily as
 * in-process, so what it needed was not a second copy of the retry but the same
 * one with the READING and the RUN as parameters — which is {@link
 * resolvedWrite} below, and what {@link runResolved} is now written in terms
 * of.
 *
 * ## The hole
 *
 * Two of those resolutions pick between ops that are NOT interchangeable: a
 * capture and a pin are a `create` for a directory that has no inbox (or no
 * shelf) and an `add` for one that has it. The ops layer re-plans the REQUEST
 * it was handed when the store moves under it, which is right for every op that
 * names a node — but it cannot re-make a CHOICE it did not make. So two first
 * captures both resolve `create`, one lands, and the other is refused naming a
 * file that now exists.
 *
 * That refusal is not an answer to the caller. It is the resolver's own choice
 * having gone stale between the read and the plan, which is exactly what the
 * gate's `StaleWrite` is one layer down — and that one is retried in silence
 * rather than reported. So this does the same at the layer that made the
 * choice.
 *
 * ## Why the ARM and not the request
 *
 * The retry fires only when re-resolving picks a different OP. That is the
 * whole of the fork this exists for (`create` ⇄ `add`), and the narrowness is
 * deliberate rather than lazy: "re-resolve and run whatever comes back" would
 * be wrong for the verbs whose resolution reads a MARK. A `toggle` refused with
 * "already done" because another writer got there first must stay refused —
 * re-resolving it would produce an `undo` and quietly take back somebody else's
 * mark, which is the failure `./edit.ts` already argues against at the toggle
 * arm. Comparing the op cannot reach that: only a resolver that picks between
 * two ops can flip one.
 *
 * ONCE, and not a loop. The second reading either holds the file — in which
 * case the answer is an `add` and no third attempt can be needed — or the
 * directory really has none and the `create` is the honest request. There is no
 * state this can spin on, so a bounded retry is a fact about the problem rather
 * than a number somebody picked.
 *
 * WHICH VERBS may re-resolve is `./edit.ts`'s ({@link reresolves}), because
 * what a verb MEANS is that file's, and this one only knows how to run one.
 */

import type { OpFailure, Reading, Writer } from "@olai/format"
import type { Applied, Ops, Request } from "@olai/ops"
import { Effect, Result } from "effect"

/** A write that landed, with the reading it was resolved against and the
 *  request it became — both of which a caller still needs afterwards, and
 *  neither of which it can recover once the retry has chosen a second time.
 *  `applyEdit` derives its undo from exactly this pair. */
export interface Written {
  readonly at: Reading
  readonly request: Request
  readonly done: Applied
}

/**
 * THE MECHANISM, generic over what is READ and how the request is RUN — which
 * is the whole of what its two callers differ by.
 *
 * `runResolved` below reads a whole {@link Reading} out of a local `Ops` and
 * runs under a writer; the `capture` tool reads a LISTING over a surface client
 * that may be a socket away and runs without naming one. Neither difference is
 * about the algorithm, and spelling the algorithm twice put the argument in this
 * header a file away from one of the two places it governs — so the reading is
 * a parameter and the run is a parameter, and the retry is written once.
 *
 * `A` is deliberately unconstrained: what a resolver needs to choose is its own
 * business, and this only ever hands it back.
 */
export const resolvedWrite = <A>(
  read: Effect.Effect<A, OpFailure>,
  resolve: (at: A) => Result.Result<Request, OpFailure>,
  run: (request: Request) => Effect.Effect<Applied, OpFailure>,
  /** Whether a refusal may be this resolver's own arm having gone stale — see
   *  the header, and `./edit.ts`'s `reresolves` for which verbs those are. */
  reresolves: boolean,
): Effect.Effect<{ readonly at: A; readonly request: Request; readonly done: Applied }, OpFailure> =>
  Effect.gen(function*() {
    const at = yield* read
    const first = resolve(at)
    if (Result.isFailure(first)) return yield* Effect.fail(first.failure)

    const ran = yield* Effect.result(run(first.success))
    if (Result.isSuccess(ran)) return { at, request: first.success, done: ran.success }
    if (!reresolves) return yield* Effect.fail(ran.failure)

    const now = yield* read
    const again = resolve(now)
    // A resolution that answers the same op was not stale, so the refusal is a
    // real one and travels back in its own words. A resolution that now REFUSES
    // is the same case read once more: the caller is owed what the write said,
    // not what a second reading thinks of the request.
    if (Result.isFailure(again) || again.success.op === first.success.op) {
      return yield* Effect.fail(ran.failure)
    }
    const done = yield* run(again.success)
    return { at: now, request: again.success, done }
  })

/** {@link resolvedWrite} against a local `Ops`, under one writer — the
 *  browser's half, whose reading is the whole set and whose caller needs that
 *  reading back to derive an undo. */
export const runResolved = (
  ops: Pick<Ops, "read" | "run">,
  writer: Writer,
  resolve: (at: Reading) => Result.Result<Request, OpFailure>,
  reresolves: boolean,
): Effect.Effect<Written, OpFailure> =>
  resolvedWrite(ops.read, resolve, (request) => ops.run(request, writer), reresolves)
