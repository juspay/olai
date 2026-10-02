/** Maintained composition fixture, disabled in every normal bundle. It uses
 * only contracts and the navigation outlet: content implementations do not
 * know which layout owns their seat. No sidebar, geometry or app frame. */
import { definePlugin } from "@olai/plugin-api"
import { atFile } from "olai-plugin-navigation/routes"
import { Effect } from "effect"
import { navigation, content } from "olai-plugin-navigation/contract"
import { rendererSlots, root } from "olai-plugin-ui-renderer/contract"
import { For, Show, createMemo, createSignal } from "solid-js"
import { shownRecord, type Row } from "@olai/format"
import { pageView, type PageBodyProps } from "olai-plugin-outlines/contract"
import { name } from "./index.ts"

export default definePlugin({ name, needs: [rendererSlots, navigation], apply: Effect.gen(function*() {
  const slots = yield* rendererSlots
  const nav = yield* navigation
  yield* slots.contribute(root, () => {
    const [probe, setProbe] = createSignal(false)
    return <main aria-label="Alternate layout fixture" class="mx-auto max-w-3xl p-6">
    <header class="mb-6 flex gap-4 border-b border-rule pb-4">
      <strong>Content under another layout</strong>
      <button type="button" onClick={() => setProbe(true)}>Measure outline bindings</button>
      <button type="button" onClick={() => nav.go(atFile("house.olai"))}>Open outline fixture</button>
      <button type="button" onClick={() => nav.go(atFile("finishes.md"))}>Open Markdown fixture</button>
    </header>
    <Show when={probe()} fallback={nav.page(0)}>
      <For each={slots.read(pageView)}>{entry => entry.value({ render: body => <BindingProbe page={body.page} drawn={body.drawn} held={body.held} today={body.today} /> })}</For>
    </Show>
  </main>
  }, { children: [content] })
}) })


/** The production PageView supplies these rows after done/filter pruning.
 * Counts live outside row owners, so remounting cannot reset the evidence. */
function BindingProbe(props: PageBodyProps) {
  const runs = new Map<string, number>()
  const RowProbe = (props: { row: Row }) => {
    const read = createMemo(() => {
      const node = shownRecord(props.row).node
      const title = "title" in node ? node.title : node.id
      const count = (runs.get(shownRecord(props.row).node.id) ?? 0) + 1
      runs.set(shownRecord(props.row).node.id, count)
      return { title, count }
    })
    return <div>
      <output data-probe-row={shownRecord(props.row).node.id} data-probe-runs={read().count}>{read().title}</output>
      <For each={props.row.children}>{row => <RowProbe row={row} />}</For>
    </div>
  }
  return <section aria-label="Outline binding counts"><For each={props.drawn.kind === "tree" ? props.drawn.rows : []}>{row => <RowProbe row={row} />}</For></section>
}
