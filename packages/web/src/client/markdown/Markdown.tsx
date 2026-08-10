/**
 * Markdown from a file, on the page.
 *
 * The one component that hands rendered HTML to `innerHTML`, so the reason
 * that is safe is written down once, wherever markdown appears: ./render.ts
 * sanitises, and everything it points at — a picture, a footnote, a link into
 * itself — has been narrowed to something this app is willing to draw
 * (./rewrite.ts).
 *
 * `from` is the file the markdown was written in, and it is required rather
 * than optional because a relative picture cannot be resolved without it. A
 * note's is its outline; a document's is itself.
 */

import { createMemo } from "solid-js"

import { renderMarkdown } from "./render.ts"

export function Markdown(props: {
  readonly source: string
  readonly from: string
  readonly class?: string
  readonly testid?: string
}) {
  const html = createMemo(() => renderMarkdown(props.source, props.from))
  return (
    <div
      class={`olai-md ${props.class ?? ""}`}
      data-testid={props.testid}
      // Safe because the pipeline sanitises: see ./render.ts.
      innerHTML={html()}
    />
  )
}
