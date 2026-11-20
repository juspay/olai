import { servedDirectory } from "../vault.ts"
import { isReady } from "@olai/format"
import { createSignal, Show } from "solid-js"

import { agoOf } from "@olai/web/client/ago.ts"
import { type Anchor, styleOf } from "@olai/web/client/anchor.ts"
import { PANEL_BOX } from "@olai/web/client/readout.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import {
  AUTO_ARMED,
  AUTO_STOPPED,
  because,
  commitRefused,
  LOCK_HELD,
  lockRefused,
  lockSays,
  scopeOf,
  verbatim,
  waitingOn,
  WHO,
  wroteOf,
  willRecord,
} from "./said.ts"
import { Others } from "./Others.tsx"
import { Outlines } from "./Outlines.tsx"
import { createSelection } from "./selection.ts"
import { preparation } from "./preparation.ts"
import { canRecord, type Commit } from "./state.ts"
import { TESTID } from "../../testids.ts"
import { Unpushed } from "./Unpushed.tsx"

export function Panel(props: {
  readonly commit: Commit
  readonly now: number
  readonly at: Anchor
  readonly inside: (el: HTMLElement | undefined) => void
}) {
  const pending = () => props.commit.pending()
  const ready = () => isReady(pending().repo)
  const selection = createSelection(() => servedDirectory()?.claims(), pending, preparation.dropped)

  const [typed, setTyped] = preparation.typed
  const draft = () => typed() ?? selection.message()

  const waiting = () => waitingOn(pending())

  const anything = () => waiting().rows > 0

  const picked = () => selection.paths()

  const nothingTicked = () => {
    const chosen = picked()
    return chosen._tag === "Subset" && chosen.paths.length === 0
  }

  const promised = () => willRecord(pending(), props.commit.git())

  const lock = () => lockRefused(props.commit.git())

  const [guarded, setGuarded] = createSignal<number | null>(null)
  const held = () => {
    const stopped = lock()
    return stopped !== null && guarded() === stopped.since
  }

  const refusal = () => {
    const said = commitRefused(props.commit.git())
    if (said === null) return null
    const stopped = lock()
    return {
      says: stopped === null ? said : lockSays(stopped.since, props.now),
      tip: said,
    }
  }

  return (
    <section
      ref={props.inside}
      class={`${PANEL_BOX} gap-3`}
      style={styleOf(props.at)}
      tabindex="-1"
      data-testid={TESTID.commitPanel}
      data-repo={pending().repo._tag}
      aria-label="Uncommitted changes"
    >
      <p class="wrap-anywhere text-label text-muted" data-testid={TESTID.commitLast}>
        <Show
          when={pending().last}
          fallback={<>olai hasn't committed in this folder yet</>}
        >
          {(last) => (
            <>
              <span class="text-ink">{last().message}</span>
              {" · "}
              {last().writer === null ? "unknown author" : WHO[last().writer!]}
              {" · "}
              {agoOf(last().at, props.now)}
              {" · "}
              <span class="font-mono">{last().sha.slice(0, 7)}</span>
            </>
          )}
        </Show>
      </p>

      <Show when={waiting().groups.length > 0}>
        <Rule>Outlines</Rule>
        <Outlines
          groups={waiting().groups}
          served={pending().served}
          selection={selection}
        />
      </Show>

      <Show when={waiting().others.length > 0}>
        <Rule>Other files</Rule>
        <Others others={waiting().others} selection={selection} />
      </Show>

      <Show when={waiting().unreadable.length > 0}>
        <p class="wrap-anywhere text-label text-muted" data-testid={TESTID.commitUnreadable}>
          {waiting().unreadable.join(", ")} changed, but can't be read, so its
          changes can't be shown.
        </p>
      </Show>

      <Show when={anything()}>
        <p class="text-label text-muted" data-testid={TESTID.commitScope}>
          {scopeOf(pending().served)}
        </p>
      </Show>

      <Show when={pending().wrote.length > 0}>
        <p class="text-label text-muted" data-testid={TESTID.commitWriters}>
          {pending().wrote.map((wrote, at) =>
            `${at > 0 ? " · " : ""}${wroteOf(wrote.writer, wrote.ops)}`
          ).join("")}
        </p>
      </Show>

      <Show when={props.commit.git().paused !== null}>
        <p class="text-label text-alarm" data-testid={TESTID.commitAutoPaused}>
          ⚠ {AUTO_STOPPED}
        </p>
        <button
          type="button"
          class="self-start rounded-control border border-rule px-3 py-1.5 text-label hover:text-ink"
          data-testid={TESTID.commitResume}
          onClick={() => props.commit.resume()}
        >
          Resume
        </button>
        <Show when={props.commit.refusedBy("resume")}>
          {(said) => (
            <p
              class="wrap-anywhere text-label text-alarm"
              data-testid={TESTID.commitResumeRefused}
            >
              {said()}
            </p>
          )}
        </Show>
      </Show>

      <Show when={!ready()}>
        <Tip text={verbatim(pending().repo) ?? ""} disabled={verbatim(pending().repo) === undefined}>
          <p
            class={`text-label ${
              pending().repo._tag === "Unusable" ? "text-alarm" : "text-doing"
            }`}
            data-testid={TESTID.commitBlocked}
          >
            ⚠ {because(pending().repo)}
          </p>
          <Show when={verbatim(pending().repo)}>{(said) => <span class="sr-only">{said()}</span>}</Show>
        </Tip>
      </Show>

      <Show when={anything()}>
        <textarea
          class="min-h-24 w-full resize-y rounded-control border border-rule bg-paper p-2 text-label"
          data-testid={TESTID.commitMessage}
          aria-label="Commit message"
          value={draft()}
          onInput={(event) => setTyped(event.currentTarget.value)}
        />
      </Show>

      <Show when={refusal()}>
        {(line) => (
          <Tip text={line().tip}>
            <p
              class="wrap-anywhere text-label text-alarm"
              data-testid={TESTID.commitRefused}
            >
              {line().says}
            </p>
            <Show when={line().tip !== line().says}>
              <span class="sr-only">{line().tip}</span>
            </Show>
          </Tip>
        )}
      </Show>

      <Show when={lock()}>
        <button
          type="button"
          class="self-start rounded-control border border-rule px-3 py-1.5 text-label hover:text-ink"
          data-testid={TESTID.commitUnlock}
          onClick={() =>
            props.commit.unlock((answer) => {
              if (answer._tag === "Held") {
                setGuarded(answer.since)
                return
              }
              setGuarded(null)
              props.commit.commit(draft(), picked())
            })}
        >
          Remove lock file & retry
        </button>
        <Show when={props.commit.refusedBy("unlock")}>
          {(said) => (
            <p
              class="wrap-anywhere text-label text-alarm"
              data-testid={TESTID.commitUnlockRefused}
            >
              {said()}
            </p>
          )}
        </Show>
        <Show when={held()}>
          <p class="text-label text-doing" data-testid={TESTID.commitLockHeld}>
            {LOCK_HELD}
          </p>
        </Show>
      </Show>

      <Show when={props.commit.refusedBy("commit") ?? props.commit.refusedBy("push")}>
        {(said) => (
          <p class="wrap-anywhere text-label text-alarm" data-testid={TESTID.commitCallRefused}>
            {said()}
          </p>
        )}
      </Show>

      <Unpushed commit={props.commit} />

      <Show when={promised()}>
        <p class="text-label text-muted" data-testid={TESTID.commitAutoArmed}>
          {AUTO_ARMED}
        </p>
      </Show>

      <Show when={anything()}>
        <button
          type="button"
          class="self-end rounded-control border border-rule px-3 py-1.5 text-label hover:text-ink disabled:opacity-50"
          data-testid={TESTID.commitNow}
          disabled={
            !ready() ||
            !canRecord(props.commit.working(), props.commit.pushing()) ||
            nothingTicked()
          }
          onClick={() => props.commit.commit(draft(), picked())}
        >
          {props.commit.working()
            ? "Committing…"
            : label(selection.changes().length, selection.others().length)}
        </button>
      </Show>
    </section>
  )
}

function Rule(props: { readonly children: string }) {
  return (
    <p class="flex items-center gap-2 text-caption uppercase tracking-wide text-muted">
      <span class="shrink-0">{props.children}</span>
      <span class="h-px grow bg-rule" aria-hidden="true" />
    </p>
  )
}

const label = (changes: number, others: number): string => {
  const parts = [
    ...(changes === 0 ? [] : [`${changes} ${changes === 1 ? "change" : "changes"}`]),
    ...(others === 0 ? [] : [`${others} ${others === 1 ? "file" : "files"}`]),
  ]
  return parts.length === 0 ? "Commit" : `Commit ${parts.join(" · ")}`
}
