import { intentOf } from "@olai/surface"
import type { Claims } from "@olai/format"
import { createEffect, createMemo, Show } from "solid-js"

import { markdownArrival } from "./chunk.ts"
import { nameDeadLinks } from "./dead-links.ts"
import { renderMarkdown, renderStreaming, renderLineLanding } from "./render.ts"
import { markdownExcerpt } from "./excerpt.ts"
import { escapeSource } from "./tags.ts"
import { waitingFace } from "./waiting.ts"

export function Markdown(props: {
  readonly claims: Claims | undefined
  readonly source: string
  readonly members?: ReadonlySet<string>
  readonly from: string
  readonly class?: string
  readonly testid?: string
  readonly live?: boolean
  readonly excerpt?: { readonly after?: string; readonly blocks: number }
  readonly landing?: { readonly line: number; readonly needles: ReadonlyArray<string> }
}) {
  let container: HTMLDivElement | undefined
  const arrival = createMemo(markdownArrival)
  const rendered = createMemo(() =>
    arrival().kind === "ready"
      ? props.live === true
        ? renderStreaming(props.claims, props.source, props.from)
        : props.landing !== undefined
          ? renderLineLanding(props.claims, props.source, props.from, props.landing.line, props.landing.needles)
          : renderMarkdown(props.claims, props.source, props.from)
      : undefined
  )
  const html = createMemo(() => {
    const value = rendered()
    return value !== undefined && props.excerpt ? markdownExcerpt(value, props.excerpt) : value
  })
  createEffect(() => {
    html()
    const within = container
    if (within !== undefined) nameDeadLinks(within, props.members)
  })
  const face = () => waitingFace(arrival().kind === "waiting")
  const failed = () => {
    const now = arrival()
    return now.kind === "failed" ? now.error : undefined
  }
  const classes = (): string => `olai-md ${props.class ?? ""}`

  return (
    <Show
      when={failed()}
      fallback={
        <div ref={container}
          class={classes()}
          data-testid={props.testid}
          data-markdown={face().mark}
          aria-busy={face().busy}
          onClick={event => {
            if (intentOf(event) === null || !(event.target instanceof Element)) return
            const href = event.target.closest("a[href]")?.getAttribute("href")
            if (!href?.startsWith("#")) return
            event.preventDefault()
            try { container?.querySelector(`#${CSS.escape(decodeURIComponent(href.slice(1)))}`)?.scrollIntoView({ block: "nearest" }) } catch { }
          }}
          innerHTML={html() ?? escapeSource(props.source)}
        />
      }
    >
      {(error) => (
        <div class={classes()} data-testid={props.testid} data-markdown="failed">
          <p class="text-alarm">
            Couldn't format this file, so it's shown as plain text. Reload to
            try again. ({error().message})
          </p>
          <div class="whitespace-pre-wrap">{props.source}</div>
        </div>
      )}
    </Show>
  )
}
