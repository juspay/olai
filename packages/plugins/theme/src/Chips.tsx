/**
 * The named palettes, as swatches: every swatch is a theme, painted in that
 * theme's paper with a wedge of its accent, and pressing one picks it. Ahead
 * of them stands the one control that is not a palette: FOLLOW THE OS, which
 * forgets the pick and lets `prefers-color-scheme` choose between the light
 * default and the dark one (`@olai/appearance/palettes.ts`).
 *
 * Swatches rather than text chips, because a palette is judged by its colours
 * and not by its name. The name is still there for whoever wants it: each
 * swatch's tooltip and accessible name, and the one in force beside the row's
 * label (`./AppearanceRows.tsx`).
 *
 * Lights first, then darks, in one row — the table's own order.
 *
 * ARIA is plain toggle buttons with `aria-pressed`, inside the group the
 * settings row names. A swatch is pressed when its palette is the one IN
 * FORCE, whether by a pick or by the OS's choice — so a screen reader hears
 * which palette the page is painted in either way — and the follow control
 * is pressed when the answer is the OS's.
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

/** What the row says the page is in: the palette, and whose choice it was. */
export const themeInForce = (state: Appearance): string =>
  state.theme.following()
    ? `System · ${paletteLabel(state.theme.current().name)}`
    : paletteLabel(state.theme.current().name)

const SWATCH =
  `${TARGET_BOX} group inline-flex flex-none items-center justify-center rounded-full outline-none md:min-h-0 md:min-w-0 md:p-0`

const DISC =
  "relative block size-7 rounded-full border ring-offset-2 ring-offset-panel group-hover:scale-105 " +
  "group-focus-visible:ring-2 group-focus-visible:ring-accent group-aria-pressed:ring-2 group-aria-pressed:ring-ink/60 " +
  "motion-safe:transition-transform md:size-6"

export function ThemeChips(props: { readonly state: Appearance }) {
  // `createSelector`: a pick notifies exactly the swatch that lit and the one
  // that went out, rather than every swatch.
  const isInForce = createSelector(() => props.state.theme.current().name)

  return (
    <>
      <button
        type="button"
        class={SWATCH}
        data-testid={TESTID.themeFollow}
        title="Follow the system"
        aria-label="Follow the system"
        aria-pressed={props.state.theme.following() ? "true" : "false"}
        onClick={() => props.state.theme.follow()}
      >
        {/* Half light, half dark: the two defaults the OS chooses between. */}
        <span
          aria-hidden="true"
          class={`${DISC} border-rule`}
          style={{
            background: `linear-gradient(90deg, ${PALETTES[0]!.colors.paper} 0 50%, ${PALETTES.find((p) => p.scheme === "dark")!.colors.paper} 50% 100%)`,
          }}
        />
      </button>
      <span aria-hidden="true" class="mx-1 h-5 w-px self-center bg-rule" />
      <For each={PALETTES}>
        {(palette) => (
          <button
            type="button"
            // The button is the target (44px on a phone, `../touch.ts`); the
            // swatch inside it is the drawing. The ring says which is in force,
            // and the focus ring where the caret is — the page's accent, so it
            // shows against any swatch.
            class={SWATCH}
            data-testid={TESTID.themeChip}
            data-value={palette.name}
            title={paletteLabel(palette.name)}
            aria-label={paletteLabel(palette.name)}
            aria-pressed={isInForce(palette.name) ? "true" : "false"}
            onClick={() => props.state.theme.pick(palette)}
          >
            <span
              aria-hidden="true"
              class={DISC}
              style={{
                background: `linear-gradient(135deg, ${palette.colors.paper} 0 55%, ${palette.colors.accent} 55% 100%)`,
                "border-color": palette.colors.rule,
              }}
            />
          </button>
        )}
      </For>
    </>
  )
}
