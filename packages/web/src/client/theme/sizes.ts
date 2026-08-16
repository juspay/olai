/**
 * How big the page is set, as a table.
 *
 * ONE NUMBER moves all of it. Every size in this client is a `rem` — the row
 * title, the note, the badges, the panels, the gutter's own controls
 * (`../touch.ts`), the markdown scale's generated properties (`./scale.ts`) —
 * so a font-size on `:root` scales the whole app in step rather than growing the
 * type inside furniture that stayed where it was. That is the reason this is a
 * root size and not a per-surface knob: the alternative is fifteen numbers that
 * have to be moved together, which is the arrangement `./scale.ts` already
 * exists to prevent one level down.
 *
 * WHAT DOES NOT MOVE, deliberately: the breakpoints. A media query's `rem` is
 * the browser's initial size and not the page's, so the phone/desktop line stays
 * at the same 48rem of real screen whatever is picked here — a reader who wants
 * larger type gets larger type, not a laptop drawn as a phone.
 *
 * THE DEFAULT IS `large`, which is a change (human, on sight of the first build:
 * "I find the text to be too cramped"). olai was set at the browser's own 16px,
 * which is a size the web picked for documents and not for a column of titles
 * read all day; `medium` is exactly that old size, kept, for a reader who wants
 * it back or is working on a small screen.
 *
 * The `root` values are `rem`, and on the ROOT ELEMENT a `rem` means the
 * INITIAL font size — the browser's 16px, or whatever a reader has set in their
 * own preferences — rather than the value being declared. So these are honest
 * multipliers of the reader's own baseline rather than pixel counts overriding
 * it, which is the accessibility half of the same decision.
 */

/** A size's stored name. A closed set, so a typo is a compile error rather than
 *  a stored word no block paints. */
export type SizeName = "medium" | "large" | "larger"

export interface TypeSize {
  readonly name: SizeName
  /** What the Size row's segment says. */
  readonly label: string
  /** `font-size` for `:root`, as a multiple of the reader's own baseline. */
  readonly root: string
  /** What the choice in force MEANS, for the preferences row's own line. */
  readonly hint: string
}

export const SIZES: ReadonlyArray<TypeSize> = [
  {
    name: "medium",
    label: "Medium",
    root: "1rem",
    hint: "The browser's own size — what olai was set in before there was a choice.",
  },
  {
    name: "large",
    label: "Large",
    root: "1.125rem",
    hint: "A notch up from the browser's own size, and olai's default: a column of titles read all day is not a document.",
  },
  {
    name: "larger",
    label: "Larger",
    root: "1.25rem",
    hint: "Two notches up. Everything scales with it — the rows, the gutter, the panels.",
  },
]

/** What a browser that has never been asked reads. */
export const DEFAULT_SIZE: SizeName = "large"

/** The attribute the sheet keys off, on `<html>`. Written by the shell's boot
 *  script before the first paint, exactly as the theme's and the typeface's
 *  are — a page that flashed one size and settled into another would be the
 *  worst of the three to look at. */
export const SIZE_ATTRIBUTE = "data-size"

/** Where a pick is remembered. Namespaced with every other preference this
 *  browser keeps (`../preference.ts`). */
export const SIZE_STORAGE_KEY = "olai.size"

/** The row named, or `undefined` for a name no row offers — an older olai, a
 *  value typed into a console. */
export const sizeNamed = (name: string | null): TypeSize | undefined =>
  SIZES.find((one) => one.name === name)

export const DEFAULT_TYPE_SIZE: TypeSize = (() => {
  const size = sizeNamed(DEFAULT_SIZE)
  if (size === undefined) {
    throw new Error(`unreachable: no row named ${DEFAULT_SIZE}`)
  }
  return size
})()

/**
 * The sheet's blocks, generated from the table above — one per size, with the
 * DEFAULT's landing on the bare `:root` as well, so a page that has picked
 * nothing is already in it and the boot script has nothing to write.
 *
 * Generated rather than hand-written beside the tokens for the reason the
 * palettes are (`./css.ts`): a table in TypeScript and a copy of it in CSS is
 * two places for three numbers to disagree, and the copy is the one nobody
 * re-reads. `./css.test.ts` holds this output to the table.
 */
export const sizeCss = (): string =>
  SIZES
    .map((size) => {
      const named = `:root[${SIZE_ATTRIBUTE}="${size.name}"]`
      const selector = size.name === DEFAULT_SIZE ? `:root, ${named}` : named
      return `${selector} {\n  font-size: ${size.root};\n}`
    })
    .join("\n\n")
