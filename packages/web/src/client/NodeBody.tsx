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
 * is drawn in full rather than named and previewed. Everywhere else it is a
 * line's worth.
 *
 * A FRAGMENT, not a box. Where the body sits relative to the bullet is the
 * caller's layout — a tree row indents past its toggle, a day entry past its
 * own — so this contributes its children to a container it does not own.
 */

import { docOf, type LocatedRegular } from "@olai/format"
import { Show } from "solid-js"

import { DocRef } from "./document/DocRef.tsx"
import { Note } from "./Note.tsx"

export function NodeBody(props: {
  /** The record being shown — for a mirror, the node it stands for, which is
   *  also the file its note's pictures and its `doc` are relative to. */
  readonly shows: LocatedRegular
  /** This is the node's own page. */
  readonly zoomed?: boolean
}) {
  return (
    <>
      <Show when={props.shows.node.desc}>
        {(desc) => (
          <Note
            desc={desc()}
            from={props.shows.file}
            class={props.zoomed === true
              ? "mt-2 text-muted"
              : "mt-1 mb-2 text-[0.9375rem] text-muted"}
          />
        )}
      </Show>
      <Show when={docOf(props.shows)}>
        {(doc) => <DocRef file={doc()} inline={props.zoomed} />}
      </Show>
    </>
  )
}
