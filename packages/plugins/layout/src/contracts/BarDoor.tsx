/**
 * A DOOR IN THE BAR: a chip that opens a portalled panel, and the same door as
 * a row at the foot of the phone drawer.
 *
 * ## Why this exists as one component
 *
 * Because there are two of them and they were written twice. `Preferences` was
 * the canonical one for the life of the feature; `Plugins` arrived on this
 * branch as a copy with four strings changed — the same `where` prop, the same
 * popover, the same class ternary character for character, the same
 * `aria-expanded`/`aria-haspopup`, the same `sr-only sm:not-sr-only` label
 * span, the same portalled `Show`. Mounted in the same two places, in the same
 * order, in both files.
 *
 * That the two panels answer different questions is exactly the argument for
 * two DOORS, and no argument at all for two implementations of a door. What is
 * per-door is the glyph, the words, the testid, the sentence a hover gets, and
 * what the panel IS. Everything else is what a door in this bar is, and this is
 * that.
 *
 * ## What it owns, and each of these fails silently on its own
 *
 *   - THE TWO SHAPES. Header: the bar's icon-button (`./readout.ts`), which the
 *     agent toggle beside it wears too. Closet: a directory row, because on a
 *     phone it is a row of that column rather than a chip that escaped the bar.
 *   - THE OPEN BORDER, which is the only state this button draws — and it is
 *     the trigger's own news rather than the icon-button shape's, which is why
 *     `ICON_BUTTON` deliberately carries no border colour.
 *   - THE PORTAL. The bar is `sticky` with a z-index, so it is a stacking
 *     context and a 3rem-tall box: a panel drawn inside it is clipped and mis-
 *     layered. Every panel in this app is portalled out and positioned against
 *     the VIEWPORT (`./anchor.ts`), and a door that forgot would look right on
 *     the reviewer's screen and wrong on a short one.
 *   - THE FOCUS CYCLE. Dismissal is a pointer outside, Escape, or the trigger
 *     again, and the two a keyboard can reach put focus BACK on the trigger —
 *     otherwise somebody who opened this, tabbed in and pressed Escape lands on
 *     `<body>`. That is `./popover.ts`, shared with the Commit panel, and this
 *     is the third consumer of it rather than a third implementation.
 *   - WHERE THE OPEN STATE LIVES, which is a per-door answer and is the one
 *     thing a caller may override ({@link BarDoor.held}). One door in this app
 *     holds a control that rebuilds the tree it is drawn in, so its own state
 *     has to sit above that rebuild; the rest keep theirs here and forget it on
 *     a reload, which is right for them. `./plugins/opened.ts` carries the
 *     argument.
 *
 * ## What it does NOT own
 *
 * WHY EACH DOOR EXISTS, and where it sits in the cluster. Both callers keep
 * their own headers, because the argument for spending a seat in a bar this app
 * does not hand out lightly is genuinely per-door — and `AppHeader.tsx` places
 * them, because a door does not choose its seat.
 *
 * ## The health seat
 *
 * A `health` door is MOUNTED beside the bar's health dot, not inside the
 * popover the dot opens: only its ROW goes into that popover's foot, portalled
 * there while the popover is drawn ({@link HealthSeat}, which `../Health.tsx`
 * provides). So its panel needs nothing of the popover — picking the row shuts
 * the popover and opens the panel, anchored to the dot, and a panel whose open
 * state is {@link BarDoor.held} is drawn again by the door that is always
 * standing when the shell is rebuilt.
 */

import { createContext, type JSX, Show, useContext } from "solid-js"
import { Portal } from "solid-js/web"

import type { Anchor } from "@olai/web/client/anchor.ts"
import type { ToolWhere } from "olai-plugin-layout/contract"
import { ENTRY_SHAPE, ROW_GAP } from "olai-plugin-layout/entry"
import { createPopover, type HeldOpen } from "@olai/web/client/popover.ts"
import { ICON_BUTTON, STATUS_ROW } from "@olai/web/client/readout.ts"

