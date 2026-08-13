import { describe, expect, test } from "bun:test"

import {
  customProperty,
  paletteBlock,
  paletteCss,
  selectorFor,
  shadowProperty,
} from "./css.ts"
import { depthOf, SHADOW_TOKENS, SURFACE_TOKENS } from "./depth.ts"
import {
  DEFAULT_PALETTE,
  DEFAULT_THEME,
  PALETTE_TOKENS,
  PALETTES,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
} from "./palettes.ts"

/** What the built sheet's palette section says. Generated once — it is a pure
 *  function of the table — and asked questions, rather than each question
 *  regenerating it. */
const css = paletteCss()

describe("the generated palette blocks", () => {
  test("every theme can be asked for by name", () => {
    for (const palette of PALETTES) {
      expect(css).toContain(`:root[${THEME_ATTRIBUTE}="${palette.name}"]`)
    }
  })

  test("every theme declares every token, with the table's value", () => {
    for (const palette of PALETTES) {
      const block = paletteBlock(palette)
      for (const token of PALETTE_TOKENS) {
        expect(block).toContain(
          `${customProperty(token)}: ${palette.colors[token]};`,
        )
      }
    }
  })

  test("every theme declares every altitude, with the derivation's value", () => {
    // The nine a palette does not write and gets anyway. Asserted per row for
    // the reason the eight above are: a block that shipped without them would be
    // a theme whose cards are painted with nothing, and the symptom is a
    // transparent surface rather than an error.
    for (const palette of PALETTES) {
      const block = paletteBlock(palette)
      const depth = depthOf(palette)
      for (const token of SURFACE_TOKENS) {
        expect(block).toContain(
          `${customProperty(token)}: ${depth.surfaces[token]};`,
        )
      }
      for (const token of SHADOW_TOKENS) {
        expect(block).toContain(
          `${shadowProperty(token)}: ${depth.shadows[token]};`,
        )
      }
    }
  })

  test("every theme says which color-scheme it is", () => {
    // The browser paints the scrollbars, the form controls and the canvas, and
    // this is the only thing that tells it which way. A theme that put its
    // colours in force and not this would read dark under light chrome.
    for (const palette of PALETTES) {
      expect(paletteBlock(palette)).toContain(`color-scheme: ${palette.scheme};`)
    }
  })

  test("one theme is what a page that picked nothing reads in", () => {
    // Asked of the selectors themselves rather than found in the generated
    // text: a page with no `data-theme` is painted by whichever block claims
    // the bare `:root`, and exactly one may.
    const bare = PALETTES.filter((palette) =>
      selectorFor(palette).split(",").some((part) => part.trim() === ":root"),
    ).map((palette) => palette.name)
    expect(bare).toEqual([DEFAULT_THEME])
  })

  test("the sheet asks the OS nothing about colour", () => {
    // A theme is a pick. The palette used to switch under the reader when the
    // OS did, which meant two things could disagree about which dark you were
    // in.
    expect(css).not.toContain("prefers-color-scheme")
  })
})

/**
 * The border with the SHELL.
 *
 * `index.html` runs four lines before anything else on the page, and it spells
 * the storage key and the attribute as literals because it runs before any
 * module exists. Nothing checks that but this: a renamed key leaves a picker
 * writing one place and a boot script reading another, and the symptom is a
 * flash of the default on every load — which nobody would call a bug report.
 */
describe("the shell's boot script", () => {
  const shell = (): Promise<string> =>
    Bun.file(new URL("../index.html", import.meta.url)).text()

  test("reads the key this table writes, and writes the attribute it keys on", async () => {
    const html = await shell()
    expect(html).toContain(`localStorage.getItem("${THEME_STORAGE_KEY}")`)
    expect(html).toContain(`setAttribute("${THEME_ATTRIBUTE}"`)
  })

  test("ships the default palette's canvas as the browser chrome", async () => {
    // The one colour the shell can know before the bundle runs: a page that
    // has picked nothing is in the default, and inventing a second value here
    // would flash a different chrome on the first paint of every load. The
    // CANVAS, because the header is what meets that strip and the header is a
    // floating strip of the ground (`./chrome.ts`) — the same value paper has on
    // every dark palette, and a step off it on every light one.
    expect(await shell()).toContain(
      `<meta name="theme-color" content="${
        depthOf(DEFAULT_PALETTE).surfaces.canvas
      }" />`,
    )
  })
})

/**
 * The border with the STYLESHEET.
 *
 * Tailwind can only emit `text-muted` for a `--color-muted` it has seen in
 * `@theme`, so the eight defaults are spelled there as well as being in the
 * table. This is what stops the two from drifting: what a utility falls back
 * to and what the default palette says have to be the same colour.
 */
describe("the stylesheet's @theme", () => {
  const themeBlock = async (): Promise<string> => {
    const sheet = await Bun.file(new URL("../styles.css", import.meta.url)).text()
    const theme = /@theme\s*\{([^}]*)\}/.exec(sheet)?.[1]
    expect(theme).toBeDefined()
    return theme ?? ""
  }

  test("declares the default palette, token for token", async () => {
    const theme = await themeBlock()
    for (const token of PALETTE_TOKENS) {
      expect(theme).toContain(
        `${customProperty(token)}: ${DEFAULT_PALETTE.colors[token]};`,
      )
    }
  })

  test("declares the default palette's ALTITUDES, as the ramp derives them", async () => {
    // `bg-canvas` and `bg-well` exist only because these names are here; the
    // VALUES are inert on any browser this app runs in (the generated unlayered
    // `:root` wins) and are the opacity fallback on one too old for
    // `color-mix`. Which is exactly why they must be the default's and not a
    // hand-picked shade that drifted from the derivation.
    const theme = await themeBlock()
    const depth = depthOf(DEFAULT_PALETTE)
    for (const token of SURFACE_TOKENS) {
      expect(theme).toContain(`${customProperty(token)}: ${depth.surfaces[token]};`)
    }
  })

  test("does NOT declare the depth shadows", async () => {
    // Stated as a claim rather than left as an absence. Tailwind bakes a theme
    // shadow's value into the utility it emits, so a `--shadow-card` in here
    // would generate a `shadow-card` that fifteen palettes could never
    // re-answer — a utility that silently paints one theme's depth on all of
    // them. They live on `:root` in the generated blocks and are read through
    // the property (`../surface.ts`).
    const theme = await themeBlock()
    for (const token of SHADOW_TOKENS) {
      expect(theme).not.toContain(`${shadowProperty(token)}:`)
    }
  })
})
