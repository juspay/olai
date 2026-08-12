/**
 * The Commit pill: what olai wrote, what it last recorded — and, since
 * `one-git-indicator`, whether git is in any state to record anything at all.
 *
 * It exists because every write olai makes is a write nobody typed — the chat
 * agent auto-approves its ops, and an agent in a terminal is working on its
 * own — so git is how you see what the tool did to your files. That is the ONE
 * job: an audit trail. Not history (the notes carry their own dates), not sync
 * (olai never pushes), not undo.
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
 * **It is ALWAYS drawn**, in every state the directory can be in. That follows
 * directly from what it is for: if the job is to be an audit trail, then "there
 * is no audit trail here" — no repository, or commits turned off — is the single
 * most important thing it can say, and a control that disappeared is exactly how
 * a person would never find that out. The connection dot's header makes the same
 * argument in the same words: an indicator that is only there when something is
 * wrong cannot be trusted when it is absent, because healthy and not-rendered
 * look identical.
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
 * (`./anchor.ts`), which is what a popover in a scrolling column needs: an
 * overflow container clips in both axes, and one laid out inside the sidebar was
 * cut off at the 16rem column, taking the commit message, the writer and half
 * the button with it. Which way it opens is that arithmetic's answer rather than
 * a constant — from the header it opens downward, because that is the side with
 * the room.
 */

import { createEffect, createSignal, onCleanup, Show } from "solid-js"
import { Portal } from "solid-js/web"

import { agoOf, createNow } from "./ago.ts"
import { type Anchor, anchoredTo } from "./anchor.ts"
import { createNoteExpand } from "../note/expand.ts"
import { explain, faceOf, isInert, MARK } from "./said.ts"
import { Panel } from "./Panel.tsx"
import { PILL } from "../readout.ts"
import { createCommit } from "./state.ts"
import { TESTID } from "../testids.ts"
import { Tip } from "../Tip.tsx"

export function Commit() {
  const commit = createCommit()
  // The client's one answer to "open until you click somewhere else"
  // (`../note/expand.ts`), which the note under a row is the other consumer of. Both
  // the pill and the portalled panel register as inside — they are siblings in
  // different corners of the document, so the pill is not an ancestor that
  // could speak for the panel.
  const panel = createNoteExpand()
  const now = createNow()

  const face = () => faceOf(commit.pending(), commit.heard(), commit.git())
  const inert = () => isInert(face())
  /** One reading of the sentence for the two places it has to be: the tip a
   *  pointer opens, and the label everything else gets. */
  const said = () => explain(face(), commit.pending(), commit.git())

  let pill: HTMLButtonElement | undefined
  const [anchor, setAnchor] = createSignal<Anchor | null>(null)

  /** Re-read where the pill is. Cheap, and it has to happen again whenever the
   *  window or the column under it moves: an anchored popover that goes stale
   *  on a scroll is worse than one that never moved at all. */
  const measure = () => {
    if (pill === undefined) return
    setAnchor(anchoredTo(pill.getBoundingClientRect(), {
      width: window.innerWidth,
      height: window.innerHeight,
    }))
  }

  createEffect(() => {
    if (!panel.expanded()) return
    measure()
    // CAPTURE phase for `scroll`: what moves under the panel is the sidebar
    // rather than the document, and a scroll event does not bubble.
    window.addEventListener("resize", measure)
    document.addEventListener("scroll", measure, true)
    onCleanup(() => {
      window.removeEventListener("resize", measure)
      document.removeEventListener("scroll", measure, true)
    })
  })

  /**
   * How long ago the last commit was, for the one face that has one — and `""`
   * everywhere else.
   *
   * Beside {@link says} rather than inside it, because it is the half the bar
   * gives up first: at 390pt the header has six things in it, and `· 3m ago` is
   * the only piece of any label that a reader can lose and still be told what
   * they came to find out. It is drawn from `sm` up; the exact instant, with
   * the message and the writer, is a tap away in the panel at every width.
   */
  const ago = () => {
    const last = commit.pending().last
    return face() === "committed" && last !== null ? agoOf(last.at, now()) : ""
  }

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

  return (
    <>
      <Tip text={said()}>
        <button
          type="button"
          ref={(el) => {
            pill = el
            panel.setRoot(el)
          }}
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
          // when the rest of it goes.
          class={`${PILL} max-w-[9rem] sm:max-w-none ${
            inert() ? "opacity-60" : "hover:text-ink"
          }`}
          data-testid={TESTID.commitPill}
          // The STATE as an attribute, so a scenario asserts on which face this
          // is rather than on the sentence it is rendered into.
          data-state={face()}
          data-uncommitted={commit.waiting()}
          data-repo={commit.pending().repo._tag}
          // Absent rather than `false` on the faces with no panel behind them:
          // a control that says it can expand and never does is a promise the
          // page does not keep.
          aria-expanded={inert() ? undefined : panel.expanded()}
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
              <span class={`shrink-0 ${mark().tone}`} aria-hidden="true">
                {mark().glyph}
              </span>
            )}
          </Show>
          <span class="min-w-0 truncate">{says()}</span>
          {/* The first thing the bar gives up — see {@link ago}. */}
          <Show when={ago() !== ""}>
            <span class="hidden shrink-0 sm:block">· {ago()}</span>
          </Show>
          {/* Which way the panel opens, and it opens DOWNWARD from the header
              — `./anchor.ts` picks the side with the room. Not below 40rem:
              the bar holds six things at 390pt, and a caret is the cheapest of
              them to give up — what it says is "there is more", which the words
              beside it would rather spend the pixels saying. */}
          <Show when={!inert()}>
            <span class="hidden shrink-0 sm:inline" aria-hidden="true">
              {panel.expanded() ? "▴" : "▾"}
            </span>
          </Show>
        </button>
      </Tip>
      {/* Out of the header entirely — see the header comment. */}
      <Show when={panel.expanded() && !inert() ? anchor() : null}>
        {(at) => (
          <Portal>
            <Panel commit={commit} now={now()} at={at()} inside={panel.setRoot} />
          </Portal>
        )}
      </Show>
    </>
  )
}
