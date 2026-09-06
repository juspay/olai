/**
 * A title's drawing, on the page.
 *
 * The title half of what ./Markdown.tsx is for a block, and it exists for the
 * same reason: the element that hands rendered HTML to `innerHTML` is also the
 * element that has to wear the waiting face (./waiting.ts), and those two
 * facts belong to one component rather than to each caller that happens to
 * draw a title.
 *
 * The callers are every surface a TITLE is drawn on as words rather than as
 * a component: `../NodeTitle.tsx` for a tree row, a zoomed heading, a
 * breadcrumb and a see-ref; `../search/Result.tsx` for a palette, search or
 * completion row; and the out-of-page faces — a chat chip, a write's recap,
 * the move picker's heading, the commit panel's rows — where `NodeTitle`'s
 * page-bound address reading does not belong. Before this component they
 * spelled the same four things each: the `olai-md olai-md-inline` pair, the
 * face, the `innerHTML`, and the note saying why that is safe. A third title
 * surface spelling three of the four is how a page starts flashing marks the
 * rest of the app does not.
 *
 * WHAT IS SAFE ABOUT `innerHTML` is ../markdown/render.ts's: the pipeline
 * sanitises, tags are alphabet-restricted, and the source this falls back to
 * is escaped (./title.ts). The one thing this component adds is that a caller
 * cannot draw the html without the state it came with, because it takes the
 * DRAWING rather than a string.
 */

import type { TitleDrawing } from "./title.ts"
import { busyMark, waitingMark } from "./waiting.ts"

export function TitleHtml(props: {
  /** What ./title.ts answered — the HTML and which rung of the ladder it came
   *  from. Taken whole, so the face cannot be forgotten. */
  readonly drawing: TitleDrawing
  /** Additional classes the caller's layout needs (`min-w-0 flex-1 truncate`
   *  in a search row). The markdown classes are this component's. */
  readonly class?: string
  /** As `class`, but per-class: the caller's extra toggles. */
  readonly classList?: Record<string, boolean>
}) {
  return (
    <span
      // `class` covers the layout claims; `classList` the behavioural ones
      // that go on the same element — Solid applies both.
      class={`olai-md olai-md-inline ${props.class ?? ""}`}
      classList={props.classList}
      // Blurred and swept while the title is its own source, so a title with
      // marks in it is never READ as marks — the same face a note and a
      // document body wear (./waiting.ts, ../styles.css). The same element
      // throughout: what the pipeline landing does to this row is take the
      // blur off, not redraw it.
      data-markdown={waitingMark(props.drawing.waiting)}
      aria-busy={busyMark(props.drawing.waiting)}
      innerHTML={props.drawing.html}
    />
  )
}
