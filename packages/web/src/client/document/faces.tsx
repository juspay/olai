/**
 * The FACE a bodied file's page wears — one per kind, in one table.
 *
 * `/<file>` opens any file whose content is a body (`@olai/format`'s
 * registry: a `.md` today, a `.html` beside it), and what changes between them
 * is not the page — same address, same heading, same "the directory does not
 * hold that" screen — but what the file is DRAWN AS, and whether the reader may
 * write it. Those are exactly two facts, so they are two fields, and the table
 * is a `Record` over `BodyKind`: a kind added to the registry with a body is a
 * compile error here, naming the one thing a new kind of file cannot inherit.
 *
 * The alternative is what this replaces before it could be written: a `Show`
 * per kind in `./DocumentPage.tsx`, with the Edit control gated by a second
 * condition somewhere above it. Two conditions about one kind is two answers,
 * and the page they disagree in is the one where a reader is offered an editor
 * for a file the ops layer will refuse to write.
 *
 * WHAT A FACE IS HANDED is the file and nothing else ({@link Reading}), and
 * that is the decision this table gained last. Each face asks the wire for what
 * it draws from — a document's body, a saved page's revision — through the one
 * module that owns both members (`./documents.tsx`), so a face cannot be handed
 * a value it does not read, and what a kind costs this tab is a fact about that
 * kind's own component rather than about a props type shared with another.
 */

import type { BodyKind } from "@olai/format"
import { createEffect, createMemo, type JSX, onCleanup, Show } from "solid-js"

import { markdownReady } from "../markdown/chunk.ts"
import { Markdown } from "../markdown/Markdown.tsx"
import { landingId, outlineOf } from "../markdown/render.ts"
import { useHere, useLanding } from "../router.tsx"
import { TESTID } from "../testids.ts"
import { useDocument } from "./documents.tsx"
import { Hypertext } from "./Hypertext.tsx"
import { Toc } from "./Toc.tsx"

/**
 * What a reading face is handed: THE FILE, and nothing else.
 *
 * It used to be handed the body as well, and that is the field this type lost
 * on purpose. A face draws from what it draws from — the markdown face from
 * the document's text, the hypertext face from a frame that fetches the file
 * over HTTP and from the revision that says the file moved — and those are two
 * different members of the wire (`@olai/surface`: `documents`, `heads`). A
 * props type carrying both meant handing each face a value it does not read,
 * which for the hypertext face was an empty string standing in for bytes this
 * tab never asked for: a body-shaped hole that a future face could read and
 * quietly draw as an empty document.
 *
 * So each face ASKS, through the one module that owns both members
 * (`./documents.tsx`), and a face's cost on the wire is a fact about the face
 * rather than about this table's props. That is what makes a preview cost a
 * revision: `Hypertext` reads a head and never opens a body, and nothing here
 * can hand it one by accident.
 */
export interface Reading {
  readonly file: string
}

export interface Face {
  /** The reading face: the file, drawn however this kind of file is drawn. */
  readonly reads: (props: Reading) => JSX.Element
  /**
   * Whether this kind's page offers the WRITING face — the Edit control, the
   * draft and the conflict story (`./DocEditor.tsx`).
   *
   * It is also what decides whether the PAGE asks for the body
   * (`./DocumentPage.tsx`), and the two are one question rather than two: the
   * page holds the body for the editor's sake — a draft is a change to a text,
   * judged against the text it was read from — and for nothing else, since the
   * reading face fetches whatever it draws for itself. A face that does not
   * edit is a page that opens no body, which is why a `.html` preview costs
   * this tab a revision and not a megabyte.
   *
   * `edits` is not a preference. `write_document` takes a `.md` and nothing
   * else (`@olai/ops`), so a page offering Edit for a `.html` would be a door
   * onto a refusal.
   */
  readonly edits: boolean
}

export const FACES: Record<BodyKind, Face> = {
  document: { reads: Rendered, edits: true },
  hypertext: { reads: Hypertext, edits: false },
}

/** A document's reading face: the contents, then the body — exactly what the
 *  page was before it could edit, in a component so the mode switch stays one
 *  `Show` rather than two trees interleaved.
 *
 *  IT ASKS FOR THE BODY ITSELF, which is what it draws from ({@link Reading}).
 *  The page above it asks for one too, for the editor's sake, and that is one
 *  subscription rather than two: interest is counted per PATH by the module
 *  that owns the member (`./documents.tsx`), so two readers of one document
 *  share its stream. Nothing arrives until it arrives — the body is a frame
 *  behind the heading on a fresh open, which is what a `<Show>` and no
 *  placeholder mean here as they did when the page held it. */
function Rendered(props: Reading) {
  const here = useHere()
  const served = useDocument(() => props.file)
  /** The body, or the empty document there is nothing to draw yet — every
   *  reader below wants a string and none of them can do anything useful with
   *  a body that has not landed. */
  const text = () => served()?.text ?? ""
  // Empty until the markdown chunk lands, for the same reason the body is the
  // file's own text until then: there is nothing to make a contents out of
  // until something has read the headings. The `<Markdown>` under it is what
  // asks for the chunk; this memo re-runs when it arrives (../markdown/chunk.ts).
  const headings = createMemo(() =>
    markdownReady() ? outlineOf(text(), props.file) : [],
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
  // ONCE PER ARRIVAL, which is the one thing this effect has to remember. The
  // text is TRACKED — it has to be, since the id is minted from it and the body
  // lands a frame or two behind the address — and a file REWRITTEN under a
  // reader (an agent's write, a `git pull`, another tab) is a new text under
  // the same landing. Without this, somebody who had scrolled away to read
  // something else was yanked back to the heading the address named, by an edit
  // they did not make. `../router.tsx` already states the rule this keeps: a
  // landing is an ACT, and it happens once, on arrival.
  //
  // WHICH LANDING IS THIS PANE'S is {@link useLanding}'s, which is also what
  // stops a navigation NEXT DOOR waking this at all: `landing` is one signal
  // broadcast to every pane, set with a fresh value on every push, and that memo
  // is where it becomes this pane's slug or nothing.
  //
  // Spent on the SCROLL rather than on the attempt: an effect that gave up the
  // first time it found nothing would give up on the frame before the body had
  // arrived, which is most first paints.
  const landingAt = useLanding()
  let landed: string | undefined
  createEffect(() => {
    const at = landingAt()
    if (at === undefined || at === landed || !markdownReady()) return
    const id = landingId(text(), props.file, at)
    const frame = requestAnimationFrame(() => {
      // Two panes of the SAME file mint the same heading ids. Look
      // under THIS pane's root, not the first copy in document order.
      const root = document.querySelector(
        `[data-testid="${TESTID.pane}"][data-pane="${String(here())}"]`,
      )
      const heading = root?.querySelector(`#${CSS.escape(id)}`) ?? null
      if (heading === null) return
      heading.scrollIntoView({ block: "start" })
      landed = at
    })
    onCleanup(() => cancelAnimationFrame(frame))
  })

  // NOTHING UNTIL THE BODY IS HERE, which is the page's old gate moved down to
  // the face that needs it. No placeholder: a "reading…" line under a heading
  // that is already drawn would be a spinner for one frame, and an empty
  // rendering would be a document that says nothing where one says something.
  return (
    <Show when={served() !== undefined}>
      <Toc file={props.file} headings={headings()} />
      <Markdown
        source={text()}
        from={props.file}
        testid={TESTID.documentBody}
      />
    </Show>
  )
}
