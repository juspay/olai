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
 * ELEVEN PALETTES, seven light and four dark. The set is asked to cover the
 * whole wheel AND to have no two rows a person could mistake for each other,
 * and those two pull against each other. The floor is the distance between
 * the two papers that shipped closest together (chalk and reef, about 0.030
 * in OKLab). By day, a hue every 60° clears it with no room to spare (leaf
 * and reef, 0.030). By night, hues 45° apart fall under it (0.027), and a
 * preview at that spacing was judged too alike to keep; a hue every 60° would
 * clear it (0.036), and every 120° is the CHOICE made after that preview, so
 * the hued darks sit nearly twice the floor apart (ember and dusk, 0.056).
 * So each polarity is a neutral, which is what the day is mostly read in,
 * and a lattice of hues anchored on the lagoon, which is ours:
 *
 *   chalk       warm near-white, the coral note. The default when the OS is light.
 *   bloom       a rose page, the faintest tint of the set, a teal note.
 *   manuscript  amber paper, an indigo note.
 *   leaf        green paper, a berry note.
 *   reef        sea-glass paper under the palm, coral at the tips.
 *   sky         blue paper, a rose note.
 *   iris        violet paper, a green note.
 *   basalt      warm near-black, the same coral lifted. The default when the OS is dark.
 *   ember       a dark amber ground, its own hue lifted to gold.
 *   abyss       the deep under the lagoon, a cyan note.
 *   dusk        a dark violet ground, a pink note.
 *
 * The four that shipped first (chalk, reef, basalt, abyss) are hand-tuned and
 * stay digit for digit, so nobody's screen changes on upgrade. The seven after
 * them are written by ONE GRAMMAR, `./recipe.ts`: a row's `recipe` names its
 * hue, how deep its tint is and where its accent sits, and the grammar turns
 * those into the eleven colours — one hue across every ground, the same
 * lightness steps on every row of a depth, an accent dimmed until it reads on
 * its paper, and one triple of status colours per polarity. The colours stay
 * here as literals, because this file imports nothing (the website build
 * copies it alone); `./recipe.test.ts` holds each literal to the grammar.
 *
 * A light row's accent comes from the far side of the wheel; a dark row lifts
 * its own hue. `./palettes.test.ts` holds the spread (one light paper in each
 * 60° sector, one dark paper in each 120° sector), the floor between papers,
 * and the distance between accents.
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
 * done / doing / alarm are tuned per polarity: the four hand-tuned rows retune
 * them to their own ground, the grammar's rows share one triple per polarity.
 *
 * ## Contrast
 *
 * Every row promises AA over every pair this client paints
 * (`./contrast.test.ts`), with ink on paper at least 7:1 — this is an outliner
 * a person lives in, and with every row measured there is no excuse for a
 * palette that only mostly clears the line.
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

/** How deep a grammar-written row's tint runs: `pale` is reef's own ramp,
 *  `deep` the same steps with about twice its tint. A closed set, and
 *  narrower by night — the dark ramp is abyss's, and there is only the one
 *  (`./recipe.ts`). */
export type Depth = "pale" | "deep"

/** What a row written by the grammar (`./recipe.ts`) declares: the hue of its
 *  grounds and text, the depth of its tint, and the hue of its accent, all in
 *  OKLCH degrees. The scheme is the row's own. */
