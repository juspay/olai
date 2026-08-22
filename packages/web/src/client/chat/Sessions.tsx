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
 * and that is the whole of what this list can honestly say about two rows that
 * look identical. `/clear` ends one conversation and starts another under the
 * same name, and ACP has no field for "this one supersedes that one" — so what
 * is drawn is the fact the protocol does carry, for every agent, rather than a
 * relationship guessed from two rows that happen to share a title.
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

import { createMemo, createSignal, For, Match, onCleanup, Show, Switch } from "solid-js"

import { dismissOn } from "../dismiss.ts"
import { AgentMark } from "./AgentMark.tsx"
import { type Grouped, groupedByAgent, nameOf } from "./grouped.ts"
import { Refusal } from "./Refusal.tsx"
import { WITHIN } from "../layer.ts"
import { QUIET_PILL } from "../pill.ts"
import { TESTID } from "../testids.ts"
import type { Chat, Sessions as Answer } from "./state.ts"
import { whenOf } from "./when.ts"
import type { OpFailure, Unreachable } from "@olai/surface"

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
 * The SAME distinction now lives inside the listed arm as well, because the
 * list spans every installed agent: one of them being unaskable is a fact about
 * that agent rather than about the call, so it is drawn beside the others'
 * conversations instead of instead of them.
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

  const current = () => props.chat.state().session?.id ?? null

  /**
   * The answer, arranged for a reader ({@link ./grouped.ts}).
   *
   * The roster is the panel's own, so the groups come in the order the agent
   * picker offers them in rather than in the order somebody last typed
   * something. A MEMO because three things read it — whether there is anything
   * at all, the list itself, and whether there is more than one group, which is
   * what the headings turn on — and regrouping the list once per row drawn is a
   * quadratic answer to a question with one answer.
   */
  const groups = createMemo((): ReadonlyArray<Grouped> => {
    const answer = picker()
    return answer._tag === "listed"
      ? groupedByAgent(answer.sessions, props.chat.state().roster)
      : []
  })

  /** The agents that could not be asked at all. Beside the rows rather than
   *  instead of them: one broken agent must not take the other's conversations
   *  off the screen, which is the bug the fan-out is the fix for. */
  const unreachable = (): ReadonlyArray<Unreachable> => {
    const answer = picker()
    return answer._tag === "listed" ? answer.unreachable : []
  }

  /** What a person reads for that agent ({@link ./grouped.ts}) — the same
   *  lookup the headings go through. */
  const named = (agent: string): string => nameOf(props.chat.state().roster, agent)

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
                        <Show when={groups().length > 1}>
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
                            <li>
                              <button
                                type="button"
                                class="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left text-xs hover:bg-rule"
                                data-testid={TESTID.chatSession}
                                data-session-id={session.id}
                                data-agent={session.agent}
                                data-current={session.id === current()}
                                disabled={session.id === current()}
                                onClick={() => {
                                  setPicker({ _tag: "shut" })
                                  // WITH the agent the row carries: this may be
                                  // the one the panel is not talking to, and
                                  // the id means nothing to the other.
                                  props.chat.loadSession(session.agent, session.id)
                                }}
                              >
                                <span
                                  class={`min-w-0 flex-1 truncate ${
                                    session.id === current() ? "text-accent" : ""
                                  }`}
                                >
                                  {session.title ?? session.id}
                                </span>
                                {/* The stamp does not shrink and the title
                                    does: two rows that share a title (a
                                    `/clear` leaves a pair) differ in nothing
                                    else, so the one thing that tells them apart
                                    may not be the thing a long title pushes off
                                    the end. */}
                                <Show when={whenOf(session.updatedAt)}>
                                  {(at) => (
                                    <span class="shrink-0 font-mono text-[0.625rem] text-muted">
                                      {at()}
                                    </span>
                                  )}
                                </Show>
                              </button>
                            </li>
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
                      data-testid={TESTID.chatSessionsRefused}
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

/** Why there is no list, when that is the answer. */
const refusedIn = (picker: Picker): OpFailure | undefined =>
  picker._tag === "refused" ? picker.failure : undefined
