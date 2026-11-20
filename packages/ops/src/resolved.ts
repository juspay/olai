import type { OpFailure, Reading } from "@olai/format"
import type { Applied, Request } from "./index.ts"
import { Effect, Result } from "effect"

export const resolvedWrite = <A>(
  read: Effect.Effect<A, OpFailure>,
  resolve: (at: A) => Result.Result<Request, OpFailure>,
  run: (request: Request) => Effect.Effect<Applied, OpFailure>,
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
    if (Result.isFailure(again) || again.success.op === first.success.op) {
      return yield* Effect.fail(ran.failure)
    }
    const done = yield* run(again.success)
    return { at: now, request: again.success, done }
  })
