/**
 * Who is told the directory MOVED.
 *
 * One published revision reaches a browser three ways today: the two
 * collections upsert what changed, and the manifest cell is written last
 * (`./runtime.ts`'s connector, which owns that ordering and the argument for
 * it). A fourth way arrived with `vault-in-browser`'s PR 4 and needs nothing
 * published at all — a STREAM member re-READS its own answer when something
 * happened, so what it wants is the bare fact that something did.
 *
 * That fact is what this module carries. `moved()` is called at the end of the
 * connector's revision; `install` is what the framework's poll shape asks for,
 * a callback and a way to take it off again (`@kolu/surface`'s `pollOnEvent`,
 * which installs before its first read and tears down in a `finally`).
 *
 * IT CARRIES NO VALUE, and that is the design rather than an economy. A pulse
 * that carried the revision would be a second answer to what the directory
 * says — one a listener could act on WITHOUT reading the store, and therefore
 * one free to disagree with it. Every reader here goes back to the ops layer's
 * own gated read, which is the same read a keystroke is judged against and the
 * same one an agent's tool gets.
 *
 * IT IS THE FRAMEWORK'S CHANNEL AND NOT A LISTENER SET OF OUR OWN. That is
 * what this module was for one commit, and `@kolu/surface`'s `inMemoryChannel`
 * is the same three lines already written and already tested: publish, and a
 * `consume` that dispatches to a callback and hands back its own teardown. What
 * is left here is the NAME and the two paragraphs above — which is the whole
 * reason it stays a module at one caller: PR 10 gives every page reading a
 * subscription of this shape, so this is the seam they all install on.
 *
 * NOTHING IS COALESCED HERE, and nothing needs to be: the framework's poll loop
 * sets a dirty flag and folds every tick that arrives during a read into one
 * re-read, then drops the frame entirely when the answer did not move.
 * Coalescing on this side would be a second buffer in front of that one — and
 * the pulse is LEVEL-triggered ("go and look again"), so two of them in flight
 * mean exactly what one does.
 */

import { type Channel, inMemoryChannel } from "@kolu/surface/server"

/** The pulse, from both ends: the connector that says the directory moved, and
 *  the readings that want to know. */
export interface Revisions {
  /** A revision has been published. Every installed listener is told. */
  readonly moved: () => void
  /** Be told, until the returned function is called. */
  readonly install: (listener: () => void) => () => void
}

/**
 * One pulse for one served directory.
 *
 * `onError` is the framework's required choice rather than a swallow: a channel
 * carrying nothing, published from a synchronous connector and consumed by a
 * loop that only sets a flag, has no failure to report — and the one thing that
 * COULD go wrong downstream, a re-read that refuses, is reported where it
 * happens (`./runtime.ts`'s `onStreamReadError`).
 */
export const make = (): Revisions => {
  const channel: Channel<void> = inMemoryChannel<void>()
  return {
    moved: () => channel.publish(undefined),
    install: (listener) => channel.consume({ onEvent: listener, onError: () => {} }),
  }
}
