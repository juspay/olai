/**
 * The theme picker: a compact header pill that opens the chip strip.
 *
 * Behaviour is unchanged from the sidebar form — every chip is a theme, pressing
 * one picks it, each chip wears the palette it offers, `aria-pressed` says which
 * is in force. The presentation is what moved: the header is a slim bar, so
 * sixteen chips cannot live in a row of it. A pill names the theme in force and
 * opens a popover of the same chips; picking one (or pressing the pill again,
 * Escape, or clicking away) shuts it and returns focus to the trigger.
 * Persistence, the storage event, the boot script and the contrast promise are
 * all untouched — this file only draws.
 *
 * ARIA is the pre-popover shape moved up: plain toggle buttons with
 * `aria-pressed`, wrapped in `role="group"`, trigger with `aria-haspopup`. A
 * `listbox`/`option` would misstate the control (no arrow-key roving, no
 * `aria-activedescendant`) and would forbid `aria-pressed` on the options.
 *
 * There is still no "system" chip and no "auto": a theme is a pick.
 */

import {
  createEffect,
  createSelector,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js"

import { PALETTES } from "./palettes.ts"
import { currentTheme, pickTheme } from "./state.ts"
import { TESTID } from "../testids.ts"
import { TARGET_BOX } from "../touch.ts"

export function ThemePicker() {
  // `createSelector` rather than `currentTheme() === palette.name`, which is
  // what this was: that form subscribes every chip to the theme, so a pick
  // re-runs an effect per chip to change two attributes — and the table is meant
  // to grow. This notifies exactly the chip that lit and the one that went out.
  const isInForce = createSelector(currentTheme)
  const [open, setOpen] = createSignal(false)

  let root: HTMLDivElement | undefined
  let trigger: HTMLButtonElement | undefined

  /** Shut the popover and put focus back on the trigger when the close came
   *  from Escape or a pick — a keyboard user who opened, moved, and chose
   *  would otherwise land on `<body>`. Click-away leaves focus where the
   *  pointer went. */
  const close = (restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) trigger?.focus()
  }

  // Click-away and Escape. Scoped to the open state so a shut picker is not a
  // document listener for nothing; disposed with the effect when it closes or
  // the component unmounts.
  createEffect(() => {
    if (!open()) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (root?.contains(target)) return
      close(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      close(true)
    }
    // Capture so a press that also navigates still closes us first.
    document.addEventListener("pointerdown", onPointer, true)
    document.addEventListener("keydown", onKey)
    onCleanup(() => {
      document.removeEventListener("pointerdown", onPointer, true)
      document.removeEventListener("keydown", onKey)
    })
  })

  return (
    <div class="relative shrink-0" data-testid={TESTID.themePicker} ref={root}>
      <button
        type="button"
        ref={trigger}
        class={`max-w-[6.5rem] truncate rounded-full border border-rule bg-paper px-2 py-1.5 font-mono text-xs text-muted hover:text-ink sm:max-w-none sm:px-3 ${TARGET_BOX} md:min-h-0 md:min-w-0`}
        data-testid={TESTID.themeTrigger}
        aria-expanded={open()}
        aria-haspopup="true"
        title="pick a theme"
        onClick={() => setOpen(!open())}
      >
        {currentTheme()}
      </button>
      <Show when={open()}>
        <div
          class="absolute right-0 top-full z-50 mt-1 w-[min(18rem,calc(100vw-1.5rem))] rounded border border-rule bg-paper p-2 shadow-sm"
          role="group"
          aria-label="themes"
        >
          <div class="flex flex-wrap gap-1">
            <For each={PALETTES}>
              {(palette) => (
                <button
                  type="button"
                  // A chip is small type in a wrapped row; the touch rule applies
                  // to the box a finger aims at, and below 48rem this is one of
                  // them (../touch.ts).
                  class={`${TARGET_BOX} inline-flex flex-none items-center justify-center rounded-full border px-2 font-mono text-[0.6875rem] leading-none aria-pressed:ring-2 aria-pressed:ring-accent aria-pressed:ring-offset-1 aria-pressed:ring-offset-paper md:min-h-0 md:min-w-0 md:py-1`}
                  style={{
                    background: palette.colors.paper,
                    color: palette.colors.ink,
                    "border-color": palette.colors.rule,
                  }}
                  data-testid={TESTID.themeChip}
                  data-value={palette.name}
                  // Spelled out rather than handed a boolean: the chips that are
                  // NOT in force have to announce that, and an attribute a
                  // framework drops when it is false announces nothing at all.
                  aria-pressed={isInForce(palette.name) ? "true" : "false"}
                  onClick={() => {
                    pickTheme(palette)
                    close(true)
                  }}
                >
                  {palette.name}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}
