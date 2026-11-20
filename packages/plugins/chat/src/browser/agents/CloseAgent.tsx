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
        fold(props.node)
        closeMade(props.node)
      },
    )
  }

  return <span class="relative">
    <Tip text={closeTip(props.node)}>
      <button type="button" class={LINE_VERB} data-testid={TESTID.chatCloseAgent}
        disabled={closing()} aria-busy={closing()}
        onClick={close}>Close<span class="sr-only"> the chat. {closeCost(props.node)}</span></button>
    </Tip>
  </span>
}
