/**
 * A value that starts over when the thing it belongs to changes.
 *
 * Two of the client's client-local switches have this shape and neither is
 * really about time: what is folded belongs to the PAGE being read, and which
 * month the calendar shows belongs to the month it is ANCHORED to. In both
 * cases the held value is only meaningful while the stamp it was taken under
 * still holds, and when the stamp moves the answer is a fresh value rather
 * than a stale one.
 *
 * Written as a value plus a stamp, and read through a memo that compares them,
 * rather than as an effect that resets something when a route changes. The
 * difference is a frame: an effect runs AFTER the render that saw the new
 * stamp, so there is a moment where the held value and the thing it belongs to
 * disagree, and that moment is on screen. Here a value stamped with anything
 * but the current stamp is simply never the one that gets read.
 *
 * The subtle rule is `set`, and it is why this is one function rather than an
 * idiom copied twice: an edit applies to the value being READ, not to whatever
 * is held. On the first edit after the stamp moves those are different values,
 * and the held one belongs to the page the reader has already left.
 */

import { type Accessor, createMemo, createSignal } from "solid-js"

export interface Stamped<V> {
  /** The value as it stands under the current stamp. */
  readonly value: Accessor<V>
  /** Replace it, under the stamp it is being read at. */
  readonly set: (next: V) => void
  /** Change it from what it currently reads as — the safe form of `set`. */
  readonly edit: (change: (current: V) => V) => void
}

export const createStamped = <S, V>(
  stamp: Accessor<S>,
  fresh: (stamp: S) => V,
): Stamped<V> => {
  const start = stamp()
  const [held, setHeld] = createSignal<{ readonly stamp: S; readonly value: V }>({
    stamp: start,
    value: fresh(start),
  })

  const value = createMemo(() => {
    const current = held()
    const now = stamp()
    return current.stamp === now ? current.value : fresh(now)
  })

  const set = (next: V): void => {
    setHeld({ stamp: stamp(), value: next })
  }

  return { value, set, edit: (change) => set(change(value())) }
}
