/**
 * What hangs under a node's title: the open state, and the one line that is
 * drawn whether it is open or not.
 *
 * The sibling of `NodeLine.tsx`, and for the same reason — a node is drawn in
 * three places (a row in a tree, an entry on a day, the heading of its own
 * page) and "what a node's body IS" must not be three hand-copied sequences
 * that a fourth thing under a node would have to be added to three times.
 *
 * ## The open state, and its three layers
 *
 * A row is its title. Opening it adds exactly this, in this order (the quiet
 * outline, human):
 *
 *   1. the TITLE LINE saying so — the pilcrow accents and the tags brighten,
 *      which is `./note/Mark.tsx` and `./styles.css` and not this file's;
 *   2. the PROPERTIES RUN — every custom property as dim `key value` pairs on
 *      ONE wrapping line, dot-separated, read like a byline under a headline
 *      (`./props/PropsDrawer.tsx`). Never a grid, never a table, never a form;
 *   3. the NOTE, one step dimmer than the title and taking the full pane. The
 *      brief asked for it to wrap near 62 characters; the human rejected that on
 *      sight ("no need to wrap desc either. just take full width") and
 *      `./touch.ts` keeps the argument for why a measure was wrong here.
 *
 * `see` follows as the references it is. The node's DOC is the one thing here
 * that is not part of the open state: a document attached to a node is a second
 * surface rather than a fact about it, and a node with a `doc` and no note has
 * no pilcrow to open — so folding it away would put a whole document out of
 * reach from the tree.
 *
 * ## Closed, which is two shapes and not one
 *
 * `preview` is the density preference arriving as a fact about this drawing
 * (`./settings/density.ts`): at `Cozy` a closed row keeps the dim one-line clamp
 * it has always had, and at `Compact` — the default — it draws nothing at all
 * and the pilcrow beside the title is the whole of what says there is a note.
 * The clamp stays pressable where it is drawn, because a reader whose eye is
 * already on the note should not have to travel back to the mark to open it.
 *
 * `zoomed` is one fact with two consequences, not two knobs: on the node's own
 * page the body IS the page, so the note is read at page size, the drawer draws
 * the node's own facts as well as its properties, and the document is drawn in
 * full rather than named and previewed. Row expansion does not apply to the
 * subject.
 *
 * CLICKING AN OPEN NOTE PUTS THE CARET IN IT (human, 2026-08-11 —
 * Workflowy-style, superseding the textarea the 2026-08-09 plan resolved on).
 * In Workflowy a note is always shown in full and is always one click from the
 * caret; the fold is olai's own compression of that, so the faithful mapping is
 * onto the EXPANDED note — one click from what Workflowy would have been showing
 * you all along. Clicking away still collapses; `Shift+Enter` is still one key
 * from the title for a keyboard.
 *
 * A FRAGMENT, not a box. Where the body sits relative to the glyph is the
 * caller's layout — a tree row indents past its toggle, a day entry past its
 * own — so this contributes its children to a container it does not own.
 */

import { docOf, type LocatedRegular } from "@olai/format"
import { createMemo, type JSX, Show } from "solid-js"

import { DocRef } from "./document/DocRef.tsx"
import { plainLine } from "./note/preview.ts"
import { Note } from "./Note.tsx"
import { PropsDrawer } from "./props/PropsDrawer.tsx"
import { EdgeRefs } from "./edges/EdgeRefs.tsx"
import { TESTID } from "./testids.ts"
import { ROW_NOTE } from "./touch.ts"

