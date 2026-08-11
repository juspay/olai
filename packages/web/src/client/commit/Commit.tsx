/**
 * The Commit pill: what olai wrote, and what it last recorded.
 *
 * It exists because every write olai makes is a write nobody typed — the chat
 * agent auto-approves its ops, and an agent in a terminal is working on its
 * own — so git is how you see what the tool did to your files. That is the ONE
 * job: an audit trail. Not history (the notes carry their own dates), not sync
 * (olai never pushes), not undo.
 *
 * **It is ALWAYS drawn**, in every one of its six states. That follows directly
 * from what it is for: if the job is to be an audit trail, then "there is no
 * audit trail here" — no repository, or commits turned off — is the single most
 * important thing it can say, and a control that disappeared is exactly how a
 * person would never find that out. The connection dot's header makes the same
 * argument in the same words: an indicator that is only there when something is
 * wrong cannot be trusted when it is absent, because healthy and not-rendered
 * look identical.
 *
 * Two of the six are SETTINGS rather than faults — `--commit=off`, and a
 * directory that is not a work tree — so they are dim and inert, and they get
 * no warning colour. `⚠` is reserved for the one state a person can act on: a
 * repository that is mid-rebase and could take a commit once they finish.
 *
 * WHERE it goes is the layout's to say, like the connection dot beside it: the
 * sidebar's footer on the pages that draw a sidebar, a corner of the viewport
 * on the ones that do not (`../App.tsx`). The design has it in the bottom-right
 * chrome strip the `panels` item is building; that strip does not exist yet,
 * and this is the same row of pills it will be made of.
 *
 * The panel opens UPWARD, because the pill is at the bottom of the screen in
 * both of its homes.
 */

import { Show } from "solid-js"

import { agoOf, createNow } from "./ago.ts"
import { createClickAway } from "../away.ts"
import { faceOf, isInert, SETTING } from "./said.ts"
import { Panel } from "./Panel.tsx"
import { createCommit } from "./state.ts"
import { TESTID } from "../testids.ts"

export function Commit() {
  const commit = createCommit()
  // The client's one answer to "open until you click somewhere else"
  // (`../away.ts`), which the note under a row is the other consumer of. The
  // root it is given is the wrapper below, so the pill counts as INSIDE: a
  // click on it must not both close the panel and re-open it.
  const panel = createClickAway()
  const now = createNow()

  const face = () => faceOf(commit.pending())
  const inert = () => isInert(commit.pending())

  /** What the pill says. One line per state, and the reason each is worth its
   *  own words rather than a count is in the header above. */
  const says = () => {
    const pending = commit.pending()
    switch (face()) {
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
    // The anchor for the panel above it. `relative` here rather than on
    // whatever the layout wrapped this in: where the popover lands is this
    // component's business and should not depend on where it was put.
    <div class="relative" ref={panel.setRoot}>
      <button
        type="button"
        class={`flex items-center gap-2 rounded-full border border-rule bg-paper px-3 py-1.5 text-xs ${
          inert() ? "text-muted opacity-60" : "text-muted hover:text-ink"
        }`}
        data-testid={TESTID.commitPill}
        // The STATE as an attribute, so a scenario asserts on which of the six
        // this is rather than on the sentence it is rendered into.
        data-state={face()}
        data-uncommitted={commit.waiting()}
        data-repo={commit.pending().repo._tag}
        aria-expanded={panel.open()}
        disabled={inert()}
        title={inert() ? SETTING[face() as "off" | "no-repo"] : "what olai has written, and what it last recorded"}
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
          <span aria-hidden="true">{panel.open() ? "▾" : "▴"}</span>
        </Show>
      </button>
      <Show when={panel.open() && !inert()}>
        <Panel commit={commit} now={now()} />
      </Show>
    </div>
  )
}
