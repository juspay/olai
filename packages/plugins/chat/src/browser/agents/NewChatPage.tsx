import { TESTID } from "../../testids.ts"
import { createEffect, createMemo, createSignal, For, onMount, onCleanup, Show } from "solid-js"
import { runAsync } from "@olai/web/client/run.ts"
import { nodePlace } from "olai-plugin-search/ui/place.ts"
import { chatWire } from "../wire.ts"
import { createSearch } from "../search.ts"
import { CompletionRow } from "../chat/CompletionMenu.tsx"
import { NoAgent } from "../chat/NoAgent.tsx"
import { useAgents } from "./answered.tsx"
import { agentReadings } from "./reading.ts"
import { byActivity } from "./activity-order.ts"
import type { ChatLocation, LocationNode } from "./new-chat.ts"

const trail = (node: LocationNode) => [node.file, ...node.path, node.title].join(" › ")
export function NewChatPage() {
  const owner = agentReadings()!.newChat
  const agents = useAgents()
  let input: HTMLTextAreaElement | undefined
  const [picking, pick] = createSignal(false)
  const engine = () => owner.chosen() ?? agents.engines()[0]?.id
  const send = () => { const id = engine(); if (id !== undefined) void owner.start(id) }
  const label = () => { const at = owner.location(); return at.kind === "default" ? "In: Inbox › Chats" : `${at.kind === "on" ? "On" : "In"}: ${trail(at.node)}` }
  const focus = () => input?.focus()
  createEffect(() => {
    owner.focusRequest()
    // Palette actions close and restore their old focus after navigation's
    // microtasks. This face owns the later focus, and cancels it on departure.
    const frame = requestAnimationFrame(focus)
    onCleanup(() => cancelAnimationFrame(frame))
  })
  return <section class="mx-auto w-full max-w-2xl p-4" data-testid={TESTID.newChatPage}>
    <h1 class="text-title">New chat</h1>
    <button type="button" class="mb-3 rounded-control border border-rule px-3 py-2 text-body" data-testid={TESTID.newChatLocation} onClick={() => pick(!picking())}>{label()} ▾</button>
    <Show when={picking()}><LocationPicker draft={owner.draft()} here={owner.here()} choose={value => { owner.choose(value); pick(false); focus() }} close={() => { pick(false); focus() }} /></Show>
    <Show when={agents.engines().length > 0} fallback={<NoAgent />}>
      <textarea ref={input} aria-label="New chat message" data-testid={TESTID.newChatInput} placeholder="What would you like to discuss?"
        class="min-h-32 w-full resize-y rounded-control border border-rule bg-paper p-3 text-body outline-none"
        value={owner.draft()} onInput={event => owner.setDraft(event.currentTarget.value)}
        onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); send() } }} />
      <div class="mt-2 flex items-center gap-2">
        <select aria-label="Agent" data-testid={TESTID.newChatEngine} value={engine()} onChange={event => owner.chooseEngine(event.currentTarget.value)}>
          <For each={agents.engines()}>{one => <option value={one.id}>{one.name}</option>}</For>
        </select>
        <span class="flex-1" />
        <button type="button" data-testid={TESTID.newChatSend} class="rounded-control bg-accent px-3 py-1 text-paper" onClick={send}>{owner.pending() ? "Starting…" : "Send"}</button>
      </div>
    </Show>
    <Show when={owner.failure()}>{message => <p role="alert" class="text-alarm">{message()}</p>}</Show>
  </section>
}

function LocationPicker(props: { readonly draft: string; readonly here: string | null; readonly choose: (value: ChatLocation) => void; readonly close: () => void }) {
  const agents = useAgents()
  const [filter, setFilter] = createSignal("")
  const [nodes, setNodes] = createSignal<readonly LocationNode[]>([])
  const [failure, fail] = createSignal<string>()
  const suggestions = createSearch(() => props.draft.trim() || null, "node")
  const [selected, select] = createSignal(0)
  let alive = true
  onCleanup(() => { alive = false })
  onMount(async () => {
    const result = await runAsync(chatWire().procedures.conversation.locations())
    if (!alive) return
    if (result._tag === "Success") setNodes(result.success)
    else fail(result.failure.message)
  })
  const rows = createMemo(() => {
    const all = nodes()
    const byId = new Map(all.map(node => [node.id, node]))
    const seen = new Set<string>()
    const values: { section: string; node?: LocationNode }[] = []
    const matches = (node: LocationNode) => trail(node).toLowerCase().includes(filter().toLowerCase())
    const add = (section: string, id: string | null) => {
      const node = id === null ? undefined : byId.get(id)
      if (node === undefined || seen.has(node.id) || !matches(node)) return
      seen.add(node.id); values.push({ section, node })
    }
    if ("Inbox Chats".toLowerCase().includes(filter().toLowerCase())) values.push({ section: "Default" })
    add("Here", props.here)
    // A stale search answer may be drawn elsewhere, but cannot suggest a
    // destination for words the person has already replaced.
    if (suggestions.answering() === props.draft.trim()) for (const hit of suggestions.hits()) add("Suggested", hit.id)
    for (const row of byActivity(agents.rows())) add("Recent", byId.get(row.id)?.parent ?? null)
    for (const node of all) add("All nodes", node.id)
    return values
  })
  const take = (index: number, on = false) => {
    const row = rows()[index]
    if (row === undefined) return
    if (row.node === undefined) props.choose({ kind: "default" })
    else if (!on || agents.at(row.node.id) === undefined) props.choose({ kind: on ? "on" : "under", node: row.node })
  }
  return <div class="mb-3 rounded-control border border-rule bg-panel p-2" data-testid={TESTID.newChatPicker}>
    <input aria-label="Find a chat location" placeholder="Find a node…" class="w-full bg-transparent p-2" ref={element => onMount(() => element.focus())}
      value={filter()} onInput={event => { setFilter(event.currentTarget.value); select(0) }}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); props.close() }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); select(index => Math.max(0, Math.min(rows().length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))) }
        if (event.key === "Enter") { event.preventDefault(); take(selected(), event.altKey) }
      }} />
    <div class="max-h-64 overflow-y-auto">
      <For each={rows()}>{(row, index) => <>
        <Show when={row.section !== rows()[index() - 1]?.section}><h2 class="px-2 text-caption uppercase text-muted">{row.section}</h2></Show>
        <div class={`flex items-center rounded-control ${selected() === index() ? "bg-rule" : ""}`} data-location={row.node?.id ?? "default"}>
          <button type="button" class="min-w-0 flex-1 px-2 py-1 text-left text-label" onClick={() => take(index())}
            onKeyDown={event => { if (event.key === "Enter" && event.altKey) { event.preventDefault(); take(index(), true) } }}>
            <Show when={row.node} fallback={"Inbox › Chats"}>{node => <CompletionRow row={{ label: node().title, from: node().file, place: nodePlace(node()) }} />}</Show>
          </button>
          <Show when={row.node !== undefined && agents.at(row.node.id) === undefined}>
            <button type="button" class="px-2 text-label text-muted" aria-label={`Chat on ${row.node?.title} itself`} onClick={() => take(index(), true)}>On this node</button>
          </Show>
        </div>
      </>}</For>
    </div>
    <Show when={failure()}>{message => <p role="alert">{message()}</p>}</Show>
    <p class="m-1 text-caption text-muted">Enter: under this node · Alt+Enter: on this node</p>
  </div>
}