export function NodeBody(props: {
  /** The record being shown — for a mirror, the node it stands for, which is
   *  also the file its note's pictures and its `doc` are relative to. */
  readonly shows: LocatedRegular
  /** This is the node's own page. Forces the note full and the document inline;
   *  row expansion does not apply to the subject. */
  readonly zoomed?: boolean
  /** Row is open. Ignored when zoomed. */
  readonly expanded?: boolean
  /** A CLOSED row draws the dim one-line clamp of its note. The density
   *  preference's `cozy`, arriving as what it means here. */
  readonly preview?: boolean
  /** Click/tap the clamped line to open the row — the pilcrow's gesture, from
   *  the other end of the note. */
  readonly onToggle?: () => void
  /** Click/tap the open note to put the CARET in it: absent wherever a node is
   *  drawn read-only (a day page), which is the same rule `NodeLine.onEdit`
   *  follows for the title. */
  readonly onEdit?: () => void
  /**
   * THE NOTE ITSELF, when the page has a better one than a rendering.
   *
   * A tree row hands in the live-preview EDITOR, reading until it is clicked
   * (`Tree.tsx`) — one surface that is the rendering and becomes the caret in
   * place, rather than a rendering this file draws and something else replaces.
   * A page that offers no caret at all — a day, the agenda, the trash, a
   * zoomed subject — passes nothing and gets `./Note.tsx`, which is the same
   * markdown through the page's own pipeline.
   *
   * A SLOT rather than a flag, because what the two draw is genuinely
   * different machinery, and because the caller is the only one that knows
   * whether there is a draft open on a row with no note yet — which is a note
   * surface with nothing to render.
   *
   * A FUNCTION rather than an element, and that is load-bearing: an element in
   * a prop is re-created every time the expression that built it re-runs, and
   * re-creating THIS one would remount the editor — losing the caret, the undo
   * history and the very no-jump the surface exists for. Called once, here, so
   * the caller's own `<Show>` decides when it lives and its props carry every
   * change.
   */
  readonly note?: () => JSX.Element
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
          {/* Closed at `cozy`: one clamped dim line under the title. At
              `compact` there is nothing here and the pilcrow says it all. */}
          <Show when={!open() && props.preview === true && snippet()}>
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
                  // Open. A clamped line is not something anybody can type
                  // into, so the caret belongs to the click after this one.
                  props.onToggle?.()
                }}
              >
                {line()}
              </button>
            )}
          </Show>

          {/* Open: the run, then the note, then what this node sees. */}
          <Show when={open()}>
            <div class="olai-row-detail" data-open="true">
              {/* Layer two. A ROW draws the CUSTOM properties only: its id, its
                  mark and its date are already on screen — in the glyph, on the
                  date badge, in the address — and repeating them here would put
                  two spellings of one fact under one title. The node's own page
                  is where the full drawer is (`always`). */}
              <PropsDrawer node={props.shows.node} />
              {/* The caller's surface when there is one (above), and otherwise
                  the rendering — with the click that asks for a caret, for the
                  pages that offer one but hand in no surface. */}
              <Show when={props.note} fallback={
                <Show when={props.shows.node.desc}>
                  {(desc) => (
                    <div
                      class={`mt-0.5 mb-1 cursor-text ${ROW_NOTE}`}
                      role="button"
                      tabindex={0}
                      title="write in this note"
                      onClick={(event) => {
                        event.stopPropagation()
                        // Already open: the click is the caret's. Folding back
                        // is what the pilcrow does, and what clicking AWAY does
                        // (./note/expand.ts), which is also what commits.
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
              }>
                {(note) => note()()}
              </Show>
              <EdgeRefs node={props.shows.node} relation="see" onRemove={props.onUnsee} />
            </div>
          </Show>

          {/* A doc reference is not part of the fold: it is always a line under
              the node when the node carries one (see this file's header). */}
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
      {/* Zoomed, the drawer is drawn WHATEVER the node carries: this is a page
          about one node, its facts are what the page is for, and the id in
          particular is what every tool call and every `((` reference takes. */}
      <PropsDrawer node={props.shows.node} always />
      <EdgeRefs node={props.shows.node} relation="see" onRemove={props.onUnsee} />
      <Show when={docOf(props.shows)}>
        {(doc) => <DocRef file={doc()} inline />}
      </Show>
    </Show>
  )
}
