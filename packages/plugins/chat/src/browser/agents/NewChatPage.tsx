import { TESTID } from "../../testids.ts"
import { createEffect, createSignal, For, createUniqueId, onMount, onCleanup, Show } from "solid-js"
import { dismissOn } from "@olai/web/client/dismiss.ts"
import { nodePlace } from "olai-plugin-search/ui/place.ts"
import { CompletionRow } from "../chat/CompletionMenu.tsx"
import { NoAgent } from "../chat/NoAgent.tsx"
import { useAgents } from "./answered.tsx"
import { agentReadings } from "./reading.ts"
import { createLocationPicker } from "./location-picker.ts"
import { locationTrail as trail } from "./location-rows.ts"
import type { ChatLocation } from "./new-chat.ts"

export function NewChatPage() {
  const owner = agentReadings()!.newChat
  const agents = useAgents()
  let input: HTMLTextAreaElement | undefined
  let locationButton: HTMLButtonElement | undefined
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
    <button ref={locationButton} type="button" class="mb-3 rounded-control border border-rule px-3 py-2 text-body" data-testid={TESTID.newChatLocation} onClick={() => pick(!picking())}>{label()} ▾</button>
    <Show when={picking()}><LocationPicker trigger={() => locationButton} draft={owner.draft()} here={owner.here()} choose={value => { owner.choose(value); pick(false); focus() }} close={() => pick(false)} /></Show>
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

function LocationPicker(props: { readonly trigger: () => HTMLElement | undefined; readonly draft: string; readonly here: string | null; readonly choose: (value: ChatLocation) => void; readonly close: () => void }) {
  const agents = useAgents()
  const picker = createLocationPicker({
    rows: agents.rows, here: () => props.here, draft: () => props.draft,
    hasAgent: node => agents.at(node) !== undefined, choose: props.choose,
  })
  const listId = createUniqueId()
  let element: HTMLDivElement | undefined
  const options = new Map<string, HTMLDivElement>()
  dismissOn({ open: () => true, root: () => element, trigger: props.trigger, dismiss: props.close })
  createEffect(() => { picker.rows(); options.get(picker.rows()[picker.selected()]?.node?.id ?? "default")?.scrollIntoView({ block: "nearest" }) })
  return <div ref={element} class="mb-3 rounded-control border border-rule bg-panel p-2" data-testid={TESTID.newChatPicker} data-ready={picker.ready()}>
    <input role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={picker.rows().length > 0 ? `${listId}-${picker.selected()}` : undefined} aria-label="Find a chat location" placeholder="Find a node…" class="w-full bg-transparent p-2" ref={element => onMount(() => element.focus())}
      value={picker.filter()} onInput={event => picker.typed(event.currentTarget.value)}
      onKeyDown={event => { if (!picker.press(event)) return; event.preventDefault(); event.stopPropagation() }} />
    <div id={listId} role="listbox" aria-label="Chat locations" class="max-h-64 overflow-y-auto">
      <For each={picker.rows()}>{(row, index) => <>
        <Show when={row.section !== picker.rows()[index() - 1]?.section}><h2 class="px-2 text-caption uppercase text-muted">{row.section}</h2></Show>
        <div ref={el => { const key = row.node?.id ?? "default"; options.set(key, el); onCleanup(() => options.delete(key)) }} id={`${listId}-${index()}`} role="option" aria-selected={picker.selected() === index()} class={`flex items-center rounded-control ${picker.selected() === index() ? "bg-rule" : ""}`} data-location={row.node?.id ?? "default"}>
          <button type="button" class="min-w-0 flex-1 px-2 py-1 text-left text-label" onClick={() => picker.take(index())}
            onKeyDown={event => { if (event.key === "Enter" && event.altKey) { event.preventDefault(); picker.take(index(), true) } }}>
            <Show when={row.node} fallback={"Inbox › Chats"}>{node => <CompletionRow row={{ label: node().title, from: node().file, place: nodePlace(node()) }} />}</Show>
          </button>
          <Show when={row.node !== undefined && !picker.hasAgent(row.node.id)}>
            <button type="button" class="px-2 text-label text-muted" aria-label={`Chat on ${row.node?.title} itself`} onClick={() => picker.take(index(), true)}>On this node</button>
          </Show>
        </div>
      </>}</For>
    </div>
    <Show when={picker.failure()}>{message => <p role="alert">{message()}</p>}</Show>
    <p class="m-1 hidden md:block text-caption text-muted">Enter: under this node · Alt+Enter: on this node</p>
  </div>
}
