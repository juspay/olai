import { createSignal, Show } from "solid-js"
import { memoryOf } from "@olai/format"
import { QUIET_PILL } from "@olai/web/client/pill.ts"
import { run } from "@olai/web/client/run.ts"
import { createSaying } from "@olai/web/client/saying.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { chatWire } from "../wire.ts"
import { agentReadings } from "./reading.ts"
import type { Row } from "./roster.ts"
import { TESTID } from "../../testids.ts"

/** The node's fresh-start gesture is independent of which of its sessions the
 * reader has open. The pending owner guards physical repeat presses. */
export function FreshStart(props: { readonly agent: Row }) {
  const saying = createSaying()
  const [starting, setStarting] = createSignal(false)

  const fresh = (): void => {
    if (starting()) return
    const reading = agentReadings()
    const node = props.agent.id
    const engine = props.agent.engine
    setStarting(true)
    saying.say(undefined)
    run(
      chatWire().procedures.conversation.startAgentSession({
        node,
        agent: engine,
      }),
      (failure) => {
        setStarting(false)
        saying.say({ tone: "alarm", text: failure.message, kind: failure._tag })
      },
      () => {
        setStarting(false)
        if (agentReadings() === reading) reading?.visit(node)
        // The completed history revision refreshes this tab and its siblings.
      },
    )
  }

  return <span class="relative">
    <button type="button" class={QUIET_PILL} data-testid={TESTID.chatFreshSession}
      data-agent={props.agent.id} disabled={starting()} aria-busy={starting()}
      title={`memory is the subtree (${memoryOf(props.agent)}); the transcript becomes history`}
      onClick={fresh}>fresh start</button>
    <Show when={saying.said()}>{said => <SaidLine said={said()} testid={TESTID.chatFreshSaid} class="mt-1 text-xs" />}</Show>
  </span>
}
