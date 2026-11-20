import { hasText } from "./carried.ts"
import { Grip, textCarry } from "./Grip.tsx"
import { textOf } from "./carried.ts"

import { createMemo, Show } from "solid-js"

import type { ChatEntry } from "olai-plugin-chat/wire"
import { TESTID } from "../../testids.ts"
import { doorOf } from "./door.ts"
import { useConversationUI } from "./ui.tsx"
import { whoOf } from "./spawn.ts"
import { Entry } from "./Entry.tsx"
import type { Lane } from "./lanes.ts"
import { RAIL } from "./lanes.ts"
import { LIVE_DOT } from "./live.ts"
import type { Rail } from "./rail.ts"
import { type Faced, Speaker } from "./Speaker.tsx"
import type { Chat } from "./state.ts"

export function Row(props: {
  readonly entry: ChatEntry
  readonly chat: Chat
  readonly lane: Lane | null
  readonly rail: Rail | null
  readonly speaker: Faced | null
}) {
  const words = () => textOf(props.chat.entry(props.entry.id)() ?? props.entry)
  const carry = textCarry(words)
  const { isPreviewing, togglePreview } = useConversationUI().previewing
  const calls = createMemo(() => whoOf(props.entry) === null ? 0 : props.chat.lanes().get(props.entry.id)?.length ?? 0)
  const door = createMemo(() => {
    const at = doorOf(props.entry, calls())
    return at.kind === "door" ? at.label : undefined
  })
  return (
    <div
      class="group/row relative ml-4" onPointerDown={carry.touch} onContextMenu={carry.heldMenu}
      classList={{
        [RAIL]: props.lane !== null,
        "pb-2": props.rail === null && door() === undefined,
      }}
      data-testid={props.lane === null ? undefined : TESTID.chatLane}
      data-lane={props.lane?.parent}
    >
      <Show when={props.speaker}>
        {(faced) => <Speaker party={faced().party} agent={faced().agent} />}
      </Show>
      <Show when={props.lane?.label}>
        {(label) => (
          <p
            class="mb-1 flex min-w-0 items-center gap-1 text-caption text-muted"
            data-testid={TESTID.chatLaneLabel}
          >
            <span aria-hidden="true">↳</span>
            <span class="min-w-0 truncate">{label()}</span>
          </p>
        )}
      </Show>
      <div class="absolute -left-4 top-0"><Grip has={hasText(props.chat.entry(props.entry.id)() ?? props.entry)} carry={carry} /></div>
      <Entry entry={props.entry} chat={props.chat} />
      <Show when={props.rail}>
        {(rail) => (
          <div class={`${RAIL} ${door() === undefined ? "pb-2" : ""} pt-1`}>
            <p
              class="flex items-center gap-1 text-caption text-doing"
              data-testid={rail().name}
              data-lane={props.entry.id}
              aria-live="polite"
            >
              <span class={LIVE_DOT} aria-hidden="true" />
              {rail().said}
            </p>
          </div>
        )}
      </Show>
      <Show when={door()}>
        {(label) => (
        <div class={`${RAIL} pb-2 pt-1`}>
          <button
            type="button"
            class="flex items-center gap-1 rounded-control text-caption text-muted hover:text-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent"
            data-testid={TESTID.chatLaneDoor}
            data-lane={props.entry.id}
            aria-expanded={isPreviewing(props.entry.id)}
            onClick={() => togglePreview(props.entry.id)}
          >
            <span aria-hidden="true">↳</span>
            <span class="min-w-0 truncate">{label()}</span>
          </button>
        </div>
        )}
      </Show>
    </div>
  )
}
