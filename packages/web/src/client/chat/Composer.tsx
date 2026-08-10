/**
 * The input row: type, send, cancel.
 *
 * Three behaviours, and each of them is here because the panel is unusable
 * without it:
 *
 *   - **Enter sends, Shift+Enter is a newline.** A prompt is usually one line
 *     and occasionally several, and the common case should not need a button.
 *   - **Send becomes CANCEL while a turn is running.** There is one action
 *     available at a time and one place to look for it. A separate cancel
 *     button that is disabled most of the time is a control you have to learn
 *     to ignore.
 *   - **`/` opens the agent's own commands.** The list comes from the agent
 *     (the `commands` frame), so it is whatever that agent actually offers
 *     rather than a list olai maintains. Accepting one only writes `/name ` —
 *     sending is what invokes it, exactly as typing it would.
 *
 * The draft is local to this tab and is deliberately NOT a surface member: it
 * is an editor, not committed state, and two tabs typing at once should not
 * fight over one box.
 */

import { createSignal, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { SlashMenu } from "./SlashMenu.tsx"
import type { Chat } from "./state.ts"

export function Composer(props: { readonly chat: Chat }) {
  const [draft, setDraft] = createSignal("")
  const [showing, setShowing] = createSignal(false)
  let input: HTMLTextAreaElement | undefined

  const working = () => props.chat.state().status === "thinking"

  /** The word being completed: everything after a `/` that starts the draft.
   *  Only at the start — a slash mid-sentence is a slash. */
  const typed = () => {
    const text = draft()
    if (!text.startsWith("/")) return null
    const upto = text.indexOf(" ")
    return upto === -1 ? text.slice(1) : null
  }

  const matches = () => {
    const prefix = typed()
    if (prefix === null) return []
    return props.chat
      .state()
      .commands.filter((command) => command.name.startsWith(prefix))
  }

  const open = () => showing() && matches().length > 0

  const send = () => {
    const text = draft()
    if (text.trim() === "") return
    props.chat.send(text)
    setDraft("")
    setShowing(false)
  }

  const accept = (name: string) => {
    setDraft(`/${name} `)
    setShowing(false)
    input?.focus()
  }

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setShowing(false)
      return
    }
    // Enter sends. It does NOT need a "unless the menu is open" guard: the menu
    // takes the key in the capture phase and stops it propagating, so this
    // handler does not run while it is up (see ./SlashMenu.tsx). One mechanism
    // for one rule — a second one here would be a guard nobody could test.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }

  return (
    <div class="relative shrink-0 border-t border-rule p-2">
      <Show when={open()}>
        <SlashMenu
          commands={matches()}
          onAccept={accept}
          onDismiss={() => setShowing(false)}
        />
      </Show>

      <div class="flex items-end gap-2">
        <textarea
          ref={input}
          class="min-h-[2.5rem] flex-1 resize-none rounded border border-rule bg-paper px-2 py-1 text-sm outline-none focus:border-accent"
          data-testid={TESTID.chatInput}
          rows={2}
          placeholder="ask the agent…"
          value={draft()}
          onInput={(event) => {
            setDraft(event.currentTarget.value)
            setShowing(event.currentTarget.value.startsWith("/"))
          }}
          onKeyDown={onKey}
        />
        <Show
          when={working()}
          fallback={
            <button
              type="button"
              class="rounded border border-rule px-3 py-1.5 text-xs hover:border-accent hover:text-accent"
              data-testid={TESTID.chatSend}
              onClick={send}
            >
              send
            </button>
          }
        >
          <button
            type="button"
            class="rounded border border-alarm px-3 py-1.5 text-xs text-alarm"
            data-testid={TESTID.chatCancel}
            onClick={() => props.chat.cancel()}
          >
            cancel
          </button>
        </Show>
      </div>
    </div>
  )
}
