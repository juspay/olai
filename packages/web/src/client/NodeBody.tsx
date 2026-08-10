/**
 * What hangs under a node's line: its note, and the document it attaches.
 *
 * The sibling of `NodeLine.tsx`, and for the same reason — a node is drawn in
 * three places (a row in a tree, an entry on a day, the heading of its own
 * page) and "what a node's body IS" must not be three hand-copied sequences
 * that a fourth thing under a node would have to be added to three times.
 *
 * `zoomed` is one fact with two consequences, not two knobs: on the node's own
 * page the body is the page, so the note is read at page size and the document
 * is drawn in full rather than named and previewed. Everywhere else the note
 * follows the reading's density (./view.ts) for this PLACE, and the document
 * is a line.
 *
 * A FRAGMENT, not a box. Where the body sits relative to the bullet is the
 * caller's layout — a tree row indents past its toggle, a day entry past its
 * own — so this contributes its children to a container it does not own.
 */

import { docOf, type LocatedRegular } from "@olai/format"
import { Show } from "solid-js"

import { DocRef } from "./document/DocRef.tsx"
import { Note, type NoteShape } from "./Note.tsx"
import type { View } from "./view.ts"

export function NodeBody(props: {
  /** The record being shown — for a mirror, the node it stands for, which is
   *  also the file its note's pictures and its `doc` are relative to. */
  readonly shows: LocatedRegular
  /** This is the node's own page. Forces the note full and the document inline;
   *  density does not apply to the subject. */
  readonly zoomed?: boolean
  /** The PLACE this body hangs under (`Row.key`, or a day entry's `file/id`).
   *  Required when not zoomed: note-expand is keyed by place. */
  readonly place?: string
  /** The reading this body is drawn under. Required when not zoomed. */
  readonly view?: View
}) {
  const shape = (): NoteShape => {
    if (props.zoomed === true) {
      return { kind: "full", class: "mt-2 text-muted" }
    }
    const view = props.view
    const place = props.place
    if (view === undefined || place === undefined) {
      return { kind: "full", class: "mt-1 mb-2 text-[0.9375rem] text-muted" }
    }
    const density = view.density()
    if (density === "hidden") return { kind: "hidden" }
    if (density === "full") {
      return { kind: "full", class: "mt-1 mb-2 text-[0.9375rem] text-muted" }
    }
    return {
      kind: "preview",
      open: view.noteOpen().has(place),
      onToggle: () => view.toggleNote(place),
    }
  }

  return (
    <>
      <Show when={props.shows.node.desc}>
        {(desc) => (
          <Note
            desc={desc()}
            from={props.shows.file}
            shape={shape()}
          />
        )}
      </Show>
      <Show when={docOf(props.shows)}>
        {(doc) => <DocRef file={doc()} inline={props.zoomed} />}
      </Show>
    </>
  )
}