/** What the health dot lends a door in its seat: the dot (the panel's anchor,
 *  and where the caret goes back to), the popover's foot while it is drawn,
 *  and the gesture that shuts the popover. Layout's own wiring between two of
 *  its files — the dot provides it, a door in that seat reads it. */
export const HealthSeat = createContext<{
  readonly dot: () => HTMLElement | undefined
  readonly foot: () => HTMLElement | undefined
  readonly shut: () => void
}>()

export function BarDoor(props: {
  /** `closet` is the phone drawer row, `health` a row at the foot of the
   *  desktop health popover. Default is the header chip, which is the GLYPH
   *  alone: the word rides the accessible name and the tip. */
  readonly where?: ToolWhere
  /** One character, drawn `aria-hidden` — the word is the name. */
  readonly glyph: string
  /** The door's word: drawn beside the glyph on a row (the phone drawer, the
   *  health popover), and the accessible name of the glyph-only bar chip. The
   *  bar used to draw a short second word (`prefs`) beside the glyph; a calm
   *  bar draws the glyph and nothing else, so one word is enough. */
  readonly name: string
  /** The hover sentence: what is behind this door, in the words a person who
   *  has not opened it yet would use. */
  readonly title: string
  readonly testid: string
  /** What opens. A FUNCTION rather than an element, because the panel must be
   *  created inside the `Show` — built eagerly it would exist (and subscribe)
   *  while the door is shut. */
  readonly panel: (at: Anchor, inside: (el: HTMLElement | undefined) => void) => JSX.Element
  /** WHERE "IS IT UP" LIVES, for the one door whose own contents can rebuild
   *  the tree under it (`./plugins/opened.ts`). Absent on every other, and
   *  absent is a fresh signal disposed with this component — which is what a
   *  door in this bar has always been, and what makes a reload forget it. */
  readonly held?: HeldOpen
}) {
  // Whether it is up, where it goes, and the three ways it shuts —
  // `./popover.ts`, shared with the Commit panel along the bar.
  //
  // `held` READ ONCE rather than reactively: a door does not change which
  // state it is holding halfway through its life, and a popover rebuilt around
  // a new one would be the open state this prop exists to preserve, lost.
  const popover = createPopover(props.held === undefined ? {} : { held: props.held })
  const open = popover.open
  const closet = () => props.where === "closet"
  const health = () => props.where === "health"
  // In the health seat the panel hangs off the DOT, which is always standing,
  // rather than off a row that is only drawn while the popover is.
  const seat = health() ? useContext(HealthSeat) : undefined
  if (seat !== undefined) popover.setTrigger(seat.dot())

  const trigger = (
      <button
        type="button"
        ref={(el) => {
          if (seat === undefined) popover.setTrigger(el)
        }}
        class={
          closet()
            ? `${ENTRY_SHAPE} ${ROW_GAP} w-full text-paper/80`
            : health()
            ? `${STATUS_ROW} ${open() ? "bg-pill/60" : ""}`
            : `${ICON_BUTTON} size-8 !p-0 border ${
              open() ? "border-accent text-paper" : "border-paper/20"
            }`
        }
        data-testid={props.testid}
        aria-expanded={open()}
        aria-haspopup="true"
        title={props.title}
        onClick={() => {
          seat?.shut()
          popover.toggle()
        }}
      >
        <span aria-hidden="true" class={health() ? "inline-block w-2 text-center text-muted" : undefined}>{props.glyph}</span>
        <span class={closet() || health() ? undefined : "sr-only"}>
          {props.name}
        </span>
      </button>
  )

  return (
    <>
      {seat === undefined
        ? trigger
        // KEYED: each opening draws a fresh foot, and the row follows it there.
        : <Show when={seat.foot()} keyed>{(foot) => <Portal mount={foot}>{trigger}</Portal>}</Show>}
      {/* Out of the bar entirely — see this file's header. */}
      <Show when={open() ? popover.at() : null}>
        {(at) => <Portal>{props.panel(at(), popover.setPanel)}</Portal>}
      </Show>
    </>
  )
}
