import { createSignal, Show } from "solid-js"
import { QUIET_PILL } from "@olai/web/client/pill.ts"
import { run } from "@olai/web/client/run.ts"
import { createSaying } from "@olai/web/client/saying.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { chatWire } from "../wire.ts"
import { fold } from "./folding.ts"
import { TESTID } from "../../testids.ts"

/** The node's close gesture: take the binding property off, so the seat
 *  closes and the conversation becomes an unclaimed chat again — the next
 *  filer run files it back under Chats. Nothing is superseded and nothing is
 *  deleted — the transcript, its history and the subtree memory stay. The
 *  pending owner guards physical repeat presses. */
export function CloseAgent(props: { readonly node: string }) {
  const saying = createSaying()
  const [closing, setClosing] = createSignal(false)

  const close = (): void => {
    if (closing()) return
    setClosing(true)
    saying.say(undefined)
    run(
      chatWire().procedures.conversation.closeAgent({ node: props.node }),
      (failure) => {
        setClosing(false)
        saying.say({ tone: "alarm", text: failure.message, kind: failure._tag })
      },
      () => {
        setClosing(false)
        // The binding is gone; closing the fold makes it visible now.
        fold(props.node)
      },
    )
  }

  return <span class="relative">
    <button type="button" class={QUIET_PILL} data-testid={TESTID.chatCloseAgent}
      disabled={closing()} aria-busy={closing()}
      title="close the agent: the conversation goes back to the unclaimed chats, filed under Chats — nothing is deleted"
      onClick={close}>close</button>
  </span>
}
