import { intentOf } from "@olai/surface"
import { deadLinkSaid, type Claims } from "@olai/format"
import { createEffect, createMemo, Show } from "solid-js"

import { markdownFailure, markdownReady, markdownWaiting } from "./chunk.ts"
import { renderMarkdown, renderStreaming, renderLineLanding } from "./render.ts"
import { markdownExcerpt } from "./excerpt.ts"
import { escapeHtml } from "./tags.ts"
import { busyMark, waitingMark } from "./waiting.ts"

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
  const rendered = createMemo(() =>
    markdownReady()
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
    const members = props.members
    for (const link of container?.querySelectorAll<HTMLAnchorElement>("a[data-link-path]") ?? []) {
      const path = link.dataset["linkPath"]!
      const dead = members !== undefined && !members.has(path)
      link.classList.toggle("olai-dead-link", dead)
      if (dead) link.setAttribute("data-dead", "true")
      else link.removeAttribute("data-dead")
      const authored = link.dataset["linkTitle"] ?? ""
      if (authored) link.title = authored
      else link.removeAttribute("title")
      if (dead) {
        const warning = deadLinkSaid({ written: link.dataset["linkWritten"]!, resolved: path, suggest: [] })
        const words = (link.textContent ?? "").trim()
        link.setAttribute("aria-label", words === "" ? warning : `${words} — ${warning}`)
      } else link.removeAttribute("aria-label")
    }
  })
  const waiting = markdownWaiting
  const classes = (): string => `olai-md ${props.class ?? ""}`

  return (
    <Show
      when={markdownFailure()}
      fallback={
        <div ref={container}
          class={classes()}
          data-testid={props.testid}
          data-markdown={waitingMark(waiting())}
          aria-busy={busyMark(waiting())}
          onClick={event => {
            if (intentOf(event) === null || !(event.target instanceof Element)) return
            const href = event.target.closest("a[href]")?.getAttribute("href")
            if (!href?.startsWith("#")) return
            event.preventDefault()
            try { container?.querySelector(`#${CSS.escape(decodeURIComponent(href.slice(1)))}`)?.scrollIntoView({ block: "nearest" }) } catch { }
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
