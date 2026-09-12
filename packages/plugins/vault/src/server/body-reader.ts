/** Procedure requests hold the vault's serial body reader until their answer
 * arrives. Nothing retains text after delivery; cancellation releases only
 * that request. The browser re-asks when the file's head changes. */
import { claimedOf, fileKind, type Claims } from "@olai/format"
import type { PlatformFailure } from "@olai/store"
import { Deferred, Effect } from "effect"
import type { Body } from "../file-surface.ts"
import { make } from "./bodies.ts"

const refused: Body = { text: null, refused: true }

export const openBodyReader = (
  read: (path: string) => Effect.Effect<string | null, PlatformFailure>,
  current: () => Claims,
) => Effect.gen(function*() {
  let live = true
  const waiting = new Map<string, Set<(body: Body) => void>>()
  const admitted = (path: string): boolean => {
    if (!live) return false
    const claims = current()
    if (claimedOf(claims, path) === null) return false
    const claim = claims.byKind.get(fileKind(claims, path)!)!
    return claim.holds === "text" && !claim.kept && !claim.fetched
  }
  const publish = (path: string, body: Body) => {
    const answer = admitted(path) ? body : refused
    for (const tell of waiting.get(path) ?? []) tell(answer)
  }
  const bodies = yield* make({
    read: path => Effect.suspend(() => {
      if (!admitted(path)) {
        publish(path, refused)
        return Effect.succeed(null)
      }
      return Effect.tap(read(path), text => Effect.sync(() => {
        if (text === null) publish(path, { text: null, refused: false })
      }))
    }),
    publish: (path, body) => publish(path, "refused" in body ? refused : { text: body.text, refused: false }),
  })
  yield* Effect.addFinalizer(() => Effect.sync(() => {
    live = false
    for (const readers of waiting.values()) for (const tell of readers) tell(refused)
    waiting.clear()
  }))
  return (path: string): Effect.Effect<Body> => Effect.scoped(Effect.gen(function*() {
    if (!admitted(path)) return refused
    const answer = yield* Deferred.make<Body>()
    yield* Effect.acquireRelease(Effect.sync(() => {
      const tell = (body: Body) => Deferred.doneUnsafe(answer, Effect.succeed(body))
      const readers = waiting.get(path) ?? new Set()
      readers.add(tell)
      waiting.set(path, readers)
      return tell
    }), tell => Effect.sync(() => {
      const readers = waiting.get(path)
      readers?.delete(tell)
      if (readers?.size === 0) waiting.delete(path)
    }))
    yield* bodies.held(path)
    bodies.unread([path])
    return yield* Deferred.await(answer)
  }))
})
