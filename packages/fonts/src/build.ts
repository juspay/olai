/**
 * What a client build takes from this package — the sheet, the files, and the
 * one directory both mean.
 *
 * `fontCss()` is the block appended to the built stylesheet. `HOSTED_WOFF2` is
 * what has to sit under `FONTS_DIR` for that block's `src: url(…)` to resolve:
 * the same list, in the same order, named the way the derivation writes them.
 * They are one entry point because they are one obligation — a build that
 * takes the sheet and not the files ships a page whose every face 404s — and
 * because none of it belongs on the entry a browser imports.
 */

import { HOSTED_FILES, woff2Name } from "./hosted.ts"

export { fontCss } from "./css.ts"
export { FONTS_DIR } from "./hosted.ts"

/** Every file the build copies out of `OLAI_FONTS_DIR`, by the name it has
 *  there and under `/fonts/`. */
export const HOSTED_WOFF2: ReadonlyArray<string> = HOSTED_FILES.map((file) =>
  woff2Name(file.file),
)
