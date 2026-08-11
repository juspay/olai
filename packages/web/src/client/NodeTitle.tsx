/**
 * A title, printed.
 *
 * Two view-time concerns, and both stay here so a tree row and a zoomed page's
 * heading cannot disagree about either of them:
 *
 *   - **inline markdown** — bold, links, code — through the same sanitised
 *     pipeline a note and a document use (`./markdown/`), forced to phrasing
 *     content only so a heading or a fence cannot break the row's layout.
 *   - **`#tags`** — still live in the title verbatim (the format stores no tag
 *     list), split out before the markdown pass so a tag is a styled span and
 *     not a markdown heading (a heading needs a space after `#`; a tag does
 *     not, but the split keeps the two languages from arguing).
 *
 * Decorative for tags, for now. Clicking a tag becomes a filter when the filter
 * machinery exists (docs/brainstorming/viewing-web.md); until then styling one
 * as a link would promise something nothing answers.
 */

import { titleParts } from "@olai/format"
import { For, Show } from "solid-js"

import { renderInlineMarkdown } from "./markdown/render.ts"
import { TESTID } from "./testids.ts"

export function NodeTitle(props: {
  readonly title: string
  /** The file the title is written in — an outline, for a node. Relative
   *  pictures in a title (rare) resolve against it, same contract as a note. */
  readonly from: string
}) {
  return (
    <For each={titleParts(props.title)}>
      {(part) =>
        part.kind === "tag"
          ? (
            <span class="font-semibold text-accent" data-testid={TESTID.tag}>
              #{part.tag}
            </span>
          )
          : (
            <Show when={part.text.length > 0 ? part.text : undefined}>
              {(text) => (
                <span
                  class="olai-md olai-md-inline"
                  // Safe: same pipeline as notes/docs, forced inline.
                  innerHTML={renderInlineMarkdown(text(), props.from)}
                />
              )}
            </Show>
          )}
    </For>
  )
}
