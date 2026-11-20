import { createMemo } from "solid-js"

import { For, Show } from "solid-js"
import { Portal } from "solid-js/web"

import { agoOf, createNow } from "@olai/web/client/ago.ts"
import {
  faceOf,
  readingOf,
  isInert,
  loopIn,
  newsSays,
  unpushedIn,
} from "./said.ts"
import { Panel } from "./Panel.tsx"
import { desktop } from "../shell.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { BANNER, DOT, PILL, TONE } from "@olai/web/client/readout.ts"
import { createPopover } from "@olai/web/client/popover.ts"
import { createCommit } from "./state.ts"
import { TESTID } from "../../testids.ts"
import { Tip } from "@olai/web/client/Tip.tsx"

export function Commit() {
  const commit = createCommit()
  const auto = () => loopIn(commit.git())
  const panel = createPopover()
  const now = createNow()

  const face = createMemo(() => faceOf(commit.pending(), commit.heard(), commit.git()))
  const inert = () => isInert(face())
  const read = createMemo(() => readingOf(face(), commit.pending(), commit.git()))
  const said = createMemo(() => read().detail)

  const ago = () => {
    const last = commit.pending().last
    return face() === "committed" && last !== null ? agoOf(last.at, now()) : ""
  }

  const unpushed = () => unpushedIn(commit.pending())

  const pushSaid = () => commit.git().pushSaid

  const showPill = () => desktop()
  const showBanner = () => !desktop() && (read().tone === "notice" || read().tone === "alarm")
  const line = createMemo(() => newsSays(face(), commit.pending(), commit.git()))

  return (
    <>
      <Show when={showPill()}>
      <Tip text={said()} layer={LAYER.over}>
        <button
          type="button"
          ref={panel.setTrigger}
          class={`${PILL} min-w-9 max-w-[9rem] sm:max-w-none ${
            inert() ? "opacity-60" : ""
          }`}
          data-testid={TESTID.commitPill}
          data-state={face()}
          data-uncommitted={commit.waiting()}
          data-unpushed={unpushed()}
          data-repo={commit.pending().repo._tag}
          data-auto={auto()}
          data-push-refused={pushSaid() === null ? undefined : "true"}
          aria-expanded={inert() ? undefined : panel.open()}
          aria-disabled={inert() ? true : undefined}
          aria-label={said()}
          onClick={() => {
            if (!inert()) panel.toggle()
          }}
        >
          <span class={`${DOT} ${TONE[read().tone].dot}`} data-health={read().tone} aria-hidden="true" />
          <span class="min-w-0 truncate">{read().says}</span>
          <Show when={ago() !== ""}>
            <span class="hidden shrink-0 sm:block">· {ago()}</span>
          </Show>
          <For each={read().riders}>
            {(rider) => <span class={`shrink-0 ${TONE[read().tone].text}`}>· {rider}</span>}
          </For>
          <Show when={!inert()}>
            <span class="ml-auto hidden shrink-0 text-muted sm:inline" aria-hidden="true">
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
          class={`${BANNER} justify-between ${TONE[read().tone].text}`}
          data-testid={TESTID.gitNews}
          data-state={face()}
          data-uncommitted={commit.waiting()}
          data-unpushed={unpushed()}
          data-repo={commit.pending().repo._tag}
          data-auto={auto()}
          data-push-refused={pushSaid() === null ? undefined : "true"}
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
      <Show when={panel.open() && !inert() ? panel.at() : null}>
        {(at) => (
          <Portal>
            <Panel commit={commit} now={now()} at={at()} inside={panel.setPanel} />
          </Portal>
        )}
      </Show>
    </>
  )
}
