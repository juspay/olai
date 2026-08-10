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
 *   - **`/` opens the agent's own commands**, and so does the button beside
 *     the input, which shows the WHOLE list. Typing filters; the button is for
 *     when you do not know what to type, which is most of the time you want a
 *     command list at all. It is drawn only when there are commands — a button
 *     that opens nothing is a button that lies. The list comes from the agent
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

/** Every control on the toolbar, the same height and the same corners. Written
 *  once because "these line up" is the property, and three copies of a class
 *  list line up only until somebody edits one. */
const CONTROL =
  "flex h-8 shrink-0 items-center justify-center rounded border text-xs"

export function Composer(props: { readonly chat: Chat }) {
  const [draft, setDraft] = createSignal("")
  const [showing, setShowing] = createSignal(false)
  /** Opened by the BUTTON rather than by typing a slash — the difference is
   *  only which prefix the list is filtered by. */
  const [asked, setAsked] = createSignal(false)
  let input: HTMLTextAreaElement | undefined

  const working = () => props.chat.state().status === "thinking"

  /** The word being completed: everything after a `/` that starts the draft.
   *  Only at the start — a slash mid-sentence is a slash. `null` is "this is
   *  not a command line", which is what closes the popover as you type past
   *  one. */
  const typed = () => {
    const text = draft()
    if (!text.startsWith("/")) return null
    const upto = text.indexOf(" ")
    return upto === -1 ? text.slice(1) : null
  }

  /** What the list is filtered by. The BUTTON asks with an empty prefix, which
   *  is the whole list; typing asks with what has been typed. */
  const prefix = () => (asked() ? typed() ?? "" : typed())

  const matches = () => {
    const wanted = prefix()
    if (wanted === null) return []
    return props.chat
      .state()
      .commands.filter((command) => command.name.startsWith(wanted))
  }

  const open = () => showing() && matches().length > 0

  const send = () => {
    const text = draft()
    if (text.trim() === "") return
    props.chat.send(text)
    setDraft("")
    dismiss()
  }

  const accept = (name: string) => {
    setDraft(`/${name} `)
    dismiss()
    input?.focus()
  }

  const dismiss = () => {
    setShowing(false)
    setAsked(false)
  }

  /** The button: the whole list, or put it away if it is already up. */
  const askForAll = () => {
    if (open()) {
      dismiss()
      return
    }
    setAsked(true)
    setShowing(true)
    input?.focus()
  }

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      dismiss()
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
        <SlashMenu commands={matches()} onAccept={accept} onDismiss={dismiss} />
      </Show>

      {/* The box takes the whole width and the controls sit UNDER it, rather
          than three things of three different shapes sharing a row. A textarea
          two lines tall beside a pair of one-line buttons has no alignment that
          is right: bottom-aligned they hang off its corner, centred they float
          in the middle of it. A row of its own gives them one edge to line up
          on, and gives the box the width it is actually for. */}
      <textarea
        ref={input}
        class="w-full resize-none rounded border border-rule bg-paper px-2 py-1.5 text-sm outline-none focus:border-accent"
        data-testid={TESTID.chatInput}
        rows={2}
        placeholder="ask the agent…"
        value={draft()}
        onInput={(event) => {
          setDraft(event.currentTarget.value)
          // Typing takes the popover back off the button: what is on screen
          // should be what the line says, not what a click said a moment ago.
          setAsked(false)
          setShowing(event.currentTarget.value.startsWith("/"))
        }}
        onKeyDown={onKey}
      />

      <div class="mt-2 flex items-center gap-2">
        {/* Only when the agent offers some: a button that opens nothing lies. */}
        <Show when={props.chat.state().commands.length > 0}>
          <button
            type="button"
            class={`${CONTROL} w-8 border-rule font-mono text-muted hover:text-ink`}
            data-testid={TESTID.chatCommands}
            aria-label="show the agent's slash commands"
            onClick={askForAll}
          >
            /
          </button>
        </Show>
        <span class="flex-1" />
        <Show
          when={working()}
          fallback={
            <button
              type="button"
              class={`${CONTROL} border-rule px-3 hover:border-accent hover:text-accent`}
              data-testid={TESTID.chatSend}
              onClick={send}
            >
              send
            </button>
          }
        >
          <button
            type="button"
            class={`${CONTROL} border-alarm px-3 text-alarm`}
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
