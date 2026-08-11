/**
 * A question the agent asked, as a form in the conversation.
 *
 * It is a ROW rather than a modal, and that is the whole design. A modal would
 * take the screen away from the thing the question is about — the outline, the
 * answer being written above it — and would leave nothing behind once it was
 * dismissed. This stays: after it is answered the same form is still there,
 * disabled, with what was chosen marked on it, so a person scrolling back sees
 * what was asked and what they said, and so does the next person to read the
 * conversation.
 *
 * Two things are drawn that the payload does not spell out:
 *
 *   - **an "other" box lives INSIDE the question it belongs to.** The agent
 *     sends it as a field of its own, marked with the question it is paired
 *     with; drawn as a seventh field it would read as a second question. So
 *     fields that name a partner are folded under it, and the partner's own
 *     block is the one place both appear.
 *   - **dismiss is a REAL answer.** It tells the agent a person declined, which
 *     is a thing it is entitled to know and act on. What it must never become
 *     is a fabricated choice — so it is a button of its own, it says what it
 *     does, and the row afterwards says which of the two happened.
 *
 * Nothing here is optimistic. Pressing submit calls a verb; the row changes
 * when the server says it did, exactly like every other entry in this panel.
 */

import type { AskField, ChatEntry } from "@olai/surface"
import { createMemo, For, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { AskControl } from "./AskControl.tsx"
import { draftAnswers, draftOf, forgetDraft, setDraft } from "./drafts.ts"
import type { Chat } from "./state.ts"

/** What the row says once it has stopped waiting. Three outcomes, three
 *  sentences — a dismissal and a withdrawal are different things that happened
 *  and a reader coming back to the row deserves to know which. */
const SAID: Record<string, string> = {
  answered: "answered",
  declined: "you dismissed this",
  withdrawn: "the agent took this back",
}

export function AskForm(props: {
  readonly entry: ChatEntry
  readonly chat: Chat
}) {
  const ask = () => props.entry.ask
  const waiting = () => ask()?.outcome === null

  /** The fields to draw as blocks: everything that is not somebody else's
   *  "other" box. */
  const blocks = createMemo<ReadonlyArray<AskField>>(() =>
    (ask()?.fields ?? []).filter((field) => field.attachedTo === null)
  )

  /** The free-text companion of a question, if it sent one. */
  const companion = (field: AskField): AskField | undefined =>
    ask()?.fields.find((each) => each.attachedTo === field.key)

  /**
   * What a field holds right now: the draft while the question is live, and
   * what was actually sent once it is not.
   *
   * The same accessor for both is what makes one component draw a form and its
   * own record — and it is why the record is TRUE rather than a repeat of
   * whatever this tab happened to have typed: after the answer, the row's own
   * outcome is the only source.
   */
  const values = (key: string): ReadonlyArray<string> => {
    const outcome = ask()?.outcome
    if (outcome === null || outcome === undefined) return draftOf(props.entry.id, key)
    return outcome.answers.find((answer) => answer.key === key)?.values ?? []
  }

  const submit = () => {
    const keys = (ask()?.fields ?? []).map((field) => field.key)
    props.chat.answer(props.entry.id, draftAnswers(props.entry.id, keys))
    forgetDraft(props.entry.id)
  }

  const dismiss = () => {
    props.chat.decline(props.entry.id)
    forgetDraft(props.entry.id)
  }

  return (
    <Show when={ask()}>
      {(form) => (
        <div
          class={`rounded border-l-[3px] py-1.5 pl-3 pr-2 ${
            waiting() ? "border-doing bg-doing/5" : "border-rule"
          }`}
          data-testid={TESTID.chatAsk}
          data-asking={waiting()}
          data-how={form().outcome?.how ?? ""}
        >
          {/* The agent's own words. Quoted rather than rendered, like a user
              message: a question is a sentence somebody has to read exactly,
              and a `#` in it is a `#`. */}
          <p class="m-0 whitespace-pre-wrap text-sm">{props.entry.text}</p>

          <div class="mt-2 flex flex-col gap-3">
            <For each={blocks()}>
              {(field) => (
                <div data-testid={TESTID.chatAskField} data-field={field.key}>
                  <Show when={field.label}>
                    {(label) => (
                      <p class="m-0 text-xs text-muted">
                        {label()}
                        <Show when={field.required}>
                          <span class="text-alarm" aria-label="required">*</span>
                        </Show>
                      </p>
                    )}
                  </Show>
                  <Show when={field.hint}>
                    {(hint) => <p class="m-0 text-xs text-muted">{hint()}</p>}
                  </Show>

                  <div class="mt-1">
                    <AskControl
                      field={field}
                      values={values(field.key)}
                      disabled={!waiting()}
                      onChange={(next) => setDraft(props.entry.id, field.key, next)}
                    />
                  </div>

                  {/* Its own box, under the options it is an alternative to.
                      The agent reads a typed answer as taking PRECEDENCE over
                      whichever chip is pressed, so the two live together and
                      neither is hidden behind the other. */}
                  <Show when={companion(field)}>
                    {(other) => (
                      <div class="mt-1.5">
                        <AskControl
                          field={other()}
                          values={values(other().key)}
                          disabled={!waiting()}
                          onChange={(next) => setDraft(props.entry.id, other().key, next)}
                        />
                      </div>
                    )}
                  </Show>
                </div>
              )}
            </For>
          </div>

          <Show
            when={waiting()}
            fallback={
              <p
                class="mt-2 font-mono text-[0.6875rem] text-muted"
                data-testid={TESTID.chatAskOutcome}
              >
                {SAID[form().outcome?.how ?? ""] ?? "no longer waiting"}
              </p>
            }
          >
            <div class="mt-2 flex items-center gap-2">
              <button
                type="button"
                class="flex h-8 items-center rounded border border-accent px-3 text-xs text-accent"
                data-testid={TESTID.chatAskSubmit}
                onClick={submit}
              >
                answer
              </button>
              <button
                type="button"
                class="flex h-8 items-center rounded border border-rule px-3 text-xs text-muted hover:text-ink"
                data-testid={TESTID.chatAskDismiss}
                onClick={dismiss}
              >
                dismiss
              </button>
            </div>
          </Show>
        </div>
      )}
    </Show>
  )
}
