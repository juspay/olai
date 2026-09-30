/** A row owns only the question. The chat still owns the replacement request. */
import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { createConfirming } from "@olai/web/client/confirming.ts"
import { anchoredTo, styleOf } from "@olai/web/client/anchor.ts"
import { LAYER } from "@olai/web/client/layer.ts"
import { MENU_PANEL } from "@olai/ui-primitives/menu.ts"
import { ConfirmReplacement } from "../ConfirmReplacement.tsx"
import { TESTID } from "../../testids.ts"
import type { Chat } from "./state.ts"

export function Rewind(props: { readonly chat: Chat; readonly id: string }) {
  const subject = createMemo(() => JSON.stringify([props.chat.state().session?.id, props.id, props.chat.canRewind()]))
  const confirm = createConfirming(subject)
  let trigger: HTMLButtonElement | undefined
  const [at, setAt] = createSignal(anchoredTo({ left: 0, bottom: 0, top: 0 }, { width: 0, height: 0 }))
  createEffect(() => {
    if (confirm.where() !== "asking") return
    const measure = () => {
      if (trigger !== undefined) setAt(anchoredTo(trigger.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight }))
    }
    measure()
    window.addEventListener("resize", measure)
    document.addEventListener("scroll", measure, true)
    onCleanup(() => { window.removeEventListener("resize", measure); document.removeEventListener("scroll", measure, true) })
  })
  return <>
    <button ref={trigger} type="button" data-testid={TESTID.chatRewind} title="Edit from here" aria-label="Edit from here"
      class="absolute right-full top-0 mr-1 flex size-7 items-center justify-center rounded-control text-faint hover:text-ink [@media(pointer:coarse)]:size-11 [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-hover/rewind:opacity-100 [@media(pointer:fine)]:group-focus-within/rewind:opacity-100"
      onClick={() => { if (confirm.where() === "offered") confirm.ask() }}>
      <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m16 3 5 5M4 15 16 3a3.54 3.54 0 0 1 5 5L9 20l-6 1 1-6Z" />
      </svg>
    </button>
    <Show when={confirm.where() === "asking"}>
      <Portal>
        <div class={`fixed ${LAYER.over}`} style={styleOf(at())}>
          <div class={`${MENU_PANEL} p-3`}>
          <ConfirmReplacement label="Confirm edit from here"
            question="Later messages leave this chat. The original stays under Past sessions. Files are not reverted."
            action="Edit from here" trigger={() => trigger} cancel={confirm.drop}
            confirm={() => { confirm.drop(); props.chat.rewind(props.id) }} />
          </div>
        </div>
      </Portal>
    </Show>
  </>
}
