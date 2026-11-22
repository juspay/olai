import { intentOf } from "@olai/surface"
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
import type { Claims, Names } from "@olai/format"
import { createComponent, createEffect, createMemo, createRoot, getOwner, type JSX, onCleanup, Show } from "solid-js"
import { insert } from "solid-js/web"

import { markdownFailure, markdownReady, markdownWaiting } from "./chunk.ts"
import { renderMarkdown, renderStreaming, renderLineLanding } from "./render.ts"
import { markdownExcerpt } from "./excerpt.ts"
import { escapeHtml } from "./tags.ts"
import { busyMark, waitingMark } from "./waiting.ts"
import { applyLink } from "./rewrite/links.ts"
import { BLOCK_ATTRIBUTE } from "./rewrite/blocks.ts"
import { applyWikilink } from "./wikilinks.ts"

/**
 * A DRAWING FOR A FENCE — what a caller hands {@link Markdown} for a language,
 * mounted into each fence in that language. It is handed the fence's text as
 * written and the file the text is in.
 */
export type FenceFace = (props: { readonly text: string; readonly file: string }) => JSX.Element

/** One set of languages per map of drawings, compared by what it holds, so a
 *  map rebuilt with the same languages renders nothing again. */
const sameLanguages = (a: ReadonlySet<string> | undefined, b: ReadonlySet<string> | undefined): boolean =>
  a === b || (a !== undefined && b !== undefined && a.size === b.size && [...a].every((one) => b.has(one)))

