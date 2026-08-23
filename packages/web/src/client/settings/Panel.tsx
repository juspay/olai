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
 * browser does with finished work, whether the agent stopping on a question is
 * announced and whether that makes a sound, which files the directory column
 * draws, and the two git rows — whether what is waiting records itself, and
 * whether a commit from here is pushed.
 * The two ALERT rows meet the test the same way Done does: "tell me when the
 * agent needs me" is a claim about the reader, and the surface it is about is
 * a drawer that is SHUT in exactly the case the setting is for — so a switch
 * on the panel would be a control you can only reach when you do not need it.
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

import { onMount, Show } from "solid-js"

import { type Anchor, styleOf } from "../anchor.ts"
import { LAYER } from "../layer.ts"
import type { GitState } from "@olai/format"

import { askToNotify, bannerConsent, refreshConsent } from "../chat/attention/banner.ts"
import { createGitPolicy } from "../commit/state.ts"
import { alertsOn, alertSoundOn, setAlertsOn, setAlertSoundOn } from "./alerts.ts"
import { density, type Density, setDensity } from "./density.ts"
import { doneHidden, setDoneHidden } from "./done.ts"
import { outlinesHidden, setOutlinesHidden } from "./hiddenOutlines.ts"
import {
  commitFrozen,
  commitPick,
  commitOn,
  commitSetBy,
  commitsOff,
  pushFrozen,
  pushOn,
  pushPick,
  pushSetBy,
} from "./policy.ts"
import { QUIET_MS } from "@olai/format"
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

/** Alerts: Off / On — whether the agent stopping on a question you cannot see
 *  reaches you at all. */
const ALERT_CHOICES = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
] as const

/** Alert sound: Off / On — the same pair, because it is the same kind of
 *  claim one step in. */
const SOUND_CHOICES = ALERT_CHOICES

/** Hidden outlines: Hidden / Shown — the Done row's pair one subject over,
 *  and the same two words, because it is the same kind of claim: a list of
 *  rows, and whether some of them are on it. */
const HIDDEN_CHOICES = [
  { value: "hidden", label: "Hidden" },
  { value: "shown", label: "Shown" },
] as const

/** Git commit: Off / Auto-commit — a write waits for a press, or what is
 *  waiting records itself once writes stop arriving. */
const COMMIT_CHOICES = [
  { value: "off", label: "Off" },
  { value: "on", label: "Auto-commit" },
] as const

/** Git push: Off / Auto-push — a commit waits to be sent, or every commit olai
 *  makes here is followed by the same push the panel already offers. */
const PUSH_CHOICES = [
  { value: "off", label: "Off" },
  { value: "on", label: "Auto-push" },
] as const

/** The quiet window in the words the hint says it in. Read off the value the
 *  server's loop actually waits (`@olai/format`) rather than spelled again, so
 *  the sentence cannot promise a span the loop does not keep. */
const QUIET_SECONDS = Math.round(QUIET_MS / 1000)

