/**
 * THE FACES A PAGE FETCHES BEFORE IT NEEDS THEM — the default typeface's
 * upright, regular-weight files, one per voice.
 *
 * A hosted face is `font-display: swap`: the page paints in a fallback and
 * reflows when the file lands. That is the right choice for a face nobody is
 * sure of, and the wrong experience for the one every page reads in — a
 * landing measured in the fallback's metrics (a search hit scrolled to the top
 * of the window, a `#heading` somebody pasted) is somewhere else once the
 * real face arrives, and a reader who scrolled to the foot of a document is
 * no longer at it. On a machine with no fonts of its own the fallback is
 * whatever is installed, and the reflow is hundreds of pixels.
 *
 * So the shell asks for these three files at the top of the document, before
 * anything on the page has used them, and the first text set in them is set
 * in them. Only the default typeface's, and only its regular uprights: a pick
 * is a pick, made after the page is up, and bold and italic are a document's
 * occasional words.
 */
import { HOSTED_FILES, FONTS_DIR, woff2Name } from "./hosted.ts"
import { DEFAULT_FONT, FONT_TOKENS, TYPEFACES } from "./typefaces.ts"

/** The first family a stack names, unquoted — the hosted one, when there is
 *  one; a generic stack (`ui-monospace, …`) names nothing hosted. */
const leadingFamily = (stack: string): string =>
  stack.split(",")[0]!.trim().replace(/^"(.*)"$/, "$1")

/** Whether a face's declared weight covers regular — `400`, or a variable
 *  range that spans it. */
const regular = (weight: string): boolean => {
  const [low, high] = weight.split(/\s+/).map(Number)
  return high === undefined ? low === 400 : low! <= 400 && high >= 400
}

/** The woff2 basenames to preload, in the order of the voices that use them. */
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

/** The `<link rel="preload">` lines a shell's head carries for them.
 *  `crossorigin` because a font fetch is always CORS-mode, and a preload
 *  without it is a second fetch rather than the one the sheet will reuse. */
export const fontPreloadHtml = (): string =>
  fontPreloads()
    .map((name) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="/${FONTS_DIR}/${name}" />`)
    .join("\n")
