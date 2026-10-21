/**
 * The named palettes, and the vocabulary they are written in.
 *
 * A theme is a PALETTE WITH A NAME, and this table is the whole of it: adding
 * one is adding a row, deleting one is deleting a row, and neither touches a
 * line of CSS — `./css.ts` generates every block in the sheet from what is
 * here, and the theme row's picker draws one swatch per row. Hand-written CSS
 * would be the same eleven lines copied once per theme, and one place per
 * theme for a new token to be forgotten.
 *
 * FOUR PALETTES, two light and two dark, and the number is a ruling rather
 * than a shortage. The eighteen-row wheel that used to live here was written
 * for a frame of ink around a page of paper — a forest column beside a lagoon
 * sheet — and the redesign retired the inversion: the header, the directory
 * column and the page are ONE surface now, in steps of the same paper, so a
 * palette is judged on how a whole screen of it reads for a working day rather
 * than on whether its frame sets off its page. Two of each polarity is what
 * that leaves room for and what can be kept honest — a neutral, which is what
 * the day is mostly read in, and the lagoon, which is ours:
 *
 *   chalk    warm near-white, the coral note. The default when the OS is light.
 *   reef     sea-glass paper under the palm, coral at the tips.
 *   basalt   warm near-black, the same coral lifted. The default when the OS is dark.
 *   abyss    the deep under the lagoon, a cyan note.
 *
 * Two rows are twins in the way reef's night was always the abyss: chalk and
 * basalt are the neutral read both ways, reef and abyss the lagoon read both
 * ways, and `./palettes.test.ts` holds each light row to a dark one within a
 * few degrees of the same hue.
 *
 * THE OS CHOOSES BETWEEN THE TWO DEFAULTS. A page that has picked nothing reads
 * in `chalk` by day and `basalt` under `prefers-color-scheme: dark` — the sheet
 * carries that media rule for the bare `:root` only (`./css.ts`), so a PICK is
 * still a pick: a stored name wins over the OS in either polarity, and the
 * Theme row offers the OS's choice back as its own control.
 *
 * ## The vocabulary
 *
 *   paper    the page itself — the outline, a document, the main column
 *   desk     the furniture around it — the header, the directory column, a
 *            pane's own bar, a well a control sits in
 *   panel    a raised card: a popover, a menu, a composer, the command palette
 *   pill     a filled chip: a date, a readout, a count
 *   ink      what is written on it
 *   muted    a label, a timestamp, a note's chrome
 *   rule     a hairline, and the surface a row lights up with
 *   accent   a link, the entry in force, the focus ring
 *   done     finished, and the live connection dot
 *   doing    in flight
 *   alarm    an error, a refusal
 *
 * Desk, panel and pill are lightness steps of paper, not a second ramp: in a
 * light palette the desk is one step under the paper and the panel one over
 * it; in a dark one every step is a lift. Accent is the one foreign note.
 * done / doing / alarm are retuned to each ground, never copied across.
 *
 * ## Contrast
 *
 * Every row promises AA over every pair this client paints
 * (`./contrast.test.ts`), with ink on paper at least 7:1 — this is an outliner
 * a person lives in, and with four rows there is no excuse for a palette that
 * only mostly clears the line.
 */

/** Every token a palette names. The order is the order they are written in a
 *  block, which is the order they are read in below. */
export const PALETTE_TOKENS = [
  "paper",
  "desk",
  "panel",
  "pill",
  "ink",
  "muted",
  "rule",
  "accent",
  "done",
  "doing",
  "alarm",
] as const

export type PaletteToken = (typeof PALETTE_TOKENS)[number]

export type Scheme = "light" | "dark"

export interface Palette {
  /** What a page names this theme by — the `data-theme` value, the chip's
   *  label, and the key this browser stores. One string, three jobs. */
  readonly name: string
  /**
   * The one thing about a theme a browser has to be told in its own words:
   * form controls, scrollbars and the canvas behind the page are the UA's to
   * paint, and `color-scheme` is how it is told which way. It rides in the
   * table because it is a fact about the palette — a theme that changed its
   * mind about being dark and forgot this would keep the OS's scrollbars.
   */
  readonly scheme: Scheme
  /**
   * A PROMISE every row makes: every foreground this one paints on a
   * background clears WCAG AA (4.5:1). Said per row so something can hold the
   * row to it (`./contrast.test.ts`) — a colour nudged by two digits is exactly
   * the edit that quietly drops a pair under the line.
   */
  readonly aa: true
  readonly colors: Readonly<Record<PaletteToken, string>>
}

/** The table itself, `as const` so the names survive as literal types — which
 *  is what makes `ThemeName` a real type and `DEFAULT_THEME` a compile error
 *  the day a row is renamed. Private, because everything that READS a palette
 *  wants the interface (`PALETTES` below); only the two derivations under it
 *  want the literals. */
