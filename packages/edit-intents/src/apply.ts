/** Resolve a UI intent against the authoritative vault gate. The capability
 * registering the wire handler decides which intent variants it owns. */
import { Effect } from "effect"
import type { Ops, Caller } from "@olai/ops"
import { runResolved } from "@olai/ops/resolved-gate"
import type { Edit, Applied } from "@olai/surface"
import type { OpFailure } from "@olai/format"
import { RequestAuthority } from "@olai/plugin-api/authority"
import { inverseOf, reresolves, requestFor } from "./index.ts"
export const applyEdit = (ops: Ops, edit: Edit): Effect.Effect<Applied, OpFailure> => Effect.gen(function*() {
  const caller = (yield* RequestAuthority) as Caller
  return yield* Effect.map(runResolved(ops, caller, at => requestFor(at, edit), reresolves(edit)), ({ at, request, done }) => {
    const undo = inverseOf(at, edit, request, done.id)
    return { id: done.id, title: done.title, file: done.file,
      ...(done.nudge === undefined ? {} : { nudge: done.nudge }),
      ...(undo.length === 0 ? {} : { undo }),
    }
  })
})
export const runWrite = (ops: Ops, request: Parameters<Ops["run"]>[0]) => Effect.gen(function*() {
  const caller = (yield* RequestAuthority) as Caller
  return yield* ops.run(request, caller.writer, caller.fence ?? undefined)
})
