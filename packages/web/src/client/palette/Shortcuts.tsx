/**
 * The keys, on screen.
 *
 * Everything this app answers was written down in two places nobody who USES
 * it reads: a matcher in `../keys.ts` and a paragraph in a package README. A
 * keyboard-first outliner whose keys are only in its source is a keyboard-first
 * outliner nobody can learn, so the palette — the one surface that already
 * answers "what can I do here" — opens this.
 *
 * It draws `SHORTCUTS` and nothing of its own. The list is beside the matchers
 * it describes, and a unit test holds it to covering every editing action, so
 * this component cannot go stale without something failing first.
 */

import { For, Show } from "solid-js"

import { SHORTCUTS } from "../keys.ts"
import { TESTID } from "../testids.ts"

export function Shortcuts(props: {
  readonly open: boolean
  readonly onClose: () => void
}) {
  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 px-4 pt-[min(14vh,6rem)]"
        data-testid={TESTID.shortcuts}
        role="dialog"
        aria-modal="true"
        aria-label="keyboard shortcuts"
      >
        <button
          type="button"
          class="absolute inset-0 cursor-default"
          aria-label="close the shortcuts"
          onClick={() => props.onClose()}
        />
        <div class="relative z-10 max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-lg border border-rule/70 bg-panel p-4 shadow-lg">
          <For each={[...SHORTCUTS]}>
            {(group) => (
              <section class="mb-4 last:mb-0">
                <h2 class="m-0 mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  {group.group}
                </h2>
                <ul class="m-0 list-none p-0">
                  <For each={[...group.keys]}>
                    {(shortcut) => (
                      <li
                        class="flex items-baseline justify-between gap-4 py-0.5 text-sm"
                        data-testid={TESTID.shortcut}
                      >
                        <span class="text-ink">{shortcut.what}</span>
                        <kbd class="shrink-0 rounded border border-rule px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted">
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
      </div>
    </Show>
  )
}
