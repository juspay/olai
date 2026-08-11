/**
 * ⌘K command palette — the SHELL only.
 *
 * Navigation, panel toggles, and a `>` prefix that sends the rest to the
 * agent. Jump-to-node type-ahead and op actions are the separate `palette`
 * roadmap item.
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

import { setChatOpen, toggleChat, toggleSidebar } from "../layout/prefs.ts"
import type { Route } from "../routes.ts"
import { TESTID } from "../testids.ts"
import { olai } from "../wire.ts"
import { run } from "../chat/run.ts"
import {
  askQuery,
  filterItems,
  type PaletteItem,
  SHELL_ITEMS,
} from "./items.ts"
import { isEditingTarget, matchKey } from "./keys.ts"

export function Palette(props: {
  readonly go: (route: Route) => void
}) {
  const [open, setOpen] = createSignal(false)
  const [query, setQuery] = createSignal("")
  const [active, setActive] = createSignal(0)
  let input: HTMLInputElement | undefined

  const ask = createMemo(() => askQuery(query()))
  const items = createMemo(() => {
    if (ask() !== null) return [] as ReadonlyArray<PaletteItem>
    return filterItems(query())
  })

  const close = () => {
    setOpen(false)
    setQuery("")
    setActive(0)
  }

  const runItem = (item: PaletteItem) => {
    const action = item.action
    if (action.kind === "route") props.go(action.route)
    else if (action.kind === "toggle-sidebar") toggleSidebar()
    else if (action.kind === "toggle-chat") toggleChat()
    close()
  }

  const sendAsk = (text: string) => {
    if (text.trim() === "") return
    setChatOpen(true)
    run(olai.procedures.chat.send({ text }), () => {
      /* refusal surfaces in the panel */
    })
    close()
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
        return
      }
      if (!match.whileEditing && isEditingTarget(event.target)) return
      event.preventDefault()
      if (match.action === "palette") {
        if (open()) close()
        else {
          setOpen(true)
          setQuery("")
          setActive(0)
          queueMicrotask(() => input?.focus())
        }
        return
      }
      if (match.action === "sidebar") toggleSidebar()
      if (match.action === "chat") toggleChat()
    }
    window.addEventListener("keydown", onKey)
    onCleanup(() => window.removeEventListener("keydown", onKey))
  })

  createEffect(() => {
    // Keep the highlight inside the filtered list.
    const n = items().length
    if (active() >= n) setActive(n === 0 ? 0 : n - 1)
  })

  return (
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
          <Show
            when={ask() !== null}
            fallback={
              <ul
                class="m-0 max-h-72 list-none overflow-y-auto p-1"
                data-testid={TESTID.paletteList}
              >
                <For each={[...items()]} fallback={
                  <li class="px-3 py-2 font-mono text-xs text-muted">no matches</li>
                }>
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
                fallback={<span>type a message after &gt; to send to the agent</span>}
              >
                <span>
                  send to agent: <span class="text-ink">{ask()}</span>
                </span>
              </Show>
            </div>
          </Show>
          {/* Keep shell items referenced so tree-shaking never drops the table
              mid-edit of filterItems defaults. */}
          <span class="hidden">{SHELL_ITEMS.length}</span>
        </div>
      </div>
    </Show>
  )
}
