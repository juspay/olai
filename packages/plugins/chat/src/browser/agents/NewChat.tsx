import { TESTID } from "../../testids.ts"
import { HEAD_ACTION } from "olai-plugin-layout/entry"
import { agentReadings } from "./reading.ts"

/** Opening never spends the draft or starts an engine. */
export function NewChat() {
  return <button type="button" class={HEAD_ACTION} data-testid={TESTID.chatNew}
    aria-label="New chat" title="New chat" onClick={() => void agentReadings()?.newChat.open()}>
    <span aria-hidden="true">+</span>
  </button>
}
