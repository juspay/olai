/** A row in a node agent's past-session list: title, available count and date,
 * replacement link, selection and the caller's open gesture. The list itself
 * belongs to the fold/page history line. */

import { Show } from "solid-js"

import type { SessionInfo } from "olai-plugin-chat/wire"
import { TESTID, type ChatTestId } from "../../testids.ts"
import { whenOf } from "./when.ts"

export function Conversation(props: {
  readonly session: SessionInfo
  /** The conversation that replaced this one, when it is on the screen —
   *  `undefined` when the `supersededBy` id names nothing the list knows: the
   *  row it pointed at can be gone, and a named successor is the whole of the
   *  hint's worth, so without one the line says nothing. */
  readonly successor: SessionInfo | undefined
  /** Whether this is the conversation the panel is already in. Passed rather
   *  than looked up, so the row does not need the cell. */
  readonly current: boolean
  /** What to call this row, for a scenario — the list's own name by default,
   *  and the node agent's own where the row is one of ITS past sessions. Two
   *  names because they are two claims: *the directory holds this chat* and
   *  *this agent has had this conversation* are asserted separately, and the
   *  same row can be both. */
  readonly testid?: ChatTestId
  readonly onPick: () => void
}) {
  /** The agent's own count of the conversation, drawn when it was SENT:
   *  `null` is nobody's answer and draws nothing rather than a zero of our
   *  own, and zero itself is an answer — a conversation nobody has spoken in
   *  yet — which is the one a `0 messages` cell exists to make visible. */
  const size = (): string | null => {
    const count = props.session.messageCount
    if (count === null) return null
    return `${count} ${count === 1 ? "message" : "messages"}`
  }
  return (
    <button
      type="button"
      class="flex w-full flex-col rounded px-2 py-1 text-left text-xs hover:bg-rule"
      data-testid={props.testid ?? TESTID.chatSession}
      data-session-id={props.session.id}
      data-agent={props.session.agent}
      data-current={props.current}
      // Loading the conversation you are already in would throw away a
      // transcript to replace it with the same one.
      disabled={props.current}
      onClick={() => props.onPick()}
    >
      <span class="flex w-full items-baseline gap-2">
        <span class={`min-w-0 flex-1 truncate ${props.current ? "text-accent" : ""}`}>
          {props.session.title ?? props.session.id}
        </span>
        <Show when={size()}>
          {(drawn) => <span class="shrink-0 font-mono text-[0.625rem] text-muted">{drawn()}</span>}
        </Show>
        {/* The stamp does not shrink and the title does: two rows that share a
            title (a `/clear` leaves a pair) differ in nothing else, so the one
            thing that tells them apart may not be the thing a long title pushes
            off the end. */}
        <Show when={whenOf(props.session.updatedAt)}>
          {(at) => <span class="shrink-0 font-mono text-[0.625rem] text-muted">{at()}</span>}
        </Show>
      </span>
      <Show when={props.successor}>
        {(next) => (
          <span
            class="truncate text-[0.625rem] text-muted"
            data-testid={TESTID.chatSessionSuperseded}
            data-successor={next().id}
          >
            superseded by {next().title ?? next().id}
          </span>
        )}
      </Show>
    </button>
  )
}
