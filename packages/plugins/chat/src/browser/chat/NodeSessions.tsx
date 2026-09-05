/**
 * THIS NODE AGENT'S OWN SESSIONS — the conversations it has had, and the one
 * that starts it over.
 *
 * It is what is left of the `chats` picker after the human's amendment of
 * 2026-09-02, and the shape of what is left is the ruling: the panel's header
 * lists a NODE AGENT's sessions, and every other stored conversation is reached
 * from the sidebar.
 *
 * ## Why the chats picker went, and what stands in for it
 *
 * The picker answered *what conversations are stored in this directory* —
 * every installed agent's, grouped, with the one this panel is in marked. Since
 * migration there are two better doors onto exactly that set, and they are both
 * in the column a person navigates from:
 *
 *   - a conversation some node agent claims is reached by PRESSING THAT AGENT
 *     (`../agents/Agents.tsx`), which also takes you to its node — and its
 *     older conversations are here, under the agent they belong to;
 *   - a conversation NO node claims is a row of **Unassigned**
 *     (`../agents/Unassigned.tsx`), which is the same list with the same rows
 *     and the gesture that gives one a home.
 *
 * Between them every stored conversation is reachable, which is what made the
 * third door redundant rather than merely duplicated — and the last thing
 * keeping it was that it was the only face that NAMED an agent whose disk could
 * not be read. The Unassigned list draws those now, which is the amendment's
 * first half and the reason its second half is safe.
 *
 * `+ new` stays where it was: raising the question of which agent a fresh
 * conversation is with is not a question about a node agent's history.
 *
 * ## What it draws
 *
 * `sessions (n)` — how many conversations this node agent has had, the current
 * one included — opening onto its **past sessions**, newest first, and the
 * **fresh session** affordance under them. Past sessions are the `/clear` chain
 * behind the conversation its property names ({@link ../agents/lineage.ts}),
 * claimed in one gesture when a chat was assigned, so the list is populated
 * from day one rather than filling as somebody clears.
 *
 * **Fresh session** says what it MEANS beside it — memory is the subtree, the
 * transcript becomes history — because that sentence is the whole reason it is
 * safe to press, and a button that threw away a transcript without saying where
 * the knowledge went would be the one gesture in this feature nobody should
 * press without reading. It is `chat.startAgentSession` on a node that already
 * has one: the same two acts in the same order as the `•••` verb, so the vault
 * never names a conversation that was not opened.
 *
 * ## Drawn only where the conversation belongs to a node
 *
 * Everywhere else the header has no session control at all, and that is the
 * navigation story rather than an omission: a chat that is nobody's has no
 * history of its own, and its siblings are in the sidebar.
 *
 * ## The listing is shared by the tab
 *
 * The lineage is read off `chat.sessions`, and this popover does not ask for
 * itself: it reads the answer the roster provider holds and asks it to refresh
 * on open (`../agents/answered.tsx`). Completed node-session replacements
 * refresh that shared answer in every tab. One asker per tab rather than one per
 * face — the two lists would otherwise be two answers about one disk, and the
 * one a person met second would be the one that looked wrong.
 *
 * ## How it shuts
 *
 * `../inlinePicker.ts`, unchanged from the picker it came from: the pointer,
 * Escape, the topmost panel only, and the caret back on the trigger when a
 * keyboard asked — because Escape from a list that has the focus would
 * otherwise land on `<body>`.
 */

import { createMemo, createSignal, For, Show } from "solid-js"
import { chatWire } from "../wire.ts"

import { memoryOf } from "@olai/format"
import { agentIn } from "olai-plugin-chat/wire"
import type { SessionInfo } from "olai-plugin-chat/wire"
import { useAgents } from "../agents/answered.tsx"
import { pastOf, successorIn } from "../../lineage.ts"
import { hideUnassigned } from "../agents/showing.ts"
import { createInlinePicker } from "@olai/web/client/inlinePicker.ts"
import { WITHIN } from "@olai/web/client/layer.ts"
import { QUIET_PILL } from "@olai/web/client/pill.ts"
import { run } from "@olai/web/client/run.ts"
import { createSaying } from "@olai/web/client/saying.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { TESTID } from "../../testids.ts"
import { olai } from "@olai/web/client/wire.ts"
import { Conversation } from "./Conversation.tsx"
import type { Chat } from "./state.ts"
import type { Row } from "../agents/roster.ts"

