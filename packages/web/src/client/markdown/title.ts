/**
 * A node's title, as safe HTML.
 *
 * Two view-time concerns that belong together because they share one string:
 * the title is stored verbatim, and both the markdown and the `#tags` in it
 * are decided only when it is drawn. One function answers both, so a tree row
 * and a zoomed heading cannot disagree about either.
 *
 *   - **inline markdown** through {@link renderInlineMarkdown} — same pipeline
 *     a note uses, forced to phrasing content so a block cannot break a row.
 *   - **`#tags`**, peeled by `titleParts` before that pass, so a tag is a
 *     styled span and not something markdown gets to re-interpret.
 *
 * The result is handed to `innerHTML` by {@link ../NodeTitle.tsx}; everything
 * that is not a tag has already been through the sanitiser.
 */

import { titleParts } from "@olai/format"

import { TESTID } from "../testids.ts"
import { renderInlineMarkdown } from "./render.ts"

/**
 * The class a styled tag wears. A complete string literal so Tailwind's content
 * scan still finds both utilities when the markup is built as HTML rather than
 * as a Solid element.
 */
const TAG_CLASS = "font-semibold text-accent"

/** One title → one HTML string, safe for `innerHTML`. */
export const renderTitle = (title: string, from: string): string =>
  titleParts(title)
    .map((part) => {
      if (part.kind === "tag") {
        // The tag alphabet is `[A-Za-z0-9_/-]+`, so the body needs no escape;
        // the `#` is the same character the format stores.
        return `<span class="${TAG_CLASS}" data-testid="${TESTID.tag}">#${part.tag}</span>`
      }
      return renderText(part.text, from)
    })
    .join("")

/**
 * Markdown a text run of the title, keeping the spaces the parser would trim.
 *
 * `titleParts` leaves the space before a tag on the text run ("kitchen remodel
 * " then `#home`). A paragraph of markdown drops trailing whitespace, and
 * without it the tag butts against the word. The edges stay outside the
 * pipeline; only the core is rendered.
 */
const renderText = (text: string, from: string): string => {
  if (text.length === 0) return ""
  const match = /^(?<lead>\s*)(?<core>[\s\S]*?)(?<trail>\s*)$/.exec(text)
  if (match === null || match.groups === undefined) return text
  const { lead, core, trail } = match.groups
  if (core === undefined || core.length === 0) return text
  return `${lead ?? ""}${renderInlineMarkdown(core, from)}${trail ?? ""}`
}
