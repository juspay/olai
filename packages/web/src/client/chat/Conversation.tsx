/**
 * ONE STORED CONVERSATION, as a row — the same row wherever conversations are
 * listed.
 *
 * There is one list of stored conversations in this app now: the chats no node
 * claims (`../agents/Unassigned.tsx`), with a node agent's own past sessions
 * ({@link ./NodeSessions.tsx}) as the one other place a row of this kind is
 * drawn. Both draw the same four facts — what the conversation is called, how
 * big it is, when it was last touched, and which conversation replaced it — so
 * both draw them through here.
 *
 * It was the session picker's own `Row`, and it moved out for the reason it was
 * extracted from that component in the first place, one altitude up: the second
 * list would otherwise have been a second idea of what a conversation row says,
 * and the one a person met second would be the one that looked wrong.
 *
 * It takes what it draws and what to do about a click, and knows nothing about
 * groups, lists or agents.
 */

import { Show } from "solid-js"

import type { SessionInfo } from "@olai/surface"

import { TESTID, type TestId } from "../testids.ts"
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
  readonly testid?: TestId
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
