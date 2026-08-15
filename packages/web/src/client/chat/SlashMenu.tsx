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
import { topmostWhileOpen } from "../topmost.ts"
import { WITHIN } from "../layer.ts"
import { createCursor } from "../search/cursor.ts"
import { TESTID } from "../testids.ts"

export function SlashMenu(props: {
  readonly commands: ReadonlyArray<Command>
  /**
   * The BOX this list is completing, which is what makes it caret-scoped.
   *
   * The listener below is capture-phase on the document — it has to be, so the
   * composer's own Enter cannot send the message the reader was only
   * completing — and that reach is the whole trouble: it saw every keystroke on
   * the page, not only the ones aimed at the box. With a list up, pressing
   * Enter on the preferences trigger was answered HERE: `listKey` read it as
   * `take`, the completion was accepted, the key was stopped, and the panel the
   * reader asked for never opened (reported by review, reproducible on `master`
   * too). Being topmost does not answer that — a list is not the panel a
   * keystroke is for merely by being the last thing opened; it is the panel for
   * the keys aimed at the box it belongs to, which is what `../keys.ts` means
   * by its LIST layer.
   */
  readonly within: () => HTMLElement | undefined
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
   * This list on the client's one dismissal stack (`../topmost.ts`).
   *
   * `() => true` because BEING HERE is being open: the composer mounts this
   * component only while there is a list to draw, so the ticket is taken at
   * mount and given back at disposal. Every other layer holds a state its
   * caller owns; this one's state is its own existence.
   *
   * It matters because the listener below is capture-phase on the DOCUMENT and
   * takes the key outright — which is the stack's rule inverted when something
   * is over it. `../keys.ts`'s list layer says a shortlist is asked FIRST, and
   * that stays true; what this adds is that "first" means first among the
   * layers on screen, not first regardless of them.
   */
  const topmost = topmostWhileOpen(() => true)

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
    // Aimed at the box this list completes, or it is not this list's (see
    // `within`). First, because it is the older and stronger of the two
    // questions: a key somewhere else is not this menu's however topmost the
    // menu is.
    if (event.target !== props.within()) return
    // Not while something is over it: a key belongs to the panel that was
    // opened last, and this handler is the one place on the page that could
    // take it before that panel is even asked.
    if (!topmost()) return
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
      class={`absolute bottom-full left-2 right-2 ${WITHIN.pop} mb-1 max-h-64 list-none overflow-y-auto rounded border border-rule/70 bg-panel p-1 shadow-lg`}
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
