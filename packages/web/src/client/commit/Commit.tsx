/**
 * The Commit button: what olai wrote, waiting to be recorded.
 *
 * It exists because every write olai makes is a write nobody typed — the chat
 * agent auto-approves its ops, and an agent in a terminal is working on its
 * own — so git is how you see what the tool did to your files. That is the ONE
 * job: an audit trail. Not history (the notes carry their own dates), not sync
 * (olai never pushes), not undo.
 *
 * **Nothing pending, nothing shown.** A control that is always there would be a
 * permanent nag about a directory that is usually clean, and the two states
 * this can be in — something is waiting, or nothing is — are exactly a pill
 * that is drawn or not. Not a work tree, or `--commit=off`: nothing either,
 * because there is no answer to give.
 *
 * WHERE it goes is the layout's to say, like the connection dot beside it: the
 * sidebar's footer on the pages that draw a sidebar, a corner of the viewport
 * on the ones that do not (`../App.tsx`). The design has it in the bottom-right
 * chrome strip the `panels` item is building; that strip does not exist yet,
 * and this is the same pair of pills it will be made of.
 *
 * The panel opens UPWARD, because the pill is at the bottom of the screen in
 * both of its homes.
 */

import { Show } from "solid-js"

import { createClickAway } from "../away.ts"
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

  return (
    <Show when={commit.waiting() > 0}>
      {/* The anchor for the panel above it. `relative` here rather than on
          whatever the layout wrapped this in: where the popover lands is this
          component's business and should not depend on where it was put. */}
      <div class="relative" ref={panel.setRoot}>
        <button
          type="button"
          class="flex items-center gap-2 rounded-full border border-rule bg-paper px-3 py-1.5 text-xs text-muted hover:text-ink"
          data-testid={TESTID.commitPill}
          // The count as an attribute, so a scenario asserts on the number
          // rather than on the sentence it is rendered into.
          data-uncommitted={commit.waiting()}
          data-repo={commit.pending().repo._tag}
          aria-expanded={panel.open()}
          title="what olai has written and not yet committed"
          onClick={panel.toggle}
        >
          {commit.waiting()} uncommitted
          <span aria-hidden="true">{panel.open() ? "▾" : "▴"}</span>
        </button>
        <Show when={panel.open()}>
          <Panel commit={commit} />
        </Show>
      </div>
    </Show>
  )
}