export interface Recipe {
  readonly hue: number
  readonly depth: Depth
  readonly accentHue: number
}

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
  /** Present on a row the grammar wrote, and absent on the four hand-tuned
   *  ones; `./recipe.test.ts` holds `colors` equal to what it derives. */
  readonly recipe?: Recipe
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
  // A rose page, the palest tint of the set, with a teal note from across
  // the wheel.
  {
    name: "bloom",
    scheme: "light",
    aa: true,
    colors: {
      paper: "#FDEEF1",
      desk: "#F8E3E8",
      panel: "#FEF6F8",
      pill: "#F3D7DE",
      ink: "#3A2228",
      muted: "#75515A",
      rule: "#E8C5CD",
      accent: "#00717D",
      done: "#1F7656",
      doing: "#875601",
      alarm: "#C13349",
    },
    recipe: { hue: 2, depth: "pale", accentHue: 205 },
  },
  // Amber paper, the colour of an old page, with an indigo note.
  {
    name: "manuscript",
    scheme: "light",
    aa: true,
    colors: {
      paper: "#FDEAD8",
      desk: "#F7E0C9",
      panel: "#FEF4E9",
      pill: "#F1D6BA",
      ink: "#35220C",
      muted: "#6B5134",
      rule: "#E4C4A3",
      accent: "#475BBD",
      done: "#1F7656",
      doing: "#875601",
      alarm: "#C13349",
    },
    recipe: { hue: 68, depth: "deep", accentHue: 271 },
  },
  // Green paper, with a berry note.
  {
    name: "leaf",
    scheme: "light",
    aa: true,
    colors: {
      paper: "#EAF2DA",
      desk: "#E0E9CC",
      panel: "#F3F8EB",
      pill: "#D5E0BE",
      ink: "#232A0F",
      muted: "#515C39",
      rule: "#C4D1A7",
      accent: "#94439A",
      done: "#1F7656",
      doing: "#875601",
      alarm: "#C13349",
    },
    recipe: { hue: 122, depth: "deep", accentHue: 325 },
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
  // Blue paper, with a rose note. The grammar's own turn would have put the
  // accent on an amber that sat beside `doing`; rose stands clear of all three
  // status colours.
  {
    name: "sky",
    scheme: "light",
    aa: true,
    colors: {
      paper: "#DEF0FF",
      desk: "#D0E8FF",
      panel: "#EDF7FF",
      pill: "#C3DEFA",
      ink: "#13283B",
      muted: "#3E5974",
      rule: "#ADCFEF",
      accent: "#A73B76",
      done: "#1F7656",
      doing: "#875601",
      alarm: "#C13349",
    },
    recipe: { hue: 248, depth: "deep", accentHue: 350 },
  },
  // Violet paper, with a green note.
  {
    name: "iris",
    scheme: "light",
    aa: true,
    colors: {
      paper: "#F2E9FF",
      desk: "#EADFFB",
      panel: "#F8F3FF",
      pill: "#E1D4F5",
      ink: "#2B2138",
      muted: "#5D4F70",
      rule: "#D2C2EA",
      accent: "#00731F",
      done: "#1F7656",
      doing: "#875601",
      alarm: "#C13349",
    },
    recipe: { hue: 304, depth: "deep", accentHue: 147 },
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
  // A dark amber ground, its own hue lifted to gold for the accent.
  {
    name: "ember",
    scheme: "dark",
    aa: true,
    colors: {
      paper: "#27160B",
      desk: "#311E11",
      panel: "#3E2717",
      pill: "#4C321F",
      ink: "#F2DED0",
      muted: "#BF9E89",
      rule: "#543826",
      accent: "#E0BA61",
      done: "#51B37F",
      doing: "#CDA62B",
      alarm: "#EB7B90",
    },
    recipe: { hue: 55, depth: "deep", accentHue: 87 },
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
  // A dark violet ground, a pink note turned a little from its own hue.
  {
    name: "dusk",
    scheme: "dark",
    aa: true,
    colors: {
      paper: "#1D1728",
      desk: "#261F32",
      panel: "#30283F",
      pill: "#3D334E",
      ink: "#E5DEF3",
      muted: "#AA9FC0",
      rule: "#433A56",
      accent: "#ECA3E1",
      done: "#51B37F",
      doing: "#CDA62B",
      alarm: "#EB7B90",
    },
    recipe: { hue: 300, depth: "deep", accentHue: 332 },
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

/**
 * …and where it keeps THE SCHEME OF THAT PICK, as the one word a browser
 * understands: `light` or `dark`.
 *
 * A second key for something derivable looks like a redundancy, and from in
 * here it is one — `paletteNamed(stored)?.scheme` is the same answer. It is
 * not derivable in the ONE PLACE that needs it first: the shell's inline boot
 * script runs before any module exists and deliberately knows no theme names,
 * so the only thing it can do with `olai.theme` is copy it onto an attribute.
 * The canvas, the scrollbars and the form controls of the pre-sheet window are
 * the UA's, and the only thing that moves them is `<meta name="color-scheme">`
 * — a word, not a theme name. So the scheme rides beside the pick as DATA the
 * shell was handed, written from this table by whoever made the pick
 * (theme/state.ts) and copied verbatim by a script that cannot read it.
 *
 * It is a cache of this table and is treated as one: every activation rewrites
 * it from the palette in force, so an entry left by an older olai — or none at
 * all, which is what every browser that picked before this key existed has —
 * is right again after one load.
 */
export const SCHEME_STORAGE_KEY = "olai.scheme"

/** What the canvas meta says when nobody has pinned it: BOTH, which is the
 *  word for "follow the OS". The shell authors it (so a page whose JavaScript
 *  never runs still follows the system), and handing the theme back to the
 *  system puts it back. */
export const SYSTEM_SCHEME = "light dark"

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
