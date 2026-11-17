/**
 * THE DOOR — how a chat about an ITEM is started where that item is: the
 * one-row box in the line at the top of a note (`./NoteLine.tsx`), the
 * palette's **Chat about this page** level (`./AgentPalette.ts`), and the
 * *Ask about <name>…* box a chat page draws for an item that has no chat yet
 * (`./ChatPage.tsx`). All of them send through {@link sendAbout}, so a refusal
 * means one thing everywhere.
 *
 * Sending writes the tie where that kind of item keeps one — a note's own
 * front matter, a node's row — starts the agent and hands it the words, once,
 * through the server (`./new-chat.ts`'s `about`). A refused start leaves the
 * words in the box and says why; the item keeps the engine it was asked for,
 * so a retry starts on the same item rather than making a second chat
 * anywhere (`../../server/new-chat.ts`).
 *
 * A door is offered while the item has no conversation (`talking`), not only
 * while it has no tie: an item whose start was refused is still its own door.
 */
import { batch, createSignal, type Accessor } from "solid-js"
import { type AgentItem, itemKey, UsageFailure } from "@olai/format"
import { TESTID } from "../../testids.ts"
import { keepMessage } from "../chat/message-draft.ts"
import { agentReadings } from "./reading.ts"
import { AskBox } from "./AskBox.tsx"
import { unfold } from "./folding.ts"

/** The words under the box, which say what sending does — one sentence per
 *  kind of item, because what carries the tie and what the memory IS are
 *  different facts about the two. */
export const ABOUT_NOTE = "Sending starts a chat about this note · the chat is kept in its front matter"
export const ABOUT_NODE = "Sending starts a chat about this node · the rows under it are its memory"

/** What one press of a door came to: the chat row that now has a conversation
 *  (or is waiting at sign-in), or `null` with the sentence that says why not —
 *  in which case the words stay where they were typed. */
export interface Sent {
  readonly started: string | null
  readonly talking: boolean
  readonly said: string | null
}

/**
 * ONE PRESS OF A DOOR.
 *
 *   - nothing created, or a start the agent refused: the words stay in the box
 *     that sent them, and the sentence is shown;
 *   - a start that stopped at sign-in: the item's chat exists with no
 *     conversation yet, so the words become its unsent words, which the page
 *     session hands to the conversation once it opens;
 *   - a conversation the first message did not reach: the words wait in its
 *     composer, with the sentence over it.
 *
 * Anything that started opens the item's fold, so the person sees it.
 */
export const sendAbout = async (input: { readonly item: AgentItem; readonly engine: string; readonly text: string }): Promise<Sent> => {
  const reading = agentReadings()
  if (reading === undefined) return { started: null, talking: false, said: "Chat isn't available" }
  const made = await reading.newChat.about(input)
  if (typeof made === "string") return { started: null, talking: false, said: made }
  if (made.to === null && made.refusal !== null) return { started: null, talking: false, said: made.refusal }
  if (made.to === null) {
    const row = { kind: "row", node: made.node } as const
    const waiting = reading.unsent(row)
    reading.setUnsent(row, waiting === "" ? input.text : `${input.text}\n${waiting}`)
  } else if (made.refusal !== null) {
    const ui = reading.ui(made.to)
    keepMessage(ui.messages, JSON.stringify([made.to.agent, made.to.session]), input.text, true)
    ui.refused[1](new UsageFailure({ reason: made.refusal }))
  }
  unfold(made.node)
  return { started: made.node, talking: made.to !== null, said: null }
}

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
