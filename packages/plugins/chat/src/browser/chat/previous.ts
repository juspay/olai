/**
 * WHICH ROW IS DRAWN DIRECTLY ABOVE THIS ONE — asked by every row, and answered
 * so that a row arriving wakes the row it arrived next to and no other.
 *
 * A lane and a face are both facts about the row above ({@link ./lanes.ts},
 * {@link ./speakers.ts}), and a row cannot see its neighbour, so the list
 * answers for it ({@link ./Transcript.tsx}). It used to answer with ONE memo
 * over a map of the whole list that every row read. That is correct and it is
 * quadratic: the map is a fresh object on every tick the order moves on, so each
 * arriving row re-ran every row's lookup. A turn in a long conversation adds
 * its rows one tick at a time — a tool call, its result, the next paragraph —
 * and each of them re-decided, for every row already on screen, that nothing
 * above it had changed. Measured with 1,600 rows delivered a few a frame, it
 * was minutes of main thread.
 *
 * So each row holds its OWN signal, and keyed reconciliation writes only the changed span. A write that says what the signal already holds notifies nobody, which
 * is Solid's own equality — so an append costs one plain pass over the keys and
 * wakes exactly one row, the one appended. An insertion wakes the row it pushed
 * down; a removal wakes the row that closed the gap.
 *
 * THE SIGNAL IS OWNED BY THE ROW that asks — made in the scope that calls
 * {@link Previous}, and let go when that scope is disposed — so a row leaving
 * the list takes its slot with it, and the walk never writes to a row that is
 * no longer drawn.
 */

import { type Accessor, createComputed, createSignal, onCleanup, type Setter } from "solid-js"

/** The key above `key`, tracked for that one row. Call it where the row is
 *  made: the signal lives exactly as long as that scope. `undefined` for the
 *  first row, and for a key not in the list. */
export type Previous = (key: string) => Accessor<string | undefined>

export const createPrevious = (order: Accessor<ReadonlyArray<string>>): Previous => {
  const slots = new Map<string, Setter<string | undefined>>()
  const above = new Map<string, string>()
  let previous: ReadonlyArray<string> = []
  createComputed(() => {
    const keys = order()
    let start = 0
    while (start < previous.length && start < keys.length && previous[start] === keys[start]) start++
    let oldEnd = previous.length, newEnd = keys.length
    while (oldEnd > start && newEnd > start && previous[oldEnd - 1] === keys[newEnd - 1]) { oldEnd--; newEnd-- }
    const retained = new Set(keys.slice(start, newEnd))
    for (let at = start; at < oldEnd; at++) {
      const key = previous[at]!
      if (!retained.has(key)) { above.delete(key); slots.get(key)?.(undefined) }
    }
    // Only the changed span and the first unchanged successor can have a
    // different predecessor. Appending allocates no replacement index.
    for (let at = start; at < Math.min(keys.length, newEnd + 1); at++) {
      const key = keys[at]!, before = keys[at - 1]
      if (before === undefined) above.delete(key)
      else above.set(key, before)
      slots.get(key)?.(before)
    }
    previous = keys
  })
  return (key) => {
    const [previous, set] = createSignal(above.get(key))
    slots.set(key, set)
    // Only its own: a key drawn again before the old row's cleanup ran has
    // already put a fresh slot here.
    onCleanup(() => {
      if (slots.get(key) === set) slots.delete(key)
    })
    return previous
  }
}
