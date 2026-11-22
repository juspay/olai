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
 * TWO LINES, light above dark, in the table's own order. A dark swatch stands
 * under the light one of its family — the light whose paper is nearest it in
 * hue, and the neutral under the neutral — so basalt sits under chalk and
 * abyss under reef, and a person reads each column as one colour by day and
 * by night. The columns are measured off the table rather than listed here,
 * so a new row finds its own place. The follow control stands ahead of both
 * lines; on a phone, where the two would not fit one line, it wraps above
 * them.
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

import { hueGap, oklchOf } from "@olai/appearance/hues.ts"
import { defaultPaletteFor, type Palette, PALETTES } from "@olai/appearance/palettes.ts"
import type { Appearance } from "./index.ts"

import { TARGET_BOX } from "@olai/ui-primitives/touch.ts"
import { Tip } from "@olai/web/client/Tip.tsx"

/** A palette's name as a person reads it. */
export const paletteLabel = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1)

/** A paper with too little chroma to have a hue — chalk's and basalt's. The
 *  same line `@olai/appearance/palettes.test.ts` tells the neutrals by. */
const NEUTRAL_CHROMA = 0.01

const LIGHTS = PALETTES.filter((palette) => palette.scheme === "light")
const DARKS = PALETTES.filter((palette) => palette.scheme === "dark")

/** The column a dark swatch stands in: under the light swatch of its family.
 *  A neutral goes under the neutral; a hued paper under the hued light whose
 *  paper is nearest it on the wheel. */
const columnUnder = (dark: Palette): number => {
  const ground = oklchOf(dark.colors.paper)
  const neutral = ground.c < NEUTRAL_CHROMA
  const distance = (light: Palette): number => {
    const paper = oklchOf(light.colors.paper)
    if ((paper.c < NEUTRAL_CHROMA) !== neutral) return Number.POSITIVE_INFINITY
    return neutral ? 0 : hueGap(ground.h, paper.h)
  }
  return LIGHTS.reduce((best, light, at) => (distance(light) < distance(LIGHTS[best]!) ? at : best), 0)
}

/** Where a swatch sits in the two-line grid, 1-based as CSS counts. */
interface Place {
  readonly row: number
  readonly column: number
}

const PLACE: ReadonlyMap<string, Place> = new Map<string, Place>([
  ...LIGHTS.map((light, at) => [light.name, { row: 1, column: at + 1 }] as const),
  ...DARKS.map((dark) => [dark.name, { row: 2, column: columnUnder(dark) + 1 }] as const),
])

/** What the row says the page is in: the palette, and whose choice it was. */
export const themeInForce = (state: Appearance): string =>
  state.theme.following()
    ? `System · ${paletteLabel(state.theme.current().name)}`
    : paletteLabel(state.theme.current().name)

/* THE TARGET, and the one control in this app whose drawing is nothing but
 * colour — which is why `./all.css` lets its disc out of forced colours and
 * nothing else in the tree is allowed the same.
 *
 * `[--olai-ring-radius:9999px]` hands the app's ring the one fact the sheet
 * cannot know: this is a circle, not a `--radius-control` box. There is no
 * `outline-none` here any more — the one that used to be did nothing at all
 * (`@olai/appearance/chrome.css` is unlayered and outranks every utility), so
 * the swatch was wearing the app's outline AND the disc's own
 * `group-focus-visible` ring the whole time. */
const SWATCH =
  `${TARGET_BOX} group inline-flex flex-none items-center justify-center rounded-full [--olai-ring-radius:9999px] md:min-h-0 md:min-w-0 md:p-0`

/* THE DRAWING. The ring that says which palette is IN FORCE stays on the disc
 * rather than moving to the button: on a phone the button is a 44px target
 * around a 28px disc, and a mark drawn at the target's edge would be floating
 * a finger's width from the thing it marks. The `group-focus-visible` ring
 * that used to sit beside it is gone — it was a second ring under the app's
 * outline, and a `box-shadow` at that. */
const DISC =
  "olai-swatch-disc relative block size-7 rounded-full border ring-offset-2 ring-offset-panel group-hover:scale-105 " +
  "group-aria-pressed:ring-2 group-aria-pressed:ring-ink/60 " +
  "motion-safe:transition-transform md:size-6"

export function ThemeChips(props: { readonly state: Appearance }) {
  // `createSelector`: a pick notifies exactly the swatch that lit and the one
  // that went out, rather than every swatch.
  const isInForce = createSelector(() => props.state.theme.current().name)

  return (
    <>
      {/* Every tip here repeats the swatch's own `aria-label` — a swatch is a
          disc of colour with no words, so the palette's name has to be the
          NAME, and the tip is the same sentence drawn for a pointer. */}
      <Tip text="Follow the system">
        <button
          type="button"
          class={SWATCH}
          data-testid={TESTID.themeFollow}
          aria-label="Follow the system"
          aria-pressed={props.state.theme.following() ? "true" : "false"}
          onClick={() => props.state.theme.follow()}
        >
          {/* Half light, half dark: the two defaults the OS chooses between. */}
          <span
            aria-hidden="true"
            class={`${DISC} border-rule`}
            style={{
              background: `linear-gradient(90deg, ${defaultPaletteFor("light").colors.paper} 0 50%, ${defaultPaletteFor("dark").colors.paper} 50% 100%)`,
            }}
          />
        </button>
      </Tip>
      <span aria-hidden="true" class="mx-1 h-5 w-px self-center bg-rule" />
      {/* The two lines: a grid whose columns are the light swatches, with
          each dark one placed under its family. DOM order is still the
          table's, so Tab walks the light line and then the dark one. */}
      <div
        class="grid gap-1 md:gap-1.5"
        style={{ "grid-template-columns": `repeat(${LIGHTS.length}, auto)` }}
      >
        <For each={PALETTES}>
          {(palette) => (
            <Tip text={paletteLabel(palette.name)}>
              <button
                type="button"
                // The button is the target (44px on a phone, `../touch.ts`); the
                // swatch inside it is the drawing. The ring says which is in force,
                // and the focus ring where the caret is — the page's accent, so it
                // shows against any swatch.
                class={SWATCH}
                style={{
                  "grid-row": String(PLACE.get(palette.name)!.row),
                  "grid-column": String(PLACE.get(palette.name)!.column),
                }}
                data-testid={TESTID.themeChip}
                data-value={palette.name}
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
            </Tip>
          )}
        </For>
      </div>
    </>
  )
}
