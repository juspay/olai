/**
 * The Commit pill: what olai wrote, what it last recorded — and, since
 * `one-git-indicator`, whether git is in any state to record anything at all.
 *
 * It exists because every write olai makes is a write nobody typed — the chat
 * agent auto-approves its ops, and an agent in a terminal is working on its
 * own — so git is how you see what the tool did to your files. That is the ONE
 * job: an audit trail. Not history (the notes carry their own dates), not undo
 * — and not sync either, though it does now PUSH what it recorded: sharing an
 * audit trail is not merging one, and nothing here pulls, fetches or resolves.
 *
 * **It is the only git indicator in the header.** There were two: this pill and
 * #108's `● git` readout beside it, which answered "is what gets written here
 * being kept?" while this one answered "what is waiting, and when was the last
 * time?". The human filed the screenshot — `● git` next to `✓ committed · 3m
 * ago` — and he is right that those are one question wearing two chips. #114
 * had already made them one DERIVATION (both are renderings of a single survey,
 * never two probes); this is the face catching up with the data. Nothing #108
 * won is given back: a git that FAILED still reads differently from a directory
 * that is no repository, git's own words are still on screen rather than in the
 * server's log, and none of it blocks a write. What is gone is the second chip.
 *
 * **On desktop it is ALWAYS drawn**, in every state the directory can be in.
 * That follows from what it is for: if the job is to be an audit trail, then
 * "there is no audit trail here" is the most important thing it can say, and
 * a chip that disappeared cannot be trusted when it is absent. On a phone the
 * same control is a banner, and only while there is news (`isNews` in
 * `./said.ts`): a banner that vanished CAN be trusted, because the page
 * itself is the healthy state. Two faces of ONE control — not a second
 * `News` that also called `createCommit` and opened this panel.
 *
 * Two of them are SETTINGS rather than faults — `--commit=off`, and a directory
 * that is not a work tree — so they are dim and inert, and they get no warning
 * colour. `⚠` is for the two states a person can act on: a repository that is
 * mid-rebase and could take a commit once they finish, and a git that failed.
 * One more face is this PAGE rather than the directory: before the server has
 * said anything, it says so instead of claiming one of the settings.
 *
 * The sentence rides this app's own {@link ../Tip.tsx} rather than a `title`,
 * and that is #108's finding rather than a preference: git's words are a
 * paragraph, and the platform's tooltip ran one off the right edge of the
 * window. It is on the `aria-label` too, so nothing here is hover-only — which
 * is also why the inert faces are `aria-disabled` rather than `disabled`: a
 * disabled button takes no focus, and a reason a keyboard cannot reach is a
 * reason half the readers do not get.
 *
 * WHERE the pill goes is the layout's to say, like the connection dot beside it:
 * the app header, which is where the readout it absorbed used to sit
 * (`../AppHeader.tsx`). It wears that header's own pill (`../readout.ts`), the
 * same one the connection wears — the bar is a fixed height, so the label
 * truncates rather than wrapping a 390pt phone's first row off the top.
 *
 * WHERE THE PANEL GOES is not the layout's, and cannot be. It is portalled out
 * of whatever the pill is inside and positioned against the VIEWPORT
 * (`../anchor.ts`), which is what a popover in a scrolling column needs: an
 * overflow container clips in both axes, and one laid out inside the sidebar was
 * cut off at the 16rem column, taking the commit message, the writer and half
 * the button with it. Which way it opens is that arithmetic's answer rather than
 * a constant — from the header it opens downward, because that is the side with
 * the room. Being open, being placed and being dismissed are `../popover.ts`,
 * which the preferences at the other end of the bar are the second consumer of.
 */

import { Show } from "solid-js"
import { Portal } from "solid-js/web"

import { agoOf, createNow } from "./ago.ts"
import { createAuto, pausedIn } from "./auto.ts"
import { createElected } from "./elected.ts"
import {
  AUTO_PAUSED,
  explain,
  faceOf,
  isInert,
  isNews,
  MARK,
  newsSays,
} from "./said.ts"
import { commitFrozen } from "../settings/pinned.ts"
import { Panel } from "./Panel.tsx"
import { desktop } from "../layout/media.ts"
import { LAYER } from "../layer.ts"
import { BANNER, PILL } from "../readout.ts"
import { createPopover } from "../popover.ts"
import { autoCommit } from "../settings/autocommit.ts"
import { autoPush } from "../settings/autopush.ts"
import { createCommit } from "./state.ts"
import { TESTID } from "../testids.ts"
import { Tip } from "../Tip.tsx"

