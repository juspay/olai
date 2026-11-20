export const STEP_REM = 0.125

export type Density = "reading" | "compact"

export const DENSITIES: readonly Density[] = ["reading", "compact"]

export const SPACE = {
  reading: {
    none: 0,
    item: 0.25,
    headBottomMinor: 0.5,
    headBottomMajor: 0.75,
    block: 1,
    headTopMinor: 1.5,
    rule: 1.5,
    headTopMajor: 2,
  },
  compact: {
    none: 0,
    item: 0.25,
    headBottomMinor: 0.25,
    headBottomMajor: 0.5,
    block: 0.5,
    headTopMinor: 0.75,
    rule: 1,
    headTopMajor: 1,
  },
} as const satisfies Record<Density, Record<string, number>>

export const PAD = {
  reading: {
    none: 0,
    chipY: 0.125,
    chipX: 0.25,
    headRule: 0.25,
    cellY: 0.375,
    cellX: 0.75,
    fenceY: 0.75,
    fenceX: 1,
    quoteX: 1,
    listX: 1.5,
  },
  compact: {
    none: 0,
    chipY: 0.125,
    chipX: 0.25,
    headRule: 0,
    cellY: 0.25,
    cellX: 0.625,
    fenceY: 0.5,
    fenceX: 0.75,
    quoteX: 0.75,
    listX: 1.25,
  },
} as const satisfies Record<Density, Record<string, number>>

export const TYPE = {
  h1: 2,
  h2: 1.5,
  h3: 1.25,
  h4: 1,
  h5: 0.875,
  h6: 0.875,
} as const

export const UNDER_TITLE = {
  h1: 1,
  h2: 1,
  h3: 1,
} as const

export const RELATIVE = {
  code: 0.875,
  footnotes: 0.875,
  sup: 0.75,
} as const

export const LEADING = {
  heading: 1.25,
  body: 1.5,
  none: 0,
} as const

export const WEIGHT = {
  text: 400,
  heading: 600,
  major: 700,
} as const

export const BORDER_PX = {
  none: 0,
  rule: 1,
  quote: 3,
} as const

export const HEAD_BORDER_PX = {
  reading: BORDER_PX.rule,
  compact: BORDER_PX.none,
} as const satisfies Record<Density, number>

export const ANCHOR_DISPLAY = {
  reading: "inline",
  compact: "none",
} as const satisfies Record<Density, string>

const rem = (value: number): string => `${value}rem`

export const property = (name: string): string => `--olai-md-${name}`

export const BLOCK_CLASS = "olai-md"

export const COMPACT_CLASS = "olai-md-compact"

const densityDeclarations = (density: Density): string[] => [
  ...Object.entries(SPACE[density]).map(
    ([name, size]) => `  ${property(`space-${name}`)}: ${rem(size)};`,
  ),
  ...Object.entries(PAD[density]).map(
    ([name, size]) => `  ${property(`pad-${name}`)}: ${rem(size)};`,
  ),
  `  ${property("border-head")}: ${HEAD_BORDER_PX[density]}px;`,
  `  ${property("anchor-display")}: ${ANCHOR_DISPLAY[density]};`,
]

export const scaleCss = (): string => {
  const base = [
    ...Object.entries(TYPE).map(([level, size]) => `  ${property(level)}: ${rem(size)};`),
    ...Object.entries(RELATIVE).map(([name, factor]) => `  ${property(`of-${name}`)}: ${factor};`),
    ...Object.entries(LEADING).map(([name, ratio]) => `  ${property(`leading-${name}`)}: ${ratio};`),
    ...Object.entries(WEIGHT).map(([name, weight]) => `  ${property(`weight-${name}`)}: ${weight};`),
    ...Object.entries(BORDER_PX).map(
      ([name, width]) => `  ${property(`border-${name}`)}: ${width}px;`,
    ),
    ...densityDeclarations("reading"),
  ]
  const compact = [
    ...Object.entries(UNDER_TITLE).map(([level, size]) => `  ${property(level)}: ${rem(size)};`),
    ...densityDeclarations("compact"),
  ]
  return [
    "/* The markdown type and spacing scales — GENERATED from",
    " * packages/appearance/src/scale.ts. Do not edit: edit the table.",
    " * packages/tests asserts the rendered page against these same values. */",
    `.${BLOCK_CLASS} {\n${base.join("\n")}\n}`,
    `.${COMPACT_CLASS} {\n${compact.join("\n")}\n}`,
    "",
  ].join("\n")
}
