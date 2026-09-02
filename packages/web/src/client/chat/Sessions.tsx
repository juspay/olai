/**
 * The picker: EVERY installed agent's stored conversations for this directory,
 * grouped by who they are with, newest first inside each group.
 *
 * Every agent's, and that is the fix this file carries. The list used to be the
 * one the panel happened to be TALKING to — so a single opencode chat took
 * every Claude conversation in the directory off the screen, and the way back
 * to one was to start a new Claude chat purely so the list would name them
 * again. One agent at a time is true of the PROCESS and was never true of the
 * history: the conversations are all still there, and what somebody opens this
 * for is to find one.
 *
 * So a row here can belong to the agent this panel is not talking to, and
 * picking it is a change of agent as well as of conversation — the same change
 * `+ new` makes, through the same door (`./state.ts`'s `loadSession`, which
 * takes the agent the row carries).
 *
 * GROUPED, in the roster's own order, headings only where there is more than
 * one group ({@link ./grouped.ts}): interleaving two agents' conversations by
 * timestamp makes a list you have to read every line of to find the one you
 * want, and the thing you know about the one you want is who it was with. One
 * agent on the machine draws exactly the list it always did.
 *
 * Asked of the SERVER every time it opens rather than kept in a cell, because
 * the agent's list is the only one that is right — it changes when a terminal
 * `claude --resume` writes to the same directory, and a cached copy would
 * quietly stop being true. The cost is one round trip on a click. (The server
 * keeps the answers of the agents it had to START for a few seconds, which is
 * its own bargain and argued where it is made.)
 *
 * The one this server is in is marked, and clicking it does nothing: loading
 * the session you are already in would throw away a transcript to replace it
 * with the same one.
 *
 * Every row says WHEN it was last touched, to the minute ({@link ./when.ts}),
 * and — where the agent said them — HOW BIG the conversation is and WHICH one
 * of the rows replaced it. `/clear` ends one conversation and starts another
 * under the same name, and ACP has no field for "this one supersedes that
 * one": olai's pinned Claude Code adapter says it in its own `_meta` corner
 * ({@link ../../../../../acp/patches/README.md}, off the transcripts' own
 * clock), and on every other row the minute goes on carrying the answer
 * alone. What is drawn is always a fact somebody SENT — never a relationship
 * inferred here from two rows that happen to share a title.
 *
 * ## THE NODE AGENT'S OWN SESSIONS COME FIRST, where the panel is in one
 *
 * A conversation bound to a node agent has a history that is not the same list
 * as *every chat in this directory*: the conversations THIS agent has had, which
 * are the `/clear` chain behind the one its property names, claimed in one
 * gesture when the chat was assigned ({@link ../agents/lineage.ts}). So the
 * list opens with **past sessions (n)** — the same rows, the same press, in a
 * block of their own — and then the whole directory's chats under it. An agent
 * that has had one conversation draws no block at all rather than a heading
 * over nothing.
 *
 * ... and with **fresh session**, which is the affordance this panel owed a
 * person and did not have: a new conversation for this node agent, with the
 * property re-pointed at it. It is drawn with what it MEANS beside it — memory
 * is the subtree, the transcript becomes history — because that sentence is the
 * whole reason it is safe, and a button that threw away a transcript without
 * saying where the knowledge went would be the one gesture in this feature
 * nobody should press without reading. Nothing is lost that was written down,
 * and what was only ever in the transcript is what the contract asked the agent
 * to bank as it went.
 *
 * Both are drawn only where the panel's conversation belongs to a node —
 * everywhere else this is the list it has always been.
 *
 * ## HOW IT SHUTS, which for a while was "it does not"
 *
 * Every other panel this client draws answers a pointer outside it and Escape;
 * this one answered neither, so the only way out of a list you opened by
 * mistake was to press `chats` again — and a reader who had moved on to the
 * transcript underneath was left with a list over it that nothing they tried
 * would take away. That is a missing affordance rather than a fourth copy of an
 * existing one, and what fills it is the open/shut machine this picker shares
 * with the wake strip's ({@link ../inlinePicker.ts}), which reaches the client's
 * one dismissal (`../dismiss.ts`) on the same terms as the header's popovers:
 * the pointer, the key, the topmost panel only (`../topmost.ts`), the caret back
 * on `chats` when a keyboard asked — because Escape from a list that has the
 * focus would otherwise land on `<body>` — and both roots handed over, since the
 * list is a sibling of the button rather than a child of it. Each of those is
 * argued where it now lives; what is left here is the list itself.
 */

import { createMemo, For, Match, Show, Switch, untrack } from "solid-js"

