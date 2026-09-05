/** Model selection uses ACP configuration, including on adapters with no /model command. */
import { createEffect, createSignal, For, Show } from "solid-js"
import { agentIn } from "olai-plugin-chat/wire"
import { createInlinePicker } from "@olai/web/client/inlinePicker.ts"
import { WITHIN } from "@olai/web/client/layer.ts"
import { TESTID } from "../../testids.ts"
import type { Chat } from "./state.ts"

export function Model(props: { readonly chat: Chat; readonly name: string }) {
  const state = () => props.chat.state()
  const [pending, setPending] = createSignal(false)
  const picker = createInlinePicker({
    opening: () => ({ agent: agentIn(state())?.id, session: state().session?.id }),
  })
  const disabled = () => pending() || state().status !== "idle" || state().session === null
  createEffect(() => {
    const at = picker.showing()
    if (at !== undefined && (disabled() || at.agent !== agentIn(state())?.id || at.session !== state().session?.id)) {
      picker.shut()
    }
  })

  return (
    <Show when={state().models.length > 0}
      fallback={<span data-testid={TESTID.chatModel}>{props.name}</span>}>
      <button type="button" ref={picker.setTrigger} disabled={disabled()}
        class="truncate text-left hover:text-accent disabled:cursor-default"
        aria-label="Change model" aria-expanded={picker.open()} onClick={picker.toggle}>
        <span data-testid={TESTID.chatModel}>{props.name}</span>
        <span aria-hidden="true"> ▾</span>
      </button>
      <Show when={picker.open()}>
        <ul ref={picker.setList} aria-label="Models"
          class={`absolute inset-x-3 top-full ${WITHIN.pop} mt-1 max-h-80 list-none overflow-y-auto rounded border border-rule/70 bg-panel p-1 shadow-lg`}>
          <For each={state().models}>
            {(model) => (
              <li>
                <button type="button"
                  class="block w-full rounded px-2 py-1 text-left text-xs hover:bg-rule"
                  onClick={() => {
                    const at = picker.showing()
                    if (at?.agent === undefined || at.session === undefined) return
                    picker.shut()
                    setPending(true)
                    props.chat.setModel(at.agent, at.session, model.value, () => setPending(false))
                  }}>
                  {model.name}
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </Show>
  )
}
