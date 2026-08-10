/**
 * The named palettes, and the vocabulary they are written in.
 *
 * A theme is a PALETTE WITH A NAME, and this table is the whole of it: adding
 * one is adding a row, deleting one is deleting a row, and neither touches a
 * line of CSS — `./css.ts` generates every block in the sheet from what is
 * here, and `./Picker.tsx` draws one chip per row. Hand-written CSS would be
 * the same eight lines copied fifteen times, and one place per theme for a new
 * token to be forgotten.
 *
 * The values are the racket implementation's, ported hex for hex from
 * `olai/web/theme.rkt` on the `master-racket` branch. Four of the fifteen are
 * that implementation's own (leaf, manuscript, chalk, pitch); the other eleven
 * are the WorkFlowy desktop themes' colour VALUES, and they were re-read off
 * those themes' own stylesheets rather than trusted second-hand — every row
 * below was checked against the `._theme-*` block it comes from, `var()` chains
 * resolved. Nothing else came across: their app draws a different app, and none
 * of its rules, names or markup are ours to keep. A hex is a fact about a
 * colour.
 *
 * Four of their themes are not here, and it is the same reason for all four:
 * `wood`, `steel` and `glass` are a photograph or a pane of glass over the
 * ramp their default already uses, and `space` is that ramp one shade darker.
 * Without the image each is a duplicate row.
 *
 * ## The vocabulary, and what it left behind
 *
 * The racket skin painted with fourteen tokens; this client paints with eight,
 * and they are the eight `styles.css` already had. So each row is that row's
 * fourteen read through the one mapping below:
 *
 *   paper   <- paper       the page itself
 *   ink     <- ink         what is written on it
 *   muted   <- dim         a label, a timestamp, a note's chrome
 *   rule    <- line        a border, and the surface a row lights up with
 *   accent  <- blue-fg     a link, the entry in force, the focus ring
 *   done    <- green       finished, and the live connection dot
 *   doing   <- amber-fg    in flight
 *   alarm   <- rose-fg     an error, a refusal
 *
 * which for the eleven imported rows is one more step back, to the slots their
 * own themes are written in — `paper` is their `background-primary`, `ink`
 * their `text-primary`, `muted` their `text-tertiary`, `rule` their
 * `border-primary`, and the four accents their named colour ramp
 * (`text-blue`, `text-green`, `text-yellow`, `text-red`) rather than their
 * semantic ones, which are pale mints and pinks that only work on a dark
 * ground. Three rows depart from that and each says so where it is written.
 *
 * The six that did not come — `paper-2`, `panel`, `pill-bg` and the three
 * accent GROUNDS — have no home in this client: it paints one paper, and its
 * accent pills are the accent at an opacity rather than a colour of their own.
 * A token nothing paints with is a value nobody can check, so they are not
 * carried. When a component wants a second surface, the way to give it one is
 * to add a column here and let the type error name every row that owes a value
 * — which is exactly what `Record<PaletteToken, string>` is for.
 */

/** Every token a palette names. The order is the order they are written in a
 *  block, which is the order they are read in below. */
