/**
 * One preference: what it is called, the control that sets it, and what the
 * choice in force MEANS.
 *
 * The third part is the one worth arguing for. A row of switches with tidy
 * labels is a quiz — "Done: Hidden" says what the control is set to and nothing
 * about what the app will now do — so every row carries a line under it that is
 * read off the CURRENT choice rather than describing the switch in general.
 * That is the shape kolu's settings popover uses, and it is adopted here for
 * the reason it works there: the sentence changes when you press the control,
 * so the panel answers "what did I just do" in the same gesture.
 *
 * The label is the hero and the hint recedes, because attention belongs on the
 * control. Nothing here is hover-only and nothing is a colour alone.
 */

import type { JSX } from "solid-js"

import { TESTID } from "../testids.ts"

export function Row(props: {
  /** What this preference is called, and the accessible name of the group of
   *  controls beside it — the buttons are a set, and a set with no name is a
   *  screen reader announcing three verbs in a row. */
  readonly label: string
  /** What the choice in force means, in this app's own words. Reactive: it is
   *  read again whenever the control moves. */
  readonly hint: string
  /** Which preference this is, for a scenario that has to find one row. */
  readonly pref: string
  readonly children: JSX.Element
}) {
  return (
    <div data-testid={TESTID.prefsRow} data-pref={props.pref}>
      {/* Wraps rather than clips: the theme row's control is fifteen chips, and
          a panel narrow enough to be a phone's has to put them under the label
          instead of off the edge. */}
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span class="text-sm text-ink">{props.label}</span>
        <div
          class="flex min-w-0 flex-wrap items-center gap-1"
          role="group"
          aria-label={props.label}
        >
          {props.children}
        </div>
      </div>
      <p class="mt-1.5 text-xs leading-relaxed text-muted" data-testid={TESTID.prefsHint}>
        {props.hint}
      </p>
    </div>
  )
}