export function NodeSessions(props: { readonly chat: Chat; readonly agent: Row }) {
  const { chats, askChats } = useAgents()
  /** It opens on the answer this tab already has and asks for a fresher one,
   *  which is the picker's own bargain: a conversation started in a terminal a
   *  moment ago should be in the list by the time somebody looks for it. */
  const picker = createInlinePicker<true>({
    opening: () => {
      askChats()
      return true
    },
  })

  /** THE CONVERSATIONS THIS AGENT HAD BEFORE THIS ONE, newest first
   *  ({@link ../agents/lineage.ts}) — empty for an agent on its first session,
   *  and while the tab has no answer to walk. */
  const past = createMemo((): ReadonlyArray<SessionInfo> => {
    const answer = chats()
    const session = props.agent.session
    return answer === null || session === null ? [] : pastOf(answer.sessions, props.agent.engine, session)
  })

  /** ... and which conversation replaced one of them, where the answer holds
   *  that one too ({@link ../agents/lineage.ts}) — matched on the pair, like
   *  every other step of a lineage. */
  const successorOf = (session: SessionInfo): SessionInfo | undefined =>
    successorIn(chats()?.sessions ?? [], session)

  const isOpen = (session: string): boolean =>
    agentIn(props.chat.state())?.id === props.agent.engine
    && props.chat.state().session?.id === session

  /** What *fresh session* said, where it was refused — an engine this machine
   *  does not have, an agent that would not start, a record the ops layer will
   *  not write. The popover shuts on success, so this line is only ever about a
   *  press that did not land. */
  const saying = createSaying()
  const [starting, setStarting] = createSignal(false)

  const fresh = (): void => {
    if (starting()) return
    setStarting(true)
    saying.say(undefined)
    run(
      chatWire().procedures.conversation.startAgentSession({
        node: props.agent.id,
        agent: props.agent.engine,
      }),
      (failure) => {
        setStarting(false)
        saying.say({ tone: "alarm", text: failure.message, kind: failure._tag })
      },
      () => {
        setStarting(false)
        // The completed history revision refreshes this tab and its siblings.
        picker.shut()
      },
    )
  }

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
        {/* HOW MANY CONVERSATIONS THIS AGENT HAS HAD, the open one included —
            which is what a person means by "sessions" and what the heading
            inside counts one fewer of, under its own word. */}
        sessions ({past().length + 1})
      </button>

      <Show when={picker.open()}>
        <ul
          ref={picker.setList}
          // Hung from the HEADER (`relative` on `Header.tsx`), not from this
          // button: a list `right-0` of a pill runs off the left of a phone
          // sheet. `inset-x-3 top-full` is the header's own box.
          class={`absolute inset-x-3 top-full ${WITHIN.pop} mt-1 max-h-80 list-none overflow-x-hidden overflow-y-auto rounded border border-rule/70 bg-panel p-1 shadow-lg`}
          data-testid={TESTID.chatSessionList}
        >
          <Show when={props.agent.session}>
            {(session) => (
              <li>
                <button
                  type="button"
                  class="block w-full rounded px-2 py-1 text-left text-xs hover:bg-rule disabled:text-accent"
                  disabled={isOpen(session())}
                  data-session-id={session()}
                  onClick={() => {
                    picker.shut()
                    hideUnassigned()
                    props.chat.loadSession(props.agent.engine, session())
                  }}
                >
                  current session
                </button>
              </li>
            )}
          </Show>
          <Show when={past().length > 0}>
            <li
              class="px-2 pt-1 pb-1 text-[0.625rem] text-muted"
              data-testid={TESTID.chatPastSessions}
              data-count={past().length}
            >
              past sessions ({past().length})
            </li>
            <For each={past()}>
              {(session) => (
                <li>
                  <Conversation
                    session={session}
                    successor={successorOf(session)}
                    current={isOpen(session.id)}
                    testid={TESTID.chatPastSession}
                    onPick={() => {
                      picker.shut()
                      // Opening a conversation is asking to be IN it, wherever
                      // the press was made (`../agents/showing.ts`).
                      hideUnassigned()
                      props.chat.loadSession(session.agent, session.id)
                    }}
                  />
                </li>
              )}
            </For>
          </Show>
          <li class="px-2 pt-1 pb-2">
            <button
              type="button"
              class="block w-full rounded px-2 py-1 text-left text-xs text-accent hover:bg-rule disabled:opacity-50"
              data-testid={TESTID.chatFreshSession}
              data-agent={props.agent.id}
              disabled={starting()}
              aria-busy={starting()}
              onClick={() => fresh()}
            >
              fresh session
              <span class="block text-[0.625rem] text-muted">
                memory is the subtree ({memoryOf(props.agent)}); the transcript becomes history
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
        </ul>
      </Show>
    </>
  )
}
