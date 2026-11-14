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
 * IT IS THE PLATFORM'S ANSWER NOW. This is a native `<dialog>` opened with
 * `showModal()`, so Escape is a close request the browser makes of the topmost
 * modal, the page under it is inert, the dim is `::backdrop`, and the caret
 * goes back to the row that opened it without this file arranging any of it.
 * The window listener that used to do the first of those is gone, and so is
 * the scrim that did the second: a press outside is `../../../../web/src/client/dismiss.ts`'s
 * `lightDismiss`, which is the one half of a modal's dismissal Safari still
 * lacks the attribute for.
 *
 * It keeps its ticket on the one dismissal stack (`../topmost.ts`) all the
 * same, because a layer UNDERNEATH asks that stack whether a gesture is for
 * it, and the answer has to be this sheet while it is up.
 */
import { TESTID } from "olai-plugin-navigation/testids"
import { createEffect,For,onCleanup,Show } from "solid-js"

import { SHORTCUTS } from "@olai/web/client/keys.ts"
import type { AppChord } from "../slots.ts"
import { enterTopLayer } from "@olai/web/client/layer.ts"
import { claimCloseRequest, lightDismiss } from "@olai/web/client/dismiss.ts"

import { topmostWhileOpen } from "@olai/web/client/topmost.ts"

/** How a registered chord is written on the sheet — both platforms' spellings,
 *  the way the app's own rows are. */
export const spellChord = (chord: Pick<AppChord, "key" | "shift">): string => {
  const shift = chord.shift === true ? "⇧" : ""
  const key = chord.key.toUpperCase()
  return `⌘${shift}${key} / Ctrl+${shift}${key}`
}

/** The heading the chords plugins registered sit under. */
export const REGISTERED_GROUP = "Added by plugins"

export function Shortcuts(props: {
  readonly open: boolean
  readonly onClose: () => void
  /** The chords plugins registered in `app.keys` and the palette listens for. */
  readonly more?: ReadonlyArray<AppChord>
}) {
  const groups = () => {
    const more = props.more ?? []
    return more.length === 0 ? SHORTCUTS : [
      ...SHORTCUTS,
      { group: REGISTERED_GROUP, keys: more.map((chord) => ({ keys: spellChord(chord), what: chord.said })) },
    ]
  }
  const nearest = topmostWhileOpen(() => props.open)
  let sheet: HTMLDialogElement | undefined
  // Withdrawal puts the layer down: a modal removed from the document leaves
  // the top layer with no `close` behind it, so the element is closed while it
  // is still in the page (the palette's own note says why).
  onCleanup(() => { if (sheet?.open === true) sheet.close() })

  // OPENING IS A CALL, not a class — the freeze's own shape
  // (`web/src/client/connection/Offline.tsx`), for the same reason: the top
  // layer is only entered through `showModal`, and everything a sheet over the
  // whole app promises comes with it. Through `enterTopLayer` because the
  // offline freeze is the floor of that layer and this may not stand over it.
  createEffect(() => {
    if (props.open) {
      if (sheet !== undefined) enterTopLayer(sheet)
      return
    }
    if (sheet?.open === true) sheet.close()
  })

  return (
    <dialog
      // No `z-index`: `showModal` puts this over every stacking context on the
      // page at once, which is a claim `web/src/client/layer.ts`'s table
      // cannot make. No `role` or `aria-modal` either — a native modal is one,
      // and the name is the label below.
      class="fixed inset-x-4 top-[min(14vh,6rem)] bottom-auto mx-auto my-0 h-auto max-h-[70vh] w-auto max-w-lg overflow-y-auto rounded-surface border border-rule/40 bg-panel p-4 text-ink shadow-overlay backdrop:bg-ink/40"
      aria-label="Keyboard shortcuts"
      ref={(element) => { sheet = element; lightDismiss(element); claimCloseRequest(element, nearest) }}
      // WHOEVER CLOSED IT says so once: Escape, a press outside, or the effect
      // above. The state is the palette's (`open` is a prop), so the sheet
      // tells it rather than keeping a second copy.
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
