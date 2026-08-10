/**
 * One row of the conversation, and the five things it can be.
 *
 * A switch rather than five call sites, because "what kind of row is this" is
 * one question and the transcript should not have to know the answer. Each arm
 * is small enough to read at a glance and different enough from the others to
 * earn its own shape.
 *
 * Markdown at RENDER time, and only for the agent: what a person typed is
 * quoted verbatim, and a tool's title is the agent's own string. The rule is
 * the same one titles and notes follow — the stored text is never touched, and
 * `#` at the start of a line somebody typed is a `#`, not a heading.
 */

import type { ChatEntry } from "@olai/surface"
import { Match, Show, Switch } from "solid-js"

import { renderMarkdown } from "../markdown.ts"
import { TESTID } from "../testids.ts"
import { Refusal } from "./Refusal.tsx"
import { ToolFrame } from "./ToolFrame.tsx"

export function Entry(props: { readonly entry: ChatEntry }) {
  return (
    <div
      class="mb-2"
      data-testid={TESTID.chatEntry}
      data-kind={props.entry.kind}
      data-entry-id={props.entry.id}
    >
      <Switch>
        <Match when={props.entry.kind === "user"}>
          <p class="whitespace-pre-wrap rounded bg-rule/60 px-2 py-1 text-sm">
            {props.entry.text}
          </p>
        </Match>

        <Match when={props.entry.kind === "agent"}>
          <div class="olai-note text-sm">
            {/* eslint-disable-next-line solid/no-innerhtml */}
            <div innerHTML={renderMarkdown(props.entry.text)} />
            <Show when={props.entry.streaming}>
              <span class="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-muted align-middle" />
            </Show>
          </div>
        </Match>

        <Match when={props.entry.kind === "tool"}>
          <ToolFrame entry={props.entry} />
        </Match>

        <Match when={props.entry.kind === "refusal"}>
          <Show
            when={props.entry.refusal}
            fallback={<p class="text-sm text-alarm">{props.entry.text}</p>}
          >
            {(failure) => <Refusal failure={failure()} />}
          </Show>
        </Match>

        <Match when={props.entry.kind === "notice"}>
          <p class="font-mono text-[0.6875rem] text-muted">{props.entry.text}</p>
        </Match>
      </Switch>
    </div>
  )
}
