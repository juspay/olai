import { useRouter } from "olai-plugin-navigation/routing"

import type { UserEntry } from "olai-plugin-chat/wire"
import { createEffect, createMemo, Show } from "solid-js"

import { createDeclared } from "../references.ts"
import { useConversationUI } from "./ui.tsx"
import { Quoted } from "./Quoted.tsx"
import { Tip } from "@olai/web/client/Tip.tsx"
import { rangRow } from "./rang.ts"
import { markNodeRefs } from "./refs.ts"
import { TESTID } from "../../testids.ts"

const RANG = "border-l-[3px] border-ink bg-pill"

const rangBubbleOf = (fated: string | undefined): string => fated ?? RANG

function RangBody(props: { readonly said: string }) {
  return (
    <p class="whitespace-pre-wrap" data-testid={TESTID.chatRangBody}>
      <Quoted said={props.said} />
    </p>
  )
}

export function Rang(props: {
  readonly entry: UserEntry
  readonly by: string
  readonly fated: string | undefined
}) {
  const { isUnfolded, toggleFold } = useConversationUI().folds
  const said = createMemo(() => rangRow(props.entry.text, isUnfolded(props.entry.id)))
  const routes = useRouter().routes
  const declared = createDeclared()
  let rang: HTMLDivElement | undefined
  createEffect(() => {
    said()
    if (rang === undefined) return
    declared.want(markNodeRefs(rang, declared.named, routes.href))
  })
  return (
    <div
      class={`w-full rounded-control py-1.5 pl-3 pr-2 text-body text-ink ${
        rangBubbleOf(props.fated)
      }`}
      data-testid={TESTID.chatRang}
      data-rang-by={props.by}
      data-unfolded={said().open}
      ref={rang}
    >
      <Show when={said().folds} fallback={<RangBody said={said().body} />}>
        <Tip text={said().body} disabled={said().open}>
        <div
          class="mb-0.5 flex w-full items-start gap-1.5 text-caption tracking-wider text-muted"
        >
          <button
            type="button"
            class="shrink-0 cursor-pointer rounded-control leading-4 hover:text-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent"
            data-testid={TESTID.chatRangFold}
            aria-expanded={said().open}
            aria-label={said().open ? "Hide details" : "Show details"}
            onClick={() => toggleFold(props.entry.id)}
          >
            <span aria-hidden="true">{said().open ? "▾" : "▸"}</span>
          </button>
          <span class="min-w-0" data-testid={TESTID.chatRangByline}>
            <Quoted said={said().byline} />
          </span>
        </div>
        </Tip>
        <Show when={said().open}>
          <RangBody said={said().body} />
        </Show>
      </Show>
    </div>
  )
}
