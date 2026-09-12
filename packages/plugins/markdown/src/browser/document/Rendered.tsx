/** Markdown's own reading face, including heading and source-line landings. */
import { servedDirectory } from "../vault.ts"
import { lineAt } from "olai-plugin-navigation/routes"
import { panesOf } from "olai-plugin-navigation/workspace"
import { TESTID as IDS_MARKDOWN } from "olai-plugin-markdown/testids"
import { TESTID as IDS_NAVIGATION } from "olai-plugin-navigation/testids"
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
  /**
   * The body's PROSE, or the empty document there is nothing to draw yet —
   * every reader below wants a string and none of them can do anything useful
   * with a body that has not landed.
   *
   * `proseIn` is where a document's `---` block comes off, and it comes off
   * HERE rather than in the pipeline because this is the one place that knows
   * the source is a whole FILE (`../markdown/pipeline.ts` says why a plugin
   * there would be wrong: it is one pipeline for notes and chat replies too,
   * and neither of those has frontmatter to hide). One accessor serves all
   * three readers below — the contents, the landing id and the body — so they
   * cannot come to disagree about which lines this document has, and neither
   * can they disagree with the FACE, which is built by the same function.
   *
   * The EDITOR is untouched by this and must be: a draft is a change to the
   * file's whole text, block and all, and `../document/DocEditor.tsx` reads
   * the served body directly.
   */
  const text = () => {
    const entry = served()
    return proseIn(isServed(entry) ? entry.text : "")
  }
  // Empty until the markdown chunk lands, for the same reason the body is the
  // file's own text until then: there is nothing to make a contents out of
  // until something has read the headings. The `<Markdown>` under it is what
  // asks for the chunk; this memo re-runs when it arrives (../markdown/chunk.ts).
  //
  // SO THE CONTENTS ARRIVES IN THE SAME FLUSH AS THE BODY'S DE-BLUR, and this
  // page moves when it does: measured on `finishes.md` (two headings), the body
  // top goes 181px → 316px at that instant, the contents block being 99px plus
  // its margins. Raised in review (pi, 2026-08-24) against the flash fix's
  // ruling — "a de-blur rather than a reflow" — and left as it is, because the
  // same measurement on master is the same two numbers: this is what a document
  // page has always done, and the flash work changed only what the frame BEFORE
  // it looks like.
  //
  // What it would take to change it, and why none of it is free: RESERVING the
  // block's height means inventing one (how many headings? that is the guess
  // the whole skeleton refuses); READING the headings out of the source without
  // the pipeline is a second markdown dialect (`#` inside a fence is not a
  // heading — ../markdown/plain.ts's rule, from the other side); and ORDERING
  // the two — the contents first, the de-blur a frame later, so the page moves
  // only while it still says it is loading — means telling `<Markdown>` to hold
  // back, which is a second readiness path into the one component that owns the
  // waiting state. The last of those is the one worth having if a reader ever
  // complains; it is a decision about the CONTENTS rather than about the flash,
  // and it is the human's.
  const headings = createMemo(() =>
    markdownReady() ? outlineOf(servedDirectory()?.claims(), text(), props.file) : [],
  )

  // LAND ON THE SECTION the address named, once there is a page to land in.
  //
  // The id in the address is the heading's own (`#beds`) and the id in the page
  // is that inside this block's namespace (`../markdown/render.ts` mints it, and
  // `landingId` is the one translation between them) — so a browser cannot do
  // this for us: it would look for `beds`, find nothing, and leave the reader at
  // the top of a document they were sent into the middle of.
  //
  // An EFFECT rather than a call, because everything it needs arrives on its own
  // schedule: the markdown chunk is fetched (`markdownReady`), the body is drawn
  // from it, and the text itself can be replaced under an open page by a file
  // that moved on disk. Re-running is how the first two eventually land; the
  // third is why re-running is not free, and is what the `landed` guard below
  // answers.
  //
  // ON THE NEXT FRAME, which is the one thing here that is not obvious and was
  // measured rather than reasoned: scrolling inside the effect lands on the
  // element's position BEFORE the layout around it has settled — the contents
  // above the body appears in the same update — and the reader ends up several
  // hundred pixels short of the heading they asked for. A frame later the page
  // has been laid out and the element is where it will stay.
  //
  // NOTHING FOUND IS NOTHING DONE, which is what a browser does with a fragment
  // naming no id: the reader stays at the top of the page rather than being sent
  // somewhere arbitrary. A `.md` whose heading was renamed is exactly that case.
  //
  // ONCE PER ARRIVAL, which is the one thing this effect must not remember for
  // itself. The text is TRACKED — it has to be, since the id is minted from it
  // and the body lands a frame or two behind the address — and a file REWRITTEN
  // under a reader (an agent's write, a `git pull`, another tab) is a new text
  // under the same landing. Without a spent mark, somebody who had scrolled
  // away to read something else was yanked back to the heading the address
  // named, by an edit they did not make.
  //
  // The mark is the ROUTER's ({@link Landfall}), which is where the rule was
  // already written — "a landing is an ACT, and it happens once, on arrival" —
  // and where the value is minted. It used to be a private `let` here, so the
  // rule held for exactly the face that had one: the `.html` preview next door
  // re-landed its reader on every revision, which is the same bug in the pane
  // that could not see this variable.
  //
  // WHICH LANDING IS THIS PANE'S is {@link useLanding}'s, which is also what
  // stops a navigation NEXT DOOR waking this at all: `landing` is one signal
  // broadcast to every pane, set with a fresh value on every push, and that memo
  // is where it becomes this pane's slug or nothing.
  //
  // Spent on the SCROLL rather than on the attempt: an effect that gave up the
  // first time it found nothing would give up on the frame before the body had
  // arrived, which is most first paints. That is this face's answer and not a
  // rule about landings — the preview pane spends its own at the moment it
  // points a frame, because for a `.html` the pointing IS the act.
  const landing = useLanding(() => props.file)
  const router = useRouter()
  const sourceLine = () => lineAt(landing.at())
  const lineDrawing = createMemo(() => {
    const line = sourceLine()
    const entry = served()
    if (line === undefined || !isServed(entry)) return undefined
    const route = panesOf(router.workspace())[here()]?.route
    const query = route?.kind === "at" ? route.filter ?? "" : ""
    return { line: line - proseLineOffset(entry.text), needles: needlesFrom(query, today()) }
  })
  createEffect(() => {
    const at = landing.owed()
    if (at === undefined || !markdownReady()) return
    const id = landingId(text(), props.file, at)
    const line = sourceLine()
    const entry = served()
    if (!isServed(entry)) return
    const frame = requestAnimationFrame(() => {
      // Two panes of the SAME file mint the same heading ids. Look
      // under THIS pane's root, not the first copy in document order.
      const root = document.querySelector(
        `[data-testid="${IDS_NAVIGATION.pane}"][data-pane="${String(here())}"]`,
      )
      if (line !== undefined && line > entry.text.split("\n").length) {
        root?.scrollTo({ top: 0 })
        landing.landed(at)
        return
      }
      const heading = line === undefined
        ? root?.querySelector(`#${CSS.escape(id)}`) ?? null
        : root?.querySelector('[data-search-landing="true"]') ?? null
      if (heading === null) return
      heading.scrollIntoView({ block: "start" })
      landing.landed(at)
    })
    onCleanup(() => cancelAnimationFrame(frame))
  })

  // NOTHING UNTIL THE BODY IS HERE, which is the page's old gate moved down to
  // the face that needs it. No placeholder: a "reading…" line under a heading
  // that is already drawn would be a spinner for one frame, and an empty
  // rendering would be a document that says nothing where one says something.
  // A REFUSAL is here: folding it into the empty rendering is how a page went
  // blank for a file that had something to say.
  return (
    <>
      <Show when={served()?.refused}>
        <BodyRefused />
      </Show>
      <Show when={isServed(served())}>
        <Toc file={props.file} headings={headings()} />
        <Markdown
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
