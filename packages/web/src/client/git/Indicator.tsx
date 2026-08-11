/**
 * The git readout: is what I am reading being kept?
 *
 * It sits beside the connection pill, and the two answer the same shape of
 * question about different halves of the promise — "is this page still
 * reading?" and "is what the agent writes being kept?". Both are facts a page
 * can only get wrong silently, which is exactly why they are chrome rather than
 * something a reader has to go and ask for.
 *
 * It was NOT here, and that was the bug (docs/roadmap.jsonl's `git-invisible`).
 * A write came back `committed: false` on a directory its owner knew was a
 * repository, the reason went to the server log, and the page said nothing at
 * all — so "git is fine", "this is not a repository" and "git is broken here"
 * were one blank space. The human's ruling was that git failures stay
 * non-blocking and become VISIBLE, which is the whole of this component.
 *
 * Absent entirely under `--no-commit` ({@link ../git/state.ts}'s table), and
 * quiet when everything is well: three letters and a dim dot. What it must
 * never be is loud in the healthy state, because chrome that cries in the
 * ordinary case is chrome nobody reads in the rare one.
 *
 * The reason for a failure rides this app's own {@link ../Tip.tsx} rather than
 * a `title`: git's words are a paragraph, and the platform's tooltip would run
 * one off the right edge of the window. It is on the `aria-label` too, so
 * nothing here is hover-only, and the readout takes focus so a keyboard can
 * reach the sentence at all.
 */

import { GIT_OFF } from "@olai/surface"
import { Show } from "solid-js"

import { LOOK, sentence } from "./state.ts"
import { DOT, PILL } from "../readout.ts"
import { TESTID } from "../testids.ts"
import { Tip } from "../Tip.tsx"
import { olai } from "../wire.ts"

export function GitIndicator() {
  // The cell always has a value: the spec declares `off` as its default and the
  // framework seeds the subscription with it, so a page reads "say nothing"
  // before the first frame rather than flashing a state it has not been told.
  const cell = olai.cells.git.use()
  const state = () => cell.value() ?? GIT_OFF

  return (
    <Show when={LOOK[state().status]}>
      {(look) => {
        // One reading of the sentence for the two places it has to be: the tip
        // a pointer opens, and the label everything else gets.
        const said = () => sentence(state(), look())
        return (
        <Tip text={said()}>
          <span
            // The header's own pill (`../readout.ts`), the same one the
            // connection wears: the bar is a fixed height, so both labels
            // truncate rather than wrap.
            class={`${PILL} max-w-[8rem] sm:max-w-none`}
            data-testid={TESTID.git}
            // The state as an attribute, so a test asserts on the STATE rather
            // than on a colour — the same contract the connection pill keeps.
            data-git={state().status}
            // A readout, not a control, but a focusable one: the tip is where
            // git's own words are, and a sentence only a pointer can reach is
            // a sentence half the readers do not get.
            tabindex="0"
            role="status"
            aria-label={said()}
          >
            <span class={`${DOT} ${look().dot}`} aria-hidden="true" />
            <span class="min-w-0 truncate">{look().label}</span>
          </span>
        </Tip>
        )
      }}
    </Show>
  )
}
