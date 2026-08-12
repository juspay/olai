/**
 * ⌘K command palette — the SHELL only.
 *
 * Navigation, panel toggles, reset widths, and a `>` prefix that sends the
 * rest to the agent. Jump-to-node type-ahead and op actions are the separate
 * `palette` roadmap item.
 *
 * `>` ask uses `run` with a real failure handler: a refusal is shown in the
 * palette rather than dropped (run.ts forbids a silent handler).
 */

import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js"

import type { OpFailure } from "@olai/surface"

import {
  resetPanelWidths,
  setChatOpen,
  toggleChat,
} from "../layout/prefs.ts"
import type { Route } from "../routes.ts"
import { TESTID } from "../testids.ts"
import { olai } from "../wire.ts"
import { run } from "../run.ts"
import { askQuery, filterItems, type PaletteItem } from "./items.ts"
import { isEditingTarget, matchKey } from "../keys.ts"
import { Shortcuts } from "./Shortcuts.tsx"

export function Palette(props: {
  readonly go: (route: Route) => void
  /**
   * Toggle the directory panel in a mode-aware way: desktop sidebar open/rail,
   * or the mobile drawer. Owned by App because the mobile state is ephemeral.
   */
  readonly toggleDirectory: () => void
  /** ⌘Z / ⌘⇧Z. They belong to the page's undo stack, not to this component —
   *  what this file owns is the ONE window listener the global layer has
   *  (../keys.ts), and a second one for two more chords would be exactly the
   *  disagreement that registry exists to make impossible. */
  readonly undo: () => void
  readonly redo: () => void
}) {
  const [open, setOpen] = createSignal(false)
  const [keys, setKeys] = createSignal(false)
  const [query, setQuery] = createSignal("")
  const [active, setActive] = createSignal(0)
  const [askError, setAskError] = createSignal<string | null>(null)
  let input: HTMLInputElement | undefined
  let previousFocus: HTMLElement | null = null

  const ask = createMemo(() => askQuery(query()))
  const items = createMemo(() => {
    if (ask() !== null) return [] as ReadonlyArray<PaletteItem>
    return filterItems(query())
  })

  const close = () => {
    setOpen(false)
    setQuery("")
    setActive(0)
    setAskError(null)
    const back = previousFocus
    previousFocus = null
    queueMicrotask(() => back?.focus())
  }

  const openPalette = () => {
    previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setOpen(true)
    setQuery("")
    setActive(0)
    setAskError(null)
    queueMicrotask(() => input?.focus())
  }

  const runItem = (item: PaletteItem) => {
    const action = item.action
    if (action.kind === "route") props.go(action.route)
    else if (action.kind === "shortcuts") setKeys(true)
    else if (action.kind === "toggle-sidebar") props.toggleDirectory()
    else if (action.kind === "toggle-chat") toggleChat()
    else if (action.kind === "reset-widths") resetPanelWidths()
    close()
  }

  const sendAsk = (text: string) => {
    if (text.trim() === "") return
    setAskError(null)
    run(
      olai.procedures.chat.send({ text }),
      (failure: OpFailure) => {
        setAskError(failure.message)
        // Leave the palette open so the refusal is visible; open the panel
        // so the reader can also recover there.
        setChatOpen(true)
      },
      () => {
        setChatOpen(true)
        close()
      },
    )
  }

  const confirm = () => {
    const text = ask()
    if (text !== null) {
      sendAsk(text)
      return
    }
    const list = items()
    const item = list[active()] ?? list[0]
    if (item !== undefined) runItem(item)
  }

  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      const match = matchKey(event)
      if (match === null) {
        if (open() && event.key === "Escape") {
          event.preventDefault()
          close()
        }
        // Simple focus trap: keep Tab inside the dialog while open.
        if (open() && event.key === "Tab" && input) {
          event.preventDefault()
          input.focus()
        }
        return
      }
      if (!match.whileEditing && isEditingTarget(event.target)) return
      event.preventDefault()
      if (match.action === "palette") {
        if (open()) close()
        else openPalette()
        return
      }
      if (match.action === "sidebar") props.toggleDirectory()
      if (match.action === "chat") toggleChat()
      // Reached only with the caret nowhere — both chords are
      // `whileEditing: false`, so a draft keeps the platform's own undo and
      // Escape keeps abandoning.
      if (match.action === "undo") props.undo()
      if (match.action === "redo") props.redo()
    }
    window.addEventListener("keydown", onKey)
    onCleanup(() => window.removeEventListener("keydown", onKey))
  })

  createEffect(() => {
    const n = items().length
    if (active() >= n) setActive(n === 0 ? 0 : n - 1)
  })

  return (
    <>
    <Shortcuts open={keys()} onClose={() => setKeys(false)} />
    <Show when={open()}>
      <div
        class="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 px-4 pt-[min(20vh,8rem)]"
        data-testid={TESTID.palette}
        role="dialog"
        aria-modal="true"
        aria-label="command palette"
      >
        <button
          type="button"
          class="absolute inset-0 cursor-default"
          aria-label="close the palette"
          data-testid={TESTID.paletteScrim}
          onClick={close}
        />
        <div class="relative z-10 w-full max-w-lg overflow-hidden rounded-lg border border-rule bg-paper shadow-lg">
          <input
            ref={input}
            type="text"
            class="w-full border-b border-rule bg-transparent px-4 py-3 font-mono text-sm text-ink outline-none placeholder:text-muted"
            data-testid={TESTID.paletteInput}
            placeholder="Jump, toggle, or > ask the agent…"
            value={query()}
            onInput={(e) => {
              setQuery(e.currentTarget.value)
              setActive(0)
              setAskError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault()
                const n = items().length
                if (n > 0) setActive((i) => (i + 1) % n)
              } else if (e.key === "ArrowUp") {
                e.preventDefault()
                const n = items().length
                if (n > 0) setActive((i) => (i - 1 + n) % n)
              } else if (e.key === "Enter") {
                e.preventDefault()
                confirm()
              } else if (e.key === "Escape") {
                e.preventDefault()
                close()
              }
            }}
          />
          <Show when={askError()}>
            {(err) => (
              <div
                class="border-b border-alarm/40 bg-alarm/5 px-4 py-2 font-mono text-xs text-alarm"
                data-testid={TESTID.paletteAskError}
                role="alert"
              >
                {err()}
              </div>
            )}
          </Show>
          <Show
            when={ask() !== null}
            fallback={
              <ul
                class="m-0 max-h-72 list-none overflow-y-auto p-1"
                data-testid={TESTID.paletteList}
              >
                <For
                  each={[...items()]}
                  fallback={
                    <li class="px-3 py-2 font-mono text-xs text-muted">
                      no matches
                    </li>
                  }
                >
                  {(item, index) => (
                    <li>
                      <button
                        type="button"
                        class={`flex w-full items-baseline justify-between gap-3 rounded px-3 py-2 text-left text-sm ${
                          index() === active()
                            ? "bg-rule text-ink"
                            : "text-ink hover:bg-rule/60"
                        }`}
                        data-testid={TESTID.paletteItem}
                        data-id={item.id}
                        data-active={index() === active() ? "true" : "false"}
                        onMouseEnter={() => setActive(index())}
                        onClick={() => runItem(item)}
                      >
                        <span>{item.label}</span>
                        <Show when={item.hint}>
                          {(hint) => (
                            <span class="shrink-0 font-mono text-[0.6875rem] text-muted">
                              {hint()}
                            </span>
                          )}
                        </Show>
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            }
          >
            <div
              class="px-4 py-3 font-mono text-xs text-muted"
              data-testid={TESTID.paletteAsk}
            >
              <Show
                when={(ask() ?? "").trim() !== ""}
                fallback={
                  <span>type a message after &gt; to send to the agent</span>
                }
              >
                <span>
                  send to agent: <span class="text-ink">{ask()}</span>
                </span>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </Show>
    </>
  )
}
