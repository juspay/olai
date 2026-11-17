/**
 * THE DOOR — how a chat about a note is started from that note: the seat's box
 * at the foot of the page, the side panel's **This page** block beside it, and
 * the palette's **Chat about this page** level (`./AgentPalette.ts`). All three
 * send through {@link sendAbout}, so a refusal means one thing everywhere.
 *
 * Sending writes the tie into the note's own front matter, starts the agent and
 * hands it the words, once, through the server (`./new-chat.ts`'s `about`). A
 * refused start leaves the words in the box and says why; the note keeps the
 * engine it was asked for, so a retry starts on the same note rather than
 * making a second chat anywhere (`../../server/new-chat.ts`).
 *
 * A door is offered while the note has no conversation (`talking`), not only
 * while it has no tie: a note whose start was refused is still its own door.
 */
import { batch, createMemo, createSignal, Show, type Accessor } from "solid-js"
import { Dynamic } from "solid-js/web"
import { UsageFailure } from "@olai/format"
import { MARK_BOX } from "@olai/ui-primitives/mark.ts"
import { useRouter } from "olai-plugin-navigation/routing"
import { TESTID } from "../../testids.ts"
import { fileMark } from "../kinds.ts"
import { keepMessage } from "../chat/message-draft.ts"
import { useAgents } from "./answered.tsx"
import { agentReadings } from "./reading.ts"
import { AskBox } from "./AskBox.tsx"
import { unfold } from "./folding.ts"
import { talking } from "./roster.ts"

/** The words under the box, which say what sending does. */
export const ABOUT_NOTE = "Sending starts a chat about this note · the chat is kept in its front matter"

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
 *   - a start that stopped at sign-in: the note's chat exists with no
 *     conversation yet, so the words become its unsent words, which the page
 *     session hands to the conversation once it opens;
 *   - a conversation the first message did not reach: the words wait in its
 *     composer, with the sentence over it.
 *
 * Anything that started opens the seat's fold, so the person sees it.
 */
export const sendAbout = async (input: { readonly path: string; readonly engine: string; readonly text: string }): Promise<Sent> => {
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
 * THE DOOR, as a box: a note's path and name, and the words to start a chat
 * about it with — kept by the activation for this box on this note, so a
 * refused start, or leaving the page, leaves them where they are. `started` is
 * told what came of a press that started something (the side panel docks a
 * conversation; the seat docks one on a desktop).
 */
export function AboutBox(props: {
  readonly where: "seat" | "panel"
  readonly path: Accessor<string>
  readonly name: Accessor<string>
  readonly started?: (sent: Sent & { readonly started: string }) => void
}) {
  const owner = () => ({ kind: "door", where: props.where, path: props.path() }) as const
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
      const sent = await sendAbout({ path: props.path(), engine, text })
      if (sent.started === null) { setFailure(sent.said); return }
      agentReadings()?.setUnsent(sentFrom, "")
      props.started?.({ ...sent, started: sent.started })
    } finally { setStarting(false) }
  }
  return <AskBox name={props.name()} draft={draft} setDraft={setDraft} starting={starting} failure={failure}
    send={(engine) => void send(engine)} note={ABOUT_NOTE} testid={TESTID.chatAbout} where={props.where} />
}

/**
 * THE SIDE PANEL'S **This page** BLOCK, over its picker — the same door, beside
 * the page rather than under it, offered exactly where the page in front is a
 * note with a seat, has no conversation on it, and an agent can start. Sending
 * docks the new chat, so the conversation that just started is the one beside
 * the page; a refused start leaves whatever was docked alone.
 */
export function ThisPage(props: { readonly open: (node: string) => void }) {
  const agents = useAgents()
  const router = useRouter()
  const seat = createMemo(() => {
    const pane = router.panes()[router.focusIndex()]
    const here = pane === undefined ? undefined : agentReadings()?.seatIn(pane.id)
    if (here === undefined || agents.engines().length === 0) return undefined
    return talking(agents.chatOf({ kind: "note", path: here.path })) ? undefined : here
  })
  return (
    <Show when={seat()} keyed>
      {(here) => {
        const mark = () => fileMark(here.path)
        return (
          <section class="mb-2 px-1" data-testid={TESTID.chatThisPage} data-note={here.path}>
            <p class="m-0 px-2 pb-1 pt-2 text-caption font-semibold uppercase tracking-[0.08em] text-muted">This page</p>
            <p class="m-0 flex items-baseline gap-2 px-2 pb-2 text-body">
              <Show when={mark()}>{(drawn) => <span class={`${MARK_BOX} self-center text-muted`}><Dynamic component={drawn()} /></span>}</Show>
              <span class="min-w-0 truncate">{here.name}</span>
              <span class="min-w-0 flex-1 truncate font-mono text-caption text-muted">{here.path}</span>
              <span class="shrink-0 text-caption text-muted">No chat yet</span>
            </p>
            <AboutBox where="panel" path={() => here.path} name={() => here.name}
              started={(sent) => { if (sent.talking) props.open(sent.started) }} />
          </section>
        )
      }}
    </Show>
  )
}
