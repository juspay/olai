/**
 * WHAT CLAIMS THE PROPERTY VALUES THIS PAGE DRAWS — the table, and the rule
 * about when it moves.
 *
 * `./names.ts` and `./doors.ts`'s third sibling, and deliberately their twin:
 * the same shape, the same memo, the same comparator argument. What differs is
 * only what is being looked up — an id's title, a value's meaning, and here the
 * WORD a running plugin's contributed kind claims a value under. All three are
 * tables rather than questions the browser asks for one reason: the tab holds a
 * page, not a vault (`@olai/format`'s `meaning.ts`).
 *
 * ## THREE OF THEM, AND STILL THREE MODULES — asked, and answered
 *
 * Two of a shape is a coincidence and three is a pattern, so this is where the
 * question gets answered rather than restated: no, they do not collapse into
 * one `createTable(rows, key, same)`.
 *
 * What is actually shared is the SKELETON — copy, memo with an `equals`, build a
 * `Map`, return a lookup — which is about eight lines. What is not shared is
 * every part of it that does any work: the COPY differs per shape (a door's
 * answer is a nested tagged struct and has to be spread; a licence is four flat
 * strings; a name is three), the COMPARATOR differs for the same reason and is
 * the one piece with a real argument in it, and the KEY differs — `./names.ts`
 * is keyed by a bare node id, where these two are keyed by the triple. A helper
 * over that is eight lines of skeleton parameterised by three functions and a
 * type, which is not fewer moving parts than three plain modules; it is the same
 * parts with a layer of indirection over them and one place to break all three.
 *
 * ## The triple is each table's OWN key, not a shared one
 *
 * {@link at} below looks identical to `./doors.ts`'s and is deliberately not
 * imported from it. Each of these tables writes and reads its own `Map` with its
 * own encoding, so the two never meet: changing one's separator is invisible to
 * the other, exactly as `@olai/format`'s projection says of the spelling IT uses
 * for the same triple ("the wire carries the three fields APART, so this
 * spelling is this walk's own"). What travels is three fields; how a reader keys
 * them is the reader's.
 *
 * ## What the word is FOR, and why it could not be the key
 *
 * A live FACE — a terminal door, a CI chip — is a plugin's, licensed by a
 * declared KIND. The dressing table used to be looked up by the property KEY
 * instead, because the key was the only thing a tab had: a vault's declarations
 * do not travel to one (juspay/olai#395), and that decision is not being
 * reopened here. So the server followed the kind and the browser followed the
 * key, and the two agreed only while a vault happened to name its key after the
 * kind. `terminal` on a key called `pty` was walked, probed and gated on the
 * server and drew nothing in the tab — the fourth member of the bug family
 * `meaning.ts`'s header lists, closed the way the other three were.
 *
 * WHAT SHIPS IS AN ANSWER, not the declaration behind it. This table says which
 * word claims each value THIS PAGE DRAWS and nothing else — not which keys the
 * vault declares, not what else it declared them as, not what a value on some
 * other page would answer. #395 is intact; the tab still cannot re-derive a
 * rule, and there is still exactly one place that decides.
 *
 * ## Why the memo has an `equals` on it
 *
 * `./doors.ts`'s paragraph, word for word and for the same measured reason: a
 * NAVIGATION blanks the subscription, so the arriving page's first frame has
 * nothing to merge into and the store adopts it whole — every reader wakes,
 * whatever the value says. Two pages drawing the same lane board is the ordinary
 * case, and without the comparison every dressed property of the arriving page
 * would re-run for a table saying exactly what the last one said.
 *
 * THE COPY IS THE MECHANISM: a comparator needs two values, and the store's
 * array is identity-stable across frames, so a memo handing it straight back
 * would be comparing one value with itself and would report every frame
 * unchanged.
 */

import type { Licence, PageReading } from "@olai/format"
import { type Accessor, createMemo } from "solid-js"

/** What word claims a property value on this page — `undefined` for one nothing
 *  claims, which is nearly every value and is what makes a property draw as the
 *  plain chip it always did. */
export type Licences = (from: string, key: string, value: string) => string | undefined

/** THE TRIPLE, joined on a character no path, key or value can hold — a value
 *  is somebody's prose and may carry any separator a reader would think of,
 *  which is why this one is not a separator anybody would think of. This
 *  table's own encoding; see the header for why it is not `./doors.ts`'s. */
const at = (from: string, key: string, value: string): string =>
  `${from}\u0000${key}\u0000${value}`

export const createLicences = (
  reading: Accessor<PageReading | undefined>,
): Accessor<Licences> => {
  // Copying is what reads every field of every row, which is what subscribes
  // this to every frame; `equals` is what stops it there.
  const held = createMemo(
    (): ReadonlyArray<Licence> =>
      (reading()?.licences ?? []).map((one) => ({
        from: one.from,
        prop: one.prop,
        value: one.value,
        word: one.word,
      })),
    undefined,
    { equals: sameLicences },
  )
  return createMemo<Licences>(() => {
    const table = new Map<string, string>()
    for (const one of held()) table.set(at(one.from, one.prop, one.value), one.word)
    return (from, key, value) => table.get(at(from, key, value))
  })
}

/** The same licences in the same order — what "nothing this page draws changed
 *  what claims it" means. Four strings, so this is a walk rather than anything
 *  cleverer (`./doors.ts` makes the same trade about a tagged answer). */
const sameLicences = (a: ReadonlyArray<Licence>, b: ReadonlyArray<Licence>): boolean =>
  a.length === b.length &&
  a.every((one, index) => {
    const other = b[index]
    return other !== undefined &&
      one.from === other.from && one.prop === other.prop &&
      one.value === other.value && one.word === other.word
  })
