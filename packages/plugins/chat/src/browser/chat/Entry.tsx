import { useRouter } from "olai-plugin-navigation/routing"
import { servedDirectory } from "../vault.ts"
import { SAYING_MS } from "olai-plugin-chat/wire"
import type { ChatEntry } from "olai-plugin-chat/wire"
import type { Delivery } from "@kolu/acp/wire"
import { createScheduled, throttle } from "@solid-primitives/scheduled"
import { createEffect, createMemo, Match, Show, Switch } from "solid-js"


import { Attachments } from "./Attachments.tsx"
import { Rang } from "./Rang.tsx"
import { ContextChips } from "./ContextChips.tsx"
import { markdownReady } from "@olai/markdown-ui/chunk.ts"
import { Markdown } from "@olai/markdown-ui/Markdown.tsx"
import { TESTID } from "../../testids.ts"

import { AskForm } from "./AskForm.tsx"
import { createDeclared } from "../references.ts"
import { markNodeRefs } from "./refs.ts"
import { Refusal } from "./Refusal.tsx"
import type { Chat } from "./state.ts"
import { ToolFrame } from "./ToolFrame.tsx"

const FRAME_MS = SAYING_MS

const FACE: Record<Delivery, {
  readonly bubble: string
  readonly said: string
  readonly tone: string
}> = {
  refused: {
    bubble: "border border-dashed border-alarm bg-alarm/10",
    said: "Not sent",
    tone: "text-alarm",
  },
  unanswered: {
    bubble: "border border-dashed border-doing bg-doing/10",
    said: "No reply. It may not have arrived.",
    tone: "text-doing",
  },
}

const SENT = "border border-accent/20 bg-accent/10"

const fatedOf = (fate: Delivery | undefined): string | undefined =>
  fate === undefined ? undefined : FACE[fate].bubble

const bubbleOf = (fate: Delivery | undefined): string => fatedOf(fate) ?? SENT

const MINE_COLUMN = "ml-auto flex w-fit max-w-[85%] flex-col items-end"
const RANG_COLUMN = "flex w-full flex-col items-start"

const AGENT_WROTE_IT = ""

export function Entry(props: {
  readonly entry: ChatEntry
  readonly chat: Chat
}) {
  const due = props.entry.kind === "agent"
    ? createScheduled((run) => throttle(run, FRAME_MS))
    : undefined
  const routes = useRouter().routes
  const declared = props.entry.kind === "agent" ? createDeclared() : undefined
  let said: HTMLDivElement | undefined
  const shown = createMemo((previous: string = "") => {
    const text = props.entry.text
    if (props.entry.kind !== "agent" || props.entry.streaming !== true) return text
    return due === undefined || due() ? text : previous
  })
  const ofKind = <K extends ChatEntry["kind"]>(
    kind: K,
  ): Extract<ChatEntry, { kind: K }> | undefined =>
    props.entry.kind === kind
      ? (props.entry as Extract<ChatEntry, { kind: K }>)
      : undefined

  if (declared !== undefined) {
    createEffect(() => {
      shown()
      markdownReady()
      if (said === undefined) return
      declared.want(markNodeRefs(said, declared.named, routes.href))
    })
  }

  return (
    <div
      class="min-w-0"
      data-testid={TESTID.chatEntry}
      data-kind={props.entry.kind}
      data-entry-id={props.entry.id}
      data-streaming={props.entry.kind === "agent" && props.entry.streaming === true}
    >
      <Switch>
        <Match when={ofKind("user")}>
          {(user) => {
          const rang = () => user().rang
          return (
          <div class={rang() === undefined ? MINE_COLUMN : RANG_COLUMN}>
            <ContextChips nodes={user().context ?? []} />
            <Attachments names={user().attachments ?? []} />
            <Show when={user().text !== ""}>
              <Show
                when={rang()}
                keyed
                fallback={
                  <p
                    class={`whitespace-pre-wrap rounded-control px-2 py-1.5 text-body text-ink ${
                      bubbleOf(user().delivery)
                    }`}
                    data-testid={TESTID.chatMine}
                  >
                    {user().text}
                  </p>
                }
              >
                {(who) => (
                  <Rang entry={user()} by={who} fated={fatedOf(user().delivery)} />
                )}
              </Show>
            </Show>
            <Show when={user().queued}>
              <div
                class="mt-1 flex items-center gap-2"
                data-testid={TESTID.chatQueued}
              >
                <span class="text-caption text-doing">Queued</span>
              </div>
            </Show>
            <Show when={user().delivery} keyed>
              {(fate) => (
                <div
                  class="mt-1 flex items-center gap-2"
                  data-testid={TESTID.chatDelivery}
                  data-delivery={fate}
                >
                  <span class={` text-caption ${FACE[fate].tone}`}>
                    {FACE[fate].said}
                  </span>
                  <Show when={fate === "refused" && rang() === undefined}>
                    <button
                      type="button"
                      class="rounded-control border border-rule px-1.5 py-0.5 text-caption text-muted hover:text-ink"
                      data-testid={TESTID.chatResend}
                      onClick={() => props.chat.resend(user().id)}
                    >
                      Send again
                    </button>
                  </Show>
                </div>
              )}
            </Show>
          </div>
          )
          }}
        </Match>

        <Match when={ofKind("agent")}>
          {(agent) => (
          <div ref={said}>
            <Markdown
            claims={servedDirectory()?.claims()}
              source={shown()}
              from={AGENT_WROTE_IT}
              live={agent().streaming === true}
              class="olai-md-compact text-body"
              testid={TESTID.chatSaid}
            />
          </div>
          )}
        </Match>

        <Match when={ofKind("tool")}>
          {(tool) => <ToolFrame entry={tool()} />}
        </Match>

        <Match when={ofKind("ask")}>
          {(ask) => <AskForm entry={ask()} chat={props.chat} />}
        </Match>

        <Match when={ofKind("refusal")}>
          {(row) => <Refusal failure={row().refusal} />}
        </Match>

        <Match when={ofKind("notice")}>
          {(notice) => (
            <p class="text-caption text-muted">{notice().text}</p>
          )}
        </Match>
      </Switch>
    </div>
  )
}
