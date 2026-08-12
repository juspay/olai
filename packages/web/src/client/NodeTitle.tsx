/**
 * A title, printed.
 *
 * What the title becomes is decided once, in `./markdown/title.ts` — inline
 * markdown and `#tags` — so a tree row, a zoomed heading, a breadcrumb and a
 * see-link cannot disagree about either. This file is only the element that
 * hands that HTML to the page.
 *
 * Decorative for tags, for now. Clicking a tag becomes a filter when the filter
 * machinery exists (docs/brainstorming/viewing-web.md); until then styling one
 * as a link would promise something nothing answers.
 */

import { createMemo } from "solid-js"

import { renderTitle } from "./markdown/title.ts"

export function NodeTitle(props: {
  readonly title: string
  /** The file the title is written in — an outline, for a node. Relative
   *  pictures in a title (rare) resolve against it, same contract as a note. */
  readonly from: string
  /** When false, markdown links are unwrapped so this title can sit inside an
   *  existing `<a>` (breadcrumb, see-ref) without nesting anchors. Default
   *  true — tree rows and zoomed headings keep their links. */
  readonly links?: boolean
}) {
  const html = createMemo(() =>
    renderTitle(props.title, props.from, { links: props.links }),
  )
  return (
    <span
      class="olai-md olai-md-inline"
      // Safe: markdown is sanitised; tags are alphabet-restricted; the empty
      // fallback is escaped. See ./markdown/title.ts and ./markdown/render.ts.
      innerHTML={html()}
    />
  )
}
