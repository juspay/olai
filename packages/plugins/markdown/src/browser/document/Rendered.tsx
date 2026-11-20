import { usePane } from "olai-plugin-navigation/pane"
import { useShown } from "olai-plugin-navigation/routing"
import { servedDirectory } from "../vault.ts"
import { lineAt } from "olai-plugin-navigation/routes"
import { TESTID as IDS_MARKDOWN } from "olai-plugin-markdown/testids"
import { today } from "../clock.ts"
import { proseIn, proseLineOffset, needlesFrom } from "@olai/format"
import { createEffect, createMemo, type JSX, onCleanup, Show } from "solid-js"
import { markdownReady } from "@olai/markdown-ui/chunk.ts"
import { Markdown } from "@olai/markdown-ui/Markdown.tsx"
import { landingId, outlineOf } from "@olai/markdown-ui/render.ts"
import { useHere, useLanding, useRouter } from "olai-plugin-navigation/routing"
import { BodyRefused } from "./BodyRefused.tsx"
import { isServed, useDocument } from "./documents.tsx"
import { Toc } from "./Toc.tsx"

export function Rendered(props: { readonly file: string }) {
  const here = useHere()
  const served = useDocument(() => props.file)
  /** The EDITOR is untouched by this and must be: a draft is a change to the
   * file's whole text, block and all, and `../document/DocEditor.tsx` reads
   * the served body directly. */
  const text = () => {
    const entry = served()
    return proseIn(isServed(entry) ? entry.text : "")
  }
  const headings = createMemo(() =>
    markdownReady() ? outlineOf(servedDirectory()?.claims(), text(), props.file) : [],
  )

  const landing = useLanding(() => props.file)
  const router = useRouter()
  const pane = usePane(), shown = useShown()
  const sourceLine = () => lineAt(landing.at())
  const lineDrawing = createMemo(() => {
    const line = sourceLine()
    const entry = served()
    if (line === undefined || !isServed(entry)) return undefined
    const route = router.panes()[here()]?.route()
    const query = route?.kind === "at" ? route.filter ?? "" : ""
    return { line: line - proseLineOffset(entry.text), needles: needlesFrom(query, today()) }
  }, undefined, { equals: (a, b) => a?.line === b?.line && a?.needles.length === b?.needles.length
    && (a?.needles.every((needle, index) => needle === b?.needles[index]) ?? true) })
  createEffect(() => {
    const at = landing.owed()
    if (!shown() || at === undefined || !markdownReady()) return
    const id = landingId(text(), props.file, at)
    const line = sourceLine()
    const entry = served()
    if (!isServed(entry)) return
    let live = true
    // A scroll inside the effect lands before the surrounding layout has settled.
    const frame = requestAnimationFrame(() => {
      const root = pane?.element
      if (line !== undefined && line > entry.text.split("\n").length) {
        root?.scrollTo({ top: 0 })
        landing.landed(at)
        return
      }
      const heading = line === undefined
        ? root?.querySelector(`#${CSS.escape(id)}`) ?? null
        : root?.querySelector('[data-search-landing="true"]') ?? null
      if (heading === null) return
      // A font swap landing after the scroll shifts every line above the target;
      // `fonts.ready` settles at once when nothing is loading.
      void document.fonts.ready.then(() => {
        if (!live) return
        heading.scrollIntoView({ block: "start" })
        landing.landed(at)
      })
    })
    onCleanup(() => { live = false; cancelAnimationFrame(frame) })
  })

  return (
    <>
      <Show when={served()?.refused}>
        <BodyRefused />
      </Show>
      <Show when={isServed(served())}>
        <Toc file={props.file} headings={headings()} />
        <Markdown members={servedDirectory()?.members()}
            claims={servedDirectory()?.claims()}
          source={text()}
          landing={lineDrawing()}
          from={props.file}
          testid={IDS_MARKDOWN.documentBody}
        />
      </Show>
    </>
  )
}
