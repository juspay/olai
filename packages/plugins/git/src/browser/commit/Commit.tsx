import { createMemo, For, type JSX, Show } from "solid-js"
import { Portal } from "solid-js/web"

import { agoOf, createNow } from "@olai/web/client/ago.ts"
import {
  type Face,
  faceOf,
  readingOf,
  isInert,
  loopIn,
  newsSays,
  type Reading,
  unpushedIn,
} from "./said.ts"
import { Panel } from "./Panel.tsx"
import { desktop } from "../shell.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { BANNER, DOT, PILL, TONE } from "@olai/web/client/readout.ts"
import { createPopover, type Popover } from "@olai/web/client/popover.ts"
import { type Commit as CommitState, createCommit } from "./state.ts"
import { TESTID } from "../../testids.ts"
import { Tip } from "@olai/web/client/Tip.tsx"

export function Commit() {
  const commit = createCommit()
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

  const showPill = () => desktop()
  const showBanner = () => !desktop() && (read().tone === "notice" || read().tone === "alarm")
  const line = createMemo(() => newsSays(face(), commit.pending(), commit.git()))

  return (
    <>
      <Show when={showPill()}>
        <Tip text={said()} layer={LAYER.over}>
          <Trigger
            commit={commit}
            panel={panel}
            face={face()}
            testid={TESTID.commitPill}
            class={`${PILL} min-w-9 max-w-[9rem] sm:max-w-none ${inert() ? "opacity-60" : ""}`}
            label={said()}
          >
            <Says read={read()} ago={ago()} open={panel.open()} inert={inert()} />
          </Trigger>
        </Tip>
      </Show>
      <Show when={showBanner()}>
        <Trigger
          commit={commit}
          panel={panel}
          face={face()}
          testid={TESTID.gitNews}
          class={`${BANNER} justify-between ${TONE[read().tone].text}`}
          label={said()}
        >
          {line()}
        </Trigger>
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

function Trigger(props: {
  readonly commit: CommitState
  readonly panel: Popover
  readonly face: Face
  readonly testid: string
  readonly class: string
  readonly label: string
  readonly children: JSX.Element
}) {
  const inert = () => isInert(props.face)

  return (
    <button
      type="button"
      ref={props.panel.setTrigger}
      class={props.class}
      data-testid={props.testid}
      data-state={props.face}
      data-uncommitted={props.commit.waiting()}
      data-unpushed={unpushedIn(props.commit.pending())}
      data-repo={props.commit.pending().repo._tag}
      data-auto={loopIn(props.commit.git())}
      data-push-refused={props.commit.git().pushSaid === null ? undefined : "true"}
      aria-expanded={inert() ? undefined : props.panel.open()}
      aria-disabled={inert() ? true : undefined}
      aria-label={props.label}
      onClick={() => {
        if (!inert()) props.panel.toggle()
      }}
    >
      {props.children}
    </button>
  )
}

function Says(props: {
  readonly read: Reading
  readonly ago: string
  readonly open: boolean
  readonly inert: boolean
}) {
  return (
    <>
      <span
        class={`${DOT} ${TONE[props.read.tone].dot}`}
        data-health={props.read.tone}
        aria-hidden="true"
      />
      <span class="min-w-0 truncate">{props.read.says}</span>
      <Show when={props.ago !== ""}>
        <span class="hidden shrink-0 sm:block">· {props.ago}</span>
      </Show>
      <For each={props.read.riders}>
        {(rider) => <span class={`shrink-0 ${TONE[props.read.tone].text}`}>· {rider}</span>}
      </For>
      <Show when={!props.inert}>
        <span class="ml-auto hidden shrink-0 text-muted sm:inline" aria-hidden="true">
          {props.open ? "▴" : "▾"}
        </span>
      </Show>
    </>
  )
}
