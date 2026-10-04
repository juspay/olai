import { createMemo, Show } from "solid-js"
import { proseIn } from "@olai/format"
import type { Route } from "olai-plugin-navigation/contract"
import { markdownReady } from "@olai/markdown-ui/chunk.ts"
import { renderMarkdown, landingId } from "@olai/markdown-ui/render.ts"
import { isServed, useDocument } from "./document/documents.tsx"
import { servedDirectory } from "./vault.ts"

/** Cut the sanitized, rendered body at the actual heading ids. This shares
 * duplicate-heading and fenced-code semantics with the document renderer. */
export function MarkdownLinkPreview(props: { readonly route: Route }) {
  const address = () => props.route.kind === "at" && props.route.address?.kind !== "node" ? props.route.address : null
  const file = () => address()?.path ?? ""
  const entry = useDocument(file)
  const section = createMemo(() => {
    const body = entry()
    if (!isServed(body) || !markdownReady()) return undefined
    const template = document.createElement("template")
    template.innerHTML = renderMarkdown(servedDirectory()?.claims(), proseIn(body.text), file())
    const at = address()
    const heading = at?.kind === "heading" ? [...template.content.querySelectorAll("h1,h2,h3,h4,h5,h6")].find(h => h.id === landingId(proseIn(body.text), file(), at.slug)) : undefined
    if (at?.kind === "heading" && !heading) return { missing: true, html: "", title: at.slug }
    const title = heading?.textContent?.replace(/^#\s*/, "") ?? file()
    const nodes = [...template.content.children]
    const start = heading ? nodes.indexOf(heading) + 1 : 0
    const selected: Element[] = []
    for (const node of nodes.slice(start)) {
      if (heading && /^H[1-6]$/.test(node.tagName) && node.tagName <= heading.tagName) break
      selected.push(node)
      if (selected.length === 3) break
    }
    return { missing: false, title, html: selected.map(node => node.outerHTML).join("") }
  })
  const missing = () => servedDirectory()?.members().has(file()) === false || section()?.missing
  return <>
    <div class="text-xs text-muted">{file()}</div>
    <Show when={!missing()} fallback={<><strong>Nothing at {file()}{address()?.kind === "heading" ? `#${(address() as {slug: string}).slug}` : ""}</strong><p class="text-sm text-muted">The document or heading is missing.</p></>}>
      <strong>{section()?.title ?? file()}</strong>
      <div class="olai-md olai-md-compact max-h-56 overflow-hidden" innerHTML={section()?.html ?? ""} />
      <Show when={!entry()}><p class="text-xs text-muted">Reading…</p></Show>
      <Show when={entry()?.refused}><p class="text-sm text-alarm">This document could not be read.</p></Show>
    </Show>
  </>
}
