/**
 * The slash-command completion, over the input.
 *
 * The list is the AGENT'S — it arrives on the chat cell as the agent's own
 * `commands`, so what is offered is what that agent actually has, and olai
 * maintains no list of its own to go stale. An agent that offers none draws
 * nothing (the composer does not open this at all).
 *
 * Keyboard first, because the whole point is not reaching for the mouse
 * mid-sentence: ↑/↓ walk, Enter and Tab accept, Escape closes. A click does the
 * same thing for the times a hand is already there.
 */

import type { Command } from "@olai/surface"
import { For, onCleanup, onMount } from "solid-js"

import { listKey } from "../keys.ts"
import { createCursor } from "../search/cursor.ts"
import { TESTID } from "../testids.ts"

export function SlashMenu(props: {
  readonly commands: ReadonlyArray<Command>
  readonly onAccept: (name: string) => void
  readonly onDismiss: () => void
}) {
  // WHICH row Enter takes — the one cursor every shortlist in this client
  // shares (`../search/cursor.ts`), so the arrows mean the same thing here, in
  // the ⌘K palette, in the header's box and in the row editor's completions.
  // It also keeps the cursor on a row that EXISTS when the agent's command list
  // changes underneath, which this menu had no answer for at all.
  const cursor = createCursor(() => props.commands.length)

  /**
   * Bound on the document, in the CAPTURE phase, because the input owns Enter
   * for sending: the menu has to see the key first and TAKE it when it is the
   * one being answered.
   *
   * `stopPropagation` as well as `preventDefault`, and the difference matters:
   * `preventDefault` only stops the browser's own behaviour, so the composer's
   * own handler would still run — and by then the menu is closed, so it would
   * read "no menu open" and send the message the reader was only completing.
   */
  const take = (event: KeyboardEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const accept = (event: KeyboardEvent) => {
    const chosen = props.commands[cursor.at()]
    if (chosen === undefined) return
    take(event)
    props.onAccept(chosen.name)
  }

  // WHICH key is the registry's (`../keys.ts`'s list layer); what each answer
  // MEANS is this menu's. TAB is this surface's own extra — it accepts here and
  // means nothing to the other lists, so it stays a case of this handler rather
  // than an arm of the shared matcher.
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Tab") {
      accept(event)
      return
    }
    const action = listKey(event)
    if (action === null) return
    if (action === "next") {
      take(event)
      cursor.step(1)
    }
    if (action === "prev") {
      take(event)
      cursor.step(-1)
    }
    if (action === "take") accept(event)
    if (action === "dismiss") {
      take(event)
      props.onDismiss()
    }
  }

  onMount(() => {
    document.addEventListener("keydown", onKey, true)
    onCleanup(() => document.removeEventListener("keydown", onKey, true))
  })

  return (
    <ul
      class="absolute bottom-full left-2 right-2 z-50 mb-1 max-h-64 list-none overflow-y-auto rounded border border-rule/70 bg-panel p-1 shadow-lg"
      data-testid={TESTID.chatSlashMenu}
    >
      <For each={props.commands}>
        {(command, index) => (
          <li>
            <button
              type="button"
              class={`block w-full truncate rounded px-2 py-1 text-left text-xs ${
                index() === cursor.at() ? "bg-rule" : ""
              }`}
              data-testid={TESTID.chatSlashCommand}
              data-command={command.name}
              data-active={index() === cursor.at()}
              onClick={() => props.onAccept(command.name)}
            >
              <span class="font-mono">/{command.name}</span>
              <span class="ml-2 text-muted">{command.description}</span>
            </button>
          </li>
        )}
      </For>
    </ul>
  )
}
