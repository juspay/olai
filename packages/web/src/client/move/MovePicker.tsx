/**
 * The move-to picker: search every outline for a new parent, and put this row
 * under the one you choose — with everything hanging off it.
 *
 * Workflowy's `Ctrl+Shift+M` read through this app's own doctrine. What that
 * gesture IS — a keyboard door onto "this branch belongs somewhere else", asked
 * of a set too big to scroll — is exactly what arrived; what it is DRAWN as is
 * the shape this client already has for a write that needs a value chosen. A
 * dialog floating over the tree would be the one editing surface with geometry
 * of its own to keep anchored while the page scrolls, and the one that lands
 * under a thumb on a phone (`../date/DatePicker.tsx` made that argument,
 * `../edges/EdgePanel.tsx` repeated it, and this is a third surface of the same
 * kind rather than a first surface of a new one). So it hangs UNDER the row it
 * was opened on, where everything else a row says about a write is drawn.
 *
 * ## The list is the SHORTLIST, which is the other panel's too
 *
 * The box, the walk, the rows and the four keys are `../search/Shortlist.tsx` —
 * the same component the edge panel's target search draws, over the same
 * server-side reading every other door in this client asks (`../search/
 * nodes.ts`). So what this finds and what an agent's `search_nodes` finds
 * cannot drift, and neither can this door and the one next to it.
 *
 * The query is the full grammar, so `is:todo`, `#home` and `file:garden.olai`
 * all narrow the destinations — and `is:trashed` reaches into the Trash, where
 * every hit is refused by name rather than quietly missing. Archived nodes are
 * out of the default answer already (the matcher's own rule), so that refusal
 * is for the reader who asked for them on purpose.
 *
 * ## What is THIS door's: which destinations it will not take
 *
 * The picker searches the WHOLE SET, so most of what it can find is somewhere
 * this row cannot go. Every hit is drawn anyway — the edge panel's rule, for
 * the edge panel's reason: a browser that dropped rows would be teaching a rule
 * this app does not have, and a reader hunting for a title they can see is a
 * reader debugging a search. What is drawn instead is the REASON, under the
 * list, about the row the cursor is on — the aim rather than the write, which
 * is the shape a drop over the wrong pane already has (`../drag/Refusal.tsx`,
 * #238). `Enter` there sends nothing: the answer is already on screen.
 *
 * Which destinations those are, and in what words, is `@olai/format`'s `moving.ts` —
 * pure, and unit-tested, because a sentence a reader depends on is not a thing
 * to check by hand. It is the one thing this component hands the shortlist that
 * the other door does not.
 *
 * ## One press, and the refusals that are still the ops layer's
 *
 * What lands is one `under` edit at the same gate every other write goes
 * through, resolving to the `move_node` an agent sends. A destination this
 * panel says nothing about can still be refused there — an id that has moved
 * since the search answered, a file that stopped parsing — and that sentence
 * lands verbatim under the row (`./moving.tsx` owns the line, because it
 * outlives the panel a landed write closes).
 */

import type { Edit } from "@olai/surface"
import type { Accessor } from "solid-js"

import type { Moved } from "@olai/format"

import { renderTitle } from "../markdown/title.ts"
import { TitleHtml } from "../markdown/TitleHtml.tsx"
import { Shortlist, type ShortlistTestids } from "../search/Shortlist.tsx"
import { TESTID } from "../testids.ts"
import { PANEL_OUT } from "../pill.ts"

/** What this door calls the parts of its shortlist. */
const MOVE_LIST: ShortlistTestids = {
  box: TESTID.moveSearch,
  row: {
    row: TESTID.moveHit,
    place: TESTID.moveHitPlace,
    prop: TESTID.moveHitProp,
  },
  failed: TESTID.moveSearchFailed,
}

export function MovePicker(props: {
  /** The row being moved, as the set says it NOW — re-read per frame by the
   *  host, so a panel standing open while another writer moves the row is
   *  judging against where it has actually got to. */
  readonly moved: Moved
  /** Why each destination cannot take the row, by id — the server's verdicts,
   *  for the hits this list is drawing (`./moving.tsx`, which owns the one
   *  subscription both halves of this gesture read). A hit with no entry is one
   *  that can take it. */
  readonly refusals: ReadonlyMap<string, string>
  /** WHICH DESTINATIONS are on screen — the argument the host's subscription is
   *  asked with. An ACCESSOR, handed up once: the list is what knows its hits
   *  and the host is what asks about them, and a derivation is the honest shape
   *  for that (`./moving.tsx` says what a report cost instead). */
  readonly onAimed: (ids: Accessor<ReadonlyArray<string>>) => void
  /** Send it. The host knows the write gate, the undo stack and where the
   *  answer is drawn (`./moving.tsx`); this knows which destination. */
  readonly onWrite: (edit: Edit) => void
  readonly onClose: () => void
}) {
  return (
    <div
      class="my-1 w-[min(28rem,90vw)] rounded border border-rule/70 bg-panel p-2"
      data-testid={TESTID.movePicker}
      // WHICH ROW it is about, as a fact in the markup rather than something a
      // reader has to infer from where it is drawn — the row moves under it
      // when a write lands, and this is what says the panel followed.
      data-row={props.moved.id}
      // ESCAPE IS THE PANEL'S, wherever the caret is inside it — the box, a
      // destination, or the way out somebody tabbed to. `../edit/RowPanel.tsx`
      // listens on its wrapper for exactly this reason, and the shortlist
      // deliberately lets the key bubble here rather than answering it at the
      // one element the caret usually happens to be on.
      //
      // Stopped HERE: the row's own editor and the ⌘K palette both listen for
      // Escape further up, and one key must not close two things.
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        event.preventDefault()
        event.stopPropagation()
        props.onClose()
      }}
    >
      <p class="m-0 mb-1 text-xs text-muted">
        Move{" "}
        {/* Drawn as a title, since that is what it is: markdown and `#tags`
            in their pills and hues through the one pipeline
            (`../markdown/title.ts`) — the row being moved reads as in the
            tree, so what the reader is relocating is not a second, flatter
            spelling of it. The pipeline rather than `../NodeTitle.tsx`, as
            in the list below: this panel is no page, and a title naming an
            address reads as written. */}
        <span class="text-ink">
          <TitleHtml drawing={renderTitle(props.moved.title, props.moved.file)} />
        </span>{" "}
        under…
      </p>

      <Shortlist
        label="search every outline for a new parent"
        testids={MOVE_LIST}
        refusing={{
          testid: TESTID.moveRefused,
          // WHICH HITS are being judged, handed up so the host can ask about
          // exactly these (`./moving.tsx`). The ids are read THROUGH the
          // shortlist's own accessor rather than copied out of it, so what the
          // host holds is the list as it stands and not as it stood.
          asked: (hits) => props.onAimed(() => hits().map((hit) => hit.id)),
          // NOTHING SAID is the frame before the verdicts for this list have
          // come back, and the answer then is `null` rather than a refusal:
          // this is a preview of the planner's verdict, and with nothing to
          // preview from, the planner is the one that answers. A refusal
          // invented here would be a fence.
          why: (hit) => props.refusals.get(hit.id) ?? null,
        }}
        onTake={(hit) => props.onWrite({ verb: "under", id: props.moved.id, parent: hit.id })}
      />

      <div class="mt-1 flex items-center justify-end">
        <button
          type="button"
          class={PANEL_OUT}
          data-testid={TESTID.movePickerClose}
          onClick={() => props.onClose()}
        >
          Done
        </button>
      </div>
    </div>
  )
}