export function Panel(props: {
  /** Where to sit, in viewport pixels — see `../anchor.ts` for why this is not
   *  a matter of CSS alone. */
  readonly at: Anchor
  /** Register this surface with the click-away, since it is portalled and so is
   *  not a descendant of the control that opened it. */
  readonly inside: (el: HTMLElement | undefined) => void
}) {
  /** The two git rows' door — what the server says about git, and the two verbs
   *  that move it (`../commit/state.ts`). The SEAM rather than the whole
   *  committer: this panel draws nothing that is waiting, and the committer
   *  opens a `pending` subscription it would decode a full frame of per publish
   *  for nobody. `./policy.ts`'s readings are pure functions of what it hands
   *  back, so there is no signal here either. */
  const policy = createGitPolicy()
  const git = policy.git
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

      {/* THE AGENT'S TWO ROWS, and they are here for the same test as Done:
          "tell me when the agent stops on me" is a claim about the reader, and
          the panel it is about has nowhere to hang a switch — it is a drawer
          that is shut in exactly the case this setting is for. Two rows and
          not one strip of three, because they are two independent facts:
          being told and being told AUDIBLY, and folding them together would
          make turning the chime off cost the banner too. Sound is drawn under
          Alerts and reads as its second half; with alerts off it is frozen
          rather than hidden, so what it would be is still on screen. */}
      <Row label="Alerts" pref="alerts" hint={alertsHint()} under={<AllowNotify />}>
        <Segmented
          choices={ALERT_CHOICES}
          value={alertsOn() ? "on" : "off"}
          onPick={(value) => setAlertsOn(value === "on")}
        />
      </Row>

      <Row label="Alert sound" pref="alert-sound" hint={soundHint()}>
        <Segmented
          choices={SOUND_CHOICES}
          value={alertSoundOn() ? "on" : "off"}
          onPick={(value) => setAlertSoundOn(value === "on")}
          frozen={!alertsOn()}
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

      {/* The two git rows, in the order the two verbs happen in — and the only
          two on this panel that are about the DIRECTORY rather than about the
          reader, so they set the server's policy and draw its answer
          (`./policy.ts`). */}
      <Row
        label="Git commit"
        pref="git-commit"
        hint={commitHint(git())}
        setBy={commitSetBy(git())}
        under={
          /* THE ONE GESTURE THAT STARTS THE LOOP AGAIN. A refused commit or
             push stops the quiet window and nothing clears that on olai's own
             initiative — a loop that un-paused itself is a blind retry wearing
             a different hat.

             It used to be two gestures: the stop was this TAB's, so turning the
             browser's own toggle off and on again cleared it, and only a PINNED
             row (which has no toggle) carried this button. The stop is the
             directory's now, so neither a toggle nor a reload can clear it and
             this is the gesture on every deployment — which is also what makes
             it work from any tab, for a loop any tab can see is stopped.

             Drawn ONLY while the loop is actually stopped: a button offering to
             resume a loop that is running is a control with nothing to do. */
          <Show when={git().paused !== null}>
            <button
              type="button"
              // `mt-2` here rather than on a wrapper in `./Row.tsx`: the slot is
              // rendered bare, so a row whose Resume is not showing draws
              // nothing at all — see there.
              class={`${TARGET} mt-2 rounded-full border border-rule px-3 text-xs text-ink hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-h-0 md:py-1`}
              data-testid={TESTID.prefsResume}
              onClick={() => policy.resume()}
            >
              Resume auto-commit
            </button>
          </Show>
        }
      >
        <Segmented
          choices={COMMIT_CHOICES}
          value={commitOn(git()) ? "on" : "off"}
          // `manual` rather than `off` for the row's Off, because that is what
          // the row means: a write waits for the Commit button. `off` is
          // `--commit=off`, which is olai never touching git here at all — a
          // pinned-only state, and one a browser must not be able to arrive at
          // by pressing the same control that says "wait for me instead".
          onPick={(value) => policy.setPolicy(commitPick(value === "on"))}
          frozen={commitFrozen(git())}
        />
      </Row>

      <Row
        label="Git push"
        pref="git-push"
        hint={pushHint(git())}
        setBy={pushSetBy(git())}
      >
        <Segmented
          choices={PUSH_CHOICES}
          value={pushOn(git()) ? "on" : "off"}
          onPick={(value) => policy.setPolicy(pushPick(value === "on"))}
          frozen={pushFrozen(git())}
        />
      </Row>

      {/* WHAT THE SERVER WOULD NOT TAKE, beside the two rows that asked. The
          git rows are the only controls on this panel that reach a server at
          all, so they are the only ones that can silently do nothing: a pinned
          half refuses by name, and a dropped socket refuses without one. Either
          way a control that moved on screen and nowhere else is the failure
          this whole feature is about, and Resume is the sharpest case — a loop
          that stays stopped with the button pressed and no words anywhere. */}
      <Show when={policy.refused()}>
        {(said) => (
          <p class="wrap-anywhere text-xs text-alarm" data-testid={TESTID.prefsGitRefused}>
            {said()}
          </p>
        )}
      </Show>

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
        olai open in, and are never sent to the server. The two git rows are the
        exception: committing and pushing are facts about this DIRECTORY, so
        they are the server's — the same in every browser, and remembered there
        rather than here.
        <Show when={commitFrozen(git()) || pushFrozen(git())}>
          {" "}
          This one was also started with a git policy on the command line, so
          those rows are read-only.
        </Show>
      </p>
    </section>
  )
}

