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
  readonly name: string
  readonly scheme: Scheme
  readonly aa: true
  readonly colors: Readonly<Record<PaletteToken, string>>
}

const TABLE = [
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

export type ThemeName = (typeof TABLE)[number]["name"]

export const PALETTES: ReadonlyArray<Palette> = TABLE

export const THEME_NAMES: ReadonlyArray<ThemeName> = TABLE.map(
  (palette) => palette.name,
)

export const DEFAULT_THEME: ThemeName = "chalk"

export const DEFAULT_DARK_THEME: ThemeName = "basalt"

export const THEME_ATTRIBUTE = "data-theme"

export const THEME_STORAGE_KEY = "olai.theme"

export const SYSTEM_SCHEME = "light dark"

export const paletteNamed = (name: string): Palette | undefined =>
  PALETTES.find((palette) => palette.name === name)

const mustExist = (name: ThemeName): Palette => {
  const palette = paletteNamed(name)
  if (palette === undefined) {
    throw new Error(`unreachable: no row named ${name}`)
  }
  return palette
}

export const DEFAULT_PALETTE: Palette = mustExist(DEFAULT_THEME)

export const DEFAULT_DARK_PALETTE: Palette = mustExist(DEFAULT_DARK_THEME)

export const defaultPaletteFor = (scheme: Scheme): Palette =>
  scheme === "dark" ? DEFAULT_DARK_PALETTE : DEFAULT_PALETTE
