import { createSignal, Show } from "solid-js"
import { LINE_VERB } from "./verb.ts"
import { run } from "@olai/web/client/run.ts"
import { createSaying } from "@olai/web/client/saying.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { chatWire } from "../wire.ts"
import { fold } from "./folding.ts"
import { TESTID } from "../../testids.ts"
import { Tip } from "@olai/web/client/Tip.tsx"

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
    <Tip text="Close the agent. The chat moves to Chats.">
      {/* WHERE THE CHAT GOES, in the button's own name: "Close" alone does
          not say that the conversation survives under Chats, and the tip is
          drawn rather than spoken. The visible word stays first, so the name
          still begins with the label a person reads (WCAG 2.5.3). */}
      <button type="button" class={LINE_VERB} data-testid={TESTID.chatCloseAgent}
        disabled={closing()} aria-busy={closing()}
        onClick={close}>Close<span class="sr-only"> the agent. The chat moves to Chats.</span></button>
    </Tip>
  </span>
}
