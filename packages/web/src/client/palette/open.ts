/**
 * WHAT THE PALETTE IS SHOWING — a module signal, because three things open it
 * and only one of them is inside it.
 *
 * The chord is the palette's own (`Palette.tsx` holds the one window key
 * listener). The second opener is the HEADER on a phone, where there is no ⌘K
 * to press and the bar has no room for a box: the magnifier there opens THIS
 * modal rather than growing a second search surface. The third is a door that
 * opens it WITH a question already up — the pinned shelf's rename control,
 * which is a control in the sidebar and has no path to the panel that draws
 * one (`../pins/naming.ts`). A prop drilled from `App.tsx` down to either
 * would have worked and would have said less; the layout preferences next door
 * are module signals for the same reason (`../layout/prefs.ts`).
 *
 * ONE VALUE AND NOT TWO, which is what that third opener decided. A boolean
 * beside a nullable question is a product with a state nothing means — *a
 * question waiting over a modal that is shut*, which the next ⌘K would raise
 * about a page the reader left ten minutes ago — and keeping that state
 * unreachable costs a batch at every door, a clearing rule at every close, and
 * an argument in prose at each of them. Here a question cannot exist apart from
 * the open it belongs to: {@link askInPalette} is ONE write, and closing takes
 * the question with it because the question is part of what closing replaces.
 *
 * It holds no more than that. What OPENING means — the caret, the remembered
 * focus, the emptied box — stays inside the palette, which is the only thing
 * that knows those.
 */

import { createMemo, createRoot, createSignal } from "solid-js"

import type { Asking } from "./asking.ts"

type Opened =
  | { readonly kind: "closed" }
  /** Up, and asking something or nothing. */
  | { readonly kind: "open"; readonly asking: Asking | null }

/** The two states that carry nothing, as constants — so opening an open
 *  palette, or closing a closed one, is the same value and notifies nobody. */
const CLOSED: Opened = { kind: "closed" }
const LISTING: Opened = { kind: "open", asking: null }

const [opened, setOpened] = createSignal<Opened>(CLOSED)

/**
 * The two halves of that value, read apart — and MEMOS rather than plain
 * derivations, which is the one thing about this that is not obvious.
 *
 * A plain `() => opened().kind !== "closed"` subscribes its reader to the
 * SIGNAL rather than to the answer, so raising a question over an open palette
 * would notify everything that asked "is it open" — including the effect that
 * blanks the box and takes the caret when it OPENS, which would then run on a
 * question and put the caret back in the box the confirm just took it from
 * (caught by `features/palette_actions.feature`'s Tab cycle). A memo notifies
 * on the answer, so "it is still open" is not news.
 *
 * `createRoot` because these outlive every component that reads them — the
 * app's own lifetime, in effect — which is the same reason the pin line next
 * door has one (`../pins/pinning.ts`).
 */
const [paletteOpen, paletteAsking] = createRoot(() => [
  createMemo(() => opened().kind !== "closed"),
  createMemo((): Asking | null => {
    const it = opened()
    return it.kind === "closed" ? null : it.asking
  }),
])

export { paletteAsking, paletteOpen }

/** Open it on its list — the chord, and the header's magnifier. */
export const openPalette = (): void => {
  setOpened(LISTING)
}

/** Open it ON A QUESTION, from wherever the door is. One write, so the modal
 *  and the question it is about cannot arrive on two different frames. */
export const askInPalette = (asking: Asking): void => {
  setOpened({ kind: "open", asking })
}

/** Back out of the question, keeping the palette. */
export const dropQuestion = (): void => {
  setOpened((it) => (it.kind === "closed" ? it : LISTING))
}

export const closePalette = (): void => {
  setOpened(CLOSED)
}
