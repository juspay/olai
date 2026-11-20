import { type Accessor, createSignal } from "solid-js"

export const WATCHED_BEAT = 1500

export const WATCHED_LAPSE = 3750

/** `BroadcastChannel` delivers a message to every other document of the origin
 *  and never to the one that posted it. */
export interface Aired {
  readonly say: () => void
  readonly heard: (take: () => void) => void
  readonly close: () => void
}

export const broadcast = (name: string): Aired | undefined => {
  if (typeof BroadcastChannel === "undefined") return undefined
  const channel = new BroadcastChannel(name)
  return {
    say: () => channel.postMessage(1),
    heard: (take) => channel.addEventListener("message", () => take()),
    close: () => channel.close(),
  }
}

export interface Elsewhere {
  readonly beat: () => void
  readonly watched: Accessor<boolean>
  readonly close: () => void
}

export const createElsewhere = (
  air: Aired | undefined,
  lapse: number = WATCHED_LAPSE,
): Elsewhere => {
  const [watched, setWatched] = createSignal(false)
  let forget: ReturnType<typeof setTimeout> | undefined

  air?.heard(() => {
    setWatched(true)
    clearTimeout(forget)
    forget = setTimeout(() => setWatched(false), lapse)
  })

  return {
    beat: () => air?.say(),
    watched,
    close: () => {
      clearTimeout(forget)
      air?.close()
    },
  }
}
