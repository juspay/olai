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
 * ## The rows are the chats list's own
 *
 * Same answer, same grouping, same words: `chat.sessions` asked of every
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

import type { NodeHit, SessionInfo } from "@olai/surface"

import { type Grouped, groupedByAgent } from "../chat/grouped.ts"
import { AgentMark } from "../chat/AgentMark.tsx"
import { whenOf } from "../chat/when.ts"
import { run } from "../run.ts"
import { createSaying } from "../saying.ts"
import { SaidLine } from "../SaidLine.tsx"
import { Shortlist, type ShortlistTestids } from "../search/Shortlist.tsx"
import { TESTID } from "../testids.ts"
import { olai } from "../wire.ts"
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

export function Unassigned() {
  const { unassigned, engines, at } = useAgents()
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

  const key = (chat: SessionInfo): string => `${chat.agent}/${chat.id}`

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
      olai.procedures.chat.assignSession({
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

  /** ... and open one, to find out which conversation it is. The panel goes
   *  back to being a conversation, which is what a person pressing a chat's
   *  title asked for. */
  const open = (chat: SessionInfo): void => {
    saying.say(undefined)
    run(
      olai.procedures.chat.loadSession({ agent: chat.agent, id: chat.id }),
      (failure) => saying.say({ tone: "alarm", text: failure.message, kind: failure._tag }),
      () => hideUnassigned(),
    )
  }

  return (
    <div
      class="olai-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4"
      data-testid={TESTID.unassignedPanel}
    >
      <div class="mb-3 flex items-baseline gap-2">
        <p class="m-0 flex-1 text-sm text-ink">
          Unassigned — {unassigned().length === 1
            ? "one conversation"
            : `${unassigned().length} conversations`} no node claims
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
              <p class="m-0 mt-3 mb-1 flex items-center gap-1.5 text-[0.625rem] text-muted">
                <AgentMark id={group.agent.id} />
                <span class="truncate">{group.agent.name}</span>
              </p>
            </Show>
            <ul class="m-0 flex list-none flex-col gap-1 p-0">
              <For each={group.sessions}>
                {(chat) => (
                  <Chat
                    chat={chat}
                    assigning={assigning() === key(chat)}
                    onOpen={() => open(chat)}
                    onAssigning={(open) => setAssigning(open ? key(chat) : null)}
                    onTake={(hit) => assign(chat, hit)}
                    refusing={refusing}
                  />
                )}
              </For>
            </ul>
          </>
        )}
      </For>

      {/* WHAT THE LAST ASSIGNMENT SAID, under the list — the node it landed on,
          or why it did not. */}
      <Show when={saying.said()}>
        {(said) => (
          <SaidLine said={said()} testid={TESTID.unassignedSaid} class="mt-3 text-xs" />
        )}
      </Show>

      {/* An empty list is a sentence rather than a blank panel: the row that
          opened this is gone from the sidebar by then, so somebody standing
          here has just assigned the last one. */}
      <Show when={unassigned().length === 0}>
        <p class="m-0 mt-2 text-xs text-muted">
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
 * Its own component for the picker row's reason word for word — the search that
 * opens under it is eight elements of its own, and a loop over groups with that
 * nested inside could not be read on one screen.
 */
function Chat(props: {
  readonly chat: SessionInfo
  readonly assigning: boolean
  readonly onOpen: () => void
  readonly onAssigning: (open: boolean) => void
  readonly onTake: (hit: NodeHit) => void
  readonly refusing: (hit: NodeHit) => string | null
}) {
  /** The agent's own count, drawn where it was SENT: `null` is nobody's answer
   *  and draws nothing rather than a zero of our own — the picker's rule, and
   *  the same words, since it is the same fact. */
  const size = (): string | null => {
    const count = props.chat.messageCount
    if (count === null) return null
    return `${count} ${count === 1 ? "message" : "messages"}`
  }
  return (
    <li
      class="rounded border border-rule/70 px-2 py-1.5"
      data-testid={TESTID.unassignedChat}
      data-session-id={props.chat.id}
      data-agent={props.chat.agent}
    >
      <div class="flex items-baseline gap-2">
        {/* THE TITLE OPENS IT, because the first honest question about a chat
            from three weeks ago is which one it is — and the panel is right
            there. */}
        <button
          type="button"
          class="min-w-0 flex-1 truncate text-left text-xs text-ink hover:underline"
          onClick={() => props.onOpen()}
        >
          {props.chat.title ?? props.chat.id}
        </button>
        <Show when={size()}>
          {(drawn) => <span class="shrink-0 font-mono text-[0.625rem] text-muted">{drawn()}</span>}
        </Show>
        <Show when={whenOf(props.chat.updatedAt)}>
          {(at) => <span class="shrink-0 font-mono text-[0.625rem] text-muted">{at()}</span>}
        </Show>
      </div>
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
