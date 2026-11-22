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
 * LIGHTS BEFORE DARKS, in the table's own order, each set on its own line.
 * On a wider screen the two lines are a grid: a dark swatch stands under the
 * light one of its family (`@olai/appearance/families.ts` says which), so
 * basalt sits under chalk and abyss under reef, and a person reads each
 * column as one colour by day and by night. Below 48rem a swatch is a 44px
 * target and seven of them do not fit one line of the panel, so each line is
 * free to wrap there — the lights still all before the darks — and the
 * pairing is a promise for the wider screen only. The follow control stands
 * ahead of both lines, and on a phone wraps above them.
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

import { lightSiblings } from "@olai/appearance/families.ts"
import { defaultPaletteFor, type Palette, PALETTES } from "@olai/appearance/palettes.ts"
import type { Appearance } from "./index.ts"

import { TARGET_BOX } from "@olai/ui-primitives/touch.ts"
import { Tip } from "@olai/web/client/Tip.tsx"

/** A palette's name as a person reads it. */
export const paletteLabel = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1)

const LIGHTS = PALETTES.filter((palette) => palette.scheme === "light")
const DARKS = PALETTES.filter((palette) => palette.scheme === "dark")
const SIBLING = lightSiblings(PALETTES)

/** The grid column a swatch stands in on a wider screen, 1-based as CSS
 *  counts: a light one in table order, a dark one under its light sibling. */
const columnOf = (palette: Palette): number =>
  LIGHTS.findIndex((light) => light.name === (SIBLING.get(palette.name) ?? palette.name)) + 1

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

  /** One swatch. `row` is its line in the wider screen's grid; its column is
   *  handed over as `--swatch-column`, because the sheet cannot know it and a
   *  `grid-column` written inline would hold on a phone too. */
  const swatch = (palette: Palette, row: "md:row-start-1" | "md:row-start-2") => (
    <Tip text={paletteLabel(palette.name)}>
      <button
        type="button"
        // The button is the target (44px on a phone, `../touch.ts`); the
        // swatch inside it is the drawing. The ring says which is in force,
        // and the focus ring where the caret is — the page's accent, so it
        // shows against any swatch.
        class={`${SWATCH} ${row} md:[grid-column:var(--swatch-column)]`}
        style={{ "--swatch-column": String(columnOf(palette)) }}
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
  )

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
      {/* The two lines. Below 48rem each is its own wrapping line, the lights
          above; from 48rem the two wrappers step aside (`contents`) and every
          swatch is a cell of one grid whose columns are the light swatches.
          DOM order is the table's either way, so Tab walks the lights and
          then the darks. */}
      <div
        class="flex min-w-0 flex-col gap-1 md:grid md:[grid-template-columns:repeat(var(--swatch-columns),auto)] md:gap-1.5"
        style={{ "--swatch-columns": String(LIGHTS.length) }}
      >
        <div class="flex flex-wrap gap-1 md:contents">
          <For each={LIGHTS}>{(palette) => swatch(palette, "md:row-start-1")}</For>
        </div>
        <div class="flex flex-wrap gap-1 md:contents">
          <For each={DARKS}>{(palette) => swatch(palette, "md:row-start-2")}</For>
        </div>
      </div>
    </>
  )
}
