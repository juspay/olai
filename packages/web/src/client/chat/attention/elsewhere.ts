/**
 * WHETHER ANOTHER TAB OF THIS BROWSER IS LOOKING AT THE CONVERSATION.
 *
 * `document.hasFocus()` and `visibilityState` are per-DOCUMENT, and the ruling
 * this feature exists under is about a PERSON: "when the pane IS focused,
 * nothing — the form appearing is the alert." Two tabs of one olai are two
 * documents and one person, so a question arriving in the tab they are reading
 * makes every OTHER tab of it hidden, unwatched, and — before this — a source
 * of a chime about a form already on their screen. The OS replaces a same-tag
 * banner and does not cancel a sound, so tag-dedup is not this.
 *
 * A DIFFERENT VAULT IS NOT THIS QUESTION, and nothing here has to do anything
 * about it: one olai serves one directory at one address, and a
 * `BroadcastChannel` reaches one ORIGIN — so vault A being in front of you
 * cannot silence vault B behind you, because the two never share a channel.
 * That is inherited rather than arranged, which is worth saying out loud: the
 * day two olai are multiplexed behind one host and path, this bit would need a
 * name of its own, and the page has no reading of WHICH directory it is
 * serving to build one from.
 *
 * ONE BIT, AND IT DECAYS. Each watching tab says so on a beat; every other tab
 * holds "somebody said so recently" and lets it go when the saying stops. That
 * is the whole mechanism, and the decay is what makes it safe: a tab that is
 * CLOSED retracts nothing, a tab that CRASHES retracts nothing, and a standing
 * claim from either would silence this browser for good — a worse failure than
 * the one being fixed. Nothing is remembered per tab, so nothing can go stale
 * for longer than {@link WATCHED_LAPSE}.
 *
 * WHAT IT DELIBERATELY DOES NOT DO is dedup between tabs that are ALL
 * unwatched. Two backgrounded olai on one vault both ring, and that is the
 * honest answer rather than an oversight: each of them is correctly reporting
 * that nobody is looking, and picking one to speak for the rest is an election
 * — a different mechanism, for a complaint the ruling does not make. What the
 * ruling is about is nagging somebody about what is already on their screen.
 *
 * The channel is injected rather than reached for, so the two-document case is
 * a unit test rather than something only a person with two windows can find.
 */

import { type Accessor, createSignal } from "solid-js"

/** How often a watching tab says so. Short enough that a tab coming to the
 *  front is heard about before the next question, long enough that a person
 *  reading for an hour is a handful of postMessages a minute. */
export const WATCHED_BEAT = 1500

/** How long a saying is believed. Two beats and a half, so one dropped beat
 *  does not flap the answer — and short enough that a tab which was closed
 *  while watching stops silencing this one within a few seconds. */
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
  /** Take every word said by another endpoint, until {@link Aired.close}. */
  readonly heard: (take: () => void) => void
  readonly close: () => void
}

/** The browser's own, or `undefined` where it has none — an old browser, or a
 *  context that does not expose it. A page with no channel behaves exactly as
 *  it did before this existed: it answers for itself alone. */
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
  /** Say that THIS document is watching, now. */
  readonly beat: () => void
  /** Whether another document said so recently — a signal, so a sibling coming
   *  to the front clears this tab's mark rather than waiting for the next
   *  thing to happen. */
  readonly watched: Accessor<boolean>
  readonly close: () => void
}

/**
 * The bit, wired.
 *
 * `lapse` is a parameter for the test's sake and for no other: what the number
 * means is argued at {@link WATCHED_LAPSE}, and a suite that had to wait four
 * seconds to watch one decay would be a suite nobody runs.
 */
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
