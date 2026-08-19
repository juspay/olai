/**
 * The named typefaces, and the three tokens they write.
 *
 * A font is a PICK WITH A NAME, the same shape as a theme
 * (`@olai/web`'s `theme/palettes.ts`): adding one is adding a row, `./css.ts`
 * generates the `@font-face` rules and the `:root[data-font="…"]` block from
 * what is here, and the preferences panel's Font row draws one option per row.
 * Hand-written CSS would be the same three `--font-*` lines copied twenty
 * times, and one place per face for a file to be forgotten.
 *
 * Three jobs, one pick. `--font-serif` is the page (outline titles, a
 * document). `--font-sans` is the chrome (header, sidebar, notes, chat).
 * `--font-mono` is the furniture that has to be tabular (a SHA, a diff, a
 * breadcrumb). The default is Olai — titles in Literata, chrome in iA Writer
 * Quattro, code in iA Writer Mono — because a product that names a face
 * after itself and then reads in somebody else's is a product that has not
 * decided what it looks like. Atkinson Hyperlegible remains a pick, for a
 * page that wants one voice. Pick Inter and the page speaks Inter; pick
 * Fira Code and it speaks Fira Code, chrome included.
 *
 * What a row names is a FAMILY, never a file. The files those families need
 * are `./hosted.ts` — from nixpkgs, converted to woff2 once by this package's
 * own `default.nix` — and they are a table apart because nothing that draws a
 * picker has any use for them. Generics download nothing. No CDN, no font
 * binary in the repo.
 *
 * Bold and Light from Workflowy's list are not here: they are weights, not
 * faces, and a weight is not a typeface.
 */

/** The three tokens a typeface answers. Tailwind reads these as `font-sans`,
 *  `font-serif`, `font-mono`. */
export const FONT_TOKENS = ["sans", "serif", "mono"] as const

export type FontToken = (typeof FONT_TOKENS)[number]

export type FontGroup = "olai" | "generic" | "face"

export interface Typeface {
  /** What a page names this face by — the `data-font` value, the option's
   *  value, and the key this browser stores. One string, three jobs. */
  readonly name: string
  /** What the picker says. */
  readonly label: string
  /** Which optgroup it sits in. */
  readonly group: FontGroup
  /** What the choice in force means, for the Font row's hint. */
  readonly hint: string
  readonly sans: string
  readonly serif: string
  readonly mono: string
}

const SANS_FALLBACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const SERIF_FALLBACK =
  'ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, serif'
const MONO_FALLBACK = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

const named = (family: string): string =>
  /[\s\d]/.test(family) || family.includes("-") ? `"${family}"` : family

const withSans = (family: string): string => `${named(family)}, ${SANS_FALLBACK}`
const withSerif = (family: string): string =>
  `${named(family)}, ${SERIF_FALLBACK}`
const withMono = (family: string): string => `${named(family)}, ${MONO_FALLBACK}`

/** One proportional voice on sans and serif; mono stays the system stack. */
const proportional = (
  family: string,
  generic: "sans" | "serif",
): Pick<Typeface, FontToken> => {
  const stack = generic === "serif" ? withSerif(family) : withSans(family)
  return { sans: stack, serif: stack, mono: MONO_FALLBACK }
}

/** One voice everywhere, chrome included. */
const monospaced = (family: string): Pick<Typeface, FontToken> => {
  const stack = withMono(family)
  return { sans: stack, serif: stack, mono: stack }
}

const SYSTEM = `system-ui, -apple-system, "Segoe UI", ${SANS_FALLBACK}`
const INTERFACE =
  `-apple-system, BlinkMacSystemFont, "Segoe UI", ${SANS_FALLBACK}`
const COURIER = `"Courier New", Courier, ${MONO_FALLBACK}`
const TERMINAL =
  'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace'
const TYPEWRITER = `"American Typewriter", "Courier New", ${SERIF_FALLBACK}`

