import { createSignal, Show } from "solid-js"
import { LINE_VERB } from "./verb.ts"
import { run } from "@olai/web/client/run.ts"
import { createSaying } from "@olai/web/client/saying.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { chatWire } from "../wire.ts"
import { fold } from "./folding.ts"
import { TESTID } from "../../testids.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { closeCost, closeMade, closeTip } from "./closing.ts"

/** The item's close gesture: take the tie off, so the conversation is this
 *  row's or this note's no longer. Nothing is superseded and nothing is
 *  deleted — the transcript stays in the engine's own store and a node's
 *  memory rows stay under it — but nothing in olai lists that conversation
 *  afterwards, which is what the words say (`./closing.ts`). The pending
 *  owner guards physical repeat presses. */
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
        // ...and a page drawing this chat forgets the conversation it was
        // reading, because this press is why it stopped (`./closing.ts`).
        closeMade(props.node)
      },
    )
  }

  return <span class="relative">
    <Tip text={closeTip(props.node)}>
      {/* WHAT THE PRESS COSTS, in the button's own name: "Close" alone does
          not say that the conversation is listed nowhere afterwards, and the
          tip is drawn rather than spoken. The visible word stays first, so
          the name still begins with the label a person reads (WCAG 2.5.3). */}
      <button type="button" class={LINE_VERB} data-testid={TESTID.chatCloseAgent}
        disabled={closing()} aria-busy={closing()}
        onClick={close}>Close<span class="sr-only"> the chat. {closeCost(props.node)}</span></button>
    </Tip>
  </span>
}
