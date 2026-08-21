/**
 * EDITING one node's edges, as one thing a host can hold: which panel is open,
 * the writes both doors send, and the line that says what came of them.
 *
 * Two surfaces edit edges — a tree row, from its `•••` menu, and a zoomed
 * node's page, which has no `•••` at all — and each of them has TWO doors onto
 * the same op: the panel's search, and the `×` on a reference already drawn
 * beside it. Four call sites, one write. Without this they would be four copies
 * of "send it, keep the answer, put the answer somewhere", and the copy that
 * forgot the last clause would be a refusal nobody sees — which HACKING.md
 * forbids by name and which this client has already been bitten by.
 *
 * The shape is `../complete/completing.tsx`'s: a hook that hands back the
 * verbs a host calls and ONE component to draw, rather than the four accessors
 * a host would otherwise have to wire itself. What the host still owns is
 * WHERE that component sits — under the row, under the heading — which is the
 * one thing the two genuinely differ about.
 *
 * ONE WRITE AT A TIME, for the reason the date picker and the palette both
 * hold: the gate is a round trip, and a second press while the first is out is
 * two writes for one intention. The guard lives here rather than in the panel
 * because a `×` outside the panel is the same intention.
 *
 * NOTHING IS ECHOED. A reference appears, and a row's dim lifts, when the file
 * says so — the panel below is redrawn from the same snapshot every other
 * reader is drawn from, so what it lists after a write is what landed.
 */

import type { RegularNode } from "@olai/format"
import type { Edit } from "@olai/surface"
import { type Accessor, createSignal, type JSX, Show } from "solid-js"

import { SaidLine } from "../SaidLine.tsx"
import { useUndo } from "../edit/undoing.ts"
import { createSaying } from "../saying.ts"
import { TESTID } from "../testids.ts"
import { applying } from "../writes.ts"
import { EdgePanel } from "./EdgePanel.tsx"
import { type Relation, unlinking } from "./relation.ts"

export interface EdgeEditing {
  /** Open the panel for one relation — the `•••` menu's two verbs, and the
   *  zoomed page's own buttons. */
  readonly open: (relation: Relation) => void
  /** Which one is open, or `null` — read by a host that draws its own opener
   *  and wants to say which is live. */
  readonly openFor: Accessor<Relation | null>
  /**
   * WHETHER {@link Panel} would draw anything at all, asked once.
   *
   * `../complete/completing.tsx`'s rule, for its reason: the host that wraps
   * this in a box of its own and the fragment's own `<Show>`s are the same
   * question, and two formulas for it are two chances to draw an empty box —
   * which is exactly the failure a tree row would show, once per row, on every
   * frame. A row asks this so it lays out nothing while nothing is open.
   */
  readonly showing: Accessor<boolean>
  /** Drop one target: the `×` on a drawn reference (`../NodeRefs.tsx`), which
   *  is the same op the panel's own `×` sends. */
  readonly drop: (relation: Relation, target: string) => void
  /** The panel, when one is open, and whatever the last write had to say —
   *  drawn together, wherever the host puts them. */
  readonly Panel: () => JSX.Element
}

export const createEdgeEditing = (
  /** The node being edited — the node a row SHOWS, and `undefined` on a frame
   *  that draws none (a placement whose chain died). An accessor because a live
   *  page redraws it under the panel. */
  node: Accessor<RegularNode | undefined>,
): EdgeEditing => {
  const undo = useUndo()
  const [openFor, setOpenFor] = createSignal<Relation | null>(null)
  /** How long the line lingers, and what clears it, is the client's ONE
   *  receptacle for that (`../saying.ts`) rather than a fourth timer here. */
  const saying = createSaying()
  const [sending, setSending] = createSignal(false)

  const write = (edit: Edit): void => {
    if (sending()) return
    setSending(true)
    // Cleared BEFORE the attempt rather than after it, which is the menu's own
    // rule: a write that takes a moment would otherwise sit under the last
    // one's sentence, and that reads as this one's answer.
    saying.say(null)
    void applying(edit, undo.record)
      .then(saying.say)
      .finally(() => setSending(false))
  }

  return {
    openFor,
    showing: () => openFor() !== null || saying.said() !== null,
    open: (relation) => {
      // A stale sentence about the LAST write, hanging over a panel somebody
      // has just opened to make another one, is a sentence about nothing they
      // can see.
      saying.say(null)
      setOpenFor(relation)
    },
    drop: (relation, target) => {
      const at = node()
      if (at === undefined) return
      write(unlinking(at.id, relation, target))
    },
    Panel: () => (
      <>
        {/* NESTED rather than one `<Show>` over a pair, because the panel needs
            both and each is separately absent: a relation nobody opened, and a
            row drawing no node. Read out of the two `<Show>`s they are values
            rather than a `null` narrowed by hand — one condition asked and the
            other cast is exactly the illegal state a cast promises away. */}
        <Show when={openFor()}>
          {(relation) => (
            <Show when={node()}>
              {(at) => (
                <EdgePanel
                  node={at()}
                  relation={relation()}
                  onWrite={write}
                  onClose={() => setOpenFor(null)}
                />
              )}
            </Show>
          )}
        </Show>
        <Show when={saying.said()}>
          {(message) => (
            // The mood, its `data-tone` and whether a screen reader is
            // interrupted are `../SaidLine.tsx`'s, for every surface that
            // says something about a write; what is this one's is where the
            // line sits — under the panel, and under the refs when the panel is
            // shut, which is where the `×` that caused it was pressed.
            <SaidLine
              said={message()}
              class="mt-1 mb-0 text-[0.8125rem] leading-snug"
              testid={TESTID.edgeSaid}
            />
          )}
        </Show>
      </>
    ),
  }
}
