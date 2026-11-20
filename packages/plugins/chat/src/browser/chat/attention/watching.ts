import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js"

import { createTicking } from "@olai/web/client/clock.ts"
import { createElsewhere, WATCHED_BEAT } from "./elsewhere.ts"

const documentInFront = (): boolean =>
  document.visibilityState === "visible" && document.hasFocus()

const WATCHED = "olai.chat.watched"

export interface Watching {
  readonly watched: Accessor<boolean>
  readonly here: Accessor<boolean>
}

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
  return (reading: Accessor<boolean>, identity: string): Watching => {
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

  const beat = createTicking(WATCHED_BEAT, here)
  createEffect(() => {
    if (!here()) return
    beat()
    elsewhere.beat()
  })

  return {
    here,
    watched: () => here() || elsewhere.watched(),
  }
  }

}
