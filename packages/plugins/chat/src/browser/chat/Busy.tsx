import { Show } from "solid-js"

import { TESTID } from "../../testids.ts"
import { type Busy as Doing, busyIn } from "./busy.ts"
import { LIVE_DOT } from "./live.ts"
import type { Chat } from "./state.ts"

const saying = (doing: Doing): string => {
  if (doing.kind === "waiting") return "Waiting on your answer"
  if (doing.kind === "starting") {
    return doing.agent === null ? "Starting…" : `Starting ${doing.agent}…`
  }
  return doing.agent === null ? "Working…" : `${doing.agent} is working…`
}

export function Busy(props: { readonly chat: Chat }) {
  const doing = () => {
    const busy = busyIn(props.chat.state())
    return busy === null ? null : saying(busy)
  }
  return (
    <Show when={doing()}>
      {(what) => (
        <div
          class="flex shrink-0 items-center gap-2 border-t border-rule px-3 py-1.5 text-label text-doing"
          data-testid={TESTID.chatBusy}
          aria-live="polite"
        >
          <span class={LIVE_DOT} aria-hidden="true" />
          <span class="truncate">{what()}</span>
        </div>
      )}
    </Show>
  )
}