const TABLE = [
  // Warm near-white, the quietest reading, with the coral the mark is drawn
  // in. The light default.
  {
    name: "chalk",
    scheme: "light",
    aa: true,
    colors: {
      paper: "#FBFBF9",
      desk: "#F3F3EF",
      panel: "#FFFFFF",
      pill: "#E9E9E3",
      ink: "#1B1B18",
      muted: "#5D5F57",
      rule: "#DBDBD4",
      accent: "#B23A43",
      done: "#1F7A4D",
      doing: "#8A5800",
      alarm: "#C0313F",
    },
  },
  // The lagoon under the palm: sea-glass paper, coral accent. Lighter than it
  // was, because it is the whole screen now rather than a sheet in a frame.
  {
    name: "reef",
    scheme: "light",
    aa: true,
    colors: {
      paper: "#E8F6F2",
      desk: "#DAEFE9",
      panel: "#F3FBF8",
      pill: "#CAE7DF",
      ink: "#10302B",
      muted: "#3A665F",
      rule: "#B3D9D0",
      accent: "#B43C45",
      done: "#1E7656",
      doing: "#875600",
      alarm: "#C13349",
    },
  },
  // Warm near-black, every surface a lift of the one under it, the coral
  // brightened to carry on it. The dark default.
  {
    name: "basalt",
    scheme: "dark",
    aa: true,
    colors: {
      paper: "#161718",
      desk: "#1D1E21",
      panel: "#242629",
      pill: "#2E3034",
      ink: "#E8E8E4",
      muted: "#A0A19C",
      rule: "#34363B",
      accent: "#EE8F93",
      done: "#62C58D",
      doing: "#E4BA52",
      alarm: "#F27E8B",
    },
  },
  // The deep under the lagoon: near-black water, a bright cyan note.
  {
    name: "abyss",
    scheme: "dark",
    aa: true,
    colors: {
      paper: "#06201A",
      desk: "#0B2923",
      panel: "#10342D",
      pill: "#174139",
      ink: "#CFE9E2",
      muted: "#84B0A6",
      rule: "#1E4840",
      accent: "#4ED4E6",
      done: "#52B37F",
      doing: "#CDA62A",
      alarm: "#EB7B90",
    },
  },
] as const satisfies ReadonlyArray<Palette>

/** The name of a theme that EXISTS — every row's name, and nothing else. What
 *  `localStorage` hands back is a plain `string` and stays one until
 *  `paletteNamed` has looked at it; this is the type on the other side of that
 *  boundary, and it is what makes naming a default no row answers to a
 *  compile error. */
export type ThemeName = (typeof TABLE)[number]["name"]

/** Every palette, in table order: lights first, then darks. */
export const PALETTES: ReadonlyArray<Palette> = TABLE

/** Every theme a page may ask for, in the same order — the picker's rows, and
 *  the list of what a stored value is allowed to say. */
export const THEME_NAMES: ReadonlyArray<ThemeName> = TABLE.map(
  (palette) => palette.name,
)

/**
 * The theme a page with no attribute reads in by day — and, because a test
 * browser and an installer's manifest have no OS preference to speak of, the
 * one the shell and the manifest spell as THE default.
 */
export const DEFAULT_THEME: ThemeName = "chalk"

/** The theme a page with no attribute reads in when the OS says dark. */
export const DEFAULT_DARK_THEME: ThemeName = "basalt"

/** How a page says which theme it is in: one attribute, keyed on by the sheet,
 *  written by the picker and by the shell's boot script, spelled here. */
export const THEME_ATTRIBUTE = "data-theme"

/** Where THIS BROWSER keeps the pick. Never sent anywhere — the server draws
 *  the same page for everyone, and what it looks like to you is yours. */
export const THEME_STORAGE_KEY = "olai.theme"

/** One theme by name, or `undefined` for a name no row offers — which is what
 *  a value stored by an older olai looks like after a theme is renamed. */
export const paletteNamed = (name: string): Palette | undefined =>
  PALETTES.find((palette) => palette.name === name)

const mustExist = (name: ThemeName): Palette => {
  const palette = paletteNamed(name)
  if (palette === undefined) {
    throw new Error(`unreachable: no row named ${name}`)
  }
  return palette
}

/** The palette a page is in when it names none and the OS says light.
 *
 *  `DEFAULT_THEME` is a `ThemeName`, so a row for it EXISTS — the day someone
 *  renames `chalk` this file stops compiling rather than starting a browser
 *  with no chip lit and no bare `:root` in the sheet. The throw is what says
 *  so to a checker that cannot see it through `find`. */
export const DEFAULT_PALETTE: Palette = mustExist(DEFAULT_THEME)

/** …and when the OS says dark. */
export const DEFAULT_DARK_PALETTE: Palette = mustExist(DEFAULT_DARK_THEME)

/** The palette an unpicked page reads in under a given scheme — the one
 *  question the OS gets to answer. */
export const defaultPaletteFor = (scheme: Scheme): Palette =>
  scheme === "dark" ? DEFAULT_DARK_PALETTE : DEFAULT_PALETTE
