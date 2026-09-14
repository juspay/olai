/** Model selection uses ACP configuration, including on adapters with no /model command. */
import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { agentIn } from "olai-plugin-chat/wire"
import { createInlinePicker } from "@olai/web/client/inlinePicker.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { listKey } from "@olai/web/client/keys.ts"
import { createCursor } from "@olai/ui-primitives/cursor.ts"
import { TESTID } from "../../testids.ts"
import { type Offered, visibleModels } from "./model-filter.ts"
import type { SessionSetting } from "olai-plugin-chat/wire"
import type { Chat } from "./state.ts"

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

  // THE FILTER IS THE OPENING'S OWN: created inside the `<Show>` that draws
  // the list, so shutting throws it away with the DOM and the next opening
  // starts empty — a query that outlived its list would narrow a menu the
  // person can no longer see it in (see `@olai/web`'s `inlinePicker.ts`). It
  // is NOT the open-arm payload the way `./Wake.tsx`'s is: the arm here is
  // the pick's address (`{agent, session}`), the rows are the agent's own
  // static config, and the query is a thing SAID to the box while it is up —
  // presentational, nothing to recompute — so a local signal that dies with
  // the list is the load-bearing lifetime, exactly the invariant the wake
  // strip's `opening: () => ""` encodes in its shape.
  /** What the open list is narrowed BY, and the cursor over what it offers. */
  const ModelFilter = () => {
    const [query, setQuery] = createSignal("")
    const visible = createMemo(() => visibleModels(state().models, query()))
    const cursor = createCursor(() => visible().length)

    // Keep the row under the cursor ON THE SCREEN: the keys below prevent the
    // browser's own scrolling and the caret lives in the filter box, so an
    // arrow-walked row is invisible unless the row itself asks for the pane —
    // which is the whole story of an 84-model menu otherwise (review of
    // #600). `nearest`, so a move between already-visible rows moves nothing.
    // The row is FOUND the same way the DOM names it — the rows below are
    // the only things carrying `aria-selected` at all — so the effect knows
    // nothing about where the filter row sits: children arithmetic here was
    // the first re-review's target, and it went with the caret's keepers in
    // `@olai/web`'s `inlinePicker.ts`.
    createEffect(() => {
      cursor.at()
      if (visible().length === 0) return
      picker.list()?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" })
    })

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
          // CLAIMED whenever there is something to take — the shortlist's own
          // rule (`olai-plugin-search`'s `Shortlist.tsx`): a list on screen
          // owns its Enter, and an empty one has nothing to claim. ESCAPE is
          // the picker's, not the box's: `./dismissOn` answers it and puts
          // the caret back on the trigger.
          if (visible().length > 0) {
            event.preventDefault()
            pick(visible()[cursor.at()], { back: true })
          }
          return
        default:
          return
      }
    }

    /** TAKE a row — the one thing a click and Enter both do, in one function
     *  so the two cannot drift: same guard, same shut, same send.
     *
     *  `back` is the GESTURE's, not the row's: the caret goes back to the
     *  trigger only for the key it can reach, by the dismissal's own rule
     *  (`@olai/web`'s `dismiss.ts`). It goes at CONFIRMATION rather than at
     *  the press: while the send is in flight the trigger is `disabled()` and
     *  a focus placed then would be thrown off it again at once. */
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
            class="block w-full rounded bg-transparent px-2 py-1 text-xs text-ink outline-none placeholder:text-muted"
            placeholder="filter"
            // The caret goes here as the list attaches — it was opened to be
            // typed in. `queueMicrotask` for the reason every panel in this
            // client uses one: the element is not in the document when the
            // ref runs.
            ref={(box) => queueMicrotask(() => box.focus())}
            value={query()}
            onInput={(event) => {
              setQuery(event.currentTarget.value)
              // A keystroke is a NEW question, so the answer to the last one
              // is not where anybody's eye is (`@olai/ui-primitives`'s
              // `cursor.ts`).
              cursor.top()
            }}
            onKeyDown={key} />
        </li>
        <For each={visible()} fallback={
          <li data-testid={TESTID.chatModelNone} class="px-2 py-1 text-xs text-muted">
            no model matches "{query().trim()}"
          </li>
        }>
          {(model, index) => (
            <li>
              <button type="button"
                class="block w-full rounded px-2 py-1 text-left text-xs hover:bg-rule"
                classList={{ "bg-rule": index() === cursor.at() }}
                aria-selected={index() === cursor.at()}
                onPointerEnter={() => cursor.to(index())}
                onClick={() => pick(model)}>
                {model.name}
              </button>
            </li>
          )}
        </For>
      </>
    )
  }

  const choose = (setting: SessionSetting, value: string | boolean): void => {
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
          class={`absolute inset-x-3 top-full ${LAYER.page} mt-1 max-h-80 list-none overflow-y-auto rounded border border-rule/70 bg-panel p-1 shadow-lg`}>
          <Show when={state().models.length > 0}>
            <ModelFilter />
          </Show>
          <For each={state().settings}>
            {(setting) => (
              <li class="border-t border-rule/60 px-2 py-2">
                <label class="flex items-center justify-between gap-3 text-xs">
                  <span>{setting.name}</span>
                  <Show when={setting.type === "select" ? setting : undefined} fallback={
                    <input type="checkbox" aria-label={setting.name}
                      checked={setting.currentValue === true} disabled={disabled()}
                      onChange={(event) => { const value = event.currentTarget.checked; event.currentTarget.checked = setting.currentValue === true; choose(setting, value) }} />
                  }>
                    {(select) => <select aria-label={select().name} value={select().currentValue}
                      disabled={disabled()} class="max-w-40 rounded border border-rule bg-panel px-1 py-1"
                      onChange={(event) => { const value = event.currentTarget.value; event.currentTarget.value = select().currentValue; choose(setting, value) }}>
                      <For each={select().options}>{(option) =>
                        <option value={option.value} title={option.description}>{option.name}</option>
                      }</For>
                    </select>}
                  </Show>
                </label>
                <Show when={setting.description}>
                  <p class="mt-1 whitespace-normal text-[0.625rem] text-muted">{setting.description}</p>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </Show>
  )
}