export function Markdown(props: {
  readonly claims: Claims | undefined
  readonly source: string
  /** The directory's name index, which holds its membership too: identity
   *  changes only when a path arrives or leaves. */
  readonly names?: Names
  readonly from: string
  readonly class?: string
  readonly testid?: string
  /** This text is still arriving, so it is rendered but not CACHED: every
   *  prefix of a growing answer is a string that will never be asked for
   *  again. See ./render.ts. */
  readonly live?: boolean
  /** A clipped document/section face, using the same decoration and states. */
  readonly excerpt?: { readonly after?: string; readonly blocks: number }
  readonly landing?: { readonly line: number; readonly needles: ReadonlyArray<string> }
  /**
   * A drawing per fence language. A fence in one of these languages is drawn
   * by its face rather than as code: the render makes it a placeholder holding
   * the fence's text (`./rewrite/blocks.ts`), and each face is mounted into its
   * placeholder and disposed whenever the HTML is replaced, the map changes, or
   * this component goes. A page that hands no map draws every fence as code.
   */
  readonly fences?: ReadonlyMap<string, FenceFace>
}) {
  let container: HTMLDivElement | undefined
  const fenceLanguages = createMemo(
    () => props.fences === undefined || props.fences.size === 0 ? undefined : new Set(props.fences.keys()),
    undefined,
    { equals: sameLanguages },
  )
  // `markdownReady()` both answers and asks — reading it here is what starts
  // the fetch, and what re-runs this memo when the file lands.
  const rendered = createMemo(() =>
    markdownReady()
      ? props.live === true
        ? renderStreaming(props.claims, props.source, props.from)
        : props.landing !== undefined
          ? renderLineLanding(props.claims, props.source, props.from, props.landing.line, props.landing.needles, undefined, fenceLanguages())
          : renderMarkdown(props.claims, props.source, props.from, undefined, fenceLanguages())
      : undefined
  )
  const html = createMemo(() => {
    const value = rendered()
    return value !== undefined && props.excerpt ? markdownExcerpt(value, props.excerpt) : value
  })
  // The directory's name index changes link decoration, never the rendered
  // selection/details state. Both loops write what the rewrite pass wrote into
  // the tree, from the same answer it drew it from (./rewrite/links.ts,
  // ./wikilinks.ts) — the marks it left behind are what each link is found and
  // redrawn by.
  createEffect(() => {
    html()
    const names = props.names
    const claims = props.claims
    const from = props.from
    // A STANDARD LINK'S ADDRESS CANNOT MOVE: it is a path, resolved once when
    // the prose was rendered. What the index decides is whether anything is
    // served under it, so what is redrawn here is the dead mark and the name
    // that carries its reason — asked of the href as written, which is the
    // mark each link carries.
    for (const link of container?.querySelectorAll<HTMLAnchorElement>("a[data-link-written]") ?? []) {
      applyLink(link, claims, names, from)
    }
    // A WIKILINK FINDS ITS FILE BY NAME, so a file arriving or leaving can
    // heal one, kill one or re-aim one at a nearer namesake. Each is brought
    // in step here, in place — the prose is not rendered again, so a reader's
    // selection and the folds around it stay where they were.
    for (const link of container?.querySelectorAll<HTMLElement>("[data-wikilink]") ?? []) {
      applyWikilink(link, claims, names, from)
    }
  })
  // EACH CLAIMED FENCE'S DRAWING, mounted into its placeholder under this
  // component's owner, so it reads the page's context and goes with it. All
  // of them are disposed before the next set is mounted: a placeholder the new
  // HTML replaced is gone, and one that survived is mounted afresh from the
  // text it still holds — the fallback code block is hidden, never removed.
  const owner = getOwner()
  let mounted: Array<() => void> = []
  const unmount = (): void => {
    for (const stop of mounted) stop()
    mounted = []
  }
  onCleanup(unmount)
  createEffect(() => {
    html()
    const faces = props.fences
    const file = props.from
    unmount()
    if (faces === undefined) return
    for (const placeholder of container?.querySelectorAll<HTMLElement>(`[${BLOCK_ATTRIBUTE}]`) ?? []) {
      const Face = faces.get(placeholder.getAttribute(BLOCK_ATTRIBUTE) ?? "")
      if (Face === undefined) continue
      const code = placeholder.firstElementChild
      const text = code?.textContent ?? ""
      const host = document.createElement("div")
      code?.setAttribute("hidden", "")
      placeholder.append(host)
      const dispose = createRoot((dispose) => {
        insert(host, () => createComponent(Face, { text, file }))
        return dispose
      }, owner)
      mounted.push(() => {
        dispose()
        host.remove()
        code?.removeAttribute("hidden")
      })
    }
  })
  /** Is this block still WAITING on the renderer — the arrival's own answer
   *  (./chunk.ts), not `html() === undefined`, which is "not rendered" and is
   *  true of a page whose renderer failed as well. The two agree inside this
   *  branch, since the `<Show>` above sends a failure the other way; reading
   *  the one answer is what stops that agreement being a thing somebody has to
   *  keep true. ./title.ts reads the same signal for the same reason. */
  const waiting = markdownWaiting
  const classes = (): string => `olai-md ${props.class ?? ""}`

  return (
    <Show
      when={markdownFailure()}
      fallback={
        <div ref={container}
          // The SAME element either way — nothing remounts when the rendering
          // replaces the source, so nothing on the page moves but the words
          // themselves. What it LOOKS like while it waits, down to its
          // `pre-wrap`, is the sheet's (../styles.css).
          class={classes()}
          data-testid={props.testid}
          // The waiting face, which every surface holding unrendered source
          // wears (./waiting.ts, ../styles.css) — this element rather than a
          // wrapper, because what the rule blurs is what is inside it.
          data-markdown={waitingMark(waiting())}
          aria-busy={busyMark(waiting())}
          // Safe because the pipeline sanitises (see ./render.ts), and because
          // the text of the file it came from is escaped when there is no
          // pipeline yet.
          onClick={event => {
            if (intentOf(event) === null || !(event.target instanceof Element)) return
            // The sanitiser keeps neither `download` nor `target` on a `#` link.
            const href = event.target.closest("a[href]")?.getAttribute("href")
            if (!href?.startsWith("#")) return
            event.preventDefault()
            try { container?.querySelector(`#${CSS.escape(decodeURIComponent(href.slice(1)))}`)?.scrollIntoView({ block: "nearest" }) } catch { /* malformed local fragment */ }
          }}
          innerHTML={html() ?? escapeHtml(props.source)}
        />
      }
    >
      {(failed) => (
        <div class={classes()} data-testid={props.testid} data-markdown="failed">
          <p class="text-alarm">
            Couldn't format this file, so it's shown as plain text. Reload to
            try again. ({failed().message})
          </p>
          <div class="whitespace-pre-wrap">{props.source}</div>
        </div>
      )}
    </Show>
  )
}
