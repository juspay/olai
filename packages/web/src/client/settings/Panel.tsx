/**
 * What this browser is set to, in one place.
 *
 * Nearly everything on it is CLIENT-LOCAL and that is the panel's subject
 * (`docs/architecture.md`): a pick is stored in this browser, carried to the
 * other tabs of it by the `storage` event, and never sent — so two machines
 * reading the same outlines are entitled to disagree, and the served directory
 * neither knows nor cares. That is the deliberate difference from kolu's
 * settings popover, whose shape this adopts: its rows read and write wire
 * singletons, because its preferences are the server's.
 *
 * **The two GIT rows are the one exception, and only when an operator asks for
 * it** (`vault-level-settings`). Started with `--commit` or `--push`, the
 * server has stated a policy for everybody looking at this directory — in a
 * team deployment auto-push is not a thing one colleague's browser gets to
 * decide for the branch — and the pinned row is drawn in that state, read-only,
 * naming the flag that set it. Never hidden: a policy a reader cannot see is
 * one they cannot ask anybody about. Nothing is SENT even then; the pin arrives
 * on the git cell, which this panel READS and never writes, and what this
 * browser had stored is left exactly as it was for the day the flag goes away.
 * Theme, font, size, notes, done and hidden outlines are untouched by any of
 * it — those are personal view choices and there is nothing about them for a
 * server to have an opinion on.
 *
 * WHAT IS ON IT is a narrower question than "every client-local value", and the
 * answer is: the ones that are a CHOICE and have nowhere else to be made. The
 * theme, the typeface, how much of a row is drawn by default, what this
 * browser does with finished work, which files the directory column draws, and
 * the two git rows — whether what is waiting records itself, and whether a
 * commit from here is pushed.
 * The DENSITY belongs here for exactly the reason the done preference does: it
 * is a claim about the reader ("I read a tree as a list of titles") rather than
 * about any one outline, so a switch bolted to the outline page would be a
 * per-page control for a per-person fact — and would have to be drawn on the
 * zoomed page and the day page too. The two GIT rows are the same kind of claim
 * — "I do not want to press Commit", "I want a commit I make here to be sent" —
 * so they are rows here rather than switches on the Commit panel. TWO rows and
 * not one strip of three, because they are two independent facts: pushing a
 * commit you made by hand is the shipped case, and folding them into a single
 * Off / Auto-commit / both would take it away. HIDDEN OUTLINES is the one row
 * whose subject is the sidebar rather than a page, and it is here for the same test: "I want to
 * see the files olai made for itself" is a claim about the reader, and the
 * column it moves has no control of its own to hang it off. The layout values
 * in `../layout/prefs.ts` are
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

import { Show } from "solid-js"

import { type Anchor, styleOf } from "../anchor.ts"
import { LAYER } from "../layer.ts"
import { autoCommit, setAutoCommit } from "./autocommit.ts"
import { autoPush, setAutoPush } from "./autopush.ts"
import { autoPause } from "../commit/pause.ts"
import { density, type Density, setDensity } from "./density.ts"
import { doneHidden, setDoneHidden } from "./done.ts"
import { outlinesHidden, setOutlinesHidden } from "./hiddenOutlines.ts"
import { commitFrozen, commitSetBy, pushFrozen, pushSetBy } from "./pinned.ts"
import { QUIET_MS } from "../commit/flurry.ts"
import { Row } from "./Row.tsx"
import { Segmented } from "./Segmented.tsx"
import { TARGET } from "../touch.ts"
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

/** Hidden outlines: Hidden / Shown — the Done row's pair one subject over,
 *  and the same two words, because it is the same kind of claim: a list of
 *  rows, and whether some of them are on it. */
const HIDDEN_CHOICES = [
  { value: "hidden", label: "Hidden" },
  { value: "shown", label: "Shown" },
] as const

/** Git commit: Off / Auto-commit — today's wait for a press, or what is
 *  waiting records itself once the edits stop arriving. */
const COMMIT_CHOICES = [
  { value: "off", label: "Off" },
  { value: "on", label: "Auto-commit" },
] as const

/** Git push: Off / Auto-push — today's wait, or a commit from this browser is
 *  followed by the same push the panel already offers. */
const PUSH_CHOICES = [
  { value: "off", label: "Off" },
  { value: "on", label: "Auto-push" },
] as const

/** The quiet window in the words the hint says it in. Read off the rule
 *  (`../commit/flurry.ts`) rather than spelled again, so the sentence cannot
 *  promise a span the loop does not wait. */
