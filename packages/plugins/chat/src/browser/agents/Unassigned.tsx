/**
 * THE CHATS NOBODY HAS GIVEN A NODE — the panel's body, opened from the
 * roster's last row, and the one place a conversation is assigned to a node.
 *
 * Migration is ASSOCIATION, NOT CONVERSION: nothing moves on disk, no
 * transcript is copied anywhere, and the session file stays exactly where its
 * agent keeps it. What a press here writes is one property on one node — and
 * from that frame the conversation is that node agent's current session, with
 * its context intact. A home, not an abandonment.
 *
 * ## Why it is the PANEL and not a modal
 *
 * Because that is where the conversations are. Every other door onto a stored
 * chat in this app is the panel's own — the picker, the roster, `+ new` — and a
 * list of conversations that opened over the outline would be the one place you
 * pick a conversation with the board behind it rather than the panel it will
 * appear in. It takes the panel's body ({@link ../chat/Panel.tsx}) the way the
 * *which agent* question does, and for the same reason: it is a question with
 * no conversation in it.
 *
 * It is THIS TAB'S ({@link ./showing.ts}), like that question is. A second tab
 * goes on showing whatever conversation it was in.
 *
 * ## The rows are every conversation list's own
 *
 * One answer, one grouping, one set of words: `chat.sessions` asked of every
 * installed agent, grouped by whose the conversations are
 * ({@link ../chat/grouped.ts}), each row saying how big it is and when it was
 * last touched ({@link ../chat/when.ts}). A second list of conversations with a
 * second idea of what a conversation row says would be two answers to *what
 * chats are here*, and the one a person met second would be the one that looked
 * wrong.
 *
 * What differs is WHICH rows and WHAT A PRESS MEANS. The rows are the ones no
 * node claims ({@link ./lineage.ts}) — a conversation some node agent is
 * already talking through is not waiting for a home, and neither is one in its
 * history. And the press is *assign to node…* rather than *open*: opening is
 * still here, on the title, because the honest first question about a chat from
 * three weeks ago is *which one is this*.
 *
 * ## WHAT COULD NOT BE ASKED IS NAMED HERE, in both of its sizes
 *
 * An agent whose stored conversations could not be read is a row of the answer
 * rather than a silence (`olai-plugin-chat`'s `listings.ts`), and it is drawn AFTER
 * the conversations and BESIDE them: one agent being unaskable is a fact about
 * that agent, and taking the others' conversations off the screen for it is the
 * bug the fan-out was the fix for. The whole ask not landing — a dropped
 * socket — is the same sentence about a larger subject and gets its own line,
 * with the last answer still drawn above it.
 *
 * Both matter more here than they did in the picker they came from: this is the
 * ONLY list of stored conversations in the app now, so an unread disk drawn as
 * an empty list would be the whole app claiming there is nothing to migrate.
 * Which is also why *every conversation belongs to a node agent* is said only
 * where every agent actually answered.
 *
 * ## `@` NODE-COMPLETION, which is the search every other picker uses
 *
 * The target is chosen with {@link ../search/Shortlist.tsx} — the same box, the
 * same debounce, the same server-side matcher and the same rows the edge panel
 * and the move picker take a node with. A private matcher here would mean the
 * same word finding different rows in two panels of one app, which is the drift
 * docs/search.md exists to forbid.
 *
 * A NODE THAT IS ALREADY TALKING through a conversation is dimmed and says why,
 * which is the shortlist's own `refusing` slot: *one agent, one current
 * session*. The rule is drawn from the roster this tab holds, and it is a
 * COURTESY rather than the check — the server reads it again against its own
 * revision, because a tab decides against the frame it was drawn on and two
 * tabs can be looking at one node (`@olai/server`'s `assignSession`).
 *
 * A BARE NODE IS OFFERED, and that is the same ruling *start an agent session*
 * already keeps one gesture over: the press WRITES the property, so this is how
 * a node agent comes into being as much as it is how one gets a session.
 */

import { createMemo, createSignal, For, Show } from "solid-js"
import { chatWire } from "../wire.ts"

