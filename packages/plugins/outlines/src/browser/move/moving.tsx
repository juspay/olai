import { TESTID } from "olai-plugin-outlines/testids"
/**
 * MOVING one row to a new parent, as one thing a page holds: which row's picker
 * is open, where that row is drawn now, the write it sends, and the line that
 * says what came of it.
 *
 * `../edges/editing.tsx`'s shape — a hook that hands back the verbs a host
 * calls and ONE component to draw — with one difference that is the whole
 * reason this is a page-level primitive rather than a row-level one: the row
 * MOVES. Two things follow.
 *
 * **The key comes from the page and the panel is drawn in a row.** ⌘⇧M is
 * pressed in the row editor, which is the page's one caret (`../edit/
 * editing.tsx`), and the panel hangs under the row that caret was in. Those are
 * two components with no path between them, so the fact they share — which row
 * is being moved — is held here, exactly as the multi-selection the same three
 * keys hand off to is (`../select/selection.ts`). The `•••` menu's `Move to…`
 * is the second door onto the same call.
 *
 * **The panel FOLLOWS its row.** A place is a chain of ids, so the moment the
 * write lands the row's `Row.key` is a different string — and a panel keyed on
 * the old one would vanish, taking the ops layer's `nudge` with it exactly when
 * it has something to say (a subtree of unfinished work landing under a branch
 * somebody ticked off re-opens that branch, and the person who moved it is who
 * that sentence is for). So the row is followed by its RECORD through
 * `../edit/order.ts`'s `refound` — the rule that keeps the caret and a pick in
 * place across a server-authoritative redraw, and this is its third consumer.
 *
 * ONE WRITE AT A TIME, for the reason every other panel in this client holds
 * one: the gate is a round trip, and a second `Enter` while the first is out is
 * two writes for one intention.
 *
 * NOTHING IS ECHOED. The row moves when the file says it moved — the panel
 * below is redrawn from the same snapshot every other reader is drawn from, and
 * a refusal leaves the row exactly where it was with the reason under it.
 */

import { createContext, type JSX, Show, useContext } from "solid-js"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { MovePicker } from "./MovePicker.tsx"
import { createMoving as createGesture } from "./gesture.ts"
export type { Standing } from "./gesture.ts"

export interface Moving {
  /**
   * Open the picker on a row — ⌘⇧M in its editor, and the `•••` menu's
   * `Move to…`.
   *
   * The two facts it takes are the two a `Row` would have been asked for, and
   * they are taken as themselves for `../search/place.ts`'s reason: one of the
   * two doors has no `Row` at all. `⌘⇧M` is answered by the editor, which holds
   * a DRAFT — the record being typed in and where it is drawn — and a signature
   * spelled `Row` would have made it go looking for the row again in the tree it
   * had just left.
   *
   * `record` is the row's OWN, so a mirror moves as the placement it is and the
   * node it stands for stays where it lives.
   */
  readonly open: (at: { readonly record: string; readonly place: string }) => void
  /**
   * Is there anything for this row to draw — the picker, or the sentence a
   * write left standing under it?
   *
   * ONE question rather than two, which is `../edges/editing.tsx`'s rule and
   * matters most here: a row asks it on every frame, and a host that formed the
   * condition for itself would be a second formula for "is there a panel" —
   * free to lay out an empty box under every row in the outline.
   */
  readonly showing: (key: string) => boolean
  /** The panel and whatever its write had to say, drawn together wherever the
   *  host puts them. */
  readonly Panel: () => JSX.Element
}

const MovingContext = createContext<Moving>()

/** The page's move picker. A throw outside the provider, for the reason
 *  `useSelection` throws: a row drawn outside an editable page has no picker to
 *  open, rather than one that does nothing. */
export const useMoving = (): Moving => {
  const moving = useContext(MovingContext)
  if (moving === undefined) throw new Error("a move picker outside <Editable>")
  return moving
}

export const MovingProvider = MovingContext.Provider

/** The picker is a view of the page-owned gesture, not its lifetime owner. */
export const createMoving = (...args: Parameters<typeof createGesture>): Moving => {
  const { open, showing, standing, moved, refusals, saying, query, aim, write, close } = createGesture(...args)
  return {
    open,
    showing,
    Panel: () => (
      <>
        {/* NESTED rather than one `<Show>` over a pair, which is the edge
            panel's own arrangement and for its reason: the picker needs both
            and each is separately absent — a panel nobody opened, and a row
            whose record has left the set. */}
        <Show when={standing()?.kind === "picking"}>
          <Show when={moved()}>
            {(at) => (
              <MovePicker
                moved={at()}
                query={query}
                refusals={refusals()}
                // The accessor, held as a VALUE — Solid reads a function passed
                // to a setter as an updater, so a signal whose value is a
                // function is set through one that answers with it.
                onAimed={aim}
                onWrite={write}
                onClose={close}
              />
            )}
          </Show>
        </Show>
        <Show when={saying.said()}>
          {(message) => (
            // The mood, its `data-tone` and whether a screen reader is
            // interrupted are `../SaidLine.tsx`'s, for every surface that
            // says something about a write; what is this one's is where the
            // line sits — under the row that moved, which for a refusal is the
            // row that did not.
            <SaidLine
              said={message()}
              class="mt-1 mb-0 text-[0.8125rem] leading-snug"
              testid={TESTID.moveSaid}
            />
          )}
        </Show>
      </>
    ),
  }
}
