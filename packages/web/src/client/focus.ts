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
 * it near an edge.
 */

import { type Accessor, createSignal } from "solid-js"

import { useRouter } from "./router.tsx"
import { TESTID } from "./testids.ts"

const [focused, setFocused] = createSignal<string | null>(null)

/** The node being pointed at, or `null`. Read by every row of the tree
 *  (`./Tree.tsx`), which is why it is one signal and not a store. */
export const focusedNode: Accessor<string | null> = focused

/** The attribute a focused row carries — a FACT in the markup rather than a
 *  colour, so a scenario asking "which row is being pointed at" is not asking
 *  about a class name (`./Tree.tsx` writes it). It is also what the scroll
 *  below aims at: the row that wears it is the row to bring on screen,
 *  wherever in the tree it turned out to be, and a mirror of the node wears it
 *  too. */
const FOCUSED = "data-focused"

/**
 * Point at `id`: light the row up, and bring it onto the screen.
 *
 * `elsewhere` is called when the node is not drawn on this page at all — a node
 * in another outline, one inside a collapsed branch, one hidden by
 * done-hidden. It is a parameter rather than a route this module knows, because
 * a route change belongs to the router; it is not exported, because there is
 * exactly one answer to it and that answer is the hook below.
 *
 * The look happens after the frame that draws the attribute: the row does not
 * wear it yet when this returns, and asking the DOM before then would find
 * nothing and navigate away from a node that is right there.
 */
const focusNode = (id: string, elsewhere: () => void): void => {
  setFocused(id)
  requestAnimationFrame(() => {
    // The ROW, named as such. A focused pane used to wear this same
    // attribute and sat above every row, so a bare `[data-focused]`
    // always found the pane and never walked a collapsed node to its
    // own address. Panes now wear `data-pane-focused`. The selector
    // still names the row so that fact cannot sit in front of this one
    // again.
    const row = document.querySelector(
      `[data-testid="${TESTID.node}"][${FOCUSED}="true"]`,
    )
    if (row === null) {
      elsewhere()
      return
    }
    // `center` rather than the top: a row scrolled to the very top of the
    // window has its children off the bottom of it, and what a person wants to
    // see about the node they were just told about is what hangs under it.
    row.scrollIntoView({ block: "center", behavior: "smooth" })
  })
}

/**
 * What pressing a reference DOES — the whole of this module's surface, and
 * decided once.
 *
 * Every reference in the panel is either a button this app authored
 * ({@link ./chat/Reference.tsx}) or an id inside rendered markdown that a
 * listener on the pane catches ({@link ./chat/Transcript.tsx}), and two places
 * writing the same "and if it is not on this page?" is one place for the two to
 * start disagreeing about what a press means.
 */
export const useShowNode = (): ((id: string) => void) => {
  const router = useRouter()
  return (id) => focusNode(id, () => router.go({ kind: "node", id }))
}
