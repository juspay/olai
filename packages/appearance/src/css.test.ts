/** What the built sheet's palette section says. Generated once — it is a pure
 *  function of the table — and asked questions, rather than each question
 *  regenerating it. */
import { describe, expect, test } from "bun:test"

import { customProperty, paletteBlock, paletteCss, selectorFor, UNPICKED_SELECTOR, unpickedDarkBlock } from "./css.ts"
import {
  DEFAULT_DARK_PALETTE,
  DEFAULT_PALETTE,
  DEFAULT_THEME,
  PALETTE_TOKENS,
  PALETTES,
  SCHEME_STORAGE_KEY,
  SYSTEM_SCHEME,
  THEME_ATTRIBUTE,
  THEME_NAMES,
  THEME_STORAGE_KEY,
} from "./palettes.ts"
import { TAG_INK } from "./tagInk.ts"
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

  test("every theme says which color-scheme it is", () => {
    // The browser paints the scrollbars, the form controls and the canvas, and
    // this is the only thing that tells it which way. A theme that put its
    // colours in force and not this would read dark under light chrome.
    for (const palette of PALETTES) {
      expect(paletteBlock(palette)).toContain(`color-scheme: ${palette.scheme};`)
    }
  })

  test("every theme's block carries the tag ink of its scheme", () => {
    // `./css.ts`'s claim to `../styles.css`: a tag's hue is the one the pill
    // carries inline, and the palette block is the OTHER hand of the answer —
    // drop these two declarations and the pill's ink has no owner while the
    // AA test (./tagInk.test.ts), which reads the same table, stays green ask
    // of nothing. The exact declarations, for the same reason the token
    // sweep above them is exact.
    for (const palette of PALETTES) {
      const ink = TAG_INK[palette.scheme]
      const block = paletteBlock(palette)
      expect(block).toContain(`--tag-ink-l: ${ink.l};`)
      expect(block).toContain(`--tag-ink-c: ${ink.c};`)
    }
  })

  test("one theme is what a page that picked nothing reads in by day", () => {
    // Asked of the selectors themselves rather than found in the generated
    // text: a page with no `data-theme` is painted by whichever block claims
    // the bare `:root`, and exactly one may.
    const bare = PALETTES.filter((palette) =>
      selectorFor(palette).split(",").some((part) => part.trim() === ":root"),
    ).map((palette) => palette.name)
    expect(bare).toEqual([DEFAULT_THEME])
  })

  test("the OS answers for the unpicked page, and for nothing else", () => {
    // ONE media rule, scoped to `:root:not([data-theme])`: the page nobody
    // picked for reads in the dark default under a dark OS, and a stored
    // pick — which writes the attribute — is never overruled by it.
    const block = unpickedDarkBlock()
    expect(block).toMatch(/^@media \(prefers-color-scheme: dark\) \{/)
    expect(block).toContain(UNPICKED_SELECTOR)
    expect(UNPICKED_SELECTOR).toBe(`:root:not([${THEME_ATTRIBUTE}])`)
    for (const token of PALETTE_TOKENS) {
      expect(block).toContain(`${customProperty(token)}: ${DEFAULT_DARK_PALETTE.colors[token]};`)
    }
    expect(block).toContain("color-scheme: dark;")
    expect(css.split("prefers-color-scheme").length - 1).toBe(1)
    expect(css).toContain(block)
  })
})

/**
 * The border with the SHELL.
 *
 * `index.html` runs a handful of lines before anything else on the page, and
 * it spells the storage keys, the attribute and the canvas meta as literals
 * because it runs before any module exists. Nothing checks that but this: a
 * renamed key leaves a picker writing one place and a boot script reading
 * another, and the symptom is a flash of the default — or of the wrong
 * polarity of chrome — on every load, which nobody would call a bug report.
 */
describe("the shell's boot script", () => {
  const shell = (): Promise<string> =>
    Bun.file(new URL("../../plugins/theme/src/head.html", import.meta.url)).text()

  test("reads the key this table writes, and writes the attribute it keys on", async () => {
    const html = await shell()
    expect(html).toContain(`localStorage.getItem("${THEME_STORAGE_KEY}")`)
    expect(html).toContain(`setAttribute("${THEME_ATTRIBUTE}"`)
  })

  test("ships each default's paper as the browser chrome, per OS scheme", async () => {
    // The two colours the shell can know before the bundle runs: a page that
    // has picked nothing is in one default or the other by the OS's word, and
    // inventing a value here would flash a different chrome on the first
    // paint of every load.
    const html = await shell()
    expect(html).toContain(
      `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${DEFAULT_PALETTE.colors.paper}" />`,
    )
    expect(html).toContain(
      `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${DEFAULT_DARK_PALETTE.colors.paper}" />`,
    )
  })

  test("pins the canvas from a word it was handed, and knows no theme by name", async () => {
    // THE PRE-SHEET WINDOW belongs to the UA: until the stylesheet lands, the
    // canvas, the scrollbars and the form controls go the way this meta says,
    // and a dark pick under a light OS used to spend that window in light
    // chrome. The fix is one more copied string, and the thing worth pinning
    // is that it stays a COPY: the script may read the scheme this table
    // wrote beside the pick, and may not learn that `basalt` is dark — the
    // day it does, a renamed or retired palette is a wrong canvas no test
    // catches.
    //
    // Asked of the SCRIPT and not the file: the prose around it argues about
    // palettes by name, which is what prose is for, and a comment is not a
    // thing that runs.
    const html = await shell()
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1]
    expect(script).toBeDefined()
    expect(script).toContain(`localStorage.getItem("${SCHEME_STORAGE_KEY}")`)
    expect(script).toContain(`document.querySelector('meta[name="color-scheme"]').content = `)
    for (const name of THEME_NAMES) expect(script).not.toContain(name)
  })

  test("authors the canvas as both, with the script after the meta it edits", async () => {
    // `light dark` is what a page whose JavaScript never ran shows, so it is
    // the shell's word and not the script's: CSS — and the browser's own
    // painting — must not depend on JS having run. And the script comes
    // AFTER the element, because a `querySelector` for a meta the parser has
    // not reached yet finds nothing.
    const html = await shell()
    expect(html).toContain(`<meta name="color-scheme" content="${SYSTEM_SCHEME}" />`)
    expect(html.indexOf('<meta name="color-scheme"')).toBeLessThan(html.indexOf("<script>"))
  })
})

/**
 * The border with the STYLESHEET.
 *
 * Tailwind can only emit `text-muted` for a `--color-muted` it has seen in
 * `@theme`, so the eleven defaults are spelled there as well as being in the
 * table. This is what stops the two from drifting: what a utility falls back
 * to and what the default palette says have to be the same colour.
 */
describe("the stylesheet's @theme", () => {
  test("declares the default palette, token for token", async () => {
    const sheet = await Bun.file(new URL("./tokens.css", import.meta.url)).text()
    const theme = /@theme\s*\{([^}]*)\}/.exec(sheet)?.[1]
    expect(theme).toBeDefined()
    for (const token of PALETTE_TOKENS) {
      expect(theme).toContain(
        `${customProperty(token)}: ${DEFAULT_PALETTE.colors[token]};`,
      )
    }
  })
})
