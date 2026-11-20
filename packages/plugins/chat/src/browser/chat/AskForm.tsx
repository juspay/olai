import { useWaitingForms } from "./waiting-forms.ts"
import { Key } from "@solid-primitives/keyed"

import type { AskEntry } from "olai-plugin-chat/wire"
import type { AskField } from "@kolu/acp/wire"
import { createEffect, createMemo, createSignal, For, Show } from "solid-js"

import { TESTID } from "../../testids.ts"
import { AskControl } from "./AskControl.tsx"
import { LinkCard } from "./LinkCard.tsx"
import { useConversationUI } from "./ui.tsx"
import type { Chat } from "./state.ts"

const SAID: Record<string, string> = {
  answered: "Answered",
  declined: "You dismissed this",
  withdrawn: "The agent withdrew this",
}

export function AskForm(props: {
  readonly entry: AskEntry
  readonly chat: Chat
}) {
  const { draftAnswers, draftOf, forgetDraft, setDraft } = useConversationUI().drafts
  const forms = useWaitingForms()
  const ask = () => props.entry.ask
  const waiting = () => ask().outcome === null
  const link = () => ask().link

  const blocks = createMemo<ReadonlyArray<AskField>>(() =>
    ask().fields.filter((field) => field.attachedTo === null)
  )

  const companion = (field: AskField): AskField | undefined =>
    ask().fields.find((each) => each.attachedTo === field.key)

  const values = (key: string): ReadonlyArray<string> => {
    const outcome = ask().outcome
    if (outcome === null) return draftOf(props.entry.id, key)
    return outcome.answers.find((answer) => answer.key === key)?.values ?? []
  }

  const [sending, setSending] = createSignal(false)

  const settled = () => setSending(false)

  const submit = () => {
    if (sending()) return
    setSending(true)
    const keys = ask().fields.map((field) => field.key)
    props.chat.answer(props.entry.id, draftAnswers(props.entry.id, keys), settled)
  }

  const dismiss = () => {
    if (sending()) return
    setSending(true)
    props.chat.decline(props.entry.id, settled)
  }

  createEffect(() => {
    if (ask().outcome != null) forgetDraft(props.entry.id)
  })

  return (
    <div ref={element => forms?.register(element, waiting)}
      class={`rounded-control border-l-[3px] py-1.5 pl-3 pr-2 ${
        waiting() ? "border-doing bg-doing/10" : "border-rule"
      }`}
      data-testid={TESTID.chatAsk}
      data-asking={waiting()}
      data-how={ask().outcome?.how ?? ""}
    >
      <Show
        when={link()}
        fallback={
          <>
            <p class="m-0 whitespace-pre-wrap text-body">{props.entry.text}</p>
          </>
        }
      >
        {(where) => (
          <LinkCard
            message={props.entry.text}
            url={where().url}
            host={where().host}
            done={!waiting()}
          />
        )}
      </Show>

      <div class="mt-2 flex flex-col gap-3">
        <Key each={blocks()} by="key">
          {(field) => (
            <div data-testid={TESTID.chatAskField} data-field={field().key}>
              <Show when={field().label}>
                {(label) => (
                  <p class="m-0 text-label text-muted">
                    {label()}
                    <Show when={field().required}>
                      <span class="text-alarm" aria-label="Required">*</span>
                    </Show>
                  </p>
                )}
              </Show>
              <Show when={field().hint}>
                {(hint) => <p class="m-0 text-label text-muted">{hint()}</p>}
              </Show>

              <div class="mt-1">
                <AskControl
                  field={field()}
                  values={values(field().key)}
                  disabled={!waiting() || sending()}
                  onChange={(next) => setDraft(props.entry.id, field().key, next)}
                />
              </div>

              <Show when={companion(field())}>
                {(other) => (
                  <div class="mt-1.5">
                    <AskControl
                      field={other()}
                      values={values(other().key)}
                      disabled={!waiting() || sending()}
                      onChange={(next) => setDraft(props.entry.id, other().key, next)}
                    />
                  </div>
                )}
              </Show>
            </div>
          )}
        </Key>
      </div>

      <Show
        when={waiting()}
        fallback={
          <p
            class="mt-2 text-caption text-muted"
            data-testid={TESTID.chatAskOutcome}
          >
            {SAID[ask().outcome?.how ?? ""] ?? "No longer waiting"}
          </p>
        }
      >
        <div class="mt-2 flex items-center gap-2">
          <Show when={link() === null}>
            <button
              type="button"
              class="flex h-8 items-center rounded-control border border-accent px-3 text-label text-accent disabled:opacity-60"
              data-testid={TESTID.chatAskSubmit}
              disabled={sending()}
              onClick={submit}
            >
              Answer
            </button>
          </Show>
          <button
            type="button"
            class="flex h-8 items-center rounded-control border border-rule px-3 text-label text-muted hover:text-ink disabled:opacity-60"
            data-testid={TESTID.chatAskDismiss}
            disabled={sending()}
            onClick={dismiss}
          >
            {link() === null ? "Dismiss" : "Cancel"}
          </button>
        </div>
      </Show>
    </div>
  )
}
