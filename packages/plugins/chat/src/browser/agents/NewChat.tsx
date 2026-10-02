import { createSignal, Show } from "solid-js"
import { TESTID } from "../../testids.ts"
import { HEAD_ACTION } from "olai-plugin-layout/entry"
import { agentReadings } from "./reading.ts"

/** Opening never spends the draft or starts an engine. */
export function NewChat() {
  const [failure, fail] = createSignal<string | null>(null)
  return <><button type="button" class={HEAD_ACTION} data-testid={TESTID.chatNew}
    aria-label="New chat" title="New chat" onClick={async () => {
      // Let the click bubble so the sidebar dismisses its phone drawer.
      const owner = agentReadings()?.newChat
      fail(owner === undefined ? "Chat isn't available" : await owner.open())
    }}>
    <svg viewBox="0 0 16 16" class="size-3.5" aria-hidden="true" fill="currentColor">
      <path d="M8 2.75a.75.75 0 0 1 .75.75v3.75h3.75a.75.75 0 0 1 0 1.5H8.75v3.75a.75.75 0 0 1-1.5 0V8.75H3.5a.75.75 0 0 1 0-1.5h3.75V3.5A.75.75 0 0 1 8 2.75z" />
    </svg>
  </button><Show when={failure()}>{message => <p role="alert" class="text-label text-alarm">{message()}</p>}</Show></>
}
