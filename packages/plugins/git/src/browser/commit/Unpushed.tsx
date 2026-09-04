/**
 * What is recorded here and nowhere else, and the one verb that fixes it.
 *
 * "I think 'push' is the only thing that makes me use CLI outside of olai" —
 * the human, and this line is the whole of the answer. It says what is not
 * shared in git's own arithmetic ("2 commits not on origin/master") and offers
 * to send it, and there is nothing else on it: no remote to pick, no refspec,
 * no force, no pull and no branch UI. A divergence is a conversation in a
 * terminal, and git's refusal — surfaced here verbatim, exactly as a refused
 * commit is — is how it starts.
 *
 * ABSENT when there is nothing to offer: a branch already in sync, and a branch
 * with no upstream at all (which is not the same fact, and is not something to
 * fix by guessing a remote). A button that pushed nothing would be a button
 * people learn to ignore.
 *
 * It sits BELOW the message box and above the Commit button, because that is
 * the order the two acts happen in: what you are about to record, then what is
 * already recorded and still here.
 */

import { Show } from "solid-js"

import { unpushedOf } from "./said.ts"
import type { Commit } from "./state.ts"
import { TESTID } from "../../testids.ts"

export function Unpushed(props: { readonly commit: Commit }) {
  const said = () => unpushedOf(props.commit.pending())
  const trouble = () => props.commit.git().pushSaid

  return (
    <>
      <Show when={said()}>
        {(words) => (
          <p
            class="flex items-baseline gap-2 text-xs text-muted"
            data-testid={TESTID.commitUnpushed}
            data-commits={props.commit.pending().unpushed?.commits ?? 0}
          >
            <span class="min-w-0 truncate">{words()}</span>
            {/* Not `../pill.ts`'s quiet pill: this verb sits INSIDE a text-xs
                line, so it keeps py-0.5 — the shared py-1 would thicken the
                unpushed line it lives on. */}
            <button
              type="button"
              class="ml-auto shrink-0 rounded border border-rule px-2 py-0.5 hover:text-ink disabled:opacity-50"
              data-testid={TESTID.commitPush}
              disabled={props.commit.pushing()}
              onClick={() => props.commit.push()}
            >
              {props.commit.pushing() ? "Pushing…" : "Push"}
            </button>
          </p>
        )}
      </Show>

      {/* Whatever git said, whole. This is the one thing about pushing a person
          cannot find out any other way from inside the app, and it comes off
          the CELL now rather than out of this tab's memory of its own last
          press — so a push the quiet window made and git refused is readable by
          whoever opens this panel, an hour later, in a tab that has been
          reloaded since. */}
      <Show when={trouble()}>
        {(words) => (
          <p class="wrap-anywhere text-xs text-alarm" data-testid={TESTID.commitPushRefused}>
            {words()}
          </p>
        )}
      </Show>
    </>
  )
}
