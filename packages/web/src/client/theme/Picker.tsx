/**
 * The theme picker: one chip per palette, in the sidebar.
 *
 * Every chip is a theme and pressing one picks it. There is no "system" chip
 * and no "auto": the OS's preference used to choose the palette, which meant
 * two ways to be dark that could disagree, and a page that switched under a
 * reader who had already said what they wanted. A theme is a pick.
 *
 * Each chip WEARS the palette it offers — its own paper, its own ink, its own
 * rule — which is the one thing fifteen names in a 15rem column cannot do for
 * themselves. Those three colours are inline styles rather than utilities on
 * purpose: they come from the table at runtime, and a class name built from
 * data is a class Tailwind never scanned and never emitted a rule for.
 *
 * `aria-pressed` says which one is in force, because the ring that says so
 * visually is a colour, and a colour is not something a screen reader reads.
 */

import { createSelector, For } from "solid-js"

import { PALETTES } from "./palettes.ts"
import { currentTheme, pickTheme } from "./state.ts"
import { TESTID } from "../testids.ts"
import { TARGET_BOX } from "../touch.ts"

export function ThemePicker() {
  // `createSelector` rather than `currentTheme() === palette.name`, which is
  // what this was: that form subscribes every chip to the theme, so a pick
  // re-runs fifteen effects to change two attributes — and the table is meant
  // to grow. This notifies exactly the chip that lit and the one that went out.
  const isInForce = createSelector(currentTheme)

  return (
    <div class="w-full" data-testid={TESTID.themePicker}>
      <h2 class="mt-4 mb-1 px-2 text-[0.6875rem] uppercase tracking-widest text-muted">
        Theme
      </h2>
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
              onClick={() => pickTheme(palette)}
            >
              {palette.name}
            </button>
          )}
        </For>
      </div>
    </div>
  )
}
