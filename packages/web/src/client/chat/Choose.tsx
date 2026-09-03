/**
 * WHICH AGENT this conversation is with — the question, and the only place it
 * is answered.
 *
 * Every new chat asks WHERE THERE IS SOMETHING TO ASK (the human's ruling,
 * 2026-08-21, and the one narrowing of it this panel makes — see "Not a picker
 * of one" below): a conversation is bound to one agent for its life, and no
 * default is remembered across conversations. So this is not a setting and
 * there is nowhere else it can be changed — the way to talk to the other agent
 * is to start a chat with it.
 *
 * ## Two doors, one list
 *
 *   - **the panel is asking**, because it has no conversation and will not pick
 *     one for you (`ChatState.talking`'s `asking` arm). This is the panel's BODY then, where
 *     the transcript would be, and there is no way out of it: there is nothing
 *     behind it to go back to.
 *   - **`+ new` asked**, which is a person deciding to start a chat while
 *     already in one. That one is CANCELLABLE — Escape, or the row that says
 *     so — because the conversation underneath is still open and a misclick
 *     must not be a one-way door into a question.
 *
 * The list is the same either way, and so is what a row does: it names the
 * agent it will be answered with. What differs is only which verb the answer
 * goes to, which is the caller's ({@link Choose.onPick}) — see
 * `../../../../chat/src/chat.ts` for why answering the panel's own question is
 * not the same verb as asking for a new chat.
 *
 * ## THE ROWS' WORDS ARE THE ENGINES' OWN
 *
 * An engine is a PLUGIN, and what it is CALLED is a fact its own package knows;
 * `packages/bundle/src/fence.test.ts` holds as an equality that no general
 * package spells a plugin's name in code. So each row's contents come out of the
 * `chat.agent.row` slot that engine's browser half hung them in, and what stays
 * here is the row itself — the button, the press, the mark, and the ORDER, which
 * is the roster's and is what keeps the picker's promise that every row it draws
 * is an agent this machine has.
 *
 * ## Not a picker of one
 *
 * A roster of one agent never reaches this component: the server has already
 * bound the panel to it and says which it is in the header. A one-row question
 * is friction with no answer behind it — see `Talking`'s `asking` arm.
 */

import { Dynamic } from "solid-js/web"
import { For, Show } from "solid-js"

import type { AgentChoice } from "@olai/surface"

import { rowOf } from "../plugins/agents.ts"
import { TESTID } from "../testids.ts"
import { AgentMark } from "./AgentMark.tsx"

export function Choose(props: {
  readonly agents: ReadonlyArray<AgentChoice>
  readonly onPick: (id: string) => void
  /** How to leave the question unanswered, or nothing where there is no
   *  leaving it. Its presence IS the difference between the two doors, so a
   *  reader of this component can see which one they are in. */
  readonly onCancel?: (() => void) | undefined
}) {
  return (
    <div
      class="olai-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6"
      data-testid={TESTID.chatChoose}
      // The list takes the keys while it is up, and Escape backs out of the
      // door that has a way back. `tabindex` so the box can hold focus for it
      // without being a control itself.
      tabindex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        const leave = props.onCancel
        if (leave === undefined) return
        event.preventDefault()
        leave()
      }}
      ref={(element) => {
        // Focused so the keys are the list's from the moment it appears —
        // queued, because the element is not in the document yet.
        queueMicrotask(() => element.focus())
      }}
    >
      <p class="m-0 mb-1 text-sm text-ink">Which agent?</p>
      <p class="m-0 mb-4 text-sm text-muted">
        This conversation stays with the one you pick. Start another chat to use
        the other.
      </p>

      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        <For each={props.agents}>
          {(agent) => (
            <li>
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded border border-rule/70 px-3 py-2 text-left text-sm text-ink hover:border-accent"
                data-testid={TESTID.chatChooseAgent}
                data-agent={agent.id}
                onClick={() => props.onPick(agent.id)}
              >
                <AgentMark id={agent.id} />
                {/* THE ROW'S WORDS ARE THE ENGINE'S OWN, out of the slot its
                    browser half hung them in (`../plugins/agents.ts`). What
                    stays here is the row: the button, the press, the mark
                    beside it, and the ORDER — which is the roster's, so the
                    picker still offers exactly the agents this machine has.

                    THE FALLBACK IS THE WIRE'S `name`, and it is a real state
                    rather than a guard: an engine whose browser chunk the
                    roster did not name, or whose half failed to start, has hung
                    no face — and the server already told us what it is called.
                    Drawing that is the same bargain the generic mark makes one
                    element over. */}
                <Show when={rowOf(agent.id)} fallback={<span class="truncate">{agent.name}</span>}>
                  {(row) => <Dynamic component={row()} />}
                </Show>
              </button>
            </li>
          )}
        </For>
      </ul>

      <Show when={props.onCancel}>
        {(leave) => (
          <button
            type="button"
            class="mt-4 text-sm text-muted underline underline-offset-2"
            data-testid={TESTID.chatChooseCancel}
            onClick={() => leave()()}
          >
            keep the conversation I am in
          </button>
        )}
      </Show>
    </div>
  )
}
