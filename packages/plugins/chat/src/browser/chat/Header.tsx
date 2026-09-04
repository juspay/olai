/**
 * The panel's header: which conversation, which model, and the ways to change
 * session.
 *
 * ## THE NODE COMES FIRST, where there is one
 *
 * A conversation bound to a node agent is named by the NODE — its title, drawn
 * where the session's title used to be, and pressable onto the row it is
 * written on. That is the ruling read straight off what a node agent IS: the
 * node is durable and its subtree is the agent's memory, while the session is
 * cattle that can be thrown away and recreated. Naming the transcript over the
 * thing that outlives it would put the disposable half of the pair in the one
 * line a person reads to find out who they are talking to.
 *
 * The agent and the model keep the second line, unchanged and in that order,
 * which is what makes this a re-founding rather than a replacement: WHO the
 * node agent is comes first, WHAT it is running on comes second, and both were
 * already the header's own precedence one rung down.
 *
 * Every conversation NO node claims is the header exactly as it was — the
 * session's title, or *new conversation* — because that is what it is: a chat,
 * not somebody's agent.
 *
 * WHO comes before WHAT IT RUNS ON, in that line, because it is the coarser
 * fact: a conversation is bound to one agent for its life (ruled 2026-08-21),
 * and the mark is there to be glanced at rather than read
 * ({@link ./AgentMark.tsx}). It is drawn even where this machine has only one
 * agent — the header is where a person looks to find out what they are talking
 * to, and "there was only ever one" is not something they know.
 *
 * The model is here because a turn's cost and character depend on it and
 * nothing else on screen says. USAGE is the other half of that same sentence —
 * how much room is left to run the turn in — and it is here because the
 * question it answers, "is it time to `/compact`?", had no answer on screen at
 * all: a person found out by watching the agent start forgetting. The session
 * title is here because the agent writes one in the background, and a
 * conversation with a name is one you can come back to — which is what the
 * picker beside it is for.
 *
 * WORKING is drawn BESIDE the model, not instead of it. The status used to take
 * that line until a model arrived and then never appear again, so from the
 * second turn onwards the header said "Fake One" whether the agent was thinking
 * or idle — the one line a reader looks at to find out, answering a different
 * question. They are two facts and they take two slots: what it runs on, and
 * whether it is running.
 *
 * WHETHER it is running is not decided here. That is {@link ./busy.ts}'s, and
 * the strip under the transcript ({@link ./Busy.tsx}) draws the same answer in
 * its own words — this slot is two words wide beside a model name and a context
 * readout, and it already names the agent one place to the left, so it says the
 * terse version. Two sites working the same precedence out of one cell is two
 * answers free to disagree, and the one that disagrees would be the one nobody
 * is looking at.
 *
 * STARTING is the one it leaves to the other face, and not by omission: this
 * header has said *starting…* in the fallback below since before there was a
 * strip, in the same slot, so drawing it twice would be the same word beside
 * itself.
 *
 * Closing the panel is not here. On desktop the app header's agent pill is
 * the permanent toggle (./Panel.tsx); a × beside it would be a second way to
 * close one thing. On a phone that toggle is gone, and the sheet's scrim is
 * the way out — still one door, just not in this header.
 *
 * Everything drawn is a projection of the chat cell. Nothing is remembered
 * locally, so a second tab's header says the same thing as this one.
 *
 * `relative` is the sessions popover's containing block
 * (`./NodeSessions.tsx`): the list hangs from this header's box, so a 20rem
 * list hung from a pill cannot run off the left of a phone sheet.
 */

import { createMemo, Show } from "solid-js"

import { memoryOf } from "@olai/format"
import { agentIn, type ChatState } from "olai-plugin-chat/wire"
import { useAgents } from "../agents/answered.tsx"
import { rowOf } from "../agents/focus.ts"
import { QUIET_PILL } from "@olai/web/client/pill.ts"
import { Link } from "@olai/web/client/router.tsx"
import { TESTID } from "../../testids.ts"
import { AgentMark } from "./AgentMark.tsx"
import { type Busy, busyIn } from "./busy.ts"
import { LIVE_DOT } from "./live.ts"
import { NodeSessions } from "./NodeSessions.tsx"
import type { Chat } from "./state.ts"
import { usageOf } from "./usage.ts"

