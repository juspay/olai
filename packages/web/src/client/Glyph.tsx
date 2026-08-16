/**
 * ONE GLYPH COLUMN: what a node is, and the way into it, in a single cell.
 *
 * It used to be two — a filled bullet that linked to the node's page, and a
 * status box beside it — which meant every row in every tree spent two
 * fixed-width cells before its title to say one thing, and a phone spent 3.5rem
 * of a 390pt screen on them. They are one column now (the quiet outline,
 * human): the glyph IS the mark when the node carries one, the bullet when it
 * does not, and the hourglass when it cannot start yet. `./marks.tsx` draws each
 * face and argues the tones; this file is the cell, its link and its states.
 *
 * ONE PROMISE KEPT FROM THE BULLET: pressing it goes to `/n/<id>`, wherever the
 * node is drawn — a row in a tree, an entry on a day. That is now true of the
 * MARK as well, which is a widening worth naming and not a promise this app did
 * not already make: the blocked face was a link before this, for the same
 * reason, and the box stays display-only in the sense that mattered — what
 * WRITES a mark is `Ctrl+Enter` in the row's own editor and `Ctrl+Shift+Enter`
 * for the walk (`./edit/editing.tsx`), never a click here. A box with four
 * readings has no obvious click anyway.
 *
 * The link is on the RECORD's id, whatever that record turns out to show: a
 * mirror's id resolves through its chain to the same canonical page, so the two
 * spellings agree and nothing has to resolve anything here.
 *
 * THE TESTIDS ARE THE OLD CONTRACT, unchanged, because merging two columns is a
 * design decision and not a licence to move what the browser tests find things
 * by: the cell carries `zoom`, the marked glyph inside it carries `checkbox`
 * with its `data-status` / `data-face`, and a waiting one carries `blocked` with
 * the sentence naming what it waits on. A node with NO mark carries neither of
 * the inner two — which is still how a bullet is told from an unstarted task.
 */

import type { InTheWay, Status } from "@olai/format"
import { Show } from "solid-js"

import { blockedBy, BULLET_TONE, Face, FACE, faceOf } from "./marks.tsx"
import { Link } from "./router.tsx"
import { TESTID } from "./testids.ts"
import { Tip } from "./Tip.tsx"
import { CONTROL } from "./touch.ts"

export function Glyph(props: {
  readonly id: string
  /** The mark this place carries — absent for a plain bullet. */
  readonly status: Status | undefined
  /** What holds this node up, and empty when nothing does. */
  readonly blocked: ReadonlyArray<InTheWay>
  /** True when this row has children that are currently hidden. Workflowy's
   *  gray circular halo around the glyph. */
  readonly collapsed?: boolean
  /** True when this row is the one holding the caret. The glyph takes the
   *  accent — the second half of saying WHERE the caret is, beside the row's
   *  own tone (./Tree.tsx), because a blinking cursor at the end of a title is
   *  not something a reader finds in a dense tree. */
  readonly holding?: boolean
}) {
  const halo = () => props.collapsed === true
  const face = () => faceOf(props.status, props.blocked)
  const waiting = () => face() === "waiting"
  /** The ink the glyph is drawn in: the caret's accent beats everything, then
   *  the mark's own tone, then the page's ink for a bullet. */
  const tone = (): string => {
    if (props.holding === true) return "text-accent"
    const status = props.status
    return status === undefined ? BULLET_TONE : FACE[status].tone
  }

  // A COMPONENT rather than a value, because it is drawn in two places below
  // and a JSX value is one DOM node: bare, and wrapped in the tip that names
  // what a waiting row waits on. Each arm builds its own.
  const Cell = () => (
    <Link
      route={{ kind: "node", id: props.id }}
      // Sized from ./touch.ts, which is where the gutter's one exception to
      // the 44px rule is argued and where everything that moves with it lives.
      class={`${CONTROL} group/glyph relative select-none text-center no-underline ${tone()}`}
      testid={TESTID.zoom}
      title={props.status === undefined ? "zoom into this node" : FACE[props.status].hint}
      label={`zoom into ${props.id}`}
      // The halo is a FACT about the reading, not a colour: a scenario asks
      // for it the same way it asks for data-collapsed on the row.
      halo={halo()}
    >
      {/* Halo behind the glyph — always for collapsed; also on hover, so the
          one control that navigates has a Workflowy-style affordance. */}
      <span
        class="pointer-events-none absolute left-1/2 top-1/2 h-[0.95rem] w-[0.95rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-muted/55 bg-muted/15 group-hover/glyph:visible"
        classList={{ invisible: !halo() }}
        aria-hidden="true"
      />
      <Show
        when={props.status}
        fallback={
          <span class="relative group-hover/glyph:text-accent" aria-hidden="true">
            <Face face="bullet" />
          </span>
        }
      >
        {(status) => (
          <Show
            when={waiting()}
            fallback={
              <span
                class="relative"
                data-testid={TESTID.checkbox}
                data-status={status()}
                data-face={FACE[status()].face}
                aria-hidden="true"
              >
                <Face face={FACE[status()].face} />
              </span>
            }
          >
            {/* `role="img"` so the sentence below is a name the platform
                actually exposes — a bare span's `aria-label` is not. NOT
                `title`: the platform's tooltip is what `Tip` replaces, and two
                tooltips on one control is one of them written twice. */}
            <span
              class="relative"
              role="img"
              data-testid={TESTID.blocked}
              aria-label={blockedBy(props.blocked)}
            >
              {/* The mark is still the node's, so it stays in `data-status`
                  where a scenario reads it — the face is what is DRAWN, not a
                  fifth thing to be. */}
              <span
                data-status={status()}
                data-face="waiting"
                data-blocked-by={props.blocked.map((one) => one.at.node.id).join(" ")}
              >
                <Face face="waiting" />
              </span>
            </span>
          </Show>
        )}
      </Show>
    </Link>
  )

  // The tip is the pointer's half of the waiting sentence, and it wraps only
  // the face that has one to say.
  return (
    <Show when={waiting()} fallback={<Cell />}>
      <Tip text={blockedBy(props.blocked)}>
        <Cell />
      </Tip>
    </Show>
  )
}
