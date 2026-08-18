/**
 * A title, printed.
 *
 * What the title becomes is decided once, in `./markdown/title.ts` — inline
 * markdown and `#tags` — so a tree row, a zoomed heading, a breadcrumb and a
 * see-link cannot disagree about either. This file is only the element that
 * hands that HTML to the page.
 *
 * A filtered page hands down the words it found the node by, and they are lit
 * inside whatever the title turns out to be — a word, a phrase, or the `#tag`
 * that was pressed. That is a fact about the PAGE rather than about the title,
 * which is why it arrives as a prop from the row rather than being read here:
 * the same title is drawn in a breadcrumb and a see-link, where there is no
 * query to have found anything.
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
  /** The words a filter found this node by, lit where they sit
   *  (`./filter/lit.ts`) — absent on every title an unfiltered page draws, and
   *  on every title drawn for a row the query did not select. */
  readonly needles?: ReadonlyArray<string>
}) {
  const html = createMemo(() =>
    renderTitle(props.title, props.from, {
      links: props.links,
      needles: props.needles,
    }),
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
