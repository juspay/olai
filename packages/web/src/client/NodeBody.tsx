/**
 * What hangs under a node's title line: its note, see refs, and the document
 * it attaches.
 *
 * The sibling of `NodeLine.tsx`, and for the same reason — a node is drawn in
 * three places (a row in a tree, an entry on a day, the heading of its own
 * page) and "what a node's body IS" must not be three hand-copied sequences
 * that a fourth thing under a node would have to be added to three times.
 *
 * `zoomed` is one fact with two consequences, not two knobs: on the node's own
 * page the body is the page, so the note is read at page size and the document
 * is drawn in full rather than named and previewed. Everywhere else the note
 * is Workflowy-style: one dim line under the title, clamped with an ellipsis;
 * a click (or tap) expands it in place to the full multi-line desc plus see
 * links; click again or click away collapses.
 *
 * A FRAGMENT, not a box. Where the body sits relative to the bullet is the
 * caller's layout — a tree row indents past its toggle, a day entry past its
 * own — so this contributes its children to a container it does not own.
 */

import { docOf, type LocatedRegular } from "@olai/format"
import { createMemo, Show } from "solid-js"

import { DocRef } from "./document/DocRef.tsx"
import { plainLine } from "./note/preview.ts"
import { Note } from "./Note.tsx"
import { SeeRefs } from "./SeeRefs.tsx"
import { TESTID } from "./testids.ts"

export function NodeBody(props: {
  /** The record being shown — for a mirror, the node it stands for, which is
   *  also the file its note's pictures and its `doc` are relative to. */
  readonly shows: LocatedRegular
  /** This is the node's own page. Forces the note full and the document inline;
   *  row expansion does not apply to the subject. */
  readonly zoomed?: boolean
  /** Row note is open (click/tap). Ignored when zoomed. */
  readonly expanded?: boolean
  /** Click/tap the note to toggle open/closed. */
  readonly onToggle?: () => void
}) {
  const zoomed = () => props.zoomed === true
  const open = () => props.expanded === true
  const snippet = createMemo(() => {
    const desc = props.shows.node.desc
    return desc === undefined || desc === "" ? undefined : plainLine(desc)
  })

  return (
    <Show
      when={zoomed()}
      fallback={
        <>
          {/* Closed: one clamped gray line under the title. */}
          <Show when={!open() && snippet()}>
            {(line) => (
              <button
                type="button"
                class="mt-0.5 mb-1 block w-full max-w-full cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[0.875rem] leading-snug text-muted"
                data-testid={TESTID.desc}
                data-preview="true"
                data-open="false"
                title="show the full note"
                onClick={(event) => {
                  event.stopPropagation()
                  props.onToggle?.()
                }}
              >
                {line()}
              </button>
            )}
          </Show>

          {/* Open: full note + see; click the note to fold. */}
          <Show when={open()}>
            <div class="olai-row-detail" data-open="true">
              <Show when={props.shows.node.desc}>
                {(desc) => (
                  <div
                    class="mt-0.5 mb-1 cursor-pointer text-[0.875rem] text-muted"
                    role="button"
                    tabindex={0}
                    title="fold the note back"
                    onClick={(event) => {
                      event.stopPropagation()
                      props.onToggle?.()
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        props.onToggle?.()
                      }
                    }}
                  >
                    <Note
                      desc={desc()}
                      from={props.shows.file}
                      open
                    />
                  </div>
                )}
              </Show>
              <SeeRefs node={props.shows.node} />
            </div>
          </Show>

          {/* A doc reference is not densified with the note: it is always a
              line under the node when the node carries one. */}
          <Show when={docOf(props.shows)}>
            {(doc) => <DocRef file={doc()} />}
          </Show>
        </>
      }
    >
      {/* Zoomed subject: full note, see, and the document inline. */}
      <Show when={props.shows.node.desc}>
        {(desc) => (
          <Note
            desc={desc()}
            from={props.shows.file}
            class="mt-2 text-muted"
          />
        )}
      </Show>
      <SeeRefs node={props.shows.node} />
      <Show when={docOf(props.shows)}>
        {(doc) => <DocRef file={doc()} inline />}
      </Show>
    </Show>
  )
}
