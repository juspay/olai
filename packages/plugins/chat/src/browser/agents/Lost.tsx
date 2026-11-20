import { Result } from "effect"
import { createSignal, Show } from "solid-js"
import { itemKey } from "@olai/format"
import { runAsync } from "@olai/web/client/run.ts"

import { TESTID } from "../../testids.ts"
import { chatWire } from "../wire.ts"
import type { Lost } from "./lost.ts"

const SAID = "mt-6 rounded-control border border-dashed border-rule bg-desk/40 p-3 text-body leading-relaxed text-muted"

export function LostNote(props: { readonly lost: Lost; readonly name: string }) {
  return (
    <Show when={props.lost.kind === "untied" ? props.lost : undefined} fallback={<Gone name={props.name} />}>
      {(untied) => <Untied at={untied()} name={props.name} />}
    </Show>
  )
}

function Gone(props: { readonly name: string }) {
  return (
    <section class={SAID} data-testid={TESTID.chatPageGone} role="status">
      <p>
        This note is gone — olai no longer holds it, so there is no chat to open here.
        If you renamed it, its chat went with the file: open the note at its new name.
      </p>
    </section>
  )
}

function Untied(props: { readonly at: Extract<Lost, { kind: "untied" }>; readonly name: string }) {
  const [problem, setProblem] = createSignal<string>()
  const [pressing, setPressing] = createSignal(false)
  const press = async () => {
    if (pressing()) return
    setPressing(true)
    setProblem(undefined)
    try {
      const outcome = await runAsync(chatWire().procedures.conversation.retie({
        node: itemKey({ kind: "note", path: props.at.path }),
        agent: props.at.was.agent,
        session: props.at.was.session,
      }))
      if (Result.isFailure(outcome)) setProblem(outcome.failure.message)
    } finally { setPressing(false) }
  }
  return (
    <section class={SAID} data-testid={TESTID.chatPageUntied} role="status">
      <p>
        <strong class="font-semibold text-ink">{props.name}</strong> no longer names this conversation —
        the tie has gone from the note's front matter. The conversation itself is untouched.
      </p>
      <p class="mt-2">
        <button
          type="button"
          class="rounded-control border border-rule px-2 py-1 text-body text-ink hover:bg-desk"
          data-testid={TESTID.chatRetie}
          disabled={pressing()}
          onClick={() => void press()}
        >Tie it to {props.name} again</button>
        <Show when={problem()}><span role="alert" class="ml-2 text-alarm">{problem()}</span></Show>
      </p>
    </section>
  )
}
