/** A card owns this reading; none of the pane's edit callbacks or editor
 * memories enter this subtree. Rows are keyed by their stable placement key. */
import { createMemo, createEffect, For, Show } from "solid-js"
import { type Row, printAddress } from "@olai/format"
import { atNode } from "olai-plugin-navigation/routes"
import type { Route } from "olai-plugin-navigation/contract"
import { createReading, ReadingProvider } from "./reading.tsx"
import { createDeclared } from "./declared.ts"
import { NodeTitle } from "./NodeTitle.tsx"
import { Note } from "./Note.tsx"

export function OutlineLinkPreview(props: { readonly route: Route }) {
  const address = () => props.route.kind === "at" ? props.route.address : null
  // No wire face offers bounded top-level rows plus a count. Whole-outline
  // cards retain the page lease; qualified rows use only the zoomed node face.
  const reading = createReading(() => { const at = address(); return at?.kind === "row" ? atNode(at.id) : { kind: "at", address: at } })
  const named = createDeclared()
  const id = () => { const at = address(); return at?.kind === "node" || at?.kind === "row" ? at.id : undefined }
  createEffect(() => named.want(id() ? [id()!] : []))
  const shown = () => reading.page()?.shows
  const subject = createMemo(() => {
    const page = shown()
    const at = address()
    if (page?.kind === "node" && page.zoomed.kind === "node"
      && (at?.kind !== "row" || page.zoomed.shows.file === at.path)) return page.zoomed
    return undefined
  })
  const rows = () => {
    const at = address(), page = shown()
    return subject()?.children ?? (page?.kind === "outline" && at?.kind === "document" ? page.rows : [])
  }
  const file = () => { const at = address(); return subject()?.shows.file ?? (at && at.kind !== "node" ? at.path : "") }
  const missing = () => !reading.pending() && reading.page() !== undefined && !subject()
    && (shown()?.kind !== "outline" || address()?.kind === "row")
  return <ReadingProvider reading={reading}>
    <Show when={!missing()} fallback={<><strong>Nothing at {address() ? printAddress(address()!) : "this link"}</strong><p class="text-sm text-muted">The target is missing or cannot be resolved.</p></>}>
      <div class="mb-1 text-xs text-muted">{file()}{subject()?.trail.map(parent => ` › ${parent.node.title}`).join("")}</div>
      <div class="font-semibold"><NodeTitle title={subject()?.shows.node.title ?? (id() ? named.title(id()!) ?? `#${id()}` : file())} from={file()} /></div>
      <Show when={subject()}>{node => <>
        <div class="my-1 flex gap-2 text-xs text-muted">
          <Show when={node().status}><span class="rounded border border-rule/60 px-1">{node().status}</span></Show>
          <Show when={node().status}>{status => <span>{node().shows.node[status()]}</span>}</Show>
          <Show when={node().shows.node.date}><span>{node().shows.node.date}</span></Show>
          <Show when={node().progress}>{progress => <span>{progress().done}/{progress().total} done</span>}</Show>
        </div>
        <Show when={node().shows.node.desc}>{desc => <Note desc={desc()} from={file()} class="line-clamp-3" />}</Show>
      </>}</Show>
      <PreviewChildren rows={rows()} />
      <Show when={reading.pending()}><p class="text-xs text-muted">Reading…</p></Show>
    </Show>
    <Show when={reading.failure()}>{failure => <p class="text-sm text-alarm">{failure().message}</p>}</Show>
  </ReadingProvider>
}
function PreviewChildren(props: { readonly rows: ReadonlyArray<Row> }) {
  const keys = createMemo(() => props.rows.slice(0, 3).map(row => row.key))
  return <><ul class="mt-2 space-y-1 text-sm"><For each={keys()}>{key => {
    const row = () => props.rows.find(row => row.key === key)!
    const title = () => { const item = row(); return item.kind === "node" || item.kind === "mirror" ? item.shows.node.title : "Missing target" }
    return <li class="flex gap-2"><span class="text-muted">{row().status ?? "•"}</span><NodeTitle title={title()} from={row().at.file} /></li>
  }}</For></ul><Show when={props.rows.length > 3}><p class="mt-1 text-xs text-muted">+{props.rows.length - 3} more</p></Show></>
}
