/**
 * What hangs under a node's line: its note, see refs, and the document it
 * attaches.
 *
 * The sibling of `NodeLine.tsx`, and for the same reason — a node is drawn in
 * three places (a row in a tree, an entry on a day, the heading of its own
 * page) and "what a node's body IS" must not be three hand-copied sequences
 * that a fourth thing under a node would have to be added to three times.
 *
 * `zoomed` is one fact with two consequences, not two knobs: on the node's own
 * page the body is the page, so the note is read at page size and the document
 * is drawn in full rather than named and previewed. Everywhere else the body
 * appears only while the row is expanded (hover or tap) — collapsed is a
 * single title line with a gray snippet, and this fragment is empty.
 *
 * A FRAGMENT, not a box. Where the body sits relative to the bullet is the
 * caller's layout — a tree row indents past its toggle, a day entry past its
 * own — so this contributes its children to a container it does not own.
 */

import { docOf, type LocatedRegular } from "@olai/format"
import { Show } from "solid-js"

import { DocRef } from "./document/DocRef.tsx"
import { Note } from "./Note.tsx"
import { SeeRefs } from "./SeeRefs.tsx"

export function NodeBody(props: {
  /** The record being shown — for a mirror, the node it stands for, which is
   *  also the file its note's pictures and its `doc` are relative to. */
  readonly shows: LocatedRegular
  /** This is the node's own page. Forces the note full and the document inline;
   *  row expansion does not apply to the subject. */
  readonly zoomed?: boolean
  /** Row is open (hover or tap). Ignored when zoomed. */
  readonly expanded?: boolean
  /** Tap the open body to fold (touch path's second tap). */
  readonly onCollapse?: () => void
}) {
  const show = () => props.zoomed === true || props.expanded === true
  const noteClass = () =>
    props.zoomed === true
      ? "mt-2 text-muted"
      : "mt-1 mb-2 cursor-pointer text-[0.9375rem] text-muted"

  return (
    <Show when={show()}>
      <div
        class="olai-row-detail"
        data-open={props.zoomed === true ? undefined : "true"}
      >
        <Show when={props.shows.node.desc}>
          {(desc) => (
            <div
              // The open note is the second half of the touch toggle: tap
              // snippet to open, tap body to fold. On a mouse the body is not
              // the control — mouse-out is — so the click still works and is
              // harmless (open is cleared on leave anyway).
              onClick={props.zoomed === true ? undefined : props.onCollapse}
              onKeyDown={
                props.zoomed === true || props.onCollapse === undefined
                  ? undefined
                  : (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      props.onCollapse?.()
                    }
                  }
              }
              role={props.zoomed === true ? undefined : "button"}
              tabindex={props.zoomed === true ? undefined : 0}
              title={props.zoomed === true ? undefined : "fold the note back"}
            >
              <Note
                desc={desc()}
                from={props.shows.file}
                class={noteClass()}
                open={props.zoomed !== true}
              />
            </div>
          )}
        </Show>
        <SeeRefs node={props.shows.node} />
        <Show when={docOf(props.shows)}>
          {(doc) => <DocRef file={doc()} inline={props.zoomed} />}
        </Show>
      </div>
    </Show>
  )
}
