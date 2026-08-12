/**
 * The Commit pill: what olai wrote, and what it last recorded.
 *
 * It exists because every write olai makes is a write nobody typed — the chat
 * agent auto-approves its ops, and an agent in a terminal is working on its
 * own — so git is how you see what the tool did to your files. That is the ONE
 * job: an audit trail. Not history (the notes carry their own dates), not sync
 * (olai never pushes), not undo.
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
 * colour. `⚠` is reserved for the one state a person can act on: a repository
 * that is mid-rebase and could take a commit once they finish. A seventh face is
 * this PAGE rather than the directory: before the server has said anything, it
 * says so instead of claiming one of the settings.
 *
 * WHERE the pill goes is the layout's to say, like the connection dot beside it:
 * the sidebar's footer on the pages that draw a sidebar, a corner of the
 * viewport on the ones that do not (`../App.tsx`). The design has it in the
 * bottom-right chrome strip the `panels` item is building; that strip does not
 * exist yet, and this is the same row of pills it will be made of.
 *
 * WHERE THE PANEL GOES is not the layout's, and cannot be. The sidebar SCROLLS,
 * and an overflow container clips in both axes — so a popover laid out inside it
 * was cut off at the 16rem column, taking the commit message, the writer and
 * half the button with it. It is portalled out of the sidebar and positioned
 * against the viewport instead (`./anchor.ts`), which is also what lets it stay
 * put when the column under it scrolls.
 *
 * The panel opens UPWARD, because the pill is near the bottom of the screen in
 * both of its homes.
 */

import { createEffect, createSignal, onCleanup, Show } from "solid-js"
import { Portal } from "solid-js/web"

import { agoOf, createNow } from "./ago.ts"
import { type Anchor, anchoredTo } from "./anchor.ts"
import { createNoteExpand } from "../note/expand.ts"
import { faceOf, isInert, SETTING } from "./said.ts"
import { Panel } from "./Panel.tsx"
import { createCommit } from "./state.ts"
import { TESTID } from "../testids.ts"

export function Commit() {
  const commit = createCommit()
  // The client's one answer to "open until you click somewhere else"
  // (`../note/expand.ts`), which the note under a row is the other consumer of. Both
  // the pill and the portalled panel register as inside — they are siblings in
  // different corners of the document, so the pill is not an ancestor that
  // could speak for the panel.
  const panel = createNoteExpand()
  const now = createNow()

  const face = () => faceOf(commit.pending(), commit.heard())
  const inert = () => isInert(face())

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

  /** What the pill says. One line per state, and the reason each is worth its
   *  own words rather than a count is in the header above. */
  const says = () => {
    const pending = commit.pending()
    switch (face()) {
      // Not a claim about the directory — a claim about this page, which has
      // not been told anything yet.
      case "unknown":
        return "…"
      case "off":
        return "commits off"
      case "no-repo":
        return "no git here"
      case "never":
        return "no commits yet"
      case "committed": {
        const last = pending.last
        const ago = last === null ? "" : agoOf(last.at, now())
        return ago === "" ? "committed" : `committed · ${ago}`
      }
      default:
        return `${commit.waiting()} uncommitted`
    }
  }

  return (
    <>
      <button
        type="button"
        ref={(el) => {
          pill = el
          panel.setRoot(el)
        }}
        class={`flex items-center gap-2 rounded-full border border-rule bg-paper px-3 py-1.5 text-xs ${
          inert() ? "text-muted opacity-60" : "text-muted hover:text-ink"
        }`}
        data-testid={TESTID.commitPill}
        // The STATE as an attribute, so a scenario asserts on which face this
        // is rather than on the sentence it is rendered into.
        data-state={face()}
        data-uncommitted={commit.waiting()}
        data-repo={commit.pending().repo._tag}
        aria-expanded={panel.expanded()}
        disabled={inert()}
        title={inert()
          ? SETTING[face() as "unknown" | "off" | "no-repo"]
          : "what olai has written, and what it last recorded"}
        onClick={panel.toggle}
      >
        <Show when={face() === "blocked"}>
          <span class="text-doing" aria-hidden="true">⚠</span>
        </Show>
        <Show when={face() === "committed"}>
          <span class="text-done" aria-hidden="true">✓</span>
        </Show>
        {says()}
        <Show when={!inert()}>
          <span aria-hidden="true">{panel.expanded() ? "▾" : "▴"}</span>
        </Show>
      </button>
      {/* Out of the sidebar entirely — see the header. */}
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
