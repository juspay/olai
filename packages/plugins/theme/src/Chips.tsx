/**
 * The named palettes, as swatches: every swatch is a theme, painted in that
 * theme's paper with a dot of its accent, and pressing one picks it.
 *
 * Swatches rather than the ten text chips they replaced, because a palette is
 * judged by its colours and not by its name — and ten words in two rows was
 * the busiest thing on the preferences panel. The name is still there for
 * whoever wants it: each swatch's tooltip and accessible name, and the one in
 * force beside the row's label (`./AppearanceRows.tsx`).
 *
 * Lights first, then darks, in one wrapping row.
 *
 * ARIA is plain toggle buttons with `aria-pressed`, inside the group the
 * settings row names. A `listbox`/`option` would misstate the control (no
 * arrow-key roving, no `aria-activedescendant`).
 *
 * The panel STAYS OPEN on a pick: a palette is judged by looking at the page it
 * paints. Persistence, the storage event and the boot script are untouched by
 * any of that: this file only draws.
 */
import { TESTID } from "olai-plugin-theme/testids"
import { createSelector, For } from "solid-js"

import { PALETTES } from "@olai/appearance/palettes.ts"
import type { Appearance } from "./index.ts"

import { TARGET_BOX } from "@olai/ui-primitives/touch.ts"

/** A palette's name as a person reads it. */
export const paletteLabel = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1)

const ORDERED = [...PALETTES].sort((a, b) =>
  a.scheme === b.scheme ? 0 : a.scheme === "light" ? -1 : 1)

export function ThemeChips(props: { readonly state: Appearance }) {
  // `createSelector`: a pick notifies exactly the swatch that lit and the one
  // that went out, rather than every swatch.
  const isInForce = createSelector(() => props.state.theme.current().name)

  return (
    <For each={ORDERED}>
      {(palette) => (
        <button
          type="button"
          // The button is the target (44px on a phone, `../touch.ts`); the
          // swatch inside it is the drawing. The ring says which is in force,
          // and the focus ring where the caret is — the page's accent, so it
          // shows against any swatch.
          class={`${TARGET_BOX} group inline-flex flex-none items-center justify-center rounded-full focus-visible:outline-none md:min-h-0 md:min-w-0 md:p-0`}
          data-testid={TESTID.themeChip}
          data-value={palette.name}
          title={paletteLabel(palette.name)}
          aria-label={paletteLabel(palette.name)}
          aria-pressed={isInForce(palette.name) ? "true" : "false"}
          onClick={() => props.state.theme.pick(palette)}
        >
          <span
            aria-hidden="true"
            class="relative block size-7 rounded-full md:size-6 border ring-offset-2 ring-offset-panel group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-accent group-aria-pressed:ring-2 group-aria-pressed:ring-ink/60 motion-safe:transition-transform"
            style={{
              background: `linear-gradient(135deg, ${palette.colors.paper} 0 55%, ${palette.colors.accent} 55% 100%)`,
              "border-color": palette.colors.rule,
            }}
          />
        </button>
      )}
    </For>
  )
}
