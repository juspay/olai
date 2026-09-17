/** Scoped attention for the conversations this activation can observe.
 * Cross-tab readership and node standings decide whether a question needs a
 * notification; withdrawal releases the claims and listeners together. */

import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js"

import { createTicking } from "@olai/web/client/clock.ts"
import { createElsewhere, WATCHED_BEAT } from "./elsewhere.ts"

/** What the DOCUMENT says: this page is on screen and the window is in front. */
const documentInFront = (): boolean =>
  document.visibilityState === "visible" && document.hasFocus()

/** The name the tabs of one olai say it under. Origin-scoped by the platform,
 *  which is the whole of how two vaults stay apart ({@link ./elsewhere.ts}). */
const WATCHED = "olai.chat.watched"

/**
 * Whether the conversation is in front of somebody, as a signal that follows
 * the window, the panel, and the browser's other tabs.
 */
export const createWatchings = () => {
  const [front, setFront] = createSignal(documentInFront())
  const look = (): void => {
    setFront(documentInFront())
  }

  document.addEventListener("visibilitychange", look)
  window.addEventListener("focus", look)
  window.addEventListener("blur", look)
  onCleanup(() => {
    document.removeEventListener("visibilitychange", look)
    window.removeEventListener("focus", look)
    window.removeEventListener("blur", look)
  })

  const channel = typeof BroadcastChannel === "undefined" ? undefined : new BroadcastChannel(WATCHED)
  const listeners = new Map<string, Set<() => void>>()
  const heard = (event: MessageEvent<unknown>) => {
    if (typeof event.data !== "string") return
    for (const take of listeners.get(event.data) ?? []) take()
  }
  channel?.addEventListener("message", heard)
  onCleanup(() => { channel?.close(); listeners.clear() })
  return (reading: Accessor<boolean>, identity: string): Accessor<boolean> => {
  /** THIS document's answer, which is what it beats out to the others. */
  const here = (): boolean => front() && reading()

  const takes = new Set<() => void>()
  const elsewhere = createElsewhere(channel === undefined ? undefined : {
    say: () => channel.postMessage(identity),
    heard: take => {
      takes.add(take)
      const held = listeners.get(identity) ?? new Set<() => void>()
      held.add(take)
      listeners.set(identity, held)
    },
    close: () => {
      const held = listeners.get(identity)
      for (const take of takes) held?.delete(take)
      if (held?.size === 0) listeners.delete(identity)
    },
  })
  onCleanup(elsewhere.close)

  // THE ONE REPEATING TIMER IN THIS CLIENT is `../../clock.ts`'s, and this is a
  // caller of it rather than a second one: what a beat and a ticking readout
  // have in common is not the number but the LIFETIME, which is the whole
  // argument `createTicking` was written for and the claim `@olai/web`'s own `client/claims.test.ts`
  // holds. Gated on `here`, so it runs only while this tab IS the one being
  // watched — a browser with olai in every window and nobody at it says
  // nothing at all — and gated INSIDE the effect as well as through `when`,
  // because the clock has a value from the moment it is made and a beat on it
  // would be this tab claiming to be watched before anybody looked.
  const beat = createTicking(WATCHED_BEAT, here)
  createEffect(() => {
    if (!here()) return
    beat()
    elsewhere.beat()
  })

  return () => here() || elsewhere.watched()
}

}