export function Header(props: {
  readonly chat: Chat
  /** Ask which agent a new conversation is for. The QUESTION is the panel's
   *  ({@link ./Panel.tsx}), because it takes the panel's body over; this header
   *  only owns the button that raises it. */
  readonly onNew: () => void
}) {
  const state = () => props.chat.state()
  const roster = useAgents()
  /** What the panel is busy with ({@link ./busy.ts}), asked once: two slots on
   *  this line read it, and it is the same answer for both. */
  const doing = createMemo(() => busyIn(state()))
  /**
   * THE NODE AGENT this conversation belongs to, or `undefined` — which is
   * nearly every conversation, and every conversation there was before node
   * agents existed.
   *
   * TWO CELLS AND A LOOKUP, never a copy on one of them: the chat cell says
   * WHICH node ({@link ChatState.bound}), decided by the server off the same
   * record the roster's bindings came from, and the roster says what that node
   * is CALLED and how big its subtree is. A title carried on both would be one
   * fact on one wire in two places, free to disagree by a frame in exactly the
   * line a person reads to find out who they are talking to.
   *
   * A row that is not there is a node the set has stopped declaring — the
   * property came off, or the record was trashed — and the header falls back to
   * naming the conversation, which is what it has always done.
   */
  const node = createMemo(() => {
    const at = state().bound
    return at === null ? undefined : roster.at(at)
  })

  return (
    <header class="relative flex shrink-0 items-center gap-2 border-b border-rule/70 px-3 py-2">
      <div class="min-w-0 flex-1">
        {/* THE NODE FIRST, where this conversation belongs to one. A node agent
            IS a node: its title is the agent's name, its subtree is what the
            agent knows, and the conversation is cattle — so the durable thing
            is what the header names, and the session's own title is a fact
            about a transcript that will be thrown away. Pressable, because
            "where does this agent keep its memory" is a question you answer by
            going and looking at it. */}
        <Show
          when={node()}
          fallback={
            <div
              class="truncate text-sm font-semibold"
              data-testid={TESTID.chatTitle}
            >
              {state().status === "off"
                ? "agent"
                : state().session?.title ?? "new conversation"}
            </div>
          }
        >
          {(agent) => (
            <Link
              route={rowOf(agent())}
              class="block truncate text-sm font-semibold text-accent decoration-dotted underline-offset-2 hover:underline"
              testid={TESTID.chatNode}
              title={`${agent().title} — memory: this subtree (${memoryOf(agent())})`}
            >
              {agent().title}
            </Link>
          )}
        </Show>
        <div class="flex items-center gap-2 truncate font-mono text-[0.6875rem] text-muted">
          {/* WHO, before what it runs on. Drawn from the moment an agent is
              bound, which is before the conversation opens — the panel is
              talking to somebody while it starts, and saying who is the point
              of the line. */}
          <Show when={agentIn(state())}>
            {(agent) => (
              <span
                class="flex items-center gap-1"
                data-testid={TESTID.chatAgent}
                data-agent={agent().id}
              >
                <AgentMark id={agent().id} />
                <span class="truncate">{agent().name}</span>
              </span>
            )}
          </Show>
          <Show
            when={state().model}
            fallback={
              <Show when={statusWord(state().status, doing())}>
                {(word) => <span>{word()}</span>}
              </Show>
            }
          >
            {(model) => <span data-testid={TESTID.chatModel}>{model()}</span>}
          </Show>
          {/* The other half of the model's own sentence: what a turn runs on,
              and how much room is left to run it in. Drawn only once the agent
              has reported some — before the first turn there is nothing to
              say, and a `0/?` invented for that gap would be a claim about a
              window nobody named. */}
          <Show when={usageOf(state().usage)}>
            {(usage) => (
              <span data-testid={TESTID.chatUsage} title="context used / context window">
                {usage()}
              </span>
            )}
          </Show>
          {/* Always in the tree while a turn runs, whether or not a model is
              named — the two are independent, and a cue that only appears in
              one of two otherwise identical states is a cue nobody learns.
              A turn stopped on a question is still a turn in flight, so this is
              the same slot with the true word in it: "working…" while it is the
              agent's move, "waiting on you" while it is yours. */}
          <Show when={turnIn(doing())}>
            {(turn) => (
              <span
                class="flex items-center gap-1 text-doing"
                data-testid={TESTID.chatWorking}
                aria-live="polite"
              >
                <span class={LIVE_DOT} aria-hidden="true" />
                {turn() === "waiting" ? "waiting on you" : "working…"}
              </span>
            )}
          </Show>
        </div>
      </div>

      {/* Both verbs need an agent to act on. With none they would refuse, so
          they are not offered — the panel's body says why.
          SESSIONS IS THE NODE AGENT'S OWN and is drawn only where this
          conversation belongs to one ({@link ./NodeSessions.tsx}): its history,
          and the fresh session that ends it. The `chats` list that stood here —
          every stored conversation in the directory — is retired, because the
          sidebar is that list twice over: an agent's conversation is reached by
          pressing the agent, and one no node claims is a row of Unassigned. A
          chat that is nobody's has no history of its own, so on one the header
          offers nothing here at all.
          `+ new` is offered either way: raising the question of which agent a
          fresh conversation is with is not a question about a node agent, and
          it is the way out of a panel with no conversation in it. */}
      <Show when={state().status !== "off"}>
        <Show when={node()}>
          {(agent) => <NodeSessions chat={props.chat} agent={agent()} />}
        </Show>
        <button
          type="button"
          class={QUIET_PILL}
          data-testid={TESTID.chatNew}
          onClick={() => props.onNew()}
        >
          + new
        </button>
      </Show>
    </header>
  )
}

/** A turn in flight, and which kind — or `undefined`, which is what `<Show>`
 *  takes. A BOOT is not one: it has the word below, in the slot beside this
 *  one, and saying it twice would be the same word beside itself. */
const turnIn = (doing: Busy | null): "working" | "waiting" | undefined =>
  doing === null || doing.kind === "starting" ? undefined : doing.kind

/**
 * What to say before the agent has named a model.
 *
 * The BUSY states are read off the one decision rather than re-derived from the
 * status — "booting means starting" is exactly the sentence `./busy.ts` was
 * pulled out to own — and a turn in flight says nothing here at all, because
 * the live cue in the slot beside this one is already saying it. With no model
 * named, "working…" used to be drawn here and there, twice on one line.
 *
 * What is left is the three states that are not busy, and the panel draws
 * without an agent in all of them: the header is where a reader looks first for
 * why nothing is happening.
 */
const statusWord = (
  status: ChatState["status"],
  doing: Busy | null,
): string | undefined => {
  if (doing !== null) return doing.kind === "starting" ? "starting…" : undefined
  return status === "off" ? "not configured" : status === "gone" ? "not running" : "ready"
}