import { memoryOf } from "@olai/format"

import { useAgents } from "../agents/answered.tsx"
import { pastOf } from "../agents/lineage.ts"
import { hideUnassigned } from "../agents/showing.ts"
import { createInlinePicker } from "../inlinePicker.ts"
import { AgentMark } from "./AgentMark.tsx"
import { type Grouped, groupedByAgent, nameOf } from "./grouped.ts"
import { Refusal } from "./Refusal.tsx"
import { WITHIN } from "../layer.ts"
import { QUIET_PILL } from "../pill.ts"
import { run } from "../run.ts"
import { createSaying } from "../saying.ts"
import { SaidLine } from "../SaidLine.tsx"
import { TESTID, type TestId } from "../testids.ts"
import type { Chat, Sessions as Answer } from "./state.ts"
import { whenOf } from "./when.ts"
import { olai } from "../wire.ts"
import type { OpFailure, SessionInfo, Unreachable } from "@olai/surface"

/**
 * WHAT THE LIST IS UP OVER, which is the open arm of the picker's own state
 * machine — {@link ../inlinePicker.ts} holds the shut arm and every way between
 * the two, so what is spelled here is only the three things there are to draw:
 * the ask in flight, and the answer's own two.
 *
 * ONE VALUE and not an `asking` boolean beside a list, for the reason the arm it
 * hangs off is one: "a list while asking" is a state a pair of fields would
 * admit and the code would have to remember not to enter.
 *
 * The answer's own two arms ({@link Sessions}) are spliced in whole rather than
 * flattened to a list, which is the fix this file carries: a refusal used to
 * arrive as `[]` and be drawn as "no stored conversations" — a claim about the
 * agent's disk, standing in for never having reached it.
 *
 * The SAME distinction now lives INSIDE the listed arm, because the list spans
 * every installed agent: one of them being unaskable is a fact about that agent
 * rather than about the call, so it is drawn beside the others' conversations
 * rather than instead of them, and it has a name of its own. That is where the
 * server puts every reason it has — the verb cannot fail for an agent any more.
 * What is left in the REFUSED arm is the call itself not landing, which no
 * scenario can drive from a browser (a dropped socket, a server that went) and
 * which must still not be drawn as an empty list.
 */
type Showing = { readonly _tag: "asking" } | Answer

