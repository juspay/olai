/**
 * The named palettes, and the vocabulary they are written in.
 *
 * A theme is a PALETTE WITH A NAME, and this table is the whole of it: adding
 * one is adding a row, deleting one is deleting a row, and neither touches a
 * line of CSS — `./css.ts` generates every block in the sheet from what is
 * here, and `./Chips.tsx` draws one chip per row. Hand-written CSS would be
 * the same eleven lines copied once per theme, and one place per theme for a
 * new token to be forgotten.
 *
 * The eleven WorkFlowy desktop themes that used to sit in this table are
 * gone. They were another app's colour values, and olai paints a different
 * app: the frame is ink, the page is paper. A palette that was not written
 * for that inversion is a white bar over a dark page, or a shared blue
 * sticker on every ground. Reef and aurora were the first two rows that
 * were ours; the table is now only that kind of row.
 *
 * Ten palettes. Lights first (reef leading, the default), then darks. Each
 * occupies a cell of light/dark × paper hue, so the chips are a spectrum
 * rather than a pile. Named for a place, a material or a phenomenon — never
 * "light", "dark", or someone else's flavour.
 *
 * ## The vocabulary
 *
 *   paper    the page itself — the outline, a document
 *   desk     the workbench around it — a card's surround, a well
 *   panel    a raised card: the month, a popover, a composer
 *   pill     a filled chip: a date, a readout, a header control
 *   ink      what is written on it, and the FRAME (header, sidebar, rail)
 *   muted    a label, a timestamp, a note's chrome
 *   rule     a border, and the surface a row lights up with
 *   accent   a link, the entry in force, the focus ring
 *   done     finished, and the live connection dot
 *   doing    in flight
 *   alarm    an error, a refusal
 *
 * Ink is the page's family, so the frame belongs to the paper. Desk, panel
 * and pill are lightness steps of paper, not a second ramp. Accent is the
 * one foreign note — a complement, or the bright analogous of a dark ground.
 * done / doing / alarm are retuned to that ground, never copied from a
 * neighbour.
 *
 * The three accent GROUNDS did not come: a wash is the accent at an opacity,
 * and a token nothing paints with is a value nobody can check. When a
 * component wants another named surface, the way to give it one is to add a
 * column here and let the type error name every row that owes a value —
 * which is exactly what `Record<PaletteToken, string>` is for.
 *
 * ## Contrast
 *
 * Every row is held to a reading floor (`./contrast.test.ts`): ink on paper
 * (and paper on ink, the frame) at least 7:1, and muted / accent / done /
 * doing / alarm on paper, ink on desk / panel / pill / rule, and paper on
 * accent, at least AA (4.5:1). `chalk` additionally promises AA over every
 * pair this client paints, including muted on the raised surfaces.
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
  readonly scheme: "light" | "dark"
  /**
   * A PROMISE, and only some palettes make it: every foreground this one
   * paints on a background clears WCAG AA (4.5:1). Said here so something can
   * hold the palette to it (`./contrast.test.ts`) — a colour nudged by two
   * digits is exactly the edit that quietly drops a pair under the line.
   */
  readonly aa?: true
  readonly colors: Readonly<Record<PaletteToken, string>>
}

/** The table itself, `as const` so the names survive as literal types — which
 *  is what makes `ThemeName` a real type and `DEFAULT_THEME` a compile error
 *  the day a row is renamed. Private, because everything that READS a palette
 *  wants the interface (`PALETTES` below); only the two derivations under it
 *  want the literals. */
