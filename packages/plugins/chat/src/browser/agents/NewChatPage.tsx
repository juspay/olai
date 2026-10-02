import { TESTID } from "../../testids.ts"
import { createEffect, createMemo, createSignal, For, createUniqueId, onMount, onCleanup, Show } from "solid-js"
import { listKey } from "@olai/web/client/keys.ts"
import { topmostWhileOpen } from "@olai/web/client/topmost.ts"
import { createCursor } from "@olai/ui-primitives/cursor.ts"
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

import { locationRows, locationTrail as trail } from "./location-rows.ts"
export function NewChatPage() {
  const owner = agentReadings()!.newChat
  const agents = useAgents()
  let input: HTMLTextAreaElement | undefined
  const [picking, pick] = createSignal(false)
  const engine = () => agents.engines().find(one => one.id === owner.chosen())?.id ?? agents.engines()[0]?.id
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
  const [defaultParent, setDefaultParent] = createSignal<string | null>(null)
  const topmost = topmostWhileOpen(() => true)
  const listId = createUniqueId()
  let element: HTMLDivElement | undefined
  const options = new Map<string, HTMLDivElement>()
  createEffect(() => {
    const recent = byActivity(agents.rows()).slice(0, 32).map(row => row.id)
    const ids = [...(props.here === null ? [] : [props.here]), ...suggestions.hits().slice(0, 5).map(hit => hit.id), ...recent]
    const query = { filter: filter(), limit: 20, ids, parents: recent }
    let alive = true
    onCleanup(() => { alive = false })
    void runAsync(chatWire().procedures.conversation.locations(query)).then(result => {
      if (!alive) return
      if (result._tag === "Success") { setNodes(result.success.nodes); setDefaultParent(result.success.defaultParent) }
      else fail(result.failure.message)
    })
  })
  onMount(() => {
    const outside = (event: PointerEvent) => { if (topmost() && event.target instanceof Node && !element?.contains(event.target)) props.close() }
    document.addEventListener("pointerdown", outside)
    onCleanup(() => document.removeEventListener("pointerdown", outside))
  })
  const rows = createMemo(() => locationRows({
    nodes: nodes(), here: props.here, filter: filter(), defaultParent: defaultParent(),
    // Late search answers must not suggest destinations for replaced words.
    suggested: suggestions.answering() === props.draft.trim() ? suggestions.hits().map(hit => hit.id) : [],
    recent: byActivity(agents.rows()).slice(0, 32).map(row => row.id),
  }))
  const cursor = createCursor(() => rows().length)
  const selected = cursor.at
  createEffect(() => { filter(); cursor.top() })
  createEffect(() => { rows(); options.get(rows()[selected()]?.node?.id ?? "default")?.scrollIntoView({ block: "nearest" }) })
  const take = (index: number, on = false) => {
    const row = rows()[index]
    if (row === undefined) return
    if (row.node === undefined) props.choose({ kind: "default" })
    else if (on && agents.at(row.node.id) !== undefined) fail("This node already has an agent. Press Enter to start under it.")
    else props.choose({ kind: on ? "on" : "under", node: row.node })
  }
  return <div ref={element} class="mb-3 rounded-control border border-rule bg-panel p-2" data-testid={TESTID.newChatPicker}>
    <input role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={rows().length > 0 ? `${listId}-${selected()}` : undefined} aria-label="Find a chat location" placeholder="Find a node…" class="w-full bg-transparent p-2" ref={element => onMount(() => element.focus())}
      value={filter()} onInput={event => { setFilter(event.currentTarget.value); fail(undefined) }}
      onKeyDown={event => {
        if (!topmost()) return
        const action = event.key === "Enter" && event.altKey ? "take" : listKey(event)
        if (action === null) return
        event.preventDefault(); event.stopPropagation()
        if (action === "dismiss") props.close()
        if (action === "next") cursor.step(1)
        if (action === "prev") cursor.step(-1)
        if (action === "take") take(selected(), event.altKey)
      }} />
    <div id={listId} role="listbox" aria-label="Chat locations" class="max-h-64 overflow-y-auto">
      <For each={rows()}>{(row, index) => <>
        <Show when={row.section !== rows()[index() - 1]?.section}><h2 class="px-2 text-caption uppercase text-muted">{row.section}</h2></Show>
        <div ref={el => { const key = row.node?.id ?? "default"; options.set(key, el); onCleanup(() => options.delete(key)) }} id={`${listId}-${index()}`} role="option" aria-selected={selected() === index()} class={`flex items-center rounded-control ${selected() === index() ? "bg-rule" : ""}`} data-location={row.node?.id ?? "default"}>
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
    <p class="m-1 hidden md:block text-caption text-muted">Enter: under this node · Alt+Enter: on this node</p>
  </div>
}
