import { usePane } from "olai-plugin-navigation/pane"
import { useShown } from "olai-plugin-navigation/routing"
import { servedDirectory } from "../vault.ts"
import { lineAt } from "olai-plugin-navigation/routes"
import { TESTID as IDS_MARKDOWN } from "olai-plugin-markdown/testids"
import { today } from "../clock.ts"
import { proseIn, proseLineOffset, needlesFrom } from "@olai/format"
import { createEffect, createMemo, type JSX, onCleanup, Show } from "solid-js"
import { markdownArrival } from "@olai/markdown-ui/chunk.ts"
import { Markdown } from "@olai/markdown-ui/Markdown.tsx"
import { landingId, outlineOf } from "@olai/markdown-ui/render.ts"
import { useHere, useLanding, useRouter } from "olai-plugin-navigation/routing"
import { BodyRefused } from "./BodyRefused.tsx"
import { isServed, useDocument } from "./documents.tsx"
import { Toc } from "./Toc.tsx"

// A scroll issued inside an effect lands before the browser has settled layout.
const afterLayout = (run: () => void): (() => void) => {
  const frame = requestAnimationFrame(run)
  return () => cancelAnimationFrame(frame)
}

// A font swap landing after the scroll shifts every line above the target;
// `document.fonts.ready` settles at once when nothing is loading.
const afterFontsSettle = (run: () => void): (() => void) => {
  let live = true
  void document.fonts.ready.then(() => { if (live) run() })
  return () => { live = false }
}

const landOnHeading = (land: {
  readonly root: () => Element | null | undefined
  readonly id: string
  readonly line: number | undefined
  readonly lines: number
  readonly landed: () => void
}): (() => void) => {
  let stopSettle: (() => void) | undefined
  const stopFrame = afterLayout(() => {
    const root = land.root()
    if (land.line !== undefined && land.line > land.lines) {
      root?.scrollTo({ top: 0 })
      land.landed()
      return
    }
    const heading = land.line === undefined
      ? root?.querySelector(`#${CSS.escape(land.id)}`) ?? null
      : root?.querySelector('[data-search-landing="true"]') ?? null
    if (heading === null) return
    stopSettle = afterFontsSettle(() => {
      heading.scrollIntoView({ block: "start" })
      land.landed()
    })
  })
  return () => { stopFrame(); stopSettle?.() }
}

export function Rendered(props: { readonly file: string }) {
  const here = useHere()
  const served = useDocument(() => props.file)
  const text = () => {
    const entry = served()
    return proseIn(isServed(entry) ? entry.text : "")
  }
  const headings = createMemo(() =>
    markdownArrival().kind === "ready" ? outlineOf(servedDirectory()?.claims(), text(), props.file) : [],
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
    const entry = served()
    if (!shown() || at === undefined || markdownArrival().kind !== "ready" || !isServed(entry)) return
    const cancel = landOnHeading({
      root: () => pane?.element,
      id: landingId(text(), props.file, at),
      line: sourceLine(),
      lines: entry.text.split("\n").length,
      landed: () => landing.landed(at),
    })
    onCleanup(cancel)
  })

  return (
    <>
      <Show when={served()?.state === "refused"}>
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
