/**
 * The picker: the agent's stored conversations, newest first.
 *
 * Asked of the SERVER every time it opens rather than kept in a cell, because
 * the agent's list is the only one that is right — it changes when a terminal
 * `claude --resume` writes to the same directory, and a cached copy would
 * quietly stop being true. The cost is one round trip on a click.
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

import { createSignal, For, Match, onCleanup, Show, Switch } from "solid-js"

import { dismissOn } from "../dismiss.ts"
import { Refusal } from "./Refusal.tsx"
import { WITHIN } from "../layer.ts"
import { QUIET_PILL } from "../pill.ts"
import { TESTID } from "../testids.ts"
import type { Chat, Sessions as Answer } from "./state.ts"
import { whenOf } from "./when.ts"
import type { OpFailure, SessionInfo } from "@olai/surface"

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
   *  laid out BESIDE the button rather than inside it (see the header). */
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

  return (
    <div class="relative">
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
          class={`absolute right-0 top-full ${WITHIN.pop} mt-1 max-h-80 w-80 list-none overflow-y-auto rounded border border-rule/70 bg-panel p-1 shadow-lg`}
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
            <Match when={listedIn(picker())}>
              {(sessions) => (
                <Show
                  when={sessions().length > 0}
                  fallback={
                    <li class="px-2 py-1 text-xs text-muted">no stored conversations</li>
                  }
                >
                  <For each={sessions()}>
                    {(session) => (
                      <li>
                        <button
                          type="button"
                          class="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left text-xs hover:bg-rule"
                          data-testid={TESTID.chatSession}
                          data-session-id={session.id}
                          data-current={session.id === current()}
                          disabled={session.id === current()}
                          onClick={() => {
                            setPicker({ _tag: "shut" })
                            props.chat.loadSession(session.id)
                          }}
                        >
                          <span
                            class={`min-w-0 flex-1 truncate ${
                              session.id === current() ? "text-accent" : ""
                            }`}
                          >
                            {session.title ?? session.id}
                          </span>
                          {/* The stamp does not shrink and the title does:
                              two rows that share a title (a `/clear` leaves a
                              pair) differ in nothing else, so the one thing
                              that tells them apart may not be the thing a long
                              title pushes off the end. */}
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
                </Show>
              )}
            </Match>
          </Switch>
        </ul>
      </Show>
    </div>
  )
}

/** The sessions, when there are some — `undefined` in the states that have
 *  none, which is what `<Show>` takes. */
const listedIn = (picker: Picker): ReadonlyArray<SessionInfo> | undefined =>
  picker._tag === "listed" ? picker.sessions : undefined

/** Why there is no list, when that is the answer. */
const refusedIn = (picker: Picker): OpFailure | undefined =>
  picker._tag === "refused" ? picker.failure : undefined
