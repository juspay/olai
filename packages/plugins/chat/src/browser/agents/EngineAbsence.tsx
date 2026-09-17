/** One engine-absence sentence: the probe owns the words; chat owns the markup.
 * Disabled menu choices cannot offer a keyboard-reachable link. Other readers
 * retain the installation door, and identify the sentence only when they own
 * its testid; a menu identifies its item instead, never both item and child. */
import { Show } from "solid-js"
import type { NotHere } from "@olai/acp/engine"
import { AgentMark } from "../chat/AgentMark.tsx"

export function EngineAbsence(props: {
  readonly id: string
  readonly missing: NotHere
  readonly testid?: string
  readonly linked?: boolean
}) {
  return <span class="flex min-w-0 items-start gap-1.5" data-testid={props.testid} data-engine={props.testid === undefined ? undefined : props.id}>
    <span class="mt-0.5 shrink-0"><AgentMark id={props.id} /></span>
    <span class="min-w-0">
      <Show when={props.linked !== false && props.missing.where} fallback={<span>{props.missing.name}</span>}>{where =>
        <a class="underline underline-offset-2" href={where()} target="_blank" rel="noreferrer"
          onClick={event => event.stopPropagation()}>{props.missing.name}</a>
      }</Show>
      <span>{` — ${props.missing.why}`}</span>
    </span>
  </span>
}
