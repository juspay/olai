import { FONT_ATTRIBUTE, FONT_STORAGE_KEY } from "@olai/fonts"

import {
  defaultPaletteFor,
  PALETTES,
  type Scheme,
  SYSTEM_SCHEME,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
} from "./palettes.ts"
import { SIZE_ATTRIBUTE, SIZE_STORAGE_KEY } from "./sizes.ts"

export const CANVAS_SELECTOR = 'meta[name="color-scheme"]'

const RESTORED: ReadonlyArray<readonly [key: string, attribute: string]> = [
  [THEME_STORAGE_KEY, THEME_ATTRIBUTE],
  [FONT_STORAGE_KEY, FONT_ATTRIBUTE],
  [SIZE_STORAGE_KEY, SIZE_ATTRIBUTE],
]

const SCHEME_OF: Readonly<Record<string, Scheme>> = Object.fromEntries(
  PALETTES.map((palette) => [palette.name, palette.scheme]),
)

export const bootScript = (): string =>
  [
    "try {",
    "  var root = document.documentElement;",
    `  var restored = ${JSON.stringify(RESTORED)};`,
    "  for (var at = 0; at < restored.length; at += 1) {",
    "    var stored = localStorage.getItem(restored[at][0]);",
    "    if (stored) root.setAttribute(restored[at][1], stored);",
    "  }",
    `  var scheme = ${JSON.stringify(SCHEME_OF)}[localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})];`,
    `  if (scheme) document.querySelector('${CANVAS_SELECTOR}').content = scheme;`,
    "} catch {}",
  ].join("\n")

const themeColour = (scheme: Scheme): string =>
  `<meta name="theme-color" media="(prefers-color-scheme: ${scheme})" content="${defaultPaletteFor(scheme).colors.paper}" />`

export const shellHead = (indent = "    "): string =>
  [
    themeColour("light"),
    themeColour("dark"),
    `<meta name="color-scheme" content="${SYSTEM_SCHEME}" />`,
    "<script>",
    ...bootScript().split("\n").map((line) => `  ${line}`),
    "</script>",
  ]
    .map((line) => `${indent}${line}`)
    .join("\n")