export function Sessions(props: { readonly chat: Chat }) {
  /** The roster as this tab has it (`../agents/answered.tsx`) — one
   *  subscription for the whole app, and this popover is one of its readers. */
  const roster = useAgents()
  /** The payload is named rather than inferred: `opening` answers with only one
   *  of the three arms, and a picker inferred from it would be one the answer
   *  could never be shown. */
  const picker = createInlinePicker<Showing>({
    // It opens ASKING and the asking begins with it, so there is no frame in
    // which the list is up over nothing.
    opening: () => {
      void props.chat.sessions().then((answer) => {
        // Ignore an answer that arrived after the popover was shut: the reader
        // moved on, and re-opening it asks again.
        if (picker.showing()?._tag === "asking") picker.show(answer)
      })
      return { _tag: "asking" }
    },
  })

  /** Which conversation the panel is IN. A memo, not a plain read: three
   *  things per row ask it, and each of those would otherwise be its own
   *  subscription to the whole chat cell — recomputing the same id on every
   *  usage frame of every turn, for every row in the list. */
  const current = createMemo(() => props.chat.state().session?.id ?? null)

  /**
   * The answer, arranged for a reader ({@link ./grouped.ts}).
   *
   * The roster is the panel's own, so the groups come in the order the agent
   * picker offers them in rather than in the order somebody last typed
   * something — and it is read UNTRACKED, which is the whole point of the memo
   * being one. The roster changes once, when the server starts; the chat cell
   * it lives on changes several times a turn (usage, model, questions). Tracked,
   * every one of those would rebuild the group objects, and `<For>` diffs by
   * reference — so the entire list would be torn down and re-rendered under
   * somebody's cursor while they were reading it. The list is asked for afresh
   * every time it opens, so there is nothing to lose by not following it.
   */
  const groups = createMemo((): ReadonlyArray<Grouped> => {
    const answer = picker.showing()
    return answer?._tag === "listed"
      ? groupedByAgent(answer.sessions, untrack(() => props.chat.state().roster))
      : []
  })

  /** The rows by id and their OWNER, for naming the one a `supersededBy`
   *  points at. An id is the adapter's own space — two agents can collide
   *  formally, and a Claude-A's link resolving to an opencode row would
   *  be a lie by lookup. Untracked for the same reason as {@link groups}:
   *  the answer is asked afresh every time the list opens, which is the
   *  only time the links move. */
  const byId = createMemo((): ReadonlyMap<string, SessionInfo> => {
    const answer = picker.showing()
    if (answer?._tag !== "listed") return new Map()
    return new Map(answer.sessions.map((session) => [`${session.agent}/${session.id}`, session]))
  })

  /**
   * THE NODE AGENT THIS CONVERSATION BELONGS TO, or `undefined` — which is
   * nearly every conversation.
   *
   * Two cells and a lookup, never a copy on one of them: the chat cell says
   * WHICH node ({@link ChatState.bound}) and the roster says what that node is
   * called and which engine it runs on — the header's own arrangement, read at
   * the door beside it (`./Header.tsx`).
   */
  const node = createMemo(() => {
    const at = props.chat.state().bound
    return at === null ? undefined : roster.at(at)
  })

  /**
   * ... AND THE CONVERSATIONS IT HAS HAD BEFORE THIS ONE, newest first
   * ({@link ../agents/lineage.ts}).
   *
   * Off the answer this popover is showing rather than the provider's own copy,
   * which is deliberate and is the only place the two could differ: this list
   * was asked for when the popover opened, so the chain drawn is the chain that
   * answer describes. Untracked for {@link groups}' reason — the links move
   * when the answer does, and the answer arrives once per open.
   */
  const past = createMemo((): ReadonlyArray<SessionInfo> => {
    const answer = picker.showing()
    const agent = node()
    if (answer?._tag !== "listed" || agent === undefined || agent.session === null) return []
    return pastOf(answer.sessions, agent.engine, agent.session)
  })

  /** What *fresh session* said, where it was refused — an engine this machine
   *  does not have, an agent that would not start, a record the ops layer will
   *  not write. Held here rather than at the button, because the popover shuts
   *  on success and the line is only ever about a press that did not land. */
  const saying = createSaying()

  /** A NEW CONVERSATION FOR THIS NODE AGENT, with the property re-pointed at
   *  it — one procedure at the server, which is the same one the `•••` menu's
   *  *start an agent session* runs (`@olai/surface`'s `chat.startAgentSession`,
   *  which argues why a browser cannot do both halves). */
  const fresh = (): void => {
    const agent = node()
    if (agent === undefined) return
    saying.say(undefined)
    run(
      olai.procedures.chat.startAgentSession({ node: agent.id, agent: agent.engine }),
      (failure) => saying.say({ tone: "alarm", text: failure.message, kind: failure._tag }),
      () => picker.shut(),
    )
  }

  /** Whether the groups are worth a heading each. ONE agent on the machine is a
   *  heading over the whole list, saying what the panel's own header already
   *  says — the picker's own rule, read at the other door. */
  const headed = createMemo(() => groups().length > 1)

  /** The agents that could not be asked at all. Beside the rows rather than
   *  instead of them: one broken agent must not take the other's conversations
   *  off the screen, which is the bug the fan-out is the fix for. */
  const unreachable = (): ReadonlyArray<Unreachable> => {
    const answer = picker.showing()
    return answer?._tag === "listed" ? answer.unreachable : []
  }

  /** What a person reads for that agent ({@link ./grouped.ts}). */
  const named = (agent: string): string =>
    nameOf(untrack(() => props.chat.state().roster), agent)

  return (
    <>
      <button
        ref={picker.setTrigger}
        type="button"
        class={QUIET_PILL}
        data-testid={TESTID.chatSessions}
        aria-expanded={picker.open()}
        onClick={picker.toggle}
      >
        chats
      </button>

      <Show when={picker.open()}>
        <ul
          ref={picker.setList}
          // Hung from the HEADER (`relative` on `Header.tsx`), not from this
          // button: a `w-80` list `right-0` of `chats` runs off the left of a
          // phone sheet — titles clipped to their last letters, the list
          // overlapping the trigger it opened from. `inset-x-3 top-full` is
          // the header's own box, so the list is as wide as the conversation
          // and starts below the two-line title rather than through it.
          class={`absolute inset-x-3 top-full ${WITHIN.pop} mt-1 max-h-80 list-none overflow-x-hidden overflow-y-auto rounded border border-rule/70 bg-panel p-1 shadow-lg`}
          data-testid={TESTID.chatSessionList}
        >
          {/* A `<Switch>` over the one signal, because the picker IS one: the
              three things it can be showing are the three arms of the union
              above, and drawing them as siblings that each test the tag would
              be the exclusivity spelled again in a second place. "Refused" was
              the arm that did not exist, and an empty list was standing in for
              it. `asking` is the FALLBACK rather than a third `<Match>`: it is
              the state the popover opens in and the one nothing has answered
              yet, so it is what is left rather than something to test for. */}
          <Switch
            fallback={<li class="px-2 py-1 text-xs text-muted">asking the agent…</li>}
          >
            <Match when={refusedIn(picker.showing())}>
              {(failure) => (
                <li class="px-2 py-1" data-testid={TESTID.chatSessionsRefused}>
                  <Refusal failure={failure()} />
                </li>
              )}
            </Match>
            <Match when={picker.showing()?._tag === "listed"}>
              {/* THIS NODE AGENT'S OWN, before the directory's — its history,
                  and the way to start it over. Only where the panel is in a
                  node agent's conversation; everywhere else the list is the
                  list it has always been. */}
              <Show when={node()}>
                {(agent) => (
                  <>
                    <Show when={past().length > 0}>
                      <li
                        class="flex items-center gap-1.5 px-2 pt-1 pb-1 text-[0.625rem] text-muted"
                        data-testid={TESTID.chatPastSessions}
                        data-count={past().length}
                      >
                        past sessions ({past().length})
                      </li>
                      <For each={past()}>
                        {(session) => (
                          <Row
                            session={session}
                            successor={session.supersededBy === null
                              ? undefined
                              : byId().get(`${session.agent}/${session.supersededBy}`)}
                            current={false}
                            testid={TESTID.chatPastSession}
                            onPick={() => {
                              picker.shut()
                              hideUnassigned()
                              props.chat.loadSession(session.agent, session.id)
                            }}
                          />
                        )}
                      </For>
                    </Show>
                    <li class="px-2 pt-1 pb-2">
                      <button
                        type="button"
                        class="block w-full rounded px-2 py-1 text-left text-xs text-accent hover:bg-rule"
                        data-testid={TESTID.chatFreshSession}
                        data-agent={agent().id}
                        onClick={() => fresh()}
                      >
                        fresh session
                        {/* WHAT IT MEANS, beside it and not in a tooltip: this
                            is the one gesture in the feature that replaces a
                            live conversation, and the sentence is the whole
                            reason it is safe to press. */}
                        <span class="block text-[0.625rem] text-muted">
                          memory is the subtree ({memoryOf(agent())}); the transcript becomes
                          history
                        </span>
                      </button>
                      <Show when={saying.said()}>
                        {(said) => (
                          <SaidLine
                            said={said()}
                            testid={TESTID.chatFreshSaid}
                            class="mt-1 px-2 text-[0.625rem]"
                          />
                        )}
                      </Show>
                    </li>
                  </>
                )}
              </Show>
              {/* ... AND THE DIRECTORY'S OWN, UNDER A LINE OF THEIR OWN where
                  the block above is drawn. One agent on the machine draws no
                  group headings (the picker's own rule), so without this the
                  two blocks ran together and *past sessions (1)* read as a
                  heading over every conversation in the directory. It says what
                  the lower list IS rather than whose it is — and a node agent's
                  own past sessions are in it too, because they are stored here
                  like everything else and a list that hid them would be
                  answering a different question. */}
              <Show when={node() !== undefined && groups().length > 0}>
                <li class="px-2 pt-1 pb-1 text-[0.625rem] text-muted">
                  every conversation here
                </li>
              </Show>
              <Show
                when={groups().length > 0 || unreachable().length > 0}
                fallback={
                  <li class="px-2 py-1 text-xs text-muted">no stored conversations</li>
                }
              >
                <For each={groups()}>
                    {(group) => (
                      <>
                        {/* ONE agent installed draws no heading: it is a
                            heading over the whole list, saying what the panel's
                            own header already says. The same shape as the
                            picker's own rule — one installed agent is not a
                            choice. */}
                        <Show when={headed()}>
                          <li
                            class="flex items-center gap-1.5 px-2 pt-2 pb-1 text-[0.625rem] text-muted"
                            data-testid={TESTID.chatSessionAgent}
                            data-agent={group.agent.id}
                          >
                            <AgentMark id={group.agent.id} />
                            <span class="truncate">{group.agent.name}</span>
                          </li>
                        </Show>
                        <For each={group.sessions}>
                          {(session) => (
                            <Row
                              session={session}
                              successor={session.supersededBy === null
                                ? undefined
                                : byId().get(`${session.agent}/${session.supersededBy}`)}
                              current={session.id === current()}
                              onPick={() => {
                                picker.shut()
                                // ... AND THE PANEL STOPS SHOWING THE
                                // UNASSIGNED LIST, which is reachable from
                                // under this very header: opening a
                                // conversation is asking to be in it
                                // (`../agents/showing.ts`).
                                hideUnassigned()
                                // WITH the agent the row carries: this may be
                                // the one the panel is not talking to, and the
                                // id means nothing to the other.
                                props.chat.loadSession(session.agent, session.id)
                              }}
                            />
                          )}
                        </For>
                      </>
                    )}
                </For>
                {/* AFTER the conversations, because they are what somebody
                    opened this for — and in the same slot the whole call's
                    refusal takes, because it is the same sentence about a
                    smaller subject: we did not get to look. */}
                <For each={unreachable()}>
                  {(agent) => (
                    <li
                      class="px-2 py-1 text-xs text-muted"
                      data-testid={TESTID.chatSessionUnreachable}
                      data-agent={agent.agent}
                    >
                      {named(agent.agent)} could not be asked — {agent.why}
                    </li>
                  )}
                </For>
              </Show>
            </Match>
          </Switch>
        </ul>
      </Show>
    </>
  )
}

