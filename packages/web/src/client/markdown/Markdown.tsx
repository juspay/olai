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
 *
 * ## Before the pipeline arrives, and if it never does
 *
 * Mounting this is what RUNS the markdown machinery (./chunk.ts); the shell
 * has already fetched it. Until it lands, what is on the page is the file's
 * own text, set `pre-wrap` so its lines are its lines — and BLURRED out of
 * legibility, swept, by the one rule every waiting surface wears
 * (`[data-markdown="waiting"]` in ../styles.css).
 *
 * The text is what makes that honest. The box is the size the real characters
 * make, so the swap is a de-blur and the block itself moves nowhere; a
 * skeleton of invented gray bars would be a guess at a height, and a spinner
 * or a blank would be neither the shape nor the words. What no reader gets is
 * a frame of raw `**` and `[](…)`, which is what this used to paint on every
 * first render, cache or no cache (roadmap `markdown-raw-flash`).
 *
 * A fetch that fails says so, above that same text. It is the one place in the
 * app that can say it: a title's fallback is a title either way, but a
 * document whose renderer never came would otherwise be a page of source with
 * no explanation.
 */

import { createMemo, Show } from "solid-js"

import { markdownFailure, markdownReady } from "./chunk.ts"
import { renderMarkdown, renderStreaming } from "./render.ts"
import { escapeHtml } from "./tags.ts"
import { busyMark, waitingMark } from "./waiting.ts"

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
  // `markdownReady()` both answers and asks — reading it here is what starts
  // the fetch, and what re-runs this memo when the file lands.
  const html = createMemo(() =>
    markdownReady()
      ? props.live === true
        ? renderStreaming(props.source, props.from)
        : renderMarkdown(props.source, props.from)
      : undefined
  )
  const waiting = (): boolean => html() === undefined
  const classes = (): string => `olai-md ${props.class ?? ""}`

  return (
    <Show
      when={markdownFailure()}
      fallback={
        <div
          class={classes()}
          // The SAME element either way, dressed differently — nothing
          // remounts when the rendering replaces the source, so nothing on the
          // page moves but the words themselves.
          classList={{ "whitespace-pre-wrap": waiting() }}
          data-testid={props.testid}
          // The waiting face, which every surface holding unrendered source
          // wears (./waiting.ts, ../styles.css) — this element rather than a
          // wrapper, because what the rule blurs is what is inside it.
          data-markdown={waitingMark(waiting())}
          aria-busy={busyMark(waiting())}
          // Safe because the pipeline sanitises (see ./render.ts), and because
          // the text of the file it came from is escaped when there is no
          // pipeline yet.
          innerHTML={html() ?? escapeHtml(props.source)}
        />
      }
    >
      {(failed) => (
        <div class={classes()} data-testid={props.testid} data-markdown="failed">
          <p class="text-alarm">
            {failed().message} — this is the file's own text, unrendered.
            Reloading is the way to try again.
          </p>
          <div class="whitespace-pre-wrap">{props.source}</div>
        </div>
      )}
    </Show>
  )
}
