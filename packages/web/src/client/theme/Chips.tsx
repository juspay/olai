/**
 * The fifteen palettes, as chips: every chip is a theme, wearing the theme it
 * offers, and pressing one picks it.
 *
 * It draws the strip and nothing else — no popover, no trigger. It used to own
 * both, as the header's theme pill (`Picker.tsx`, retired with
 * `preferences-panel`): the pill named the theme in force and opened these
 * chips under itself, which was a second popover in a bar that now has one, and
 * a control that is a preference sitting outside the place preferences are set.
 * The strip is a row of `settings/`'s panel now, and the theme it is in is
 * named by that row's hint — so nothing the pill promised is gone, it is said
 * where the rest of them are said.
 *
 * Persistence, the storage event, the boot script and the contrast promise are
 * untouched by any of that: this file only draws.
 *
 * ARIA is plain toggle buttons with `aria-pressed`, inside the group the
 * settings row names. A `listbox`/`option` would misstate the control (no
 * arrow-key roving, no `aria-activedescendant`) and would forbid `aria-pressed`
 * on the options.
 *
 * There is still no "system" chip and no "auto": a theme is a pick.
 */

import { createSelector, For } from "solid-js"

import { PALETTES } from "./palettes.ts"
import { currentTheme, pickTheme } from "./state.ts"
import { TESTID } from "../testids.ts"
import { TARGET_BOX } from "../touch.ts"

export function ThemeChips() {
  // `createSelector` rather than `currentTheme() === palette.name`, which is
  // what this was: that form subscribes every chip to the theme, so a pick
  // re-runs fifteen effects to change two attributes — and the table is meant
  // to grow. This notifies exactly the chip that lit and the one that went out.
  const isInForce = createSelector(currentTheme)

  return (
    <For each={PALETTES}>
      {(palette) => (
        <button
          type="button"
          // A chip is small type in a wrapped row; the touch rule applies to
          // the box a finger aims at, and below 48rem this is one of them
          // (../touch.ts).
          class={`${TARGET_BOX} inline-flex flex-none items-center justify-center rounded-full border px-2 font-mono text-[0.6875rem] leading-none aria-pressed:ring-2 aria-pressed:ring-accent aria-pressed:ring-offset-1 aria-pressed:ring-offset-paper md:min-h-0 md:min-w-0 md:py-1`}
          style={{
            background: palette.colors.paper,
            color: palette.colors.ink,
            "border-color": palette.colors.rule,
          }}
          data-testid={TESTID.themeChip}
          data-value={palette.name}
          // Spelled out rather than handed a boolean: the chips that are NOT in
          // force have to announce that, and an attribute a framework drops
          // when it is false announces nothing at all.
          aria-pressed={isInForce(palette.name) ? "true" : "false"}
          // The panel stays OPEN on a pick, unlike the menu-shaped popover this
          // strip used to live in: a palette is judged by looking at the page
          // it paints, and shutting the surface after every press would make
          // comparing two of them a matter of reopening it.
          onClick={() => pickTheme(palette)}
        >
          {palette.name}
        </button>
      )}
    </For>
  )
}
