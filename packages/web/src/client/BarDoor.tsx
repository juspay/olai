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
 *
 * ## What it does NOT own
 *
 * WHY EACH DOOR EXISTS, and where it sits in the cluster. Both callers keep
 * their own headers, because the argument for spending a seat in a bar this app
 * does not hand out lightly is genuinely per-door — and `AppHeader.tsx` places
 * them, because a door does not choose its seat.
 */

import { type JSX, Show } from "solid-js"
import { Portal } from "solid-js/web"

import type { Anchor } from "./anchor.ts"
import { ENTRY_SHAPE, ROW_GAP } from "./layout/entry.ts"
import { createPopover } from "./popover.ts"
import { ICON_BUTTON } from "./readout.ts"

export function BarDoor(props: {
  /** `closet` is the phone drawer row. Default is the header chip. */
  readonly where?: "header" | "closet"
  /** One character, drawn `aria-hidden` — the word beside it is the name. */
  readonly glyph: string
  /** The word in the BAR, where space is what it is. */
  readonly header: string
  /** ...and the word in the phone DRAWER, which is a column of rows and can
   *  afford the longer one. Two props rather than one because `prefs` and
   *  `preferences` are the same door said in two widths, and a door whose two
   *  widths happen to agree passes the same string twice. */
  readonly closet: string
  /** The hover sentence: what is behind this door, in the words a person who
   *  has not opened it yet would use. */
  readonly title: string
  readonly testid: string
  /** What opens. A FUNCTION rather than an element, because the panel must be
   *  created inside the `Show` — built eagerly it would exist (and subscribe)
   *  while the door is shut. */
  readonly panel: (at: Anchor, inside: (el: HTMLElement | undefined) => void) => JSX.Element
}) {
  // Whether it is up, where it goes, and the three ways it shuts —
  // `./popover.ts`, shared with the Commit panel along the bar.
  const popover = createPopover()
  const open = popover.open
  const closet = () => props.where === "closet"

  return (
    <>
      <button
        type="button"
        ref={popover.setTrigger}
        class={
          closet()
            ? `${ENTRY_SHAPE} ${ROW_GAP} w-full text-paper/80`
            : `${ICON_BUTTON} border ${
              open() ? "border-accent text-paper" : "border-paper/25"
            }`
        }
        data-testid={props.testid}
        aria-expanded={open()}
        aria-haspopup="true"
        title={props.title}
        onClick={() => popover.toggle()}
      >
        <span aria-hidden="true">{props.glyph}</span>
        <span class={closet() ? undefined : "sr-only sm:not-sr-only"}>
          {closet() ? props.closet : props.header}
        </span>
      </button>
      {/* Out of the bar entirely — see this file's header. */}
      <Show when={open() ? popover.at() : null}>
        {(at) => <Portal>{props.panel(at(), popover.setPanel)}</Portal>}
      </Show>
    </>
  )
}