const TABLE = [
  {
    name: "olai",
    label: "Olai",
    group: "olai",
    hint:
      "Titles and documents in Literata, chrome in iA Writer Quattro, code " +
      "in iA Writer Mono.",
    sans: withSans("iA Writer Quattro"),
    serif: withSerif("Literata"),
    mono: withMono("iA Writer Mono"),
  },
  {
    name: "source",
    label: "Source",
    group: "olai",
    hint:
      "The previous pair: Source Serif 4 on the page, Source Sans 3 on the " +
      "chrome.",
    sans: withSans("Source Sans 3"),
    serif: withSerif("Source Serif 4"),
    mono: MONO_FALLBACK,
  },
  {
    name: "system",
    label: "System",
    group: "generic",
    hint: "This browser's system font. Nothing is downloaded.",
    sans: SYSTEM,
    serif: SYSTEM,
    mono: MONO_FALLBACK,
  },
  {
    name: "sans",
    label: "Sans-serif",
    group: "generic",
    hint: "The browser's generic sans. Nothing is downloaded.",
    sans: SANS_FALLBACK,
    serif: SANS_FALLBACK,
    mono: MONO_FALLBACK,
  },
  {
    name: "serif",
    label: "Serif",
    group: "generic",
    hint: "The browser's generic serif. Nothing is downloaded.",
    sans: SERIF_FALLBACK,
    serif: SERIF_FALLBACK,
    mono: MONO_FALLBACK,
  },
  {
    name: "interface",
    label: "Interface",
    group: "generic",
    hint: "The platform UI font. Nothing is downloaded.",
    sans: INTERFACE,
    serif: INTERFACE,
    mono: MONO_FALLBACK,
  },
  {
    name: "courier",
    label: "Courier New",
    group: "generic",
    hint: "Courier New everywhere, chrome included.",
    ...monospaced("Courier New"),
  },
  {
    name: "terminal",
    label: "Terminal",
    group: "generic",
    hint: "The browser's generic monospace. Nothing is downloaded.",
    sans: TERMINAL,
    serif: TERMINAL,
    mono: TERMINAL,
  },
  {
    name: "typewriter",
    label: "Typewriter",
    group: "generic",
    hint: "A typewriter face if this machine has one, Courier if not.",
    sans: TYPEWRITER,
    serif: TYPEWRITER,
    mono: COURIER,
  },
  {
    name: "atkinson",
    label: "Atkinson Hyperlegible",
    group: "face",
    hint: "The page is set in Atkinson Hyperlegible Next.",
    ...proportional("Atkinson Hyperlegible Next", "sans"),
  },
  {
    name: "et-book",
    label: "ET Book",
    group: "face",
    hint: "The page is set in ET Book.",
    ...proportional("ET Book", "serif"),
  },
  {
    name: "fira-code",
    label: "Fira Code",
    group: "face",
    hint: "The page is set in Fira Code, including the chrome.",
    ...monospaced("Fira Code"),
  },
  {
    name: "geist-mono",
    label: "Geist Mono",
    group: "face",
    hint: "The page is set in Geist Mono, including the chrome.",
    ...monospaced("Geist Mono"),
  },
  {
    name: "ibm-plex-mono",
    label: "IBM Plex Mono",
    group: "face",
    hint: "The page is set in IBM Plex Mono, including the chrome.",
    ...monospaced("IBM Plex Mono"),
  },
  {
    name: "inter",
    label: "Inter",
    group: "face",
    hint: "The page is set in Inter — titles, notes and chrome alike.",
    ...proportional("Inter", "sans"),
  },
  {
    name: "jetbrains-mono",
    label: "JetBrains Mono",
    group: "face",
    hint: "The page is set in JetBrains Mono, including the chrome.",
    ...monospaced("JetBrains Mono"),
  },
  {
    name: "junicode",
    label: "Junicode",
    group: "face",
    hint: "The page is set in Junicode.",
    ...proportional("Junicode", "serif"),
  },
  {
    name: "lexend",
    label: "Lexend",
    group: "face",
    hint: "The page is set in Lexend.",
    ...proportional("Lexend", "sans"),
  },
  {
    name: "opendyslexic",
    label: "Open Dyslexic",
    group: "face",
    hint: "The page is set in OpenDyslexic.",
    ...proportional("OpenDyslexic", "sans"),
  },
  {
    name: "open-sans",
    label: "Open Sans",
    group: "face",
    hint: "The page is set in Open Sans.",
    ...proportional("Open Sans", "sans"),
  },
  {
    name: "literata",
    label: "Literata",
    group: "face",
    hint: "The page is set in Literata.",
    ...proportional("Literata", "serif"),
  },
  {
    name: "crimson",
    label: "Crimson Pro",
    group: "face",
    hint: "The page is set in Crimson Pro.",
    ...proportional("Crimson Pro", "serif"),
  },
  {
    name: "vollkorn",
    label: "Vollkorn",
    group: "face",
    hint: "The page is set in Vollkorn.",
    ...proportional("Vollkorn", "serif"),
  },
  {
    name: "quattro",
    label: "iA Writer Quattro",
    group: "face",
    hint: "The page is set in iA Writer Quattro.",
    ...proportional("iA Writer Quattro", "sans"),
  },
  {
    name: "ia-mono",
    label: "iA Writer Mono",
    group: "face",
    hint: "The page is set in iA Writer Mono, including the chrome.",
    ...monospaced("iA Writer Mono"),
  },
  {
    name: "ibm-plex-sans",
    label: "IBM Plex Sans",
    group: "face",
    hint: "The page is set in IBM Plex Sans.",
    ...proportional("IBM Plex Sans", "sans"),
  },
  {
    name: "commit-mono",
    label: "Commit Mono",
    group: "face",
    hint: "The page is set in Commit Mono, including the chrome.",
    ...monospaced("Commit Mono"),
  },
] as const satisfies ReadonlyArray<Typeface>

export type FontName = (typeof TABLE)[number]["name"]

export const TYPEFACES: ReadonlyArray<Typeface> = TABLE

export const FONT_NAMES: ReadonlyArray<FontName> = TABLE.map((face) => face.name)

export const DEFAULT_FONT: FontName = "olai"

export const FONT_ATTRIBUTE = "data-font"

export const FONT_STORAGE_KEY = "olai.font"

export const GROUP_LABEL: Record<FontGroup, string> = {
  olai: "Olai",
  generic: "Generic",
  face: "Faces",
}

export const FONT_GROUPS: ReadonlyArray<{
  readonly group: FontGroup
  readonly label: string
  readonly faces: ReadonlyArray<Typeface>
}> = (["olai", "generic", "face"] as const).map((group) => ({
  group,
  label: GROUP_LABEL[group],
  faces: TYPEFACES.filter((face) => face.group === group),
}))

export const typefaceNamed = (name: string): Typeface | undefined =>
  TYPEFACES.find((face) => face.name === name)

export const DEFAULT_TYPEFACE: Typeface = (() => {
  const face = typefaceNamed(DEFAULT_FONT)
  if (face === undefined) {
    throw new Error(`unreachable: no row named ${DEFAULT_FONT}`)
  }
  return face
})()

/** The custom property a token is read through — Tailwind's namespace. */
export const fontProperty = (token: FontToken): string => `--font-${token}`
