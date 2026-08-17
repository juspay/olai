/**
 * The FACE a bodied file's page wears — one per kind, in one table.
 *
 * `/doc/<file>` opens any file whose content is a body (`@olai/format`'s
 * registry: a `.md` today, a `.html` beside it), and what changes between them
 * is not the page — same address, same heading, same "the directory does not
 * hold that" screen — but what the body is DRAWN AS, whether the reader may
 * write it, and what the page has to have in hand before it draws at all.
 * Those are exactly three facts, so they are three fields, and the table is a
 * `Record` over `BodyKind`: a kind added to the registry with a body is a
 * compile error here, naming the things a new kind of file cannot inherit.
 *
 * The alternative is what this replaces before it could be written: a `Show`
 * per kind in `./DocumentPage.tsx`, with the Edit control gated by a second
 * condition somewhere above it. Two conditions about one kind is two answers,
 * and the page they disagree in is the one where a reader is offered an editor
 * for a file the ops layer will refuse to write.
 *
 * `edits` is not a preference. `write_document` takes a `.md` and nothing else
 * (`@olai/ops`), so a page offering Edit for a `.html` would be a door onto a
 * refusal; the flag is that fact, said where the page can read it, rather than
 * a decision this file is making on its own.
 */

import type { BodyKind } from "@olai/format"
import { createEffect, createMemo, type JSX, onCleanup } from "solid-js"

import { markdownReady } from "../markdown/chunk.ts"
import { Markdown } from "../markdown/Markdown.tsx"
import { landingId, outlineOf } from "../markdown/render.ts"
import { useRouter } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { Hypertext } from "./Hypertext.tsx"
import { Toc } from "./Toc.tsx"

/** What a reading face is handed: the file's path, which revision of the
 *  directory it is at, and its body. A face takes what it draws FROM — the
 *  markdown face reads `text`, the hypertext face reads neither (its frame
 *  fetches the file over HTTP) and watches `rev` to know the file on disk
 *  moved. Both are passed to both, because which of them a kind uses is that
 *  kind's business and this table's job is only to say which component draws
 *  it. */
export interface Reading {
  readonly file: string
  /** The file's body, as the wire published it — and the EMPTY STRING for a
   *  face that draws without one ({@link Face.needs}), which is the honest
   *  value for bytes this tab never asked the server for. It is not a body
   *  that happens to be empty: a face needing one is never drawn until it has
   *  arrived, and a face needing none never reads this. */
  readonly text: string
  /** Which revision of the directory this file is at (`@olai/surface`'s
   *  `Head`). It moves when the file does and stays put when it does not. */
  readonly rev: number
}

export interface Face {
  /** The reading face: the body, drawn however this kind of file is drawn. */
  readonly reads: (props: Reading) => JSX.Element
  /** Whether this kind's page offers the WRITING face — the Edit control, the
   *  draft and the conflict story (`./DocEditor.tsx`). */
  readonly edits: boolean
  /**
   * WHAT THE PAGE WAITS FOR before it draws this face — the file's BODY, or
   * only its HEAD, which is to say the fact that the file moved.
   *
   * It is a fact about the FACE and not about the file, which is why it is
   * here and not in the format's registry: a `.html`'s bytes are perfectly
   * readable and an agent reads them (`@olai/server`'s `bodies.ts`); what is
   * true is that this component draws none of them, because the frame it puts
   * on screen fetches the file over HTTP for itself (`./Hypertext.tsx`).
   *
   * It is load-bearing on the WIRE, which is the reason it exists at all. A
   * page only asks for what its face needs (`./DocumentPage.tsx`), so
   * `needs: "head"` is the difference between a preview costing a number and a
   * preview costing the whole file over the websocket — a copy nothing drew,
   * ahead of the copy that did. PR #206 deferred that; this field is where it
   * is decided.
   *
   * `edits` implies `"body"`, and that is an implication rather than a second
   * field: an editor is a draft over the text, so a writable face that did not
   * wait for one would open a caret onto nothing.
   */
  readonly needs: "body" | "head"
}

export const FACES: Record<BodyKind, Face> = {
  document: { reads: Rendered, edits: true, needs: "body" },
  hypertext: { reads: Hypertext, edits: false, needs: "head" },
}

/** A document's reading face: the contents, then the body — exactly what the
 *  page was before it could edit, in a component so the mode switch stays one
 *  `Show` rather than two trees interleaved. */
function Rendered(props: Reading) {
  const router = useRouter()
  // Empty until the markdown chunk lands, for the same reason the body is the
  // file's own text until then: there is nothing to make a contents out of
  // until something has read the headings. The `<Markdown>` under it is what
  // asks for the chunk; this memo re-runs when it arrives (../markdown/chunk.ts).
  const headings = createMemo(() =>
    markdownReady() ? outlineOf(props.text, props.file) : [],
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
  // that moved on disk. Re-running is harmless — the same fragment finds the
  // same element and scrolls to where it already is.
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
  createEffect(() => {
    const at = router.landing()
    if (at === undefined || !markdownReady()) return
    const id = landingId(props.text, props.file, at)
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" })
    })
    onCleanup(() => cancelAnimationFrame(frame))
  })

  return (
    <>
      <Toc file={props.file} headings={headings()} />
      <Markdown
        source={props.text}
        from={props.file}
        testid={TESTID.documentBody}
      />
    </>
  )
}
