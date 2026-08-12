/**
 * Markdown from a file, on the page — a note, a document, or the agent.
 *
 * Titles go through the same pipeline forced to phrasing content
 * (`renderTitle` → `renderToTree` in ./title.ts / ./render.ts), drawn by
 * `NodeTitle` rather than this component, because a title is not a block of
 * prose.
 *
 * The one component that hands full rendered HTML to `innerHTML`, so the
 * reason that is safe is written down once, wherever markdown appears:
 * ./render.ts sanitises, and everything it points at — a picture, a footnote,
 * a link into itself — has been narrowed to something this app is willing to
 * draw (./rewrite.ts).
 *
 * `from` is the file the markdown was written in, and it is required rather
 * than optional because a relative picture cannot be resolved without it. A
 * note's is its outline; a document's is itself; the agent's is the EMPTY
 * string, which resolves against the served directory itself — the agent was
 * started there, so that is what a relative path in what it says is relative
 * to, and there is no file to name because it did not write one.
 */

import { createMemo } from "solid-js"

import { renderMarkdown, renderStreaming } from "./render.ts"

export function Markdown(props: {
  readonly source: string
  readonly from: string
  readonly class?: string
  readonly testid?: string
  /** This text is still arriving, so it is rendered but not CACHED: every
   *  prefix of a growing answer is a string that will never be asked for
   *  again. See ./render.ts. */
  readonly live?: boolean
}) {
  const html = createMemo(() =>
    props.live === true
      ? renderStreaming(props.source, props.from)
      : renderMarkdown(props.source, props.from)
  )
  return (
    <div
      class={`olai-md ${props.class ?? ""}`}
      data-testid={props.testid}
      // Safe because the pipeline sanitises: see ./render.ts.
      innerHTML={html()}
    />
  )
}
