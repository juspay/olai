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
 * this module's one statement, reached for directly
 * ({@link bringFocusedOntoScreen}).
 */

import { Result } from "effect"
import { type Accessor, createSignal } from "solid-js"

import { atElement, type Route } from "./routes.ts"
import { runAsync } from "./run.ts"
import { useRouter } from "./router.tsx"
import { TESTID } from "./testids.ts"
import { olai } from "./wire.ts"

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
const focusedRowIn = (root: ParentNode): Element | null =>
  root.querySelector(`[data-testid="${TESTID.node}"][${FOCUSED}="true"]`)

/** Bring the selected row onto the screen. `true` when there was a row to
 *  bring, which is the whole of what its callers differ on: a press that
 *  found none answers `elsewhere`; a landing that found none keeps its mark. */
export const bringFocusedOntoScreen = (root: ParentNode): boolean => {
  const row = focusedRowIn(root)
  if (row === null) return false
  // `center` rather than the top: a row scrolled to the very top of the
  // window has its children off the bottom of it, and what a person wants to
  // see about the node they were just told about is what hangs under it.
  row.scrollIntoView({ block: "center", behavior: "smooth" })
  return true
}

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
    if (!bringFocusedOntoScreen(document)) elsewhere()
  })
}

/** How many times the reader has pointed at a node. The press the page
 *  follows is the LATEST one, and the elsewhere half of `useShowNode` is a
 *  round trip: a reader who pressed a second reference while the first was
 *  still asking where its node lives must not be walked back to the first. */
let pointed = 0

/**
 * Where a reference goes when its node is NOT on the open page: the node's
 * own file, landed at the row (`./landing.ts` takes it from there).
 *
 * One question on the way (`nodes.homes`). The button says `show this
 * node`, and ZOOMING — `/#id`, where this used to go — showed the node by
 * leaving every page, which is the one reading the chat panel's references
 * were never about. The id is durable and the file is not, which is exactly
 * why the file is asked at press time rather than carried: the transcript's
 * hat on a node from an hour ago still lands where the node IS.
 *
 * ABSENT IS THE ANSWER, twice: an id the set has no record for is one the
 * press said nothing about, so the page stays exactly where it was — the
 * polite half of the ruled behaviour, and a blank zoom page's replacement.
 * A wire that cannot answer is a console line, no louder: the connection pill
 * is already saying so, which is `fold/refiling.ts`'s own ruling.
 */
const landOnRow = (go: (route: Route) => void, id: string, mine: number): void => {
  void runAsync(olai.procedures.nodes.homes({ ids: [id], files: [] })).then((outcome) => {
    if (mine !== pointed) return
    if (Result.isFailure(outcome)) {
      console.warn(
        "olai: could not ask where the pressed node lives, so the reference went nowhere —",
        outcome.failure.message,
      )
      return
    }
    const home = outcome.success.homes.find((one) => one.id === id)?.file
    if (home === undefined) return
    go(atElement(home, id))
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
 *
 * What it means, one sentence each arm: on the open page, the row is SELECTED
 * — this file's whole fact — and off it, the reader is taken to the node's own
 * file, LANDED at the row ({@link landOnRow}). The zoom page (`/#id`) is
 * where it used to land, and that address still means zoom — it is the
 * permalink a pin or an outside hand spells; a reference is not one.
 */
export const useShowNode = (): ((id: string) => void) => {
  const router = useRouter()
  return (id) => {
    const mine = ++pointed
    focusNode(id, () => landOnRow(router.go, id, mine))
  }
}
