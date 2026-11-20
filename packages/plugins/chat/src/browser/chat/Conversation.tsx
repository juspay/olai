import { Show } from "solid-js"

import type { SessionInfo } from "olai-plugin-chat/wire"
import { TESTID, type ChatTestId } from "../../testids.ts"
import { whenOf } from "./when.ts"

export function Conversation(props: {
  readonly session: SessionInfo
  readonly successor: SessionInfo | undefined
  readonly current: boolean
  readonly testid?: ChatTestId
  readonly onPick: () => void
}) {
  const size = (): string | null => {
    const count = props.session.messageCount
    if (count === null) return null
    return `${count} ${count === 1 ? "message" : "messages"}`
  }
  return (
    <button
      type="button"
      class="flex w-full flex-col rounded-control px-2 py-1 text-left text-label hover:bg-rule"
      data-testid={props.testid ?? TESTID.chatSession}
      data-session-id={props.session.id}
      data-agent={props.session.agent}
      data-current={props.current}
      disabled={props.current}
      onClick={() => props.onPick()}
    >
      <span class="flex w-full items-baseline gap-2">
        <span class={`min-w-0 flex-1 truncate ${props.current ? "text-accent" : ""}`}>
          {props.session.title ?? props.session.id}
        </span>
        <Show when={size()}>
          {(drawn) => <span class="shrink-0 tabular-nums text-caption text-muted">{drawn()}</span>}
        </Show>
        <Show when={whenOf(props.session.updatedAt)}>
          {(at) => <span class="shrink-0 tabular-nums text-caption text-muted">{at()}</span>}
        </Show>
      </span>
      <Show when={props.successor}>
        {(next) => (
          <span
            class="truncate text-caption text-muted"
            data-testid={TESTID.chatSessionSuperseded}
            data-successor={next().id}
          >
            Replaced by {next().title ?? next().id}
          </span>
        )}
      </Show>
    </button>
  )
}