import type { NodeHit } from "@olai/surface"
import type { SessionInfo } from "olai-plugin-chat/wire"
import { type Grouped, groupedByAgent, nameOf } from "../chat/grouped.ts"
import { AgentMark } from "../chat/AgentMark.tsx"
import { Conversation } from "../chat/Conversation.tsx"
import { run } from "@olai/web/client/run.ts"
import { createSaying } from "@olai/web/client/saying.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { Shortlist, type ShortlistTestids } from "@olai/web/client/search/Shortlist.tsx"
import { TESTID } from "../../testids.ts"
import { olai } from "@olai/web/client/wire.ts"
import { chatKey, successorIn } from "./lineage.ts"
import type { Chat } from "../chat/state.ts"
import { useAgents } from "./answered.tsx"
import { hideUnassigned } from "./showing.ts"

/** What this door calls the parts of its shortlist. It DOES fence hits, so it
 *  names the line that says why — see the header on why that line is a courtesy
 *  and not the check. */
const ASSIGN_LIST: ShortlistTestids = {
  box: TESTID.assignSearch,
  row: {
    row: TESTID.assignHit,
    place: TESTID.assignHitPlace,
    prop: TESTID.assignHitProp,
  },
  failed: TESTID.assignSearchFailed,
}

export function Unassigned(props: { readonly chat: Chat }) {
  const { unassigned, unreachable, chatsRefusal, chats, openChat, engines, at } = useAgents()
  /** Whether the panel is already IN this conversation — which is the ordinary
   *  case for somebody migrating: you are talking in a chat, and you give it a
   *  home. Marked and not pressable, for the reason every list of conversations
   *  marks it: loading the one you are in throws away a transcript to replace it
   *  with the same one. */
  const current = (chat: SessionInfo): boolean => {
    const at = openChat()
    return at !== null && at.agent === chat.agent && at.session === chat.id
  }
  /** ... and which conversation replaced it, where the list holds that one
   *  ({@link ./lineage.ts}): two `/clear` siblings both waiting for a node
   *  differ in nothing else a reader can see. */
  const successorOf = (chat: SessionInfo): SessionInfo | undefined =>
    successorIn(chats()?.sessions ?? [], chat)
  /** What a person reads for that agent ({@link ../chat/grouped.ts}) — the
   *  roster's name, never the id that came off the wire. */
  const named = (agent: string): string => nameOf(engines(), agent)
  /** WHAT THE LAST ASSIGNMENT SAID — the node it landed on, or the server's
   *  own refusal. Held by the LIST rather than by a row, for the reason the
   *  roster's own line is held by its section: the row it was about leaves this
   *  list on the frame the write lands, taking any line inside it with it. */
  const saying = createSaying()
  /** WHICH ROW HAS ITS SEARCH OPEN — one at a time, by the pair that names a
   *  conversation. One rather than a flag per row because two open searches
   *  would be two boxes competing for the arrow keys, and because assigning is
   *  a thing you do to one chat at a time. */
  const [assigning, setAssigning] = createSignal<string | null>(null)


  /** The rows, arranged by whose they are — the picker's own grouping, in the
   *  roster's order ({@link ../chat/grouped.ts}). */
  const groups = createMemo((): ReadonlyArray<Grouped> =>
    groupedByAgent(unassigned(), engines())
  )
  /** ONE agent installed is no heading, which is the picker's rule read at this
   *  door: a heading over the whole list says what the panel's header already
   *  says. */
  const headed = createMemo(() => groups().length > 1)

  /** Why this node cannot take the conversation, or `null` for one that can.
   *  Off the roster this tab holds, which is the same reading the sidebar draws
   *  from — so a row dimmed here and a row reading *asleep* over there are one
   *  answer. */
  const refusing = (hit: NodeHit): string | null => {
    const row = at(hit.id)
    if (row === undefined || row.session === null) return null
    return `already talking through a conversation — one agent, one current session`
  }

  /** Give this conversation to that node. */
  const assign = (chat: SessionInfo, hit: NodeHit): void => {
    saying.say(undefined)
    run(
      chatWire().procedures.conversation.assignSession({
        node: hit.id,
        agent: chat.agent,
        session: chat.id,
      }),
      (failure) => saying.say({ tone: "alarm", text: failure.message, kind: failure._tag }),
      () => {
        // The row is gone from this list on the frame the property lands — the
        // roster cell moves and the difference is derived — so what is left to
        // say is which node took it, in the one place that outlives the row.
        setAssigning(null)
        saying.say({
          tone: "aside",
          text: `assigned to “${hit.title}” — it is that node agent's current session now`,
        })
      },
    )
  }

  /**
   * ... and open one, to find out which conversation it is. The panel goes back
   * to being a conversation, which is what a person pressing a chat's title
   * asked for.
   *
   * THE LIST GOES FIRST, and not on the answer: a press means *take me to that
   * conversation*, and an open can HANG — an agent still loading, a handshake —
   * so waiting for it would leave a person looking at the list they just
   * pressed out of, with no box to type in.
   *
   * THROUGH THE PANEL'S OWN VERB, and that is what makes hiding first safe: a
   * refusal has to land where the reader now IS, and `../chat/state.ts`'s
   * `verb` puts one at the foot of the transcript — the panel they are looking
   * at a beat later. Sent as a bare procedure it was reported into THIS list, a
   * line inside a panel that had just dismissed itself, and the case that
   * reaches it is ordinary: a turn in flight refuses a switch ("a turn is
   * running; cancel it before switching conversations"), so pressing a chat
   * mid-turn was a press that looked like it did nothing — the offence this
   * whole feature polices.
   */
  const open = (chat: SessionInfo): void => {
    saying.say(undefined)
    hideUnassigned()
    props.chat.loadSession(chat.agent, chat.id)
  }

  return (
    <div
      class="olai-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4"
      data-testid={TESTID.unassignedPanel}
    >
      <div class="mb-3 flex items-baseline gap-2">
        {/* THE HEADING COUNTS ONLY WHAT SOMEBODY COULD COUNT. With every agent
            answered, *0 conversations no node claims* is the good news it
            sounds like; with one that could not be asked it is a claim nobody
            is in a position to make, and the reason under the list is the
            answer instead. */}
        <p class="m-0 flex-1 text-sm text-ink">
          Unassigned{unassigned().length === 0 && unreachable().length > 0
            ? ""
            : ` — ${
              unassigned().length === 1
                ? "one conversation"
                : `${unassigned().length} conversations`
            } no node claims`}
        </p>
        {/* THE WAY OUT, back to the conversation the panel was in. The list is
            a place a person went, and everything else in this app that takes
            the panel's body has one. */}
        <button
          type="button"
          class="text-xs text-muted underline underline-offset-2"
          data-testid={TESTID.unassignedDone}
          onClick={() => hideUnassigned()}
        >
          done
        </button>
      </div>
      <p class="m-0 mb-4 text-xs text-muted">
        Assigning writes one property on the node. Nothing moves on disk: the
        conversation becomes that node agent's current session, context intact,
        and its own history comes with it.
      </p>

      <For each={groups()}>
        {(group) => (
          <>
            <Show when={headed()}>
              <p
                class="m-0 mt-3 mb-1 flex items-center gap-1.5 text-[0.625rem] text-muted"
                data-testid={TESTID.chatSessionAgent}
                data-agent={group.agent.id}
              >
                <AgentMark id={group.agent.id} />
                <span class="truncate">{group.agent.name}</span>
              </p>
            </Show>
            <ul class="m-0 flex list-none flex-col gap-1 p-0">
              <For each={group.sessions}>
                {(chat) => (
                  <Chat
                    chat={chat}
                    successor={successorOf(chat)}
                    current={current(chat)}
                    assigning={assigning() === chatKey(chat.agent, chat.id)}
                    onOpen={() => open(chat)}
                    onAssigning={(open) => setAssigning(open ? chatKey(chat.agent, chat.id) : null)}
                    onTake={(hit) => assign(chat, hit)}
                    refusing={refusing}
                  />
                )}
              </For>
            </ul>
          </>
        )}
      </For>

      {/* AN AGENT THAT COULD NOT BE ASKED, named and not dropped — AFTER the
          conversations, because they are what somebody opened this for, and
          BESIDE them rather than instead of them: one agent being unaskable is
          a fact about that agent, and taking the others' conversations off the
          screen for it is the bug the fan-out was the fix for
          (`olai-plugin-chat`'s `listings.ts`). Without this the list would be
          answering *there is nothing here* with *we did not get to look*,
          which is a claim about somebody's disk. */}
      <For each={unreachable()}>
        {(agent) => (
          <p
            class="m-0 mt-2 text-xs text-muted"
            data-testid={TESTID.chatSessionUnreachable}
            data-agent={agent.agent}
          >
            {named(agent.agent)} could not be asked — {agent.why}
          </p>
        )}
      </For>

      {/* ... and the whole ask not landing, which is a different sentence about
          a larger subject: not one agent's trouble but this tab never having
          reached the server. The last answer is still drawn above it. */}
      <Show when={chatsRefusal()}>
        {(why) => (
          <p class="m-0 mt-2 text-xs text-alarm" data-testid={TESTID.chatSessionsRefused}>
            the conversations could not be listed — {why()}
          </p>
        )}
      </Show>

      {/* WHAT THE LAST ASSIGNMENT SAID, under the list — the node it landed on,
          or why it did not. */}
      <Show when={saying.said()}>
        {(said) => (
          <SaidLine said={said()} testid={TESTID.unassignedSaid} class="mt-3 text-xs" />
        )}
      </Show>

      {/* An empty list is a sentence rather than a blank panel: the row that
          opened this is gone from the sidebar by then, so somebody standing
          here has just assigned the last one.
          ONLY WHERE EVERY AGENT ANSWERED, which is the whole of the honesty
          above: *every conversation belongs to a node agent* is a claim about
          what is on disk, and an agent that could not be asked is exactly the
          case where nobody knows. */}
      <Show when={unassigned().length === 0 && unreachable().length === 0}>
        <p class="m-0 mt-2 text-xs text-muted" data-testid={TESTID.unassignedEmpty}>
          Every conversation in this directory belongs to a node agent.
        </p>
      </Show>
    </div>
  )
}

