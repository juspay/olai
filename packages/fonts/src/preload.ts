import { HOSTED_FILES, FONTS_DIR, woff2Name } from "./hosted.ts"
import { DEFAULT_FONT, FONT_TOKENS, TYPEFACES } from "./typefaces.ts"

const leadingFamily = (stack: string): string =>
  stack.split(",")[0]!.trim().replace(/^"(.*)"$/, "$1")

const regular = (weight: string): boolean => {
  const [low, high] = weight.split(/\s+/).map(Number)
  return high === undefined ? low === 400 : low! <= 400 && high >= 400
}

export const fontPreloads = (): ReadonlyArray<string> => {
  const face = TYPEFACES.find((one) => one.name === DEFAULT_FONT)
  if (face === undefined) return []
  const families = FONT_TOKENS.map((token) => leadingFamily(face[token]))
  return families.flatMap((family) => {
    const file = HOSTED_FILES.find(
      (one) => one.family === family && one.style === "normal" && regular(one.weight),
    )
    return file === undefined ? [] : [woff2Name(file.file)]
  })
}

export const fontPreloadHtml = (): string =>
  fontPreloads()
    .map((name) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="/${FONTS_DIR}/${name}" />`)
    .join("\n")
