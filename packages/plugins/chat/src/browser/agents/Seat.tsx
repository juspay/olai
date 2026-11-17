/**
 * THE SEAT, FILLED — what chat draws at the foot of a page that placed one
 * (`olai-plugin-navigation/seat`): the chat about that NOTE, folded or open,
 * or the box that starts one (`./Door.tsx`).
 *
 * ONLY A NOTE HAS ONE. A chat belongs to a node or to a `.md` file and to
 * nothing else, so on an outline, on a file olai only shows (a `.csv`, a
 * picture, a PDF, a saved page) and on a plugin's page this draws nothing at
 * all — `./here.ts` is the whole of that rule, and a page frame that places a
 * seat is not promised one will appear in it.
 *
 * ## The seat is the note's fold
 *
 * Opening a page must never wake its agent: nothing else in olai starts an
 * agent process without a press, and eight may be awake at once. So with a chat
 * there, the seat is FOLDED by default — one line, the agent's mark and how it
 * stands, which reads nothing and wakes nothing. That line is the seat's head
 * and its control, exactly as a row's standing is the row's: pressing it opens
 * the conversation under it, and pressing it again folds it away. It also
 * opens when a chat is started from one of the note's doors, and when the chat
 * is opened from **Chats**, **Needs you** or the palette (`./focus.ts`'s
 * `visitAgent`). Open, it draws what a row's fold draws: the agent line, the
 * strips, the conversation and its composer. The choice is remembered for this
 * tab under the chat's key, the key a row's own fold uses (`./folding.ts`).
 *
 * With no conversation on the note, the seat is the door's box. With no agent
 * this machine can start and no chat, there is no door to offer and the seat
 * draws nothing.
 *
 * A seat on screen tells the activation it is there (`./reading.ts`'s `seat`),
 * which is how the side panel's **This page** block and the palette's **Chat
 * about this page** know the page in front is a note with a seat at all.
 */
import { createEffect, createMemo, Show } from "solid-js"
import type { SeatProps } from "olai-plugin-navigation/contract"
import { usePane } from "olai-plugin-navigation/pane"
import { TESTID } from "../../testids.ts"
import { dock } from "../dock.ts"
import { ConversationUIProvider } from "../chat/ui.tsx"
import { useAgents } from "./answered.tsx"
import { agentReadings } from "./reading.ts"
import { noteHere } from "./here.ts"
import { servedDirectory } from "../vault.ts"
import { usePage } from "./Page.tsx"
import { AgentLine } from "./AgentLine.tsx"
import { Conversation } from "./Fold.tsx"
import { AgentStanding } from "./Standing.tsx"
import { AboutBox } from "./Door.tsx"
import { talking } from "./roster.ts"
import { unfolded } from "./folding.ts"

export function ChatSeat(props: SeatProps) {
  const agents = useAgents()
  const pane = usePane()
  const note = createMemo(() => noteHere(servedDirectory()?.claims(), props.place))
  const chat = createMemo(() => {
    const path = note()
    return path === null ? undefined : agents.chatOf({ kind: "note", path })
  })
  // REGISTERED FROM AN EFFECT, AS VALUES: the side panel and the palette read
  // this from outside the page, and a closure over this page's props would let
  // them read a page that is being left (Solid's stale-accessor error). An
  // effect never runs for a disposed page, and re-registers when the page says
  // it is a different note — or stops being one.
  createEffect(() => {
    const path = note()
    const reading = agentReadings()
    if (pane !== undefined && path !== null) reading?.seat({ pane: pane.id, path, name: props.name })
  })
  return (
    <Show when={note()}>{(path) =>
      <Show when={chat() !== undefined || agents.engines().length > 0}>
        <section class="mt-12" data-testid={TESTID.chatSeat} data-note={path()}>
          <header class="mb-3 flex items-center gap-3 text-caption font-semibold uppercase tracking-[0.08em] text-muted">
            <span>Chat about this page</span>
            <span class="h-px flex-1 bg-rule" aria-hidden="true" />
            <Show when={!talking(chat())}><span class="font-normal normal-case tracking-normal">No chat yet</span></Show>
          </header>
          {/* KEYED ON THE CHAT'S KEY and not its row: the roster mints fresh
              rows every frame, and a conversation remounted per frame would be
              one re-read per frame. */}
          <Show when={talking(chat()) ? chat()!.id : undefined} keyed fallback={<AboutBox where="seat" item={() => ({ kind: "note", path: path() })} name={() => props.name}
            started={(sent) => { const door = dock(); if (sent.talking && door?.desktop()) door.open(sent.started) }} />}>
            {(id) => <>
              <Show when={agents.at(id)}>{(row) =>
                <div class="mb-2 flex items-center gap-2 text-label text-muted" data-testid={TESTID.chatSeatLine} data-chat={id} data-folded={String(!unfolded(id))}>
                  <AgentStanding row={row()} fold={id} />
                </div>}</Show>
              <Show when={unfolded(id)}><SeatChat node={id} /></Show>
            </>}
          </Show>
        </section>
      </Show>
    }</Show>
  )
}

/** The seat open: the chat row's conversation, through the row page's own
 *  session — which is also what hands it words a sign-in held up. */
function SeatChat(props: { readonly node: string }) {
  const page = usePage(() => props.node)
  return (
    <Show when={page()?.chat()} keyed fallback={<p class="m-0 py-2 text-label text-muted">Opening…</p>}>
      {(chat) => (
        <div class="rounded-surface border border-rule bg-panel shadow-raised" data-chat={props.node}>
          <AgentLine chat={chat} node={props.node} />
          <ConversationUIProvider value={chat.ui}><Conversation chat={chat} node={props.node} /></ConversationUIProvider>
        </div>
      )}
    </Show>
  )
}
