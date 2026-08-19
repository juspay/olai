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
 *
 * ## AND IT ANSWERS ESCAPE, which it did not
 *
 * A scrim was the only way out of it — reported twice in review, and the one
 * dialog on this page that ignored the key a reader reaches for. On the
 * KEYBOARD-shortcuts dialog, which is the version of that gap worth fixing
 * rather than recording: somebody who opened it to learn the keys pressed the
 * most universal one and nothing happened.
 *
 * It is on the client's one dismissal stack (`../topmost.ts`) like every other
 * panel, and answers on the WINDOW like the palette that opens it — the rule
 * being that a layer answers a dismissal from the document or later, never
 * from its own box. Nothing stands over it today (the palette closes on its
 * way through, and this covers the page), so the ticket buys nothing yet; it
 * costs a line and it means the next thing drawn over a modal does not have to
 * remember this one.
 */

import { For, onCleanup, onMount, Show } from "solid-js"

import { SHORTCUTS } from "../keys.ts"
import { LAYER, WITHIN } from "../layer.ts"
import { TESTID } from "../testids.ts"
import { topmostWhileOpen } from "../topmost.ts"

export function Shortcuts(props: {
  readonly open: boolean
  readonly onClose: () => void
}) {
  const topmost = topmostWhileOpen(() => props.open)

  // On the window, and registered once for the component's life rather than
  // per open: this component is always mounted (the palette draws it beside
  // itself), and being open is a prop it reads. Same shape as the palette's.
  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!props.open || !topmost() || event.key !== "Escape") return
      event.preventDefault()
      props.onClose()
    }
    window.addEventListener("keydown", onKey)
    onCleanup(() => window.removeEventListener("keydown", onKey))
  })

  return (
    <Show when={props.open}>
      <div
        class={`fixed inset-0 ${LAYER.over} flex items-start justify-center bg-ink/40 px-4 pt-[min(14vh,6rem)]`}
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
        <div
          class={`relative ${WITHIN.raised} max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-2xl border-0 bg-panel p-4 shadow-xl ring-1 ring-rule/40`}
        >
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
