/**
 * Who is told the directory MOVED.
 *
 * One published revision reaches a browser three ways today: the two
 * collections upsert what changed, and the manifest cell is written last
 * (`./runtime.ts`'s connector, which owns the ordering and the argument for
 * it). A fourth way arrived with `vault-in-browser`'s PR 4 and needs nothing
 * published at all — a STREAM member re-READS its own answer when something
 * happened, so what it wants is the bare fact that something did.
 *
 * That fact is what this module is. `moved()` is called once at the end of the
 * connector's revision, after the projection is in place, so a listener that
 * reads the store the instant it is woken reads the revision that woke it.
 * `install` is what the framework's poll shape asks for: a plain callback and a
 * way to take it off again, sync in both directions, because a stream's
 * `install` runs before its first read and its teardown runs in a `finally`
 * (`@kolu/surface`'s `pollOnEvent`).
 *
 * IT CARRIES NO VALUE, and that is the whole design rather than an economy. A
 * pulse that carried the revision would be a second answer to what the
 * directory says — one a listener could act on WITHOUT reading the store, and
 * therefore one that could disagree with it. Every reader here goes back to the
 * ops layer's own gated read for the answer, which is the same read a keystroke
 * is judged against and the same one an agent's tool gets.
 *
 * NOTHING IS COALESCED HERE either, and nothing needs to be: the framework's
 * poll loop sets a dirty flag and folds every tick that arrives during a read
 * into one re-read, then drops the frame entirely when the answer did not move.
 * Coalescing on this side would be a second buffer in front of that one.
 */

/** The pulse, from both ends: the connector that says the directory moved, and
 *  the readers that want to know. */
export interface Revisions {
  /** A revision has been published and the projection is in place. Every
   *  installed listener is called, synchronously, in the order they installed. */
  readonly moved: () => void
  /** Be told, until the returned function is called. */
  readonly install: (listener: () => void) => () => void
}

/**
 * One pulse for one served directory.
 *
 * A `Set` rather than an array, so a listener removed twice is removed once and
 * an unsubscribe run after teardown is a no-op instead of a splice at the wrong
 * index. The iteration takes a COPY, because a listener is free to install or
 * drop another one while it runs — a subscription torn down inside the wake it
 * was woken by is exactly what a socket closing mid-revision looks like — and a
 * set mutated during its own iteration is where that becomes a skipped reader.
 */
export const make = (): Revisions => {
  const listeners = new Set<() => void>()
  return {
    moved: () => {
      for (const listener of [...listeners]) listener()
    },
    install: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
