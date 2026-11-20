import { createMemo, Show } from "solid-js"
import { hrefOfPlain, zoomNode } from "olai-plugin-navigation/routes"
import { useMaybeRouter } from "olai-plugin-navigation/routing"
import { Tip } from "@olai/web/client/Tip.tsx"

import { TESTID } from "../../testids.ts"
import { AgentMark } from "../chat/AgentMark.tsx"
import { agentAbove, trailOf } from "./above.ts"
import { type Row } from "./roster.ts"
import { useAgents } from "./answered.tsx"
import { focusAgent, visitAgent } from "./focus.ts"

function Pill(props: { readonly row: Row; readonly engine: string }) {
  const agents = useAgents()
  return (
    <Tip text={`Open the conversation with ${agents.named(props.row).name}`}>
      <a
        href={hrefOfPlain(zoomNode(props.row.id))}
        class="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-rule px-2 py-0.5 text-label text-muted no-underline hover:bg-rule hover:text-ink"
        data-testid={TESTID.agentAbove}
        data-agent={props.row.id}
        data-engine={props.row.engine}
        on:olai-navigated={() => visitAgent(props.row)}
      >
        <span aria-hidden="true">↑</span>
        <AgentMark id={props.row.engine} />
        <span class="min-w-0 truncate text-ink">{agents.named(props.row).name}</span>
        <span class="shrink-0 text-muted">· {props.engine}</span>
        <span class="sr-only"> — open the conversation above</span>
      </a>
    </Tip>
  )
}

export function AgentAbove(props: { readonly node: string; readonly line?: boolean }) {
  const agents = useAgents()
  const above = createMemo(() => agentAbove(trailOf(props.node), agents))
  return (
    <Show when={above()}>
      {(row) => {
        const pill = () => (
          <Pill
            row={row()}
            engine={agents.standings().find((one) => one.id === row().engine)?.name ?? row().engine}
          />
        )
        return props.line === true
          ? <div class="flex flex-wrap items-center gap-2 border-b border-rule bg-desk/50 px-3 py-1.5 text-label text-muted" data-testid={TESTID.agentAboveLine}>{pill()}</div>
          : pill()
      }}
    </Show>
  )
}

export function CrumbMark(props: { readonly node: string }) {
  const agents = useAgents()
  const router = useMaybeRouter()
  return (
    <Show when={agents.at(props.node)}>
      {(row) => (
        <Tip text={`Open the conversation with ${agents.named(row()).name}`}>
          <button
            type="button"
            tabIndex={-1}
            class="inline-flex shrink-0 items-center rounded-control p-0.5 text-muted hover:bg-rule hover:text-ink"
            data-testid={TESTID.crumbMark}
            data-agent={row().id}
            data-engine={row().engine}
            aria-label={`Open the conversation with ${agents.named(row()).name}`}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (router === undefined) return
              focusAgent(router, row())
              event.currentTarget.dispatchEvent(new CustomEvent("olai-navigated", { bubbles: true }))
            }}
          >
            <AgentMark id={row().engine} />
          </button>
        </Tip>
      )}
    </Show>
  )
}