/**
 * ONE unassigned conversation: what it is, and the gesture that gives it a
 * node.
 *
 * Its own component for the shared row's reason word for word — the search that
 * opens under it is eight elements of its own, and a loop over groups with that
 * nested inside could not be read on one screen. WHAT the conversation is, is
 * not this component's: that is the row every list of conversations draws
 * ({@link ../chat/Conversation.tsx}), and what is added here is the gesture.
 */
function Chat(props: {
  readonly chat: SessionInfo
  /** The conversation that replaced this one, where the list knows it — drawn
   *  by the row itself ({@link ../chat/Conversation.tsx}). Two `/clear`
   *  siblings both waiting for a node differ in nothing else. */
  readonly successor: SessionInfo | undefined
  /** Whether the panel is already in this one, which is the ordinary case for
   *  somebody migrating: you are talking in a chat, and you give it a home. */
  readonly current: boolean
  readonly assigning: boolean
  readonly onOpen: () => void
  readonly onAssigning: (open: boolean) => void
  readonly onTake: (hit: NodeHit) => void
  readonly refusing: (hit: NodeHit) => string | null
}) {
  return (
    <li
      class="rounded border border-rule/70 px-2 py-1.5"
      data-testid={TESTID.unassignedChat}
      data-session-id={props.chat.id}
      data-agent={props.chat.agent}
    >
      {/* WHAT THE CONVERSATION IS, in the one row every list of them draws
          ({@link ../chat/Conversation.tsx}) — and pressing it opens the chat,
          because the first honest question about one from three weeks ago is
          which one it is, and the panel is right there. */}
      <Conversation
        session={props.chat}
        successor={props.successor}
        current={props.current}
        onPick={() => props.onOpen()}
      />
      <button
        type="button"
        class="mt-0.5 text-[0.625rem] text-accent underline underline-offset-2"
        data-testid={TESTID.unassignedAssign}
        aria-expanded={props.assigning}
        onClick={() => props.onAssigning(!props.assigning)}
      >
        assign to node…
      </button>
      <Show when={props.assigning}>
        <div
          class="mt-1"
          // ESCAPE SHUTS THE SEARCH and not the panel, which is the rule every
          // door onto the shared shortlist keeps: the key is a fact about the
          // panel it is drawn in, and this is the smallest one there is. It is
          // stopped here so it does not reach the list behind it.
          onKeyDown={(event) => {
            if (event.key !== "Escape") return
            event.preventDefault()
            event.stopPropagation()
            props.onAssigning(false)
          }}
        >
          <Shortlist
            label="which node? — its subtree becomes this conversation's memory"
            testids={ASSIGN_LIST}
            onTake={(hit) => props.onTake(hit)}
            refusing={{ why: props.refusing, testid: TESTID.assignRefused }}
          />
        </div>
      </Show>
    </li>
  )
}
