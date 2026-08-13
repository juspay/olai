/**
 * What this browser is set to, in one place.
 *
 * Everything on it is CLIENT-LOCAL and that is the panel's whole subject
 * (`docs/architecture.md`): a pick is stored in this browser, carried to the
 * other tabs of it by the `storage` event, and never sent — so two machines
 * reading the same outlines are entitled to disagree, and the served directory
 * neither knows nor cares. There is no wire here, no cell, and nothing to
 * commit. That is the deliberate difference from kolu's settings popover, whose
 * shape this adopts: its rows read and write wire singletons, because its
 * preferences are the server's.
 *
 * WHAT IS ON IT is a narrower question than "every client-local value", and the
 * answer is: the ones that are a CHOICE and have nowhere else to be made. The
 * theme, the typeface, and what a page does with finished work. The layout
 * values in `../layout/prefs.ts` are stored the same way and are deliberately
 * NOT here — a sidebar width is set by dragging the sidebar, and a panel
 * being open is set by the control that opens it. Copying them into a
 * settings list would be a second control for something that already has
 * one, which is the redundancy `one-git-indicator` was filed over.
 *
 * Every row is `./Row.tsx`: a label, a control, and a line under it read off
 * the choice in force.
 *
 * The folder is `settings/` and every word on screen is "preferences", and that
 * is deliberate rather than sloppy: `../preference.ts` beside it is the STORE —
 * what this browser remembers and how — and a folder named one letter away from
 * it would be two nearly identical names for two different things, which is
 * worse than two words for one. This is the surface; that is the mechanism.
 */

import { type Anchor, styleOf } from "../anchor.ts"
import { doneHiddenDefault, setDoneHiddenDefault } from "./done.ts"
import { Row } from "./Row.tsx"
import { Segmented } from "./Segmented.tsx"
import { TESTID } from "../testids.ts"
import { FontSelect } from "../theme/FontSelect.tsx"
import { currentTypeface } from "../theme/fontState.ts"
import { ThemeChips } from "../theme/Chips.tsx"
import { currentTheme } from "../theme/state.ts"

/** Done: Visible / Hidden — the same two words the per-view switch says
 *  (`../DoneToggle.tsx`), because they are the same switch with a different
 *  scope, and a preference that named the states differently would read as a
 *  different setting. */
const DONE_CHOICES = [
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
] as const

export function Panel(props: {
  /** Where to sit, in viewport pixels — see `../anchor.ts` for why this is not
   *  a matter of CSS alone. */
  readonly at: Anchor
  /** Register this surface with the click-away, since it is portalled and so is
   *  not a descendant of the control that opened it. */
  readonly inside: (el: HTMLElement | undefined) => void
}) {
  return (
    <section
      ref={props.inside}
      class="fixed z-50 flex flex-col gap-4 overflow-y-auto overflow-x-hidden rounded-lg border border-rule/70 bg-panel p-3 text-sm shadow-lg focus:outline-none"
      style={styleOf(props.at)}
      // Focusable, and never in the tab order: opening puts the caret here so a
      // keyboard is standing IN the panel rather than beside it (`../popover.ts`
      // says why a portal needs that), and Tab from here is the first control.
      // No ring on it, because it is a waypoint rather than a control — what
      // gets one is whatever the first Tab lands on.
      tabindex="-1"
      data-testid={TESTID.prefsPanel}
      aria-label="preferences"
    >
      <Row label="Theme" pref="theme" hint={themeHint()}>
        <ThemeChips />
      </Row>

      <Row label="Font" pref="font" hint={fontHint()}>
        <FontSelect />
      </Row>

      <Row label="Done" pref="done" hint={doneHint()}>
        <Segmented
          choices={DONE_CHOICES}
          value={doneHiddenDefault() ? "hidden" : "visible"}
          onPick={(value) => setDoneHiddenDefault(value === "hidden")}
        />
      </Row>

      {/* One sentence for the whole panel, because it is one fact about every
          row on it and repeating it per row would be three copies of the
          doctrine. It is here at all because "where did this go" is exactly
          what a person wonders about a setting they just changed. */}
      <p class="border-t border-rule pt-3 text-xs text-muted" data-testid={TESTID.prefsScope}>
        These are this browser's. They are stored here, reach every tab you have
        olai open in, and are never sent to the server.
      </p>
    </section>
  )
}

/** The theme row NAMES the theme in force, which is the promise the retired
 *  header pill carried (`../theme/Chips.tsx`): fifteen chips wearing fifteen
 *  palettes say which is which and not which is ON, and the ring that says so
 *  is a ring on a chip the size of a word. */
const themeHint = (): string =>
  `${currentTheme()} is in force. Every colour on the page is this one table, ` +
  `so a pick repaints all of them at once.`

const fontHint = (): string => currentTypeface().hint

const doneHint = (): string =>
  doneHiddenDefault()
    ? "Pages open with finished work hidden — a row not drawn, never a node " +
      "marked or a file written. Any page's own Done switch still overrides it."
    : "Pages open with finished work shown. Any page's own Done switch still " +
      "overrides it."
