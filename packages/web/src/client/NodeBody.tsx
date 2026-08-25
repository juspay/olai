/**
 * What hangs under a node's title: the facts it carries, which are always
 * drawn, and the open state under them.
 *
 * The sibling of `NodeLine.tsx`, and for the same reason — a node is drawn in
 * three places (a row in a tree, an entry on a day, the heading of its own
 * page) and "what a node's body IS" must not be three hand-copied sequences
 * that a fourth thing under a node would have to be added to three times.
 *
 * ## The property run, which is NOT part of the open state
 *
 * A node's custom properties are drawn under its title whether the row is open
 * or not (`props-doors-autoshow`, and `./props/PropsDrawer.tsx` argues it): a
 * fact behind a fold is a fact nobody reads, these are short facts by rule, and
 * the run is built to make five of them cost one line rather than five. Only
 * the CUSTOM half — the node's own facts are already on the row, in the glyph,
 * on the date badge and in the address.
 *
 * It used to be layer two of the open state, and moving it out is what makes
 * the list below three lines shorter and the pilcrow's promise exact.
 *
 * ## The open state, and what it now adds
 *
 * A row is its title and its facts. Opening it adds exactly this, in this
 * order (the quiet outline, human):
 *
 *   1. the TITLE LINE saying so — the pilcrow accents and the tags brighten,
 *      which is `./note/Mark.tsx` and `./styles.css` and not this file's;
 *   2. the NOTE, one step dimmer than the title and taking the full pane. The
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
 * `noteHit` is the third shape and it OVERRULES the preference: a row a filter
 * found behind its ¶ draws the same clamp taken around the hit instead of off
 * the top (`./note/excerpt.ts`), because that line is the reason the row is on
 * screen and a reader who hid previews did not ask to be told less about the
 * query they just typed. Which of the two lines it is, is one memo below; the
 * element is one either way (`./note/Line.tsx`).
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

import { customOf, docOf, type LocatedRegular } from "@olai/format"
import { createMemo, Show } from "solid-js"

import { DocRef } from "./document/DocRef.tsx"
import { excerptOf } from "./note/excerpt.ts"
import { NoteLine } from "./note/Line.tsx"
import { plainLine } from "./note/preview.ts"
import { Note } from "./Note.tsx"
import { customEntries, drawerEntries } from "./props/drawer.ts"
import { PropsDrawer, type SetProp } from "./props/PropsDrawer.tsx"
import { EdgeRefs } from "./edges/EdgeRefs.tsx"
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
  /**
   * The words a filter found this node BY and found nowhere but its note
   * (`./filter/why.ts`'s `behindTheMark`) — so a closed row draws a
   * window onto the note around the hit instead of the plain top-of-note
   * preview, and stops being a title with nothing of the query in it.
   *
   * Empty for every other row, filtered or not. Handed IN rather than read off
   * the narrowing here, for the reason `onEdit` and `onUnsee` are: this
   * component is a body, and which of the surfaces drawing one has a filter
   * over it is the caller's fact.
   */
  readonly noteHit?: ReadonlyArray<string>
  /** Click/tap the open note to put the CARET in it: absent wherever a node is
   *  drawn read-only (a day page), which is the same rule `NodeLine.onEdit`
   *  follows for the title. */
  readonly onEdit?: () => void
  /** Drop one of the node's `see` targets — the `×` beside each link
   *  (./NodeRefs.tsx), sent by whoever owns this node's edge editing
   *  (./edges/editing.tsx). ABSENT wherever the node is drawn read-only, which
   *  is the rule `onEdit` above already follows: a day page and the agenda draw
   *  a node they do not offer to change. */
  readonly onUnsee?: (target: string) => void
  /** Write one of the node's properties, from the run of chips under the title
   *  (`./props/PropsDrawer.tsx`). ABSENT is read-only, which is the rule
   *  `onEdit` and `onUnsee` above already follow: a day page and the agenda
   *  draw a node they do not offer to change. */
  readonly onProp?: SetProp
  /** The `•••`'s one property entry, asking for the ADD chip — needed only
   *  where a node carries none, since there is no run for the `+` to sit at the
   *  end of. Passed straight through; the run owns the editor. */
  readonly addingProp?: boolean
  readonly onAddingPropEnd?: () => void
}) {
  const zoomed = () => props.zoomed === true
  const open = () => props.expanded === true
  /**
   * THE ONE DIM LINE a closed row draws under its title, as the runs it is
   * drawn from — or `undefined` for a row that draws none.
   *
   * ONE memo for what used to be two, because the two answers are exclusive by
   * construction and were held so by hand: an excerpt REPLACES the preview
   * (two dim lines under one title, saying nearly the same thing, is the noise
   * this whole feature is against), and a `<Show>` re-stating the other's
   * negation is that rule kept in a condition rather than in the shape.
   *
   * The needles are read FIRST, so an unfiltered page — which is nearly every
   * page — does not subscribe to `desc` twice per row for a line it is not
   * drawing.
   */
  const line = createMemo(() => {
    const needles = props.noteHit
    if (needles !== undefined && needles.length > 0) {
      const desc = props.shows.node.desc
      const runs = desc === undefined || desc === ""
        ? undefined
        : excerptOf(desc, needles)
      if (runs !== undefined) return { runs, hit: true }
    }
    if (props.preview !== true) return undefined
    const desc = props.shows.node.desc
    if (desc === undefined || desc === "") return undefined
    return { runs: [{ text: plainLine(desc), lit: false }], hit: false }
  })

  return (
    <Show
      when={zoomed()}
      fallback={
        <>
          {/* THE PROPERTY RUN, whether the row is open or not. A ROW draws the
              CUSTOM properties only: its id, its mark and its date are already
              on screen — in the glyph, on the date badge, in the address — and
              repeating them here would put two spellings of one fact under one
              title. The node's own page is where the full drawer is
              (`drawerEntries`). Above the clamped note line, because these are
              the node's facts and that line is the start of its story. */}
          <PropsDrawer
            entries={customEntries(customOf(props.shows.node))}
            from={props.shows.file}
            onSet={props.onProp}
            adding={props.addingProp}
            onAddingEnd={props.onAddingPropEnd}
          />

          {/* CLOSED: one clamped dim line under the title, which is either the
              top of the note (`Cozy`) or the window a filter found this row
              through — whatever the density says, because a reader who has
              hidden previews has not asked to be told less about the query
              they just typed. At `compact` with no query there is nothing here
              and the pilcrow says it all. */}
          <Show when={!open() ? line() : undefined}>
            {(one) => (
              <NoteLine runs={one().runs} hit={one().hit} onOpen={props.onToggle} />
            )}
          </Show>

          {/* Open: the note, then what this node sees — and nothing else, which
              is the whole of what the pilcrow now adds. */}
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
                      // what the pilcrow does, and what clicking AWAY does
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
      {/* Zoomed subject: the facts, then the full note, then see, then the
          document inline.

          THE FACTS COME FIRST, as they do on a row — the mockup's own line,
          "facts above the line, story below it"
          (docs/brainstorming/props-ui.html). They used to sit under the note
          here and over it there, which was one component reading two ways on
          two surfaces for no reason anybody had written down.

          And the drawer is drawn WHATEVER the node carries: this is a page
          about one node, its facts are what the page is for, and the id in
          particular is what every tool call and every `((` reference takes. */}
      <PropsDrawer
        entries={drawerEntries(props.shows.node)}
        from={props.shows.file}
        onSet={props.onProp}
        adding={props.addingProp}
        onAddingEnd={props.onAddingPropEnd}
      />
      <Show when={props.shows.node.desc}>
        {(desc) => (
          <Note
            desc={desc()}
            from={props.shows.file}
            class="mt-2 text-muted"
          />
        )}
      </Show>
      <EdgeRefs node={props.shows.node} relation="see" onRemove={props.onUnsee} />
      <Show when={docOf(props.shows)}>
        {(doc) => <DocRef file={doc()} inline />}
      </Show>
    </Show>
  )
}
