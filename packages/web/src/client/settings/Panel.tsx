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
 * theme, the typeface, how much of a row is drawn by default, what this
 * browser does with finished work, and whether a commit from here is pushed.
 * The DENSITY belongs here for exactly the reason the done preference does: it
 * is a claim about the reader ("I read a tree as a list of titles") rather than
 * about any one outline, so a switch bolted to the outline page would be a
 * per-page control for a per-person fact — and would have to be drawn on the
 * zoomed page and the day page too. Git's Auto-push is the same kind of claim
 * ("I want a commit I make here to be sent"), so it is a row rather than a
 * switch on the Commit panel. The layout values in `../layout/prefs.ts` are
 * stored the same way and are deliberately NOT here — a sidebar width is set
 * by dragging the sidebar, and a panel being open is set by the control that
 * opens it. Copying them into a settings list would be a second control for
 * something that already has one, which is the redundancy `one-git-indicator`
 * was filed over.
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
import { LAYER } from "../layer.ts"
import { autoPush, setAutoPush } from "./autopush.ts"
import { density, type Density, setDensity } from "./density.ts"
import { doneHidden, setDoneHidden } from "./done.ts"
import { Row } from "./Row.tsx"
import { Segmented } from "./Segmented.tsx"
import { TESTID } from "../testids.ts"
import { FontSelect } from "../theme/FontSelect.tsx"
import { currentTypeface } from "../theme/fontState.ts"
import { currentSize, currentTypeSize, pickSize } from "../theme/sizeState.ts"
import { SIZES, type SizeName, sizeNamed } from "../theme/sizes.ts"
import { ThemeChips } from "../theme/Chips.tsx"
import { currentTheme } from "../theme/state.ts"

/** Done: Visible / Hidden — the two words the retired outline pill said, kept
 *  because they are the same setting in the one home it now has. */
const DONE_CHOICES = [
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
] as const

/** Size: the strip is the size TABLE, read (../theme/sizes.ts) — three sizes
 *  that must not be spelled twice, since the sheet's blocks are generated from
 *  the same rows. */
const SIZE_CHOICES: ReadonlyArray<{ value: SizeName; label: string }> = SIZES
  .map((size) => ({ value: size.name, label: size.label }))

/** Notes: how much of a row this browser draws by default (./density.ts). The
 *  words are the three the design names, in the order they open up. */
const DENSITY_CHOICES: ReadonlyArray<{ value: Density; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "cozy", label: "Cozy" },
  { value: "open", label: "Open" },
]

/** Git: Off / Auto-push — today's wait, or a commit from this browser is
 *  followed by the same push the panel already offers. */
const GIT_CHOICES = [
  { value: "off", label: "Off" },
  { value: "on", label: "Auto-push" },
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
      class={`fixed ${LAYER.over} flex flex-col gap-4 overflow-y-auto overflow-x-hidden rounded-2xl border-0 bg-panel p-4 text-sm shadow-xl ring-1 ring-rule/40 focus:outline-none`}
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

      {/* Under Font, because it is the other half of "how this page is set" —
          and a segmented strip rather than a select, because three sizes are
          three, and the whole page moves under the press so a reader judges it
          by looking rather than by reading the option. */}
      <Row label="Size" pref="size" hint={currentTypeSize().hint}>
        <Segmented
          choices={SIZE_CHOICES}
          value={currentSize()}
          onPick={(name) => {
            const size = sizeNamed(name)
            if (size !== undefined) pickSize(size)
          }}
        />
      </Row>

      <Row label="Notes" pref="density" hint={densityHint()}>
        <Segmented
          choices={DENSITY_CHOICES}
          value={density()}
          onPick={setDensity}
        />
      </Row>

      <Row label="Done" pref="done" hint={doneHint()}>
        <Segmented
          choices={DONE_CHOICES}
          value={doneHidden() ? "hidden" : "visible"}
          onPick={(value) => setDoneHidden(value === "hidden")}
        />
      </Row>

      <Row label="Git" pref="git" hint={gitHint()}>
        <Segmented
          choices={GIT_CHOICES}
          value={autoPush() ? "on" : "off"}
          onPick={(value) => setAutoPush(value === "on")}
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
 *  header pill carried (`../theme/Chips.tsx`): chips wearing their palettes
 *  say which is which and not which is ON, and the ring that says so
 *  is a ring on a chip the size of a word. */
const themeHint = (): string =>
  `${currentTheme()} is in force. Every colour on the page is this one table, ` +
  `so a pick repaints all of them at once.`

const fontHint = (): string => currentTypeface().hint

/** What the density in force MEANS — the row's own promise (./Row.tsx): a
 *  sentence read off the choice rather than a label describing the switch. Each
 *  one ends by saying the fold is still there, because "Compact" reads as
 *  "olai is hiding my notes" until somebody says what opens them. */
const densityHint = (): string => {
  switch (density()) {
    case "compact":
      return "A row is its title. A node with a note says so with a ¶ beside " +
        "it — press that, or Space with it focused, to open the row."
    case "cozy":
      return "A row is its title and the first line of its note, clamped — " +
        "the shape every row had before this switch existed. The ¶ opens the " +
        "rest, with the node's properties."
    case "open":
      return "Every note you have not folded yourself is already open: the " +
        "node's properties, then the note in full. The ¶ folds one back."
  }
}

const doneHint = (): string =>
  doneHidden()
    ? "Finished work is hidden — a row not drawn, never a node marked or a " +
      "file written."
    : "Finished work is shown."

const gitHint = (): string =>
  autoPush()
    ? "A commit from this browser is pushed after it is recorded."
    : "A commit from here waits. Push it from the panel."
