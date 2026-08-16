/**
 * The FACE a bodied file's page wears — one per kind, in one table.
 *
 * `/doc/<file>` opens any file whose content is a body (`@olai/format`'s
 * registry: a `.md` today, a `.html` beside it), and what changes between them
 * is not the page — same address, same heading, same "the directory does not
 * hold that" screen — but what the body is DRAWN AS, and whether the reader may
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
 * `edits` is not a preference. `write_document` takes a `.md` and nothing else
 * (`@olai/ops`), so a page offering Edit for a `.html` would be a door onto a
 * refusal; the flag is that fact, said where the page can read it, rather than
 * a decision this file is making on its own.
 */

import type { BodyKind } from "@olai/format"
import { createMemo, type JSX } from "solid-js"

import { markdownReady } from "../markdown/chunk.ts"
import { Markdown } from "../markdown/Markdown.tsx"
import { outlineOf } from "../markdown/render.ts"
import { TESTID } from "../testids.ts"
import { Hypertext } from "./Hypertext.tsx"
import { Toc } from "./Toc.tsx"

/** What a reading face is handed: the file's path, the entry the collection
 *  holds for it, and both halves of that entry. A face takes what it draws
 *  FROM — the markdown face reads `text`, the hypertext face reads neither
 *  (its frame fetches the file over HTTP) and watches `rev` to know the file on
 *  disk moved. Both are passed to both, because which of them a kind uses is
 *  that kind's business and this table's job is only to say which component
 *  draws it. */
export interface Reading {
  readonly file: string
  readonly text: string
  /** Which revision of the directory this body was published in
   *  (`@olai/surface`'s `DocumentEntry`). It moves when the file does and
   *  stays put when it does not. */
  readonly rev: number
}

export interface Face {
  /** The reading face: the body, drawn however this kind of file is drawn. */
  readonly reads: (props: Reading) => JSX.Element
  /** Whether this kind's page offers the WRITING face — the Edit control, the
   *  draft and the conflict story (`./DocEditor.tsx`). */
  readonly edits: boolean
}

export const FACES: Record<BodyKind, Face> = {
  document: { reads: Rendered, edits: true },
  hypertext: { reads: Hypertext, edits: false },
}

/** A document's reading face: the contents, then the body — exactly what the
 *  page was before it could edit, in a component so the mode switch stays one
 *  `Show` rather than two trees interleaved. */
function Rendered(props: Reading) {
  // Empty until the markdown chunk lands, for the same reason the body is the
  // file's own text until then: there is nothing to make a contents out of
  // until something has read the headings. The `<Markdown>` under it is what
  // asks for the chunk; this memo re-runs when it arrives (../markdown/chunk.ts).
  const headings = createMemo(() =>
    markdownReady() ? outlineOf(props.text, props.file) : [],
  )
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
