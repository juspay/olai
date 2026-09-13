/**
 * WHICH ROW IS DRAWN DIRECTLY ABOVE THIS ONE — asked by every row, and answered
 * so that a row arriving wakes the row it arrived next to and no other.
 *
 * A lane and a face are both facts about the row above ({@link ./lanes.ts},
 * {@link ./speakers.ts}), and a row cannot see its neighbour, so the list
 * answers for it ({@link ./Transcript.tsx}). It used to answer with ONE memo
 * over a map of the whole list that every row read. That is correct and it is
 * quadratic: the map is a fresh object on every tick the order moves on, so each
 * arriving row re-ran every row's lookup — and a conversation OPENED is its
 * whole history arriving a few rows a frame. A long chat's open was minutes of
 * main thread spent re-deciding, a thousand times over, that nothing above
 * anything had changed, while the pane followed the rows down the screen one
 * frame at a time.
 *
 * So each row holds its OWN signal, and the walk over the order writes all of
 * them. A write that says what the signal already holds notifies nobody, which
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
  let above = new Map<string, string>()
  createComputed(() => {
    const keys = order()
    const next = new Map<string, string>()
    for (let at = 1; at < keys.length; at++) {
      const key = keys[at]
      const before = keys[at - 1]
      if (key !== undefined && before !== undefined) next.set(key, before)
    }
    above = next
    for (const [key, set] of slots) set(next.get(key))
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
