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
 * CLICKING IT PUTS THE CARET IN IT (human, 2026-08-11 — Workflowy-style,
 * superseding the textarea the 2026-08-09 plan resolved on), and WHICH click
 * is the reconciliation this needed. In Workflowy a note is always shown in
 * full and is always one click from the caret; there is no clamped state to
 * reconcile, because the clamp is olai's own compression of it. So the
 * faithful mapping is onto the EXPANDED note: the clamped line expands, as it
 * has since notes-single, and a click in the note you are now reading puts the
 * caret in it — one click from what Workflowy would have been showing you all
 * along.
 *
 * The alternative — one click doing both — was tried and is worse, for a
 * reason the tests found rather than an argument: the expanded note is the
 * only place a row draws its `see` links and its rendered markdown, so a click
 * that went straight to source deleted a reading surface to save a click.
 * Clicking away still collapses, exactly as before; `Shift+Enter` is still one
 * key from the title for a keyboard.
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
import { ROW_NOTE } from "./touch.ts"

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
  /** Click/tap the note to put the CARET in it — the same gesture, one level
   *  further: absent wherever a node is drawn read-only (a day page), which is
   *  the same rule `NodeLine.onEdit` follows for the title. */
  readonly onEdit?: () => void
  /** Drop one of the node's `see` targets — the `×` beside each link
   *  (./NodeRefs.tsx), sent by whoever owns this node's edge editing
   *  (./edges/editing.tsx). ABSENT wherever the node is drawn read-only, which
   *  is the rule `onEdit` above already follows: a day page and the agenda draw
   *  a node they do not offer to change. */
  readonly onUnsee?: (target: string) => void
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
                class={`mt-0.5 mb-1 block w-full max-w-full cursor-text truncate border-0 bg-transparent p-0 text-left ${ROW_NOTE}`}
                data-testid={TESTID.desc}
                data-preview="true"
                data-open="false"
                title="show the full note"
                onClick={(event) => {
                  event.stopPropagation()
                  // Expand. A clamped line is not something anybody can type
                  // into, so the caret belongs to the click after this one.
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
                    class={`mt-0.5 mb-1 cursor-text ${ROW_NOTE}`}
                    role="button"
                    tabindex={0}
                    title="write in this note"
                    onClick={(event) => {
                      event.stopPropagation()
                      // Already open: the click is the caret's. Folding back is
                      // what clicking AWAY does (./note/expand.ts), which is
                      // also what commits.
                      props.onEdit?.()
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        props.onEdit?.()
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
              <SeeRefs node={props.shows.node} onRemove={props.onUnsee} />
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
      <SeeRefs node={props.shows.node} onRemove={props.onUnsee} />
      <Show when={docOf(props.shows)}>
        {(doc) => <DocRef file={doc()} inline />}
      </Show>
    </Show>
  )
}
