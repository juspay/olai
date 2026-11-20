import { batch, createMemo, createSignal, For, Show } from "solid-js"
import { isNotePath, itemKey } from "@olai/format"
import { composing } from "@olai/web/client/composition.ts"
import { useHere, useRouter } from "olai-plugin-navigation/routing"

import { TESTID } from "../../testids.ts"
import { servedDirectory } from "../vault.ts"
import { AgentMark } from "../chat/AgentMark.tsx"
import { useAgents } from "./answered.tsx"
import { ChatBeside, useChatBeside } from "./ChatBeside.tsx"
import { sendAbout } from "./send-about.ts"
import { agentReadings } from "./reading.ts"
import { nameOfNote } from "./called.ts"
import { chatRouteOf } from "./route.ts"
import type { Row } from "./roster.ts"
import { StandingWords } from "./Standing.tsx"

const ROW = "flex items-center gap-2 text-label text-muted"
const RULE = "h-px flex-1 bg-rule"

export function NoteLine(props: { readonly path: string }) {
  const agents = useAgents()
  const note = createMemo(() => {
    const claims = servedDirectory()?.claims()
    return claims !== undefined && isNotePath(claims, props.path) ? props.path : null
  })
  const chat = createMemo(() => note() === null ? undefined : agents.chatOf({ kind: "note", path: props.path }))
  return (
    <Show when={note()}>{(path) =>
      <Show when={chat() !== undefined || agents.engines().length > 0}>
        <section class="mt-2 mb-3 border-y border-rule py-1.5" data-testid={TESTID.chatLine}
          data-note={path()} data-chat={chat()?.id}>
          <Show when={chat()} fallback={<Ask path={path()} />}>
            {(row) => <Here row={row()} path={path()} />}
          </Show>
        </section>
      </Show>
    }</Show>
  )
}

function Here(props: { readonly row: Row; readonly path: string }) {
  const { beside, press } = useChatBeside(() => ({ kind: "note", path: props.path }))
  return (
    <div class={ROW}>
      <button type="button" class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-control bg-transparent p-0 text-left text-label text-muted hover:text-ink"
        data-testid={TESTID.chatLineOpen} data-beside={String(beside() !== null)} onClick={press}>
        <span class="inline-flex items-center gap-1 whitespace-nowrap text-caption text-muted"
          data-testid={TESTID.chatLineStanding} data-agent={props.row.id} data-standing={props.row.standing}>
          <StandingWords row={props.row} />
        </span>
        <span class="min-w-0 truncate">Chat about this page</span>
        <span class={RULE} aria-hidden="true" />
      </button>
      <ChatBeside item={{ kind: "note", path: props.path }} />
    </div>
  )
}

function Ask(props: { readonly path: string }) {
  const agents = useAgents()
  const router = useRouter()
  const here = useHere()
  const name = () => nameOfNote(servedDirectory()?.claims(), props.path)
  const owner = () => ({ kind: "door", where: "line", item: itemKey({ kind: "note", path: props.path }) }) as const
  const draft = () => agentReadings()?.unsent(owner()) ?? ""
  const [chosen, choose] = createSignal<string>()
  const [starting, setStarting] = createSignal(false)
  const [failure, setFailure] = createSignal<string | null>(null)
  const engine = () => chosen() ?? agents.engines()[0]?.id
  const send = async () => {
    const text = draft()
    const id = engine()
    const sentFrom = owner()
    if (starting() || id === undefined || text.trim() === "") return
    batch(() => { setStarting(true); setFailure(null) })
    try {
      const sent = await sendAbout({ item: { kind: "note", path: props.path }, engine: id, text })
      if (sent.started === null) { setFailure(sent.said); return }
      agentReadings()?.setUnsent(sentFrom, "")
      router.openRight(here(), chatRouteOf({ kind: "note", path: props.path }))
    } finally { setStarting(false) }
  }
  return <div data-testid={TESTID.chatAbout} data-where="line">
    <div class={ROW}>
      <span class="inline-flex items-center gap-1 text-caption text-muted"><AgentMark id={engine() ?? ""} /></span>
      <input type="text" class="min-w-0 flex-1 bg-transparent text-label outline-none placeholder:text-muted"
        data-testid={TESTID.agentPlainInput} disabled={starting()}
        aria-label={`Ask about ${name()}`} placeholder={`Ask about ${name()}…`}
        value={draft()} onInput={event => agentReadings()?.setUnsent(owner(), event.currentTarget.value)}
        onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (composing(event)) return; void send() } }} />
      <Show when={agents.engines().length > 1}>
        <select aria-label="Agent" class="bg-transparent text-caption text-muted" data-testid={TESTID.agentPlainEngine}
          value={engine()} disabled={starting()} onChange={event => choose(event.currentTarget.value)}>
          <For each={agents.engines()}>{one => <option value={one.id}>{one.name}</option>}</For>
        </select>
      </Show>
      <span class={RULE} aria-hidden="true" />
      <ChatBeside item={{ kind: "note", path: props.path }} />
    </div>
    <Show when={failure()}>
      {message => <p role="alert" class="m-0 pt-1 text-caption text-alarm" data-testid={TESTID.agentPlainRefused}>{message()}</p>}
    </Show>
  </div>
}