export const PALETTE_TOKENS = [
  "paper",
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
  // The leaf the outline is written on: dried palm green, dark-green ink. The
  // name is the palette; nothing here is "light".
  {
    name: "leaf",
    scheme: "light",
    colors: {
      paper: "#E4ECCA",
      ink: "#2C4222",
      muted: "#74855F",
      rule: "#CDD8AB",
      accent: "#2B6A8F",
      done: "#3E7A3A",
      doing: "#B9741B",
      alarm: "#A84A5E",
    },
  },
  // Aged palm leaf, iron-gall ink: the outline as a manuscript. Warm paper,
  // brown-black ink, and accents pulled back to what a dye would give.
  {
    name: "manuscript",
    scheme: "light",
    colors: {
      paper: "#F0E7D2",
      ink: "#3D2F1B",
      muted: "#8C7B5C",
      rule: "#DCCEAC",
      accent: "#2F6580",
      done: "#5A7A34",
      doing: "#A05A16",
      alarm: "#9E4444",
    },
  },
  // Near-white, high contrast: every pair this client paints clears AA. THE
  // DEFAULT — what a page reads in before anyone picks — because the one
  // nobody chose should be the one that is legible on any screen.
  {
    name: "chalk",
    scheme: "light",
    aa: true,
    colors: {
      paper: "#FAFAF6",
      ink: "#15180F",
      muted: "#555E4C",
      rule: "#C9CDBF",
      accent: "#134F75",
      done: "#2A6626",
      doing: "#8F5200",
      alarm: "#8E3348",
    },
  },
  // True black: an OLED panel spends nothing on #000000, and the outline is
  // mostly background.
  {
    name: "pitch",
    scheme: "dark",
    colors: {
      paper: "#000000",
      ink: "#C9D6B4",
      muted: "#77836A",
      rule: "#242B1E",
      accent: "#6FAECE",
      done: "#7FC97A",
      doing: "#D9A85A",
      alarm: "#D68B9A",
    },
  },

  // ── the imported palettes ────────────────────────────────────────────
  //
  // Their default: white page, blue-gray ink.
  {
    name: "light",
    scheme: "light",
    colors: {
      paper: "#FFFFFF",
      ink: "#2A3135",
      muted: "#868C90",
      rule: "#DCE0E2",
      accent: "#1C64F2",
      done: "#057A55",
      doing: "#9F580A",
      alarm: "#E02424",
    },
  },
  // Their dark: charcoal, white ink.
  {
    name: "dark",
    scheme: "dark",
    colors: {
      paper: "#2A3135",
      ink: "#FFFFFF",
      muted: "#9EA1A2",
      rule: "#5C6062",
      accent: "#76A9FA",
      done: "#31C48D",
      doing: "#E3A008",
      alarm: "#F98080",
    },
  },
  // Paper on a gray desk. EXCEPTION: paper is their `background-ambient`, the
  // only body value vintage does not share with their default — the rest of
  // what makes it vintage is a dark app frame, and olai has no frame.
  {
    name: "vintage",
    scheme: "light",
    colors: {
      paper: "#ECEEF0",
      ink: "#2A3135",
      muted: "#868C90",
      rule: "#DCE0E2",
      accent: "#1C64F2",
      done: "#057A55",
      doing: "#9F580A",
      alarm: "#E02424",
    },
  },
  // The mocha one: plum-black page, lavender ink, pastel accents over it.
  {
    name: "catppuccin",
    scheme: "dark",
    colors: {
      paper: "#1E1E2E",
      ink: "#CDD6F4",
      muted: "#9399B2",
      rule: "#313244",
      accent: "#89B4FA",
      done: "#A6E3A1",
      doing: "#F9E2AF",
      alarm: "#F38BA8",
    },
  },
  // Cocoa and cream: warm paper, near-black cocoa ink. Its rule is the one
  // translucent value in the table, and it is theirs.
  {
    name: "chocolate",
    scheme: "light",
    colors: {
      paper: "#FFEFE2",
      ink: "#281603",
      muted: "#7D5E47",
      rule: "#A1836B53",
      accent: "#1A73E8",
      done: "#2DA044",
      doing: "#C99A00",
      alarm: "#D93636",
    },
  },
  // A phosphor terminal: black page, lime ink. The accents are the ones they
  // hand every dark theme.
  {
    name: "hacker",
    scheme: "dark",
    colors: {
      paper: "#000000",
      ink: "#00FF00",
      muted: "#009900",
      rule: "#005500",
      accent: "#76A9FA",
      done: "#31C48D",
      doing: "#E3A008",
      alarm: "#F98080",
    },
  },
  // Tea powder: green page, darker green ink. EXCEPTION: muted is their
  // `text-quinary`, because matcha writes `text-tertiary` in its primary ink —
  // the rule as stated would leave nothing dim at all.
  {
    name: "matcha",
    scheme: "light",
    colors: {
      paper: "#DDEABE",
      ink: "#415915",
      muted: "#85AC41",
      rule: "#85AC41",
      accent: "#2868A0",
      done: "#3D8828",
      doing: "#A88510",
      alarm: "#C43838",
    },
  },
  // Moonlight: blush paper, lilac ink.
  {
    name: "moon",
    scheme: "light",
    colors: {
      paper: "#FDF6F6",
      ink: "#615F7F",
      muted: "#8B6FA8",
      rule: "#E4D8EA",
      accent: "#6B8BC9",
      done: "#5FA876",
      doing: "#C9A84F",
      alarm: "#C85B5B",
    },
  },
  // Neutral near-black, no hue in the grays at all.
  {
    name: "neo",
    scheme: "dark",
    colors: {
      paper: "#141414",
      ink: "#DCDBDB",
      muted: "#9EA1A2",
      rule: "#242424",
      accent: "#76A9FA",
      done: "#8DBD6A",
      doing: "#F1C068",
      alarm: "#CF4653",
    },
  },
  // The editor palette, by way of their port of it: blue-gray page, muted
  // everything. Its one dim tone is dim on purpose and stays that way.
  {
    name: "one-dark",
    scheme: "dark",
    colors: {
      paper: "#282C33",
      ink: "#C8CCD4",
      muted: "#5D636F",
      rule: "#3B4048",
      accent: "#73ADE9",
      done: "#A1C181",
      doing: "#DFC184",
      alarm: "#D07277",
    },
  },
  // Black steel, orange readout, red frame. Its rule IS its alarm — the frame
  // and the error are one colour in that palette, and pulling them apart would
  // be inventing a value rather than porting one. EXCEPTION: muted is its own
  // `--robot-gray` rather than the `text-tertiary` the rule asks for, which is
  // that same red a third time.
  {
    name: "robot",
    scheme: "dark",
    colors: {
      paper: "#000000",
      ink: "#FEA143",
      muted: "#7A8A8A",
      rule: "#E8393F",
      accent: "#3580D3",
      done: "#4ED8A3",
      doing: "#DFE361",
      alarm: "#E8393F",
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
 * unpicked page reads in the default — which is the one palette that promises
 * AA, so the page nobody has chosen for is the legible one.
 */
export const DEFAULT_THEME: ThemeName = "chalk"

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
 *  renames `chalk` this file stops compiling rather than starting a browser
 *  with no chip lit and no bare `:root` in the sheet. The throw is what says
 *  so to a checker that cannot see it through `find`. */
export const DEFAULT_PALETTE: Palette = (() => {
  const palette = paletteNamed(DEFAULT_THEME)
  if (palette === undefined) {
    throw new Error(`unreachable: no row named ${DEFAULT_THEME}`)
  }
  return palette
})()
