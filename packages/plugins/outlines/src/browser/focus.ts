import { heldService } from "@olai/ui-primitives/held.ts"
import { rowElements } from "./row-elements.ts"
/**
 * Which node the reader was just pointed AT, and how the page answers.
 *
 * The other direction of `chat-node-context`: a row arms the composer, and a
 * reference in the transcript points back. What a reference does is FOCUS —
 * the node is brought onto the screen and the row says it is the one being
 * talked about — and this module is the whole of that fact.
 *
 * Three decisions, and each of them is about not doing more than was asked:
 *
 *   - **it is a reading, not a write and not a route.** Nothing is stored,
 *     nothing crosses the wire, nothing is remembered for the next visit. It is
 *     one id, in this tab, exactly like the caret's own place — and the row it
 *     names draws the same accent the row holding the caret draws, because "this
 *     is the row" is one thing to say and a second vocabulary for it would be a
 *     second thing for a reader to learn.
 *   - **it does not open an editor.** Being shown a node is not being asked to
 *     type in it, and putting the caret in a title would start a DRAFT nobody
 *     asked for — one Escape away from being fine, and one keystroke away from
 *     editing the wrong row.
 *   - **it lasts until it is replaced.** No timer: the whole point is that the
 *     reader is looking at the chat panel when they press it, and a highlight
 *     that expired while they looked back at the tree would be a place-marker
 *     that is gone exactly when it is wanted. The next reference takes it.
 *
 * A node that is not on this page is not a failure — it is in another outline,
 * or inside a branch this reader has collapsed. The caller says what to do
 * about that ({@link focusNode}'s `elsewhere`), which is how the one statement
 * that MOVES the page stays here and the one that changes the ADDRESS stays
 * with the router.
 *
 * The scroll is one of four statements in this client that move the page. Two
 * are `./scroll.ts`'s — which says so in its own header — and it is
 * deliberately not one of them: those two are what a NAVIGATION does, and this
 * is a page staying exactly where it is except for the row somebody asked to
 * see. The fourth is `./autoscroll.ts`'s, which is neither: a page keeping up
 * with a gesture that has run out of screen, moving for as long as a hand holds
 * it near an edge. The outline's landing act (`./OutlinePage.tsx`) is NOT a
 * fifth: it is the same "this is the row" one frame late, so its scroll is
 * this module's one statement, reached for directly ({@link bringOntoScreen}).
 */
import { Result } from "effect"
import { type Accessor, createSignal, onCleanup, createSelector, createContext, createComponent, useContext, type JSX } from "solid-js"

import { atNode } from "olai-plugin-navigation/routes"
import { runAsync } from "@olai/web/client/run.ts"
import { useGo, useShown } from "olai-plugin-navigation/routing"

import { client } from "../client.ts"

export const createFocusState = () => {
  const [focused, setFocused] = createSignal<string | null>(null)
  const frames = new Set<number>()
  const state = { focused, setFocused, frames, pointed: 0 }
  onCleanup(() => { ++state.pointed; for (const frame of frames) cancelAnimationFrame(frame); frames.clear() })
  return state
}
const focusState = heldService<ReturnType<typeof createFocusState>>()
export const holdFocusState = focusState.hold
const focused = () => focusState.read()?.focused() ?? null
const setFocused = (id: string | null) => focusState.read()?.setFocused(id)

/** The node being pointed at, or `null`. Each page shares one selector over
 * this reading, so changing focus notifies only the old and new rows. */
export const focusedNode: Accessor<string | null> = focused
const FocusContext = createContext<(id: string) => boolean>()
export function FocusProvider(props: { readonly children: JSX.Element }) {
  const shown = useShown()
  const matches = createSelector(() => shown() ? focused() : null)
  return createComponent(FocusContext.Provider, { value: matches, get children() { return props.children } })
}
export const useFocused = (): ((id: string) => boolean) => useContext(FocusContext) ?? createSelector(focused)

