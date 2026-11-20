import { type Accessor, createSignal } from "solid-js"

export const WATCHED_BEAT = 1500

export const WATCHED_LAPSE = 3750

/**
 * A one-way word between the documents of one browser.
 *
 * `say` reaches every OTHER endpoint and never the one that said it, which is
 * `BroadcastChannel`'s own rule and the reason this can be one bit: a tab
 * hearing its own beat would report itself as somebody else.
 */
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
