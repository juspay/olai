import type { OpFailure, Reading } from "@olai/format"
import type { Applied, Caller, Ops, Request } from "@olai/ops"
import { Effect, Result } from "effect"

export interface Written {
  readonly at: Reading
  readonly request: Request
  readonly done: Applied
}

export { resolvedWrite } from "@olai/ops/resolved"
import { resolvedWrite } from "@olai/ops/resolved"

export const runResolved = (
  ops: Pick<Ops, "read" | "run">,
  caller: Caller,
  resolve: (at: Reading & { readonly outlineRow: string }) => Result.Result<Request, OpFailure>,
  reresolves: boolean,
): Effect.Effect<Written, OpFailure> =>
  resolvedWrite(
    ops.read,
    resolve,
    (request) => ops.run(request, caller.writer, caller.rule),
    reresolves,
  )
