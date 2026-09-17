/** One vault setup's table. The provision receives the caller's row binding
 * from Cordis; callers cannot supply or replace their owner identity. */
import { claims, type Claims } from "@olai/format"
import type { FileKinds, FileClaim } from "@olai/plugin-api/services"
import { Effect, Queue, Stream } from "effect"
export const openFileKinds = () => {
  let current = claims([])
  const owners = new Map<string, object>()
  const listeners = new Set<() => void>()
  const changed = () => { for (const notify of listeners) notify() }
  const changes = Stream.callback<void>(queue => Effect.acquireRelease(
    Effect.sync(() => {
      const notify = () => { Queue.offerUnsafe(queue, undefined) }
      listeners.add(notify)
      notify()
      return notify
    }),
    notify => Effect.sync(() => { listeners.delete(notify) }),
  ), { bufferSize: 1, strategy: "sliding" })
  const provision = (owner: string): FileKinds => ({
    current: () => current.byKind,
    changes,
    register: (claim: FileClaim) => Effect.asVoid(Effect.acquireRelease(
      Effect.sync(() => {
        if ((claim.holds === "nodes") !== (claim.format !== undefined)) {
          throw new Error(`olai-plugin-vault: "${owner}" must supply a format exactly when its content holds nodes`)
        }
        // Construct before publishing: all keys are checked in this synchronous
        // step, and a refused acquisition changes nothing and owns no cleanup.
        const entry = { ...claim, kind: owner }
        let next: Claims
        try { next = claims([...current.byKind.values(), entry]) }
        catch (error) { throw new Error(`olai-plugin-vault: a second row registered an overlapping file claim (${owner}): ${String(error)}`) }
        const installed = {}
        owners.set(owner, installed)
        current = next
        changed()
        return installed
      }),
      installed => Effect.sync(() => {
        if (owners.get(owner) !== installed) return
        owners.delete(owner)
        current = claims([...current.byKind.values()].filter(entry => entry.kind !== owner))
        changed()
      }),
    )),
  })
  return { current: (): Claims => current, provision, changes }
}
