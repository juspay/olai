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
 * **THE INSTANCE'S ROWS ARE THE EXCEPTION**, and there are two GIT ones: this
 * INSTANCE's policy, set at launch (a flag, the nix module, or the built-in
 * default), the same in every browser, always read-only. Never hidden: a policy
 * a reader cannot see is one they cannot ask anybody about. Nothing is SENT;
 * the policy arrives on the `git` cell, which this panel READS and never
 * writes. Theme, font, size, notes and done are untouched by any of it — those
 * are personal view choices and there is nothing about them for a server to
 * have an opinion on.
 *
 * THERE WAS A THIRD KIND and it left: a row per plugin this build has. The
 * read-only presentation is generic (`./Row.tsx`'s `setBy`) and so are the
 * words under it (`./instance.ts`), so they JOINED without either being
 * widened — "a future instance setting can join them" was the claim, and they
 * were it arriving. What that showed is that the mechanism generalises and the
 * PANEL does not: git policy is about THIS DIRECTORY, which is what the rest of
 * this panel is about, so a person setting how their pages read is in the right
 * place to be told what happens when they write one. Which integrations the
 * instance runs is a different question with a different owner, and a
 * read-only strip among live ones reads as a preference somebody disabled
 * rather than as a fact about the serve. They are their own control in the bar
 * now (`../plugins/Plugins.tsx`), and they took their reading and their
 * subscription with them.
 *
 * WHAT IS ON IT is a narrower question than "every client-local value", and the
 * answer is: the ones that are a CHOICE and have nowhere else to be made. The
 * theme, the typeface, how much of a row is drawn by default, what the page in
 * front of you does with finished work, whether the agent stopping on a
 * question is announced and whether that makes a sound, and the two git rows —
 * whether what is waiting records itself, and whether a commit from here is
 * pushed. The two ALERT rows meet the test the same way the reader's rows do:
 * "tell me when the agent needs me" is a claim about the reader, and the
 * surface it is about is a drawer that is SHUT in exactly the case the setting
 * is for — so a switch on the panel would be a control you can only reach when
 * you do not need it. The DENSITY belongs here because it is a claim about
 * the reader ("I read a tree as a list of titles") rather than about any one
 * outline, so a switch bolted to the outline page would be a per-page control
 * for a per-person fact — and would have to be drawn on the zoomed page and
 * the day page too. The DONE row here says the Default: a page with its own
 * say-so draws its flip beside its filter (../filter/DoneFlip.tsx), and the
 * row a reader comes to change the DEFAULT on is the one door that always
 * holds still. The two GIT rows are the same kind of claim
 * — "I do not want to press Commit", "I want a commit I make here to be sent" —
 * so they are rows here rather than switches on the Commit panel. TWO rows and
 * not one strip of three, because they are two independent facts: pushing a
 * commit you made by hand is the shipped case, and folding them into a single
 * Off / Auto-commit / both would take it away. The layout values
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

import { For, Show } from "solid-js"

import { type Anchor, styleOf } from "../anchor.ts"
import { LAYER } from "../layer.ts"
import type { GitState } from "@olai/format"

import { createGitPolicy } from "../commit/state.ts"
import { askToNotify, notifyConsent } from "../notify.ts"
import { alertsOn, alertSoundOn, setAlertsOn, setAlertSoundOn } from "./alerts.ts"
import { density, type Density, setDensity } from "./density.ts"
import { doneHidden, setDoneHidden } from "./done.ts"
import {
  commitOn,
  commitSetBy,
  commitsOff,
  pushOn,
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

/** Done: Visible / Hidden — the words the setting has always said, from the
 *  outline pill through the reader-wide row to this one. What changed with
 *  scoping is where the words point: at the page the hint names. */
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

/** Off / On, for both alert rows — being told, and being told AUDIBLY. One
 *  constant because they are the same pair and a second name for it is a
 *  second thing to keep in step. */
const ALERT_CHOICES = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
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
  // THE `plugins` CELL IS NOT READ HERE ANY MORE. It was, for the rows that
  // are now their own panel — and it is worth the line, because a panel that
  // still subscribed to a cell it draws nothing from is a frame decoded per
  // publish for nobody. The subscription moved with the rows.
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

      {/* THE AGENT'S TWO ROWS, and they are here for the same test the
          reader's rows meet: "tell me when the agent stops on me" is a claim
          about the reader, and the panel it is about has nowhere to hang a
          switch — it is a drawer that is shut in exactly the case this
          setting is for. Two rows and
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
          choices={ALERT_CHOICES}
          value={alertSoundOn() ? "on" : "off"}
          onPick={(value) => setAlertSoundOn(value === "on")}
          frozen={!alertsOn()}
        />
      </Row>

      {/* The two git rows, in the order the two verbs happen in — and the only
          two on this panel that are about the INSTANCE rather than about the
          reader, so they draw the server's policy read-only (`./policy.ts`). */}
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
          frozen
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
          frozen
        />
      </Row>

      {/* THE PLUGIN ROWS LEFT, and they are a control of their own in the bar
          now (`../plugins/Plugins.tsx`). They were here, frozen, under the two
          git rows — and the two cases look alike and are not. Git policy is
          about THIS DIRECTORY, which is what the rest of this panel is about,
          so a person setting how their pages read is in the right place to be
          told what happens when they write one. Which integrations the
          INSTANCE runs is a different question with a different owner, and a
          read-only strip among live ones reads as a preference somebody
          disabled rather than as a fact about the serve. */}

      {/* WHAT THE SERVER WOULD NOT TAKE, beside the row that asked. Resume is
          the one remaining git gesture on this panel, and a dropped socket or
          a usage refusal would be a button that did nothing with no words
          anywhere. */}
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

          The git rows are named as the exception rather than left to contradict
          it: they are always the instance's, and a caveat about a feature
          nobody is using is not a caveat here — every serve has them.

          THE PLUGIN ROWS WERE NAMED HERE TOO, in the same breath, while they
          were on this panel — the same exception rather than a second one. They
          are a panel of their own now and this sentence stops reaching for
          them: a caveat about rows a reader cannot see from here is a caveat
          about nothing, and it would send somebody looking down the panel for a
          section that is not on it. Their panel needs no line of its own —
          `../plugins/Panel.tsx` says why. */}
      <p class="border-t border-rule pt-3 text-xs text-muted" data-testid={TESTID.prefsScope}>
        These are this browser's. They are stored here, reach every tab you have
        olai open in, and are never sent to the server. The two git rows are
        this instance's policy, set at launch — a flag, the nix module, or the
        built-in default. They are the same in every browser and cannot be
        changed from one.
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
 * it is actually wanted (`../notify.ts`) — which is the moment
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
  return (
    <Show when={alertsOn() && notifyConsent() === "default"}>
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
  `${currentTheme()} is in use. Every colour on the page comes from it.`

const fontHint = (): string => currentTypeface().hint

/** What the density in force MEANS — the row's own promise (./Row.tsx): a
 *  sentence read off the choice rather than a label describing the switch. Each
 *  one ends by saying the fold is still there, because "Compact" reads as
 *  "olai is hiding my notes" until somebody says what opens them. */
const densityHint = (): string => {
  switch (density()) {
    case "compact":
      return "Rows show titles only. Press the ¶ to open one."
    case "cozy":
      return "Rows show the title and one line of the note. The ¶ opens the rest."
    case "open":
      return "Rows are already open, notes in full. The ¶ folds one back."
  }
}

/**
 * WHAT ALERTS IN FORCE MEANS, in one sentence: what happens when a question
 * arrives you are not looking at.
 *
 * The banner is named as the half that needs the browser's permission, and
 * only where the browser has not granted it: on a page that can already draw
 * one, a sentence about permissions is a caveat about nothing, which teaches a
 * reader to stop believing the rest.
 */
const alertsHint = (): string => {
  if (!alertsOn()) {
    return "A question from the agent arrives silently. The header button still " +
      "shows it."
  }
  const said = "A question you cannot see chimes, raises a notification and " +
    "marks the app icon."
  switch (notifyConsent()) {
    case "granted":
      return said
    case "denied":
      return `${said} You have blocked notifications here, so there is no banner.`
    case "unsupported":
      return `${said} This browser has no notifications, so there is no banner.`
    default:
      return `${said} The banner needs this browser's permission.`
  }
}

/** What the sound row in force means — and, with alerts off, why it is inert
 *  rather than absent: the choice is still on screen, it just has nothing to
 *  be about. */
const soundHint = (): string => {
  if (!alertsOn()) return "Alerts are off, so nothing will sound."
  return alertSoundOn()
    ? "A short chime with each notification. The first plays only after you " +
      "click the page."
    : "Notifications, but no sound."
}

/** What Done in force MEANS: the default, and the one way a page out-votes
 *  it — the flip beside its filter, not another row here. */
const doneHint = (): string =>
  doneHidden()
    ? "Finished work is hidden. A page can show it anyway from its own filter."
    : "Finished work is shown. A page can hide it from its own filter."


/** What Auto-commit in force MEANS: WHEN it records, and the one gesture that
 *  starts it again after git refuses. */
const commitHint = (git: GitState): string => {
  // `--commit=off` FIRST, because it is not a third setting of this row — it is
  // the row having nothing to be about. Sending a reader to the Commit button
  // there points them at a pill that is inert and a directory olai never writes
  // a commit in; the two arms below both assume there is a history to record
  // into (`./policy.ts`'s `commitsOff`).
  if (commitsOff(git)) {
    return "olai never touches git in this directory."
  }
  return commitOn(git)
    ? `The server records what is waiting ${QUIET_SECONDS} seconds after writes ` +
      "stop. If git refuses one, press Resume to start it again."
    : "A write waits for the Commit button."
}

const pushHint = (git: GitState): string =>
  pushOn(git)
    ? "Every commit made here is pushed automatically."
    : "A commit waits for the Push button."