const QUIET_SECONDS = Math.round(QUIET_MS / 1000)

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
      class={`fixed ${LAYER.over} flex min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border-0 bg-panel p-4 text-sm shadow-xl ring-1 ring-rule/40 focus:outline-none`}
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

      {/* Under Done, because it is the other "which rows are on the page"
          row — and the only row here whose subject is the DIRECTORY column
          rather than the outline, which is why its label says out loud which
          files it is about. */}
      <Row label="Hidden outlines" pref="hidden-outlines" hint={hiddenHint()}>
        <Segmented
          choices={HIDDEN_CHOICES}
          value={outlinesHidden() ? "hidden" : "shown"}
          onPick={(value) => setOutlinesHidden(value === "hidden")}
        />
      </Row>

      {/* The two git rows, in the order the two verbs happen in — and the two
          the server is allowed to have pinned (`./pinned.ts`). */}
      <Row
        label="Git commit"
        pref="git-commit"
        hint={commitHint()}
        setBy={commitSetBy()}
        under={
          /* THE ONE GESTURE THAT STARTS THE LOOP AGAIN when this row is frozen.
             A refused commit or push stops Auto-commit and nothing clears that
             on olai's own initiative (`../commit/auto.ts`); where the row is
             this browser's, turning it off and on again is what a person does.
             A pinned row has no toggle to flip, so the stop would be permanent
             and silent — which is the one failure a loop nobody watches may
             not have.

             Drawn ONLY while it is frozen AND stopped: a button offering to
             resume a loop that is running is a control with nothing to do, and
             on a live row there is already a gesture. */
          <Show when={commitFrozen() && autoPause.said() !== null}>
            <button
              type="button"
              class={`${TARGET} rounded-full border border-rule px-3 text-xs text-ink hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-h-0 md:py-1`}
              data-testid={TESTID.prefsResume}
              onClick={() => autoPause.resume()}
            >
              Resume auto-commit
            </button>
          </Show>
        }
      >
        <Segmented
          choices={COMMIT_CHOICES}
          value={autoCommit() ? "on" : "off"}
          onPick={(value) => setAutoCommit(value === "on")}
          frozen={commitFrozen()}
        />
      </Row>

      <Row
        label="Git push"
        pref="git-push"
        hint={pushHint()}
        setBy={pushSetBy()}
      >
        <Segmented
          choices={PUSH_CHOICES}
          value={autoPush() ? "on" : "off"}
          onPick={(value) => setAutoPush(value === "on")}
          frozen={pushFrozen()}
        />
      </Row>

      {/* One sentence for the whole panel, because it is one fact about every
          row on it and repeating it per row would be three copies of the
          doctrine. It is here at all because "where did this go" is exactly
          what a person wonders about a setting they just changed.

          The pinned rows are named as the exception rather than left to
          contradict it, and only when there IS one: on the ordinary serve this
          sentence is exactly as true as it ever was, and a caveat about a
          feature nobody is using is a caveat that teaches a reader to stop
          believing the sentence. */}
      <p class="border-t border-rule pt-3 text-xs text-muted" data-testid={TESTID.prefsScope}>
        These are this browser's. They are stored here, reach every tab you have
        olai open in, and are never sent to the server.
        <Show when={commitFrozen() || pushFrozen()}>
          {" "}
          The git rows are the exception: this server was started with a git
          policy, so those are its answer for everybody and not yours.
        </Show>
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

/** What the choice in force means for the column — and, either way, the half
 *  that does NOT move: these files are in the set whichever way this row is
 *  set, so nobody is told a switch took something away from search or from an
 *  agent. The trash is named in both sentences because it is the one file
 *  under `_olai/` this row does not reach. */
const hiddenHint = (): string =>
  outlinesHidden()
    ? "Outlines olai names for itself — under _olai/ — are left out of the " +
      "file tree; the shelf, the Inbox beside Agenda, and the Trash below " +
      "are their doors. They stay in the directory: search and agents read " +
      "them unchanged."
    : "The file tree draws _olai/ too, so the shelf and the Inbox open as " +
      "outlines like any other file. The trash keeps its own page."

/** What Auto-commit in force MEANS, and the three things a reader has to be
 *  told: WHEN it records, that a burst is ONE commit, and that it sweeps every
 *  change in the repository rather than only the ones typed here. The last is
 *  the one nobody would guess — an agent writing over MCP restarts the same
 *  window and lands in the same commit. */
const commitHint = (): string =>
  autoCommit()
    ? `What is waiting records itself when edits stop arriving for ${QUIET_SECONDS} ` +
      "seconds, so a burst of work is one commit — including writes an agent " +
      `made. A commit or a push git refuses pauses it until ${
        commitFrozen() ? "you press Resume" : "you set this Off and back On"
      }.`
    : "A write waits. Record it with the Commit button, in the pill."

const pushHint = (): string =>
  autoPush()
    ? "A commit from this browser is pushed after it is recorded."
    : "A commit from here waits. Push it from the panel."