/**
 * ONE stored conversation, as a row.
 *
 * Its own component because the list around it grew a grouping layer and this
 * did not change at all: nested inside, the button that a person actually
 * clicks sat eight elements deep, so the loop over groups and the thing a row
 * IS could not be read on one screen. It takes what it draws and what to do
 * about a click, and knows nothing about groups, pickers or agents.
 */
function Row(props: {
  readonly session: SessionInfo
  /** The conversation that replaced this one, when it is on the screen —
   *  `undefined` when the `supersededBy` id names nothing the list knows: the
   *  row it pointed at can be gone, and a named successor is the whole of the
   *  hint's worth, so without one the line says nothing. */
  readonly successor: SessionInfo | undefined
  /** Whether this is the conversation the panel is already in. Passed rather
   *  than looked up, so the row does not need the cell. */
  readonly current: boolean
  /** What to call this row, for a scenario — the list's own name by default,
   *  and the node agent's own where the row is one of ITS past sessions. Two
   *  names because they are two claims: *the directory holds this chat* and
   *  *this agent has had this conversation* are asserted separately, and the
   *  same row can be both. */
  readonly testid?: TestId
  readonly onPick: () => void
}) {
  /** The agent's own count of the conversation, drawn when it was SENT:
   *  `null` is nobody's answer and draws nothing rather than a zero of our
   *  own, and zero itself is an answer — a conversation nobody has spoken in
   *  yet — which is the one a `0 messages` cell exists to make visible. */
  const size = (): string | null => {
    const count = props.session.messageCount
    if (count === null) return null
    return `${count} ${count === 1 ? "message" : "messages"}`
  }
  return (
    <li>
      <button
        type="button"
        class="flex w-full flex-col rounded px-2 py-1 text-left text-xs hover:bg-rule"
        data-testid={props.testid ?? TESTID.chatSession}
        data-session-id={props.session.id}
        data-agent={props.session.agent}
        data-current={props.current}
        // Loading the conversation you are already in would throw away a
        // transcript to replace it with the same one.
        disabled={props.current}
        onClick={() => props.onPick()}
      >
        <span class="flex w-full items-baseline gap-2">
          <span class={`min-w-0 flex-1 truncate ${props.current ? "text-accent" : ""}`}>
            {props.session.title ?? props.session.id}
          </span>
          <Show when={size()}>
            {(drawn) => (
              <span class="shrink-0 font-mono text-[0.625rem] text-muted">{drawn()}</span>
            )}
          </Show>
          {/* The stamp does not shrink and the title does: two rows that share a
              title (a `/clear` leaves a pair) differ in nothing else, so the one
              thing that tells them apart may not be the thing a long title pushes
              off the end. */}
          <Show when={whenOf(props.session.updatedAt)}>
            {(at) => <span class="shrink-0 font-mono text-[0.625rem] text-muted">{at()}</span>}
          </Show>
        </span>
        <Show when={props.successor}>
          {(next) => (
            <span
              class="truncate text-[0.625rem] text-muted"
              data-testid={TESTID.chatSessionSuperseded}
              data-successor={next().id}
            >
              superseded by {next().title ?? next().id}
            </span>
          )}
        </Show>
      </button>
    </li>
  )
}

/** Why there is no list, when that is the answer — and nothing at all while the
 *  list is shut, which is what `undefined` is doing in the argument. */
const refusedIn = (showing: Showing | undefined): OpFailure | undefined =>
  showing?._tag === "refused" ? showing.failure : undefined
