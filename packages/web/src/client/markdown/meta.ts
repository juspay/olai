/**
 * The one name the page and the build have to agree on.
 *
 * `packages/web/src/markdown.ts` writes `<meta name="olai-markdown"
 * content="/assets/markdown-<hash>.js">` into the shell; ./chunk.ts reads it
 * back to find the file. Neither may spell it itself.
 *
 * It is alone in this file rather than exported from ./chunk.ts for one
 * reason: the build imports it, and ./chunk.ts holds a Solid signal — a
 * constant should not drag the client's reactive runtime into the bundler's
 * own process. `../testids.ts` is here for the same reason one package over.
 */

export const MARKDOWN_META = "olai-markdown"
