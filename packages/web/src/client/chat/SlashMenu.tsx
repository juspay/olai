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
import { createSignal, For, onCleanup, onMount } from "solid-js"

import { TESTID } from "../testids.ts"

export function SlashMenu(props: {
  readonly commands: ReadonlyArray<Command>
  readonly onAccept: (name: string) => void
  readonly onDismiss: () => void
}) {
  const [at, setAt] = createSignal(0)

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

  const onKey = (event: KeyboardEvent) => {
    const last = props.commands.length - 1
    if (event.key === "ArrowDown") {
      take(event)
      setAt(at() >= last ? 0 : at() + 1)
      return
    }
    if (event.key === "ArrowUp") {
      take(event)
      setAt(at() <= 0 ? last : at() - 1)
      return
    }
    if (event.key === "Enter" || event.key === "Tab") {
      const chosen = props.commands[at()]
      if (chosen === undefined) return
      take(event)
      props.onAccept(chosen.name)
      return
    }
    if (event.key === "Escape") {
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
                index() === at() ? "bg-rule" : ""
              }`}
              data-testid={TESTID.chatSlashCommand}
              data-command={command.name}
              data-active={index() === at()}
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
