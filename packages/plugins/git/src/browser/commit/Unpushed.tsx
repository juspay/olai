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
            class="flex items-baseline gap-2 text-label text-muted"
            data-testid={TESTID.commitUnpushed}
            data-commits={props.commit.pending().unpushed?.commits ?? 0}
          >
            <span class="min-w-0 truncate">{words()}</span>
            <button
              type="button"
              class="ml-auto shrink-0 rounded-control border border-rule px-2 py-0.5 hover:text-ink disabled:opacity-50"
              data-testid={TESTID.commitPush}
              disabled={props.commit.pushing()}
              onClick={() => props.commit.push()}
            >
              {props.commit.pushing() ? "Pushing…" : "Push"}
            </button>
          </p>
        )}
      </Show>

      <Show when={trouble()}>
        {(words) => (
          <p class="wrap-anywhere text-label text-alarm" data-testid={TESTID.commitPushRefused}>
            {words()}
          </p>
        )}
      </Show>
    </>
  )
}
