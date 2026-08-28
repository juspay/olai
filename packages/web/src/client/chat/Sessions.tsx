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
 * ## HOW IT SHUTS, which for a while was "it does not"
 *
 * Every other panel this client draws answers a pointer outside it and Escape;
 * this one answered neither, so the only way out of a list you opened by
 * mistake was to press `chats` again — and a reader who had moved on to the
 * transcript underneath was left with a list over it that nothing they tried
 * would take away. That is a missing affordance rather than a fourth copy of an
 * existing one, and it is filled by the client's one dismissal (`../dismiss.ts`)
 * on the same terms as the header's popovers: the pointer, the key, the topmost
 * panel only (`../topmost.ts`) — and the caret back on `chats` when a keyboard
 * asked, because Escape from a list that has the focus would otherwise land on
 * `<body>`.
 *
 * BOTH ROOTS are handed over, which is the same bug the Commit pill had one
 * layer up: the list is a sibling of the button rather than a child of it, so a
 * click-away that knew only the list would read a press of `chats` as a press
 * outside — shutting on the pointerdown, and reopened by that same press's
 * click. Pressing it a second time would do nothing at all.
 */

import {
  createMemo,
  createSignal,
  For,
  Match,
  onCleanup,
  Show,
  Switch,
  untrack,
} from "solid-js"

import { dismissOn } from "../dismiss.ts"
import { AgentMark } from "./AgentMark.tsx"
import { type Grouped, groupedByAgent, nameOf } from "./grouped.ts"
import { Refusal } from "./Refusal.tsx"
import { WITHIN } from "../layer.ts"
import { QUIET_PILL } from "../pill.ts"
import { TESTID } from "../testids.ts"
import type { Chat, Sessions as Answer } from "./state.ts"
import { whenOf } from "./when.ts"
import type { OpFailure, SessionInfo, Unreachable } from "@olai/surface"

/**
 * The picker is a small state machine, and it is ONE signal because it is one
 * fact: shut, asking, or whichever answer came back.
 *
 * Spread over an `open` boolean, an `asking` boolean and a list, three of the
 * eight combinations are unreachable and nothing says so — "asking while shut"
 * and "a list while asking" are states the type would admit and the code would
 * have to remember not to enter.
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
type Picker = { readonly _tag: "shut" } | { readonly _tag: "asking" } | Answer

export function Sessions(props: { readonly chat: Chat }) {
  const [picker, setPicker] = createSignal<Picker>({ _tag: "shut" })

  /** Is the list up? The union's own "not shut", read off in ONE place — the
   *  dismissal, the toggle, the `aria-expanded` and the `<Show>` are four
   *  askings of one question, and a fourth arm of {@link Picker} would
   *  otherwise be four sites to find. */
  const up = () => picker()._tag !== "shut"

  /** The `chats` button and the list it opens — two roots, because the list is
   *  hung from the header rather than nested in the button. */
  let trigger: HTMLButtonElement | undefined
  let list: HTMLUListElement | undefined

  /** Put it away. Only that — where the caret goes is the two callers', and
   *  they are the only two there can be: a dismissal (`../dismiss.ts` hands it
   *  back for the key and leaves it alone for the press) and the button
   *  pressing itself. A `restoreFocus` boolean here would be a second spelling
   *  of a rule that already has one, selected by a flag at each call. */
  const shut = (): void => {
    setPicker({ _tag: "shut" })
  }

  // A pointer outside it and Escape, in this client's one spelling of them.
  // Handing over the `chats` button is the whole of what this takes: it is
  // both what is not "outside", and where the caret goes back when a key asked
  // (`../dismiss.ts`).
  dismissOn({ open: up, root: () => list, trigger: () => trigger, dismiss: shut })

  const toggle = () => {
    if (up()) {
      shut()
      // A press of the button while the list is up is a dismissal a keyboard
      // can reach, so the caret goes back the way Escape's does — spelled out
      // here because no dismissal can see this press: it lands on the trigger,
      // which is INSIDE as far as `dismissOn` is concerned.
      trigger?.focus()
      return
    }
    setPicker({ _tag: "asking" })
    void props.chat.sessions().then((answer) => {
      // Ignore an answer that arrived after the popover was shut: the reader
      // moved on, and re-opening it asks again.
      if (picker()._tag === "asking") setPicker(answer)
    })
  }

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
    const answer = picker()
    return answer._tag === "listed"
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
    const answer = picker()
    if (answer._tag !== "listed") return new Map()
    return new Map(answer.sessions.map((session) => [`${session.agent}/${session.id}`, session]))
  })

  /** Whether the groups are worth a heading each. ONE agent on the machine is a
   *  heading over the whole list, saying what the panel's own header already
   *  says — the picker's own rule, read at the other door. */
  const headed = createMemo(() => groups().length > 1)

  /** The agents that could not be asked at all. Beside the rows rather than
   *  instead of them: one broken agent must not take the other's conversations
   *  off the screen, which is the bug the fan-out is the fix for. */
  const unreachable = (): ReadonlyArray<Unreachable> => {
    const answer = picker()
    return answer._tag === "listed" ? answer.unreachable : []
  }

  /** What a person reads for that agent ({@link ./grouped.ts}). */
  const named = (agent: string): string =>
    nameOf(untrack(() => props.chat.state().roster), agent)

  return (
    <>
      <button
        ref={trigger}
        type="button"
        class={QUIET_PILL}
        data-testid={TESTID.chatSessions}
        aria-expanded={up()}
        onClick={toggle}
      >
        chats
      </button>

      <Show when={up()}>
        <ul
          ref={(el) => {
            list = el
            // Solid never calls a ref with `undefined`, and this one lives
            // inside the `<Show>` — so the disposal is what says the list is
            // gone. Without it a shut picker keeps its detached `<ul>` and
            // every row that was in it, and `root()` answers with an element
            // that is no longer on the page.
            onCleanup(() => {
              list = undefined
            })
          }}
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
            <Match when={refusedIn(picker())}>
              {(failure) => (
                <li class="px-2 py-1" data-testid={TESTID.chatSessionsRefused}>
                  <Refusal failure={failure()} />
                </li>
              )}
            </Match>
            <Match when={picker()._tag === "listed"}>
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
                                setPicker({ _tag: "shut" })
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
        data-testid={TESTID.chatSession}
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

/** Why there is no list, when that is the answer. */
const refusedIn = (picker: Picker): OpFailure | undefined =>
  picker._tag === "refused" ? picker.failure : undefined
