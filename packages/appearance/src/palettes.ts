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
 * EIGHTEEN PALETTES: eight hue families, each a light row and a dark one,
 * and two neutral picks that sit outside the hue claim — chalk, the quietest
 * reading, and pitch, the OLED black. The rows are the wheel, in order:
 * lights first in hue order, then darks in hue order, the neutrals last, so
 * the chips read as a spectrum rather than a pile. Named for a place, a
 * material or a phenomenon — never "light", "dark", or someone else's
 * flavour; and a family's two rows are the same thing seen twice, which is
 * why reef's night is the abyss and sky's is midnight.
 *
 * The cells are 45° apart, and that is a claim the tests hold rather than a
 * picture in this comment: every 60° sector of the wheel carries a light row
 * AND a dark one, so a colour a person likes is there in either polarity; no
 * two papers of one scheme sit within 30° of each other; and no two accents
 * of one scheme are closer than 0.05 in OKLCH distance — two and a half
 * just-noticeable differences, measured through `./hues.ts`. A row's hue is
 * its cell; its accent is the foreign note that cell wants, placed so the
 * accents cover the wheel too — the blue-violet note on the green page, the
 * olive on the violet one.
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
  // Dusty rose paper, plum frame; a green note for the one foreign colour. The wheel's red cell.
  {
    name: "bloom",
    scheme: "light",
    colors: {
      paper: "#F1DFE4",
      desk: "#E6CCD3",
      panel: "#F8EDEF",
      pill: "#DDB6C0",
      ink: "#381926",
      muted: "#6C4252",
      rule: "#CFAAB4",
      accent: "#426F48",
      done: "#246B47",
      doing: "#865C13",
      alarm: "#992929",
    },
  },
  // Ripe apricot paper, a sea-blue note. The warm cell between the rose and the cream.
  {
    name: "apricot",
    scheme: "light",
    colors: {
      paper: "#FFDECE",
      desk: "#FCD2C0",
      panel: "#FFECE0",
      pill: "#F5C5AF",
      ink: "#41261A",
      muted: "#765546",
      rule: "#E3BCAB",
      accent: "#006C84",
      done: "#256638",
      doing: "#824F00",
      alarm: "#9F3541",
    },
  },
  // Aged palm leaf, iron-gall ink: the outline as a manuscript. Verdigris for the one foreign note a copper dye would give.
  {
    name: "manuscript",
    scheme: "light",
    colors: {
      paper: "#EFE7D2",
      desk: "#F4EDDD",
      panel: "#F6F0E2",
      pill: "#F9F4E6",
      ink: "#3C2F1B",
      muted: "#64573E",
      rule: "#DBCFAC",
      accent: "#1A5B54",
      done: "#4A6529",
      doing: "#884D11",
      alarm: "#9E4444",
    },
  },
  // The leaf the outline is written on: dried palm green, dark-green ink, a blue note beside it.
  {
    name: "leaf",
    scheme: "light",
    colors: {
      paper: "#DBEFD0",
      desk: "#E7F4E0",
      panel: "#E8F6E0",
      pill: "#F0F9E9",
      ink: "#1F442C",
      muted: "#486649",
      rule: "#C0DBB4",
      accent: "#4E689C",
      done: "#2F642B",
      doing: "#885411",
      alarm: "#A84A5E",
    },
  },
  // The lagoon under the palm: sea-glass paper, forest frame, coral accent. The default.
  {
    name: "reef",
    scheme: "light",
    colors: {
      paper: "#D6F0EA",
      desk: "#C4E6DF",
      panel: "#E7F7F3",
      pill: "#B4DDD5",
      ink: "#133531",
      muted: "#45726C",
      rule: "#9BC9C1",
      accent: "#B43C45",
      done: "#1E7656",
      doing: "#8F5A00",
      alarm: "#C13349",
    },
  },
  // Morning sky: pale blue paper, ink-blue frame, a gold note. The light twin of midnight.
  {
    name: "sky",
    scheme: "light",
    colors: {
      paper: "#CFE3EC",
      desk: "#BBD4E0",
      panel: "#E2EFF4",
      pill: "#A2C7D7",
      ink: "#0B283A",
      muted: "#3B5769",
      rule: "#97B6C5",
      accent: "#9B4D18",
      done: "#206F52",
      doing: "#8A590F",
      alarm: "#99293B",
    },
  },
  // Iris paper — the violet cell of the wheel, with the olive a violet field is read against.
  {
    name: "iris",
    scheme: "light",
    colors: {
      paper: "#DDE6FF",
      desk: "#D1DCFB",
      panel: "#EBF1FF",
      pill: "#C3D0F5",
      ink: "#252D45",
      muted: "#525D7A",
      rule: "#B9C5E7",
      accent: "#784F00",
      done: "#236436",
      doing: "#804C00",
      alarm: "#9C323E",
    },
  },
  // Orchid paper: the magenta cell, with the green a magenta flower is read against.
  {
    name: "orchid",
    scheme: "light",
    colors: {
      paper: "#EFE0F7",
      desk: "#E7D4F0",
      panel: "#F8EDFD",
      pill: "#DEC7E9",
      ink: "#36273D",
      muted: "#685571",
      rule: "#D2BCDD",
      accent: "#6D6900",
      done: "#1E6032",
      doing: "#7B4800",
      alarm: "#972E3A",
    },
  },
  // Near-white, high contrast: every pair this client paints clears AA. Kept as a pick, not the default.
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
  // Madder root, steeped dark: the night of the rose, with a lamp of the same dye.
  {
    name: "madder",
    scheme: "dark",
    colors: {
      paper: "#210E14",
      desk: "#2F171E",
      panel: "#3D1F29",
      pill: "#4C2934",
      ink: "#F3D5DD",
      muted: "#B38C97",
      rule: "#4A2A34",
      accent: "#FD8A8C",
      done: "#49A675",
      doing: "#B78F08",
      alarm: "#E1728B",
    },
  },
  // Walnut and cream, gold for the fire. The warm dark — manuscript's night.
  {
    name: "ember",
    scheme: "dark",
    colors: {
      paper: "#21140E",
      desk: "#312018",
      panel: "#3F2B1F",
      pill: "#4E3729",
      ink: "#EEE3D4",
      muted: "#B49C8A",
      rule: "#4F392D",
      accent: "#F29A35",
      done: "#60C78B",
      doing: "#EECB58",
      alarm: "#E87382",
    },
  },
  // Brandy in a glass: amber gone dark, a chartreuse note. The night of the apricot and the manuscript.
  {
    name: "brandy",
    scheme: "dark",
    colors: {
      paper: "#1D1300",
      desk: "#291E00",
      panel: "#362800",
      pill: "#433300",
      ink: "#E7DEC4",
      muted: "#A49775",
      rule: "#3F3414",
      accent: "#BDBE53",
      done: "#45A271",
      doing: "#B48C00",
      alarm: "#DD6E87",
    },
  },
  // Spruce at night: the dark of the leaf, with a spring-green note.
  {
    name: "spruce",
    scheme: "dark",
    colors: {
      paper: "#0E1809",
      desk: "#172310",
      panel: "#1F2F16",
      pill: "#293C1E",
      ink: "#D4E4CD",
      muted: "#8BA081",
      rule: "#2A3B20",
      accent: "#7FD189",
      done: "#43A070",
      doing: "#B28900",
      alarm: "#DA6C85",
    },
  },
  // The deep under the lagoon: near-black water, a bright cyan note.
  {
    name: "abyss",
    scheme: "dark",
    colors: {
      paper: "#021A15",
      desk: "#042520",
      panel: "#05322B",
      pill: "#093E36",
      ink: "#C6E6DF",
      muted: "#76A399",
      rule: "#113E36",
      accent: "#49D2EA",
      done: "#409E6E",
      doing: "#AF8700",
      alarm: "#D86A83",
    },
  },
  // Midnight blue: the night of the sky, with the same azure lifted.
  {
    name: "midnight",
    scheme: "dark",
    colors: {
      paper: "#031820",
      desk: "#05232D",
      panel: "#082F3C",
      pill: "#0D3B4B",
      ink: "#C6E4F0",
      muted: "#779FB0",
      rule: "#133B49",
      accent: "#7BBEFA",
      done: "#3C9A6A",
      doing: "#AC8400",
      alarm: "#D46680",
    },
  },
  // Pitch with a sky: violet navy paper, pale frame, the aurora's own teal.
  {
    name: "aurora",
    scheme: "dark",
    colors: {
      paper: "#0D1120",
      desk: "#161B30",
      panel: "#1F2642",
      pill: "#2A3152",
      ink: "#D7E7F6",
      muted: "#7F91B1",
      rule: "#2F3A58",
      accent: "#51E0C5",
      done: "#7EE0A8",
      doing: "#F0C04A",
      alarm: "#F07090",
    },
  },
  // Plum paper, lilac frame, a rose note. The violet cell's night.
  {
    name: "dusk",
    scheme: "dark",
    colors: {
      paper: "#1D1022",
      desk: "#2A1A31",
      panel: "#362441",
      pill: "#422E51",
      ink: "#E1D4EC",
      muted: "#A58EB6",
      rule: "#473153",
      accent: "#DE88CC",
      done: "#6BC799",
      doing: "#EEC658",
      alarm: "#E87DA1",
    },
  },
  // True black: an OLED panel spends nothing on #000000. Olive frame, the night of the leaf.
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
      accent: "#96A1D7",
      done: "#7FC97A",
      doing: "#D9A85A",
      alarm: "#D68B9A",
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
