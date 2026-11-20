import { HOSTED_FILES, woff2Name } from "./hosted.ts"

export { fontCss } from "./css.ts"
export { fontPreloadHtml, fontPreloads } from "./preload.ts"
export { FONTS_DIR } from "./hosted.ts"

export const HOSTED_WOFF2: ReadonlyArray<string> = HOSTED_FILES.map((file) =>
  woff2Name(file.file),
)
