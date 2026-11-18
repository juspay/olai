/**
 * THE DOOR, AS A BOX — the *Ask about <name>…* box a chat page draws for an
 * item that has no chat yet (`./ChatPage.tsx`).
 *
 * The press itself is `./send-about.ts`, which the line at the top of a note
 * and the palette's levels share with this box: a refusal means one thing
 * everywhere, and the levels load it without loading a renderer.
 */
import { batch, createSignal, type Accessor } from "solid-js"
import { type AgentItem, itemKey } from "@olai/format"
import { TESTID } from "../../testids.ts"
import { agentReadings } from "./reading.ts"
import { AskBox } from "./AskBox.tsx"
import { ABOUT_NODE, ABOUT_NOTE, sendAbout, type Sent } from "./send-about.ts"

/**
 * THE DOOR, as a box: an item, what it is called, and the words to start a
 * chat about it with — kept by the activation for this box on this item, so a
 * refused start, or leaving the page, leaves them where they are. `started` is
 * told what came of a press that started something.
 */
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