/** The attribute a focused row carries — a FACT in the markup rather than a
 *  colour, so a scenario asking "which row is being pointed at" is not asking
 *  about a class name (`./Tree.tsx` writes it). It is also what the scroll
 *  below aims at: the row that wears it is the row to bring on screen,
 *  wherever in the tree it turned out to be, and a mirror of the node wears it
 *  too. */

/**
 * SELECT the row an address asked for — the same "this is the row" a
 * reference's press draws, because this module's standing rule is that there
 * is one accent for it and a second vocabulary for an arrival would be a
 * second thing for a reader to learn.
 *
 * Exported for the outline's landing act (`./OutlinePage.tsx`), which is the
 * only other writer: where a press is a person pointing from the panel, an
 * arrival is a URL asking once — same signal, same attribute, same accent.
 */
export const selectNode = (id: string): void => {
  setFocused(id)
}

/**
 * NOTHING is the row any more — the third state of the same signal, and a
 * state a CARET can be in.
 *
 * A line that is not yet a row is a place the reader is typing in: a ghost
 * under the row it will follow, or a page's first line. There is no row to
 * light up for it — the line draws its own chrome (`./edit/NewRow.tsx`) — and
 * saying so is what this call is for.
 *
 * It was missing, and the ring simply STAYED on whatever row was last
 * selected: a person typing a new line watched two lines claim to be the one,
 * and the row above lost its ring the moment the new row appeared — at the
 * landing, which is the one moment this whole arrangement exists to keep
 * still (`./Tree.tsx`'s `onFocusIn` claimed the row the ghost is drawn in
 * before it learnt to ignore one; nothing replaced it after that).
 *
 * `clearFocus` below is the other reader of the same signal and is NOT this:
 * it abandons a scroll that has not happened yet, and a caret arriving in a
 * line has nothing to abandon.
 */
export const clearNode = (): void => {
  setFocused(null)
}

/** The row the last point or landing selected, WITHIN one root — the whole
 *  DOM for a press, one pane for a landing, so a file opened in two columns
 *  scrolls the one the landing belongs to. It is found rather than computed,
 *  which is why `focusNode` below looks after the frame that draws the
 *  attribute: a mirror of the node wears it too, and either will do.
 *
 *  The ROW, named as such: a focused pane used to wear this same attribute
 *  and sat above every row, so a bare `[data-focused]` always found the pane
 *  and never walked a collapsed node to its own address. Panes now wear
 *  `data-pane-focused`. The selector still names the row so that fact cannot
 *  sit in front of this one again. */


/** THE SCROLL this vocabulary owns — one statement, both callers: a press
 *  aims it at the focused row of the whole DOM (through the helper below);
 *  the outline's landing aims it at the row IT owes, found by its own
 *  placement and never at the accent: one signal for the whole app, so it
 *  may very well be answering the other pane's landing (`./OutlinePage.tsx`).
 *  Exported rather than written twice, because it is ONE entry in the count
 *  this module's header keeps.
 *
 *  `center` rather than the top: a row scrolled to the very top of the
 *  window has its children off the bottom of it, and what a person wants to
 *  see about the node they were just told about is what hangs under it. */
export const bringOntoScreen = (row: Element): void => {
  row.scrollIntoView({ block: "center", behavior: "smooth" })
}

/** Select only a visible row in the requested pane. Navigation chooses the
 * pane; this content owner owns its row registry and the scrolling act. */
export const revealNode = (pane: string, id: string): boolean => {
  const row = rowElements.read()?.find(pane, id, "shown")
  if (!row) return false
  selectNode(id)
  bringOntoScreen(row)
  return true
}
export const nodeHome = async (id: string): Promise<string | undefined> => {
  const outcome = await runAsync(client().procedures.nodes.homes({ ids: [id], files: [] }))
  return Result.isSuccess(outcome) ? outcome.success.homes.find(one => one.id === id)?.file : undefined
}
export const useShowNode = (): ((id: string) => void) => {
  const go = useGo()
  return id => go(atNode(id))
}
export const clearFocus = (): void => { setFocused(null) }
