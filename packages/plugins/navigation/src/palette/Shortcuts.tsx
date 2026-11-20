import { TESTID } from "olai-plugin-navigation/testids"
import { createEffect,For,onCleanup,Show } from "solid-js"

import { SHORTCUTS } from "@olai/web/client/keys.ts"
import type { AppChord } from "../slots.ts"
import { enterTopLayer } from "@olai/web/client/layer.ts"
import { claimCloseRequest, lightDismiss } from "@olai/web/client/dismiss.ts"

import { topmostWhileOpen } from "@olai/web/client/topmost.ts"

export const spellChord = (chord: Pick<AppChord, "key" | "shift">): string => {
  const shift = chord.shift === true ? "⇧" : ""
  const key = chord.key.toUpperCase()
  return `⌘${shift}${key} / Ctrl+${shift}${key}`
}

export const REGISTERED_GROUP = "Added by plugins"

export function Shortcuts(props: {
  readonly open: boolean
  readonly onClose: () => void
  readonly more?: ReadonlyArray<AppChord>
}) {
  const groups = () => {
    const more = props.more ?? []
    return more.length === 0 ? SHORTCUTS : [
      ...SHORTCUTS,
      { group: REGISTERED_GROUP, keys: more.map((chord) => ({ keys: spellChord(chord), what: chord.said })) },
    ]
  }
  topmostWhileOpen(() => props.open)
  let sheet: HTMLDialogElement | undefined
  onCleanup(() => { if (sheet?.open === true) sheet.close() })

  createEffect(() => {
    if (props.open) {
      if (sheet !== undefined) enterTopLayer(sheet)
      return
    }
    if (sheet?.open === true) sheet.close()
  })

  return (
    <dialog
      class="fixed inset-x-4 top-[min(14vh,6rem)] bottom-auto mx-auto my-0 h-auto max-h-[70vh] w-auto max-w-lg overflow-y-auto rounded-surface border border-rule/40 bg-panel p-4 text-ink shadow-overlay backdrop:bg-ink/40"
      aria-label="Keyboard shortcuts"
      ref={(element) => { sheet = element; lightDismiss(element); claimCloseRequest(element) }}
      onClose={() => props.onClose()}
    >
      <Show when={props.open}>
        <div data-testid={TESTID.shortcuts}>
          <For each={[...groups()]}>
            {(group) => (
              <section class="mb-4 last:mb-0">
                <h2 class="m-0 mb-1 text-label font-semibold uppercase tracking-wide text-muted">
                  {group.group}
                </h2>
                <ul class="m-0 list-none p-0">
                  <For each={[...group.keys]}>
                    {(shortcut) => (
                      <li
                        class="flex items-baseline justify-between gap-4 py-0.5 text-body"
                        data-testid={TESTID.shortcut}
                      >
                        <span class="text-ink">{shortcut.what}</span>
                        <kbd class="shrink-0 rounded-control border border-rule px-1.5 py-0.5 font-mono text-caption text-muted">
                          {shortcut.keys}
                        </kbd>
                      </li>
                    )}
                  </For>
                </ul>
              </section>
            )}
          </For>
        </div>
      </Show>
    </dialog>
  )
}
