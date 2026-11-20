import { type Accessor, createEffect, createMemo, createSignal, createSelector, For, Show } from "solid-js"
import { agentIn } from "olai-plugin-chat/wire"
import { createInlinePicker } from "@olai/web/client/inlinePicker.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { listKey } from "@olai/web/client/keys.ts"
import { type Cursor, createCursor } from "@olai/ui-primitives/cursor.ts"
import { TESTID } from "../../testids.ts"
import { type Offered, visibleModels } from "./model-filter.ts"
import type { Setting } from "@kolu/acp/wire"
import type { Chat } from "./state.ts"

interface DismissableFilter {
  readonly query: Accessor<string>
  readonly setQuery: (text: string) => void
  readonly visible: Accessor<ReadonlyArray<Offered>>
  readonly cursor: Cursor
  readonly selected: (at: number) => boolean
}

const createDismissableFilter = (
  offers: (query: string) => ReadonlyArray<Offered>,
): DismissableFilter => {
  const [query, setQuery] = createSignal("")
  const visible = createMemo(() => offers(query()))
  const cursor = createCursor(() => visible().length)
  return { query, setQuery, visible, cursor, selected: createSelector(cursor.at) }
}

export function Model(props: { readonly chat: Chat; readonly name: string }) {
  const state = () => props.chat.state()
  const [pending, setPending] = createSignal(false)
  const picker = createInlinePicker({
    opening: () => ({ agent: agentIn(state())?.id, session: state().session?.id }),
  })
  const disabled = () => pending() || props.chat.pendingSends() > 0 || state().status !== "idle" || state().session === null
  createEffect(() => {
    const at = picker.showing()
    if (at !== undefined && (props.chat.pendingSends() > 0 || state().status !== "idle" || at.agent !== agentIn(state())?.id || at.session !== state().session?.id)) {
      picker.shut()
    }
  })

  const ModelFilter = () => {
    const { query, setQuery, visible, cursor, selected } = createDismissableFilter(
      (text) => visibleModels(state().models, text),
    )

    const key = (event: KeyboardEvent): void => {
      switch (listKey(event)) {
        case "next":
          event.preventDefault()
          cursor.step(1)
          return
        case "prev":
          event.preventDefault()
          cursor.step(-1)
          return
        case "take":
          if (visible().length > 0) {
            event.preventDefault()
            pick(visible()[cursor.at()], { back: true })
          }
          return
        default:
          return
      }
    }

    const pick = (model: Offered | undefined, opts?: { back?: boolean }): void => {
      if (model === undefined) return
      const at = picker.showing()
      if (at?.agent === undefined || at.session === undefined) return
      picker.shut()
      setPending(true)
      props.chat.setModel(at.agent, at.session, model.value, () => {
        setPending(false)
        if (opts?.back) picker.focusTrigger()
      })
    }

    return (
      <>
        <li>
          <input type="search" aria-label="Filter models" data-testid={TESTID.chatModelFilter}
            class="block w-full rounded-control bg-transparent px-2 py-1 text-label text-ink outline-none placeholder:text-muted"
            placeholder="Filter"
            enterkeyhint="done"
            autocorrect="off"
            autocapitalize="none"
            spellcheck={false}
            ref={(box) => queueMicrotask(() => box.focus())}
            value={query()}
            onInput={(event) => {
              setQuery(event.currentTarget.value)
              cursor.top()
            }}
            onKeyDown={key} />
        </li>
        <For each={visible()} fallback={
          <li data-testid={TESTID.chatModelNone} class="px-2 py-1 text-label text-muted">
            No model matches "{query().trim()}"
          </li>
        }>
          {(model, index) => {
            let button: HTMLButtonElement | undefined
            createEffect(() => { if (selected(index())) button?.scrollIntoView({ block: "nearest" }) })
            return <li>
              <button type="button" ref={button}
                class="block w-full rounded-control px-2 py-1 text-left text-label hover:bg-rule"
                classList={{ "bg-rule": selected(index()) }}
                aria-selected={selected(index())}
                onPointerEnter={() => cursor.to(index())}
                onClick={() => pick(model)}>
                {model.name}
              </button>
            </li>
          }}
        </For>
      </>
    )
  }

  const choose = (setting: Setting, value: string | boolean): void => {
    const at = picker.showing()
    if (disabled() || at?.agent === undefined || at.session === undefined) return
    setPending(true)
    props.chat.setSetting(at.agent, at.session, setting.id, value, () => setPending(false))
  }

  return (
    <Show when={state().models.length > 0 || state().settings.length > 0}
      fallback={<span data-testid={TESTID.chatModel}>{props.name}</span>}>
      <button type="button" ref={picker.setTrigger} disabled={disabled()}
        class="truncate text-left hover:text-accent disabled:cursor-default"
        aria-label="Change model" aria-expanded={picker.open()} onClick={picker.toggle}>
        <span data-testid={TESTID.chatModel}>{props.name}</span>
        <span aria-hidden="true"> ▾</span>
      </button>
      <Show when={picker.open()}>
        <ul ref={picker.setList} aria-label="Models"
          class={`absolute inset-x-3 top-full ${LAYER.page} mt-1 max-h-80 list-none overflow-y-auto rounded-surface border border-rule bg-panel p-1 shadow-raised`}>
          <Show when={state().models.length > 0}>
            <ModelFilter />
          </Show>
          <For each={state().settings.filter((setting) => setting.kind !== "model")}>
            {(setting) => (
              <li class="border-t border-rule/60 px-2 py-2">
                <label class="flex items-center justify-between gap-3 text-label">
                  <span>{setting.name}</span>
                  <Show when={setting.kind === "choice" ? setting : undefined} fallback={
                    <input type="checkbox" aria-label={setting.name}
                      checked={setting.value === "true"} disabled={disabled()}
                      onChange={(event) => { const value = event.currentTarget.checked; event.currentTarget.checked = setting.value === "true"; choose(setting, value) }} />
                  }>
                    {(select) => <select aria-label={select().name} value={select().value ?? ""}
                      disabled={disabled()} class="max-w-40 rounded-control border border-rule bg-panel px-1 py-1"
                      onChange={(event) => { const value = event.currentTarget.value; event.currentTarget.value = select().value ?? ""; choose(setting, value) }}>
                      {/* A `<select>`'s content model admits only `<option>`,
                          `<optgroup>` and `<hr>`, and the platform draws the
                          opened list where no node of ours can stand. HTML-AAM
                          maps an option's `title` to its accessible
                          description. */}
                      <For each={select().choices}>{(choice) =>
                        <option value={choice.value} title={choice.hint ?? undefined}>{choice.label}</option>
                      }</For>
                    </select>}
                  </Show>
                </label>
                <Show when={setting.description}>
                  <p class="mt-1 whitespace-normal text-caption text-muted">{setting.description}</p>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </Show>
  )
}
