/** One absence line for the picker, no-agent face and engine's inspector row. */
import { Show } from "solid-js"
import type { NotHere } from "@olai/acp/engine"
import { AgentMark } from "../chat/AgentMark.tsx"

export function Missing(props: {
  readonly id: string
  readonly missing: NotHere
  readonly testid?: string
}) {
  return <span class="flex min-w-0 items-start gap-1.5" data-testid={props.testid} data-engine={props.id}>
    <span class="mt-0.5 shrink-0"><AgentMark id={props.id} /></span>
    <span class="min-w-0">
      <Show when={props.missing.where} fallback={<span>{props.missing.name}</span>}>{where =>
        <a class="underline underline-offset-2" href={where()} target="_blank" rel="noreferrer"
          onClick={event => event.stopPropagation()}>{props.missing.name}</a>
      }</Show>
      <span>{` — ${props.missing.why}`}</span>
    </span>
  </span>
}
