import { batch, createSignal, type Accessor } from "solid-js"
import { type AgentItem, itemKey } from "@olai/format"
import { TESTID } from "../../testids.ts"
import { agentReadings } from "./reading.ts"
import { AskBox } from "./AskBox.tsx"
import { ABOUT_NODE, ABOUT_NOTE, sendAbout, type Sent } from "./send-about.ts"

export function AboutBox(props: {
  readonly where: "line" | "page"
  readonly item: Accessor<AgentItem>
  readonly name: Accessor<string>
  readonly started?: (sent: Sent & { readonly started: string }) => void
}) {
  const owner = () => ({ kind: "door", where: props.where, item: itemKey(props.item()) }) as const
  const draft = () => agentReadings()?.unsent(owner()) ?? ""
  const setDraft = (text: string) => agentReadings()?.setUnsent(owner(), text)
  const [starting, setStarting] = createSignal(false)
  const [failure, setFailure] = createSignal<string | null>(null)
  const send = async (engine: string) => {
    const text = draft()
    const sentFrom = owner()
    if (starting() || text.trim() === "") return
    batch(() => { setStarting(true); setFailure(null) })
    try {
      const sent = await sendAbout({ item: props.item(), engine, text })
      if (sent.started === null) { setFailure(sent.said); return }
      agentReadings()?.setUnsent(sentFrom, "")
      props.started?.({ ...sent, started: sent.started })
    } finally { setStarting(false) }
  }
  return <AskBox name={props.name()} draft={draft} setDraft={setDraft} starting={starting} failure={failure}
    send={(engine) => void send(engine)} note={props.item().kind === "note" ? ABOUT_NOTE : ABOUT_NODE}
    testid={TESTID.chatAbout} where={props.where} />
}
