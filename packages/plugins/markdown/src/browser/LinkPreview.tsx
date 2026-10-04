import { createMemo, Show } from "solid-js"
import { Markdown } from "@olai/markdown-ui/Markdown.tsx"
import { proseIn } from "@olai/format"
import type { Route } from "olai-plugin-navigation/contract"
import { markdownReady } from "@olai/markdown-ui/chunk.ts"
import { outlineOf, landingId } from "@olai/markdown-ui/render.ts"
import { isServed, useDocument } from "./document/documents.tsx"
import { servedDirectory } from "./vault.ts"

/** Cut the sanitized, rendered body at the actual heading ids. This shares
 * duplicate-heading and fenced-code semantics with the document renderer. */
export function MarkdownLinkPreview(props: { readonly route: Route }) {
  const address = () => props.route.kind === "at" && props.route.address?.kind !== "node" ? props.route.address : null
  const file = () => address()?.path ?? ""
  const entry = useDocument(file)
  const text = () => { const body = entry(); return isServed(body) ? proseIn(body.text) : "" }
  const section = createMemo(() => {
    const body = entry()
    if (!isServed(body) || !markdownReady()) return undefined
    const at = address()
    const heading = at?.kind === "heading" ? landingId(proseIn(body.text), file(), at.slug) : undefined
    const found = heading === undefined ? undefined : outlineOf(servedDirectory()?.claims(), text(), file()).find(item => item.id === heading)
    return { heading, missing: heading !== undefined && !found, title: found?.text.replace(/^#\s*/, "") ?? file() }
  })
  const missing = () => servedDirectory()?.members().has(file()) === false || section()?.missing
  return <>
    <div class="text-xs text-muted">{file()}</div>
    <Show when={!missing()} fallback={<><strong>Nothing at {file()}{address()?.kind === "heading" ? `#${(address() as {slug: string}).slug}` : ""}</strong><p class="text-sm text-muted">The document or heading is missing.</p></>}>
      <strong>{section()?.title ?? file()}</strong>
      <Markdown claims={servedDirectory()?.claims()} members={servedDirectory()?.members()} from={file()}
        source={text()} excerpt={{ after: section()?.heading, blocks: 3 }}
        class="olai-md-compact max-h-56 overflow-hidden" />
      <Show when={!entry()}><p class="text-xs text-muted">Reading…</p></Show>
      <Show when={entry()?.refused}><p class="text-sm text-alarm">This document could not be read.</p></Show>
    </Show>
  </>
}