export function Commit() {
  const commit = createCommit(autoPush)
  // Auto-commit: the same verb this panel's button runs, on a debounced flurry
  // instead of a press (`./auto.ts`). It is instantiated HERE, beside the
  // commit it drives, because the pill is the one control that is always on
  // screen — a loop hung off the panel would stop existing the moment somebody
  // shut it. `createElected` is which tab of this browser records
  // (`./elected.ts`).
  const auto = createAuto({ on: autoCommit, alone: createElected(), commit })
  /** Why the loop stopped, or `null` — the arm the words and the chip both
   *  ask about, through the union's own accessor (`./auto.ts`). */
  const paused = () => pausedIn(auto())
  // Whether the panel is up, where it goes, and the ways it shuts
  // (`../popover.ts`, shared with the preferences at the other end of the bar).
  // It used to be `note/expand.ts` — the row note's "open until you click
  // somewhere else" — plus a measuring effect of this file's own, and the
  // borrowed half was wrong here: that one keeps ONE root, so the pill and the
  // portalled panel overwrote each other, a press of the pill was read as a
  // click-away, and the pill's own click re-opened what it had just shut.
  // Pressing it a second time did nothing at all.
  const panel = createPopover()
  const now = createNow()

  const face = () => faceOf(commit.pending(), commit.heard(), commit.git())
  const inert = () => isInert(face())
  /** One reading of the sentence for the two places it has to be: the tip a
   *  pointer opens, and the label everything else gets. */
  const said = () =>
    explain(face(), commit.pending(), commit.git(), paused(), commitFrozen())

  /**
   * How long ago the last commit was, for the one face that has one — and `""`
   * everywhere else.
   *
   * Beside {@link says} rather than inside it, because it is the half the bar
   * gives up first: at 390pt the header has five things in it, and `· 3m ago` is
   * the only piece of any label that a reader can lose and still be told what
   * they came to find out. It is drawn from `sm` up; the exact instant, with
   * the message and the writer, is a tap away in the panel at every width.
   */
  const ago = () => {
    const last = commit.pending().last
    return face() === "committed" && last !== null ? agoOf(last.at, now()) : ""
  }

  /**
   * How many commits are recorded here and nowhere else.
   *
   * The human's ruling at dispatch: the unpushed count belongs in the HEADER as
   * part of this one pill, not only inside the panel. The argument is the one
   * this pill is built on — an audit trail that exists on one machine is one
   * disk failure from not existing, and "there are eleven commits nobody else
   * has" is exactly the kind of thing a person only finds out by going looking.
   * So it rides here, beside the count of what is not committed at all, and the
   * two are different facts about the same work: not recorded, and not shared.
   *
   * Zero draws nothing, and so does a branch with no upstream — there is
   * nothing to act on, and chrome that speaks in the ordinary case is chrome
   * nobody reads in the rare one.
   */
  const unpushed = () => commit.pending().unpushed?.commits ?? 0

  /** What the pill says. One line per state, and the reason each is worth its
   *  own words rather than a count is in the header above. */
  const says = () => {
    switch (face()) {
      // Not a claim about the directory — a claim about this page, which has
      // not been told anything yet.
      case "unknown":
        return "…"
      case "off":
        return "commits off"
      case "no-repo":
        return "no git here"
      // What the readout this pill absorbed used to say in its own chip. The
      // WORDS are the consequence rather than the cause — git's own account of
      // what happened is a paragraph, and it rides the tip and the aria-label.
      case "error":
        return "git error"
      case "never":
        return "no commits yet"
      case "committed":
        return "committed"
      default:
        return `${commit.waiting()} uncommitted`
    }
  }

  const showPill = () => desktop()
  const showBanner = () => !desktop() && isNews(face(), unpushed(), paused())
  const line = () => newsSays(face(), commit.waiting(), unpushed(), paused())

  return (
    <>
      <Show when={showPill()}>
      {/* {@link LAYER.over}: this pill lives in the bar, so the sentence
          about it is the same claim the panel behind it already makes —
          cover the bar (and the chat dock that shares the page layer).
          Sitting at the page layer is how the coral rule cut the first
          line and how the dock's "chats" / "+ new" painted through the rest. */}
      <Tip text={said()} layer={LAYER.over}>
        <button
          type="button"
          ref={panel.setTrigger}
          // The header's own pill (`../readout.ts`), the same one the connection
          // wears and the same one the retired git readout wore: the bar is a
          // fixed height, so a long label truncates rather than wrapping. It
          // did wrap, and on a 390pt phone `✓ committed · 3m ago` took a second
          // row inside a bar that has no second row — pushing the wordmark
          // under the pills beside it.
          //
          // This is the ONLY thing in the bar that still shrinks, which is the
          // header's stated order (`../AppHeader.tsx`) and not an accident: the
          // connection has a floor, the agent's word is already gone at this
          // width, and what is left is this label — the longest in the bar, and
          // the one whose first glyph (`✓`, `⚠`) carries most of its meaning
          // when the rest of it goes. `min-w-9` is the floor of THAT shrink:
          // without it a 360pt bar (an iPhone mini) ate the glyph too and
          // left an empty oval between `live` and the agent toggle.
          //
          // Hover brightens to paper, the same token the agent and prefs
          // already use (`../readout.ts`'s ICON_BUTTON). `hover:text-ink` is
          // the paper-page hover — muted words going dark — and on this bar
          // it painted the label the colour of the bar. The tip is a hover;
          // asking what the pill says made the pill unreadable.
          class={`${PILL} min-w-9 max-w-[9rem] sm:max-w-none ${
            inert() ? "opacity-60" : "hover:text-paper"
          }`}
          data-testid={TESTID.commitPill}
          // The STATE as an attribute, so a scenario asserts on which face this
          // is rather than on the sentence it is rendered into.
          data-state={face()}
          data-uncommitted={commit.waiting()}
          data-unpushed={unpushed()}
          data-repo={commit.pending().repo._tag}
          // What AUTO-COMMIT is doing in this browser, which is a claim about
          // the reader rather than about the directory — hence its own
          // attribute rather than a ninth face (`./said.ts`).
          data-auto={auto()._tag}
          // Absent rather than `false` on the faces with no panel behind them:
          // a control that says it can expand and never does is a promise the
          // page does not keep.
          aria-expanded={inert() ? undefined : panel.open()}
          // `aria-disabled`, NOT `disabled`. A disabled button takes no focus,
          // and the sentence below is the whole point of the control in exactly
          // the states where nothing can be written — see the header.
          aria-disabled={inert() ? true : undefined}
          aria-label={said()}
          onClick={() => {
            if (!inert()) panel.toggle()
          }}
        >
          <Show when={MARK[face()]}>
            {(mark) => (
              <span class={`shrink-0 ${mark().tone ?? ""}`} aria-hidden="true">
                {mark().glyph}
              </span>
            )}
          </Show>
          <span class="min-w-0 truncate">{says()}</span>
          {/* The first thing the bar gives up — see {@link ago}. */}
          <Show when={ago() !== ""}>
            <span class="hidden shrink-0 sm:block">· {ago()}</span>
          </Show>
          {/* What is recorded and not shared — see {@link unpushed}. It stays at
              every width, unlike the recency beside it: "3 unpushed" is news,
              and the panel behind this pill is where the Push button lives. */}
          <Show when={unpushed() > 0}>
            <span class="shrink-0">· {unpushed()} unpushed</span>
          </Show>
          {/* A loop that has STOPPED, which is the one thing Auto-commit has to
              say out loud: its promise is that nobody watches it, so silence
              after a failure is how a person finds out days later from
              `git log`. It stays at every width, like the unpushed count and
              unlike the recency — and the reason is a gesture away, in the
              panel and on this pill's own label. */}
          <Show when={paused() !== null}>
            <span class="shrink-0 text-alarm">· {AUTO_PAUSED}</span>
          </Show>
          {/* Which way the panel opens, and it opens DOWNWARD from the header
              — `../anchor.ts` picks the side with the room. Not below 40rem:
              the bar holds five things at 390pt, and a caret is the cheapest of
              them to give up — what it says is "there is more", which the words
              beside it would rather spend the pixels saying. */}
          <Show when={!inert()}>
            <span class="hidden shrink-0 sm:inline" aria-hidden="true">
              {panel.open() ? "▴" : "▾"}
            </span>
          </Show>
        </button>
      </Tip>
      </Show>
      <Show when={showBanner()}>
        <button
          type="button"
          ref={panel.setTrigger}
          class={`${BANNER} justify-between ${
            face() === "error" || paused() !== null ? "text-alarm" : "text-doing"
          }`}
          data-testid={TESTID.gitNews}
          data-state={face()}
          data-uncommitted={commit.waiting()}
          data-unpushed={unpushed()}
          data-repo={commit.pending().repo._tag}
          data-auto={auto()._tag}
          aria-expanded={inert() ? undefined : panel.open()}
          aria-disabled={inert() ? true : undefined}
          aria-label={said()}
          onClick={() => {
            if (!inert()) panel.toggle()
          }}
        >
          {line()}
        </button>
      </Show>
      {/* Out of the header entirely — see the header comment. */}
      <Show when={panel.open() && !inert() ? panel.at() : null}>
        {(at) => (
          <Portal>
            <Panel
              commit={commit}
              auto={auto}
              now={now()}
              at={at()}
              inside={panel.setPanel}
            />
          </Portal>
        )}
      </Show>
    </>
  )
}