const TABLE = [
  // The lagoon under the palm: sea-glass paper, forest frame, coral accent.
  // The default, and the first palette that was ours.
  {
    name: "reef",
    scheme: "light",
    colors: {
      paper: "#D7F0E8",
      desk: "#C5E6DC",
      panel: "#E8F7F2",
      pill: "#B5DDD2",
      ink: "#14352F",
      muted: "#467269",
      rule: "#9CC9BE",
      accent: "#B34219",
      done: "#1E7656",
      doing: "#8F5A00",
      alarm: "#C13349",
    },
  },
  // The leaf the outline is written on: dried palm green, dark-green ink.
  // The name is the palette; nothing here is "light". Sea-blue accent is the
  // water beside the palm.
  {
    name: "leaf",
    scheme: "light",
    colors: {
      paper: "#E4ECCA",
      desk: "#EDF2DC",
      panel: "#EFF4DC",
      pill: "#F5F8E6",
      ink: "#2C4222",
      muted: "#536440",
      rule: "#CDD8AB",
      accent: "#2B6A8F",
      done: "#2F642B",
      doing: "#885411",
      alarm: "#A84A5E",
    },
  },
  // Aged palm leaf, iron-gall ink: the outline as a manuscript. Warm paper,
  // brown-black ink, verdigris for the one foreign note a copper dye would
  // give.
  {
    name: "manuscript",
    scheme: "light",
    colors: {
      paper: "#F0E7D2",
      desk: "#F5EDDD",
      panel: "#F7F0E2",
      pill: "#FAF4E6",
      ink: "#3D2F1B",
      muted: "#65573E",
      rule: "#DCCEAC",
      accent: "#296559",
      done: "#4A6529",
      doing: "#884D11",
      alarm: "#9E4444",
    },
  },
  // Dusty rose paper, plum frame, teal accent. The warm-pink cell of the
  // wheel — a blush that still reads as a page, not as a wash on white.
  {
    name: "bloom",
    scheme: "light",
    colors: {
      paper: "#F1DFE3",
      desk: "#E6CCD2",
      panel: "#F8EDEF",
      pill: "#DDB6BF",
      ink: "#381925",
      muted: "#6C4251",
      rule: "#CFAAB3",
      accent: "#1E7166",
      done: "#246B47",
      doing: "#865C13",
      alarm: "#992929",
    },
  },
  // Morning sky: pale blue paper, ink-blue frame, terracotta accent. The
  // light twin of aurora's navy, and the cool cell that a gray "vintage"
  // never occupied.
  {
    name: "sky",
    scheme: "light",
    colors: {
      paper: "#D2E2EF",
      desk: "#BFD2E3",
      panel: "#E4EEF6",
      pill: "#A8C4DC",
      ink: "#15263C",
      muted: "#42556C",
      rule: "#9CB4C9",
      accent: "#9A4E13",
      done: "#206F52",
      doing: "#8A590F",
      alarm: "#99293B",
    },
  },
  // Near-white, high contrast: every pair this client paints clears AA. Kept
  // as a pick, not the default — a page that wants the quietest reading still
  // has it, and contrast.ts still holds the promise.
  {
    name: "chalk",
    scheme: "light",
    aa: true,
    colors: {
      paper: "#FAFAF6",
      desk: "#F2F2EC",
      panel: "#F5F5F0",
      pill: "#EDEFE6",
      ink: "#15180F",
      muted: "#555E4C",
      rule: "#C9CDBF",
      accent: "#134F75",
      done: "#2A6626",
      doing: "#8F5200",
      alarm: "#8E3348",
    },
  },

  // ── darks ────────────────────────────────────────────────────────────

  // Pitch with a sky: navy paper, pale-sky frame, teal lights. The first
  // dark that was ours.
  {
    name: "aurora",
    scheme: "dark",
    colors: {
      paper: "#0A1220",
      desk: "#121C30",
      panel: "#1A2742",
      pill: "#243352",
      ink: "#D5E8F5",
      muted: "#6582A4",
      rule: "#2A3C58",
      accent: "#4EE0C8",
      done: "#7EE0A8",
      doing: "#F0C04A",
      alarm: "#F07090",
    },
  },
  // True black: an OLED panel spends nothing on #000000, and the outline is
  // mostly background. Olive frame, the night of the leaf.
  {
    name: "pitch",
    scheme: "dark",
    colors: {
      paper: "#000000",
      desk: "#0D110A",
      panel: "#10140C",
      pill: "#161B10",
      ink: "#C9D6B4",
      muted: "#77836A",
      rule: "#242B1E",
      accent: "#6FAECE",
      done: "#7FC97A",
      doing: "#D9A85A",
      alarm: "#D68B9A",
    },
  },
  // Walnut and cream, gold for the fire. The warm dark — manuscript's night,
  // a cell nothing in the old table occupied.
  {
    name: "ember",
    scheme: "dark",
    colors: {
      paper: "#21140D",
      desk: "#312017",
      panel: "#3E2B1E",
      pill: "#4D3728",
      ink: "#EDE3D4",
      muted: "#B39D89",
      rule: "#4E392C",
      accent: "#F29A36",
      done: "#60C78B",
      doing: "#EECB58",
      alarm: "#E87382",
    },
  },
  // Plum paper, lilac frame, peach accent. The violet cell of the wheel.
  {
    name: "dusk",
    scheme: "dark",
    colors: {
      paper: "#1C1023",
      desk: "#291A32",
      panel: "#352442",
      pill: "#412E52",
      ink: "#E0D4ED",
      muted: "#A38FB7",
      rule: "#463154",
      accent: "#EE8F58",
      done: "#6BC799",
      doing: "#EEC658",
      alarm: "#E87DA1",
    },
  },
] as const satisfies ReadonlyArray<Palette>

/** The name of a theme that EXISTS — every row's name, and nothing else. What
 *  `localStorage` hands back is a plain `string` and stays one until
 *  `paletteNamed` has looked at it; this is the type on the other side of that
 *  boundary, and it is what makes naming a default no row answers to a
 *  compile error. */
export type ThemeName = (typeof TABLE)[number]["name"]

/** Every palette, in table order. */
export const PALETTES: ReadonlyArray<Palette> = TABLE

/** Every theme a page may ask for, in the same order — the picker's rows, and
 *  the list of what a stored value is allowed to say. */
export const THEME_NAMES: ReadonlyArray<ThemeName> = TABLE.map(
  (palette) => palette.name,
)

/**
 * The theme a page with no attribute reads in.
 *
 * The OS does not vote. `prefers-color-scheme` used to choose this, and it
 * meant two ways to be dark that could disagree; a theme is a PICK, and an
 * unpicked page reads in the default. That used to be `chalk` because it
 * promised AA. The default is `reef` — the lagoon, which is ours — and
 * `chalk` stays a pick for a page that wants the quietest reading.
 */
export const DEFAULT_THEME: ThemeName = "reef"

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

/** The palette a page is in when it names none.
 *
 *  `DEFAULT_THEME` is a `ThemeName`, so a row for it EXISTS — the day someone
 *  renames `reef` this file stops compiling rather than starting a browser
 *  with no chip lit and no bare `:root` in the sheet. The throw is what says
 *  so to a checker that cannot see it through `find`. */
export const DEFAULT_PALETTE: Palette = (() => {
  const palette = paletteNamed(DEFAULT_THEME)
  if (palette === undefined) {
    throw new Error(`unreachable: no row named ${DEFAULT_THEME}`)
  }
  return palette
})()