/**
 * THE ONE GESTURE THAT CAN RAISE THE PERMISSION PROMPT, on the row it belongs
 * to.
 *
 * Alerts are on by default (ruled), so there is no "first enable" press for
 * the browser's own prompt to ride. The banner asks for itself the first time
 * it is actually wanted (`../chat/attention/banner.ts`) — which is the moment
 * the prompt's sentence is about something happening — but Firefox and Safari
 * both REFUSE a prompt raised from a background event, and a person who was
 * away when the question arrived is exactly the person that rule is about. So
 * this is the door that always works: a press, which is what those browsers
 * were holding out for.
 *
 * Drawn only while there is something for it to do — alerts on, and a browser
 * that has neither granted nor refused. A button offering to ask a question
 * that has been answered is a control with nothing to do, which is the same
 * argument the Resume button two rows down makes.
 */
function AllowNotify() {
  // The permission can be changed in browser settings with this page open, so
  // what it says is re-read when the panel opens rather than trusted from
  // whenever this module was first loaded.
  onMount(refreshConsent)
  return (
    <Show when={alertsOn() && bannerConsent() === "default"}>
      <button
        type="button"
        // `mt-2` here rather than on a wrapper in `./Row.tsx`: the slot is
        // rendered bare, so a row whose button is not showing draws nothing at
        // all — see there.
        class={`${TARGET} mt-2 rounded-full border border-rule px-3 text-xs text-ink hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-h-0 md:py-1`}
        data-testid={TESTID.prefsAllowNotify}
        onClick={() => void askToNotify(true)}
      >
        Allow notifications
      </button>
    </Show>
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

/**
 * WHAT ALERTS IN FORCE MEANS, and the two things a reader has to be told: what
 * actually happens, and — the part nobody would guess — that nothing happens
 * while they are looking at the panel. A person who switches this on, watches
 * a question arrive in front of them and hears nothing would reasonably decide
 * it is broken.
 *
 * The banner is named as the half that needs the browser's permission, and
 * only where the browser has not granted it: on a page that can already draw
 * one, a sentence about permissions is a caveat about nothing, which teaches a
 * reader to stop believing the rest.
 */
const alertsHint = (): string => {
  if (!alertsOn()) {
    return "The agent stopping on a question is silent. The panel still says so " +
      "where you can see it: the header's agent button, and the composer."
  }
  const said = "A question you cannot see — the panel put away, the window " +
    "behind something else — chimes, raises a system notification, and marks " +
    "the app's icon until you come back. A question that arrives in front of " +
    "you does none of that: the form appearing is the alert."
  switch (bannerConsent()) {
    case "granted":
      return said
    case "denied":
      return `${said} This browser has refused notifications for this site, so ` +
        "there is no banner — the chime and the icon need no permission and " +
        "still work."
    case "unsupported":
      return `${said} This browser has no system notifications, so there is no ` +
        "banner — the chime and the icon do not need one."
    default:
      return `${said} The banner needs this browser's permission, which it has ` +
        "not been asked for yet."
  }
}

/** What the sound row in force means — and, with alerts off, why it is inert
 *  rather than absent: the choice is still on screen, it just has nothing to
 *  be about. */
const soundHint = (): string => {
  if (!alertsOn()) return "Alerts are off, so there is nothing to make a sound."
  return alertSoundOn()
    ? "One short chime with the notification. Browsers will not play a sound " +
      "on a page nobody has touched yet, so the first one lands after your " +
      "first click or keystroke here."
    : "The notification and the icon mark, without a sound."
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
const commitHint = (git: GitState): string => {
  // `--commit=off` FIRST, because it is not a third setting of this row — it is
  // the row having nothing to be about. Sending a reader to the Commit button
  // there points them at a pill that is inert and a directory olai never writes
  // a commit in; the two arms below both assume there is a history to record
  // into (`./policy.ts`'s `commitsOff`).
  if (commitsOff(git)) {
    return "olai never touches git in this directory, so nothing is waiting " +
      "and there is nothing here to record."
  }
  return commitOn(git)
    ? `The server records what is waiting when writes stop arriving for ${QUIET_SECONDS} ` +
      "seconds, so a burst of work is one commit — including writes an agent " +
      "made, and with no browser open. A commit or a push git refuses pauses " +
      "it until you press Resume."
    : "A write waits. Record it with the Commit button, in the pill."
}

const pushHint = (git: GitState): string =>
  pushOn(git)
    ? "Every commit olai makes here is pushed after it is recorded — the " +
      "button's, an agent's, and the server's own."
    : "A commit waits. Push it from the panel."
