/**
 * The editor: one draft, the keys that move it, and the writes they cause.
 *
 * Everything here is about ONE CARET — there is exactly one live draft in
 * this tab, because there is exactly one caret — and every write it makes is
 * the surface's one `edit` procedure, which is a single op at the same write
 * gate the agent's tools go through. Empty drafts that have been left behind
 * (Enter Enter Enter) stay on screen as parked slots until the page closes;
 * they are not a second caret. Nothing in this module touches an outline, a
 * record or a placement: what `Tab` MEANS is resolved on the server, against
 * the snapshot the write is judged against (`packages/server/src/edit.ts`).
 *
 * So the whole of what this file owns is the loop a person is in:
 *
 *   - what is being typed, and into which row ({@link ./draft.ts});
 *   - when that gets committed — blur, `Enter`, idle;
 *   - where the caret goes afterwards;
 *   - what the write said back, refused or not.
 *
 * **A structural key does not race the draft it interrupted.** `Tab` on a
 * half-typed row commits the text first and then moves the row, in that order,
 * because the two are one thought and the second would otherwise be judged
 * against a record whose title is still the old one. Every write goes through
 * one QUEUE (`enqueue`) for the same reason — a person types faster than a
 * round trip, and two writes in flight over one draft are two writes derived
 * from a state neither of them can see.
 *
 * **Which id an edit names is a rule, and the draft carries both halves of
 * it.** An edit to what a node SAYS — its title, its note, its mark — names
 * the node the row SHOWS, so typing in a mirror edits the node it stands for,
 * which is what a mirror is for. An edit to where a row SITS names the row's
 * own record, so moving a mirror moves the placement and leaves the node where
 * it lives, and `Enter` on a mirror makes a sibling of the mirror.
 *
 * **Nothing is optimistic, and the caret is what that costs.** A row moves on
 * screen when the file says so — so between `Tab` and the frame that answers
 * it, the row being typed in is still where it was, and then it is somewhere
 * else, drawn by a branch that did not exist before. Keeping a person's place
 * across that is this file's real work, and it is one rule: a draft is about a
 * ROW, and where that row is drawn is RE-FOUND when the key it was drawn at
 * stops being drawn (`follow`, below). The alternative — echoing the move locally so the row never
 * appears to leave — is the optimistic UI this whole design is written
 * against.
 */

import type { Row } from "@olai/format"
import type { Anchor, Edit } from "@olai/surface"
import { debounce } from "@solid-primitives/scheduled"
import {
  type Accessor,
  type Signal,
  createContext,
  createEffect,
  createMemo,
  type JSX,
  untrack,
  useContext,
} from "solid-js"
import { Result } from "effect"

import { datePick } from "../date/pick.ts"
import { setFolded } from "../fold/memory.ts"
import { foldIdOf, foldOf } from "../fold/rows.ts"
import type { Caret, EditAction } from "../keys.ts"
import { runAsync } from "../run.ts"
import type { Moving } from "../move/moving.tsx"
import { parentKeyOf } from "../select/range.ts"
import type { Selection } from "../select/selection.ts"
import { olai } from "../wire.ts"
import {
  after,
  besideOf,
  before,
  commitOf,
  emptyPending,
  emptyPendingOf,
  IDLE_COMMIT,
  type Beside,
  type Draft,
  type Editing as RowDraft,
  kept,
  landed,
  parked,
  type Pending,
  reaimed,
  refused,
  sameSlot,
  type Slot,
  slotOf,
  stillAt,
  typed,
} from "./draft.ts"
import { flatten, reanchored, refound, seated } from "./order.ts"
import type { Standing } from "./order.ts"
import { editorMemory, type EditorMemory, type EditorRange } from "./memory.ts"
import { redraws, rekeys } from "./redraws.ts"
import { useUndo } from "./undoing.ts"

export interface Editor {
  /** Consume the range inherited from a previous instance of this editor. */
  readonly takeRange: (slot: Slot | undefined) => EditorRange | undefined
  /** Record the browser selection for a later rebuild of the same draft. */
  readonly rememberRange: (range: EditorRange) => void
  /** Keep Escape's completion dismissal with its draft; a fresh edit resets it. */
  readonly completionDismissal: (slot: Slot | undefined) => Signal<string | null>
  /** The draft, or `null` when nothing is being typed. It carries what the
   *  last write said, refused or not — one value, so replacing it cannot leave
   *  a stale reason on screen.
   *
   *  Read it INSIDE a row that {@link where} has already matched. Every row of
   *  the tree asks whether the caret is in it, and this value changes on every
   *  keystroke — so a tree that matched on this would re-run its whole depth
   *  per character typed. */
  readonly draft: Accessor<Draft | null>
  /** Empty drafts left on screen while the caret is elsewhere — Enter Enter
   *  Enter parks each one rather than collapsing it. The live draft is not
   *  in this list; a row reads both to draw every ghost at its anchor. */
  readonly ghosts: Accessor<ReadonlyArray<Pending>>
  /** Put the caret in a parked empty draft. Clicking a ghost that is already
   *  on screen is how a skeleton gets filled in. */
  readonly resume: (slot: string) => void
  /** WHERE the caret is, and nothing about what is being typed there: the
   *  `Row.key` of the row being edited, the row a new line is drawn after or
   *  before, and which field. Primitives, so they answer the same value while
   *  a person types and a row's match stops propagating. */
  readonly where: Accessor<Where>
  /** A counter the open editor watches: every bump means "take the caret
   *  back". It is bumped after the ops that redraw the row the key was pressed
   *  in, because moving an element in the document is what takes focus off it
   *  (`./RowEditor.tsx` says the rest). */
  readonly caret: Accessor<number>
  /**
   * Start editing a row's title (a click on it) or its note.
   *
   * `at` is how the caret got here. A click names the offset it landed on
   * (`./point.ts`). Absent is the end of the text — the filler, a note,
   * the move-to picker handing the row back.
   */
  readonly open: (row: Row, field: "title" | "desc", at?: OpenAt) => void
  /** What has just been typed. Starts the idle clock. */
  readonly type: (text: string) => void
  /** Text typed into a parked slot while its activation waits for a write. */
  readonly typeParked: (slot: string, text: string) => void
  /** The editor at this slot lost focus: commit, and close if it landed. It
   *  says which slot because a blur arrives after the draft may already have
   *  moved on — see {@link ./draft.ts}'s `Slot` — and whether the element is
   *  still IN the document, because an editor removed by a re-render did not
   *  lose focus to a person. */
  readonly blur: (from: Slot, left: boolean) => void
  /** One of the editing keys. Which row it was pressed in is the draft's to
   *  say — there is one caret, and it knows where it is; WHERE IN THE LINE it
   *  is comes in, because two of the keys cut the text at that point and this
   *  module reads no elements. */
  readonly press: (action: EditAction, at?: Caret) => void
  /** The `!` widget chose a day: commit the line and put that date on the node
   *  this row shows. The ten characters as picked — a date is text
   *  ({@link ../date/DatePicker.tsx}), and nothing between here and the
   *  validator parses one. */
  readonly dated: (day: string) => void
  /** The `((` widget chose a node: draw a second copy of it here. */
  readonly mirrored: (target: string) => void
  /** Open an editor for a row a page has nowhere else to offer — the first row
   *  of an empty outline, the first child of an empty branch. */
  readonly start: (at: Anchor) => void
}

/** How {@link Editor.open} was asked, when the caller has an opinion. */
export interface OpenAt {
  /** Offset into the source. Clamped to the title. Absent is the end. */
  readonly caret?: number
}

/**
 * Where the two ZOOM keys land, handed in because what they name is a ROUTE:
 * this module knows how to leave a row cleanly and knows nothing about
 * addresses (the same split {@link createEditor}'s `moving` argument keeps:
 * the shape of leaving is the editor's, the destination is the page's).
 *
 * The two verbs. `into` names a record the editor already holds — the page
 * of the zoomed row. `out` is the page ABOVE, and it is OPTIONAL for one
 * reason: an outline has none. Its ABSENCE is that answer, so a zoom-out at
 * the widest zoom reads as "not there" rather than as a sentinel a second
 * member would have to be taught to read.
 */
export interface Zooming {
  readonly into: (id: string) => void
  readonly out?: () => void
}

/**
 * Where the caret is — the part of a draft a ROW has to know, split out from
 * the part it must not read.
 *
 * A tree asks "is the caret in me?" once per row, and the answer changes when
 * the caret MOVES rather than when a character is typed. Three primitives
 * compare equal across a keystroke, so the memo each row holds answers the same
 * thing and propagates nothing; the one row that matched then reads the draft
 * for its text. Before this, one character typed re-ran a memo in every row of
 * the tree.
 */
export interface Where {
  /** The `Row.key` being edited, or `null` — no row draft, or one whose row
   *  is not drawn yet. */
  readonly place: string | null
  /** The row a NEW line is drawn against, after or before it. One field, so
   *  a live draft cannot be both. `null` when there is no pending draft, or
   *  it belongs to a page's start line (`under` / `first`). */
  readonly pending: Beside | null
  readonly field: "title" | "desc" | null
}

const NOWHERE: Where = { place: null, pending: null, field: null }

/** What {@link createEditor}'s `drawn` answers with when there is no caret in
 *  a row — one array, so a page with nothing being typed in it hands back the
 *  same reference every frame and notifies nobody. NOT `NOTHING_DRAWN`, which
 *  is `../page.ts`'s and is a PAGE with nothing on it; this is a list. */
const NO_ROWS: ReadonlyArray<Row> = []

/** What a write that LANDED tells this editor: the node it turned out to be
 *  about, what that node says now, and whatever the rollup had to say. The
 *  surface's `Applied` minus the half only the undo stack reads — named once,
 *  because a fourth thing a write answers with should be one edit here and not
 *  two literal types to keep in step. */
type Landed = { readonly id: string; readonly title: string; readonly nudge?: string }

const EditorContext = createContext<Editor>()

export function EditorProvider(props: {
  readonly editor: Editor
  readonly children: JSX.Element
}) {
  return (
    <EditorContext.Provider value={props.editor}>
      {props.children}
    </EditorContext.Provider>
  )
}

/** The editor, or a throw when a row is drawn outside the provider — which is
 *  a bug in this app rather than a state a reader can reach. */
export const useEditor = (): Editor => {
  const editor = useContext(EditorContext)
  if (editor === undefined) throw new Error("a row editor outside <EditorProvider>")
  return editor
}

export const createEditor = (
  /** The rows on screen, what is folded — the two halves of "what is drawn",
   *  which is what the arrows move through and where a row that has moved is
   *  found again — and how many FRAMES the page's reading has moved on, which
   *  is what {@link settle} waits for. */
  page: {
    readonly rows: Accessor<ReadonlyArray<Row>>
    readonly collapsed: Accessor<ReadonlySet<string>>
    readonly frames: Accessor<number>
  },
  /**
   * The page's multi-selection (`../select/selection.ts`). Handed in rather
   * than read from a context, because the two are created together by the same
   * page and the order between them is what makes "a caret or a pick, never
   * both" a fact about this file rather than a habit.
   *
   * FOUR VERBS, and `clear` is the load-bearing one: every way a caret OPENS
   * goes through {@link Editor.open} or {@link Editor.start}, so putting the
   * pick away there is the whole of the invariant — where doing it at the call
   * sites is a rule each new one has to remember. It was a rule, and the note
   * forgot it (review, 2026-08-14): clicking a note opened a caret with the
   * pick still live, which left `Tab` claimed by the field while the bar said
   * rows were picked.
   */
  selection: Pick<Selection, "start" | "grow" | "widen" | "clear">,
  /**
   * The page's move-to picker (`../move/moving.tsx`), handed in for the reason
   * the selection above is: the two are made together by the same page, and
   * `⌘⇧M` is a key of this editor's that opens something that is not.
   *
   * ONE VERB, which is the whole of the coupling: this file knows how to leave
   * a row cleanly and knows nothing about destinations, searches or the write
   * that eventually lands.
   */
  moving: Pick<Moving, "open">,
  /**
   * The page's two answers to the ZOOM keys ({@link Zooming}), handed in for
   * the reason `moving` above is: this file knows how to leave a row cleanly;
   * where that goes is an address, and addresses are the page's.
   */
  zooming: Zooming,
  memory: EditorMemory = editorMemory(),
): Editor => {
  const { draft, setDraft, ghosts, setGhosts, caret, setCaret, mintSlot, enqueue } = memory
  let retainedRange = memory.range
  memory.range = undefined
  createEffect(() => {
    if (draft() !== null) return
    memory.completion.slot = undefined
    memory.completion.dismissed[1](null)
  })
  /** Leave an empty pending on screen without it holding the caret. Same
   *  slot is a no-op, so parking twice cannot duplicate a ghost. A titled
   *  draft, or nothing, is left alone — parking is not how a write happens. */
  const parkIfEmpty = (held: Draft | null): void => {
    setGhosts((list) => parked(list, held))
  }
  /** Open a fresh empty pending at this anchor and take the caret. One
   *  place mints the slot, so continued / inserted / start cannot disagree
   *  about the three fields a new row starts with. */
  const openPending = (at: Anchor): void => {
    setDraft(emptyPending(at, mintSlot()))
    setCaret((n) => n + 1)
  }
  /** Where a write's inverse goes. Read once, here, rather than at every
   *  write: it is the app's, it does not move, and a context read inside a
   *  promise would be reaching outside the scope that owns it. */
  const undo = useUndo()

  /**
   * Every write this editor makes, in the order the keys were pressed.
   *
   * A person types faster than a round trip. `Tab` twice, an idle commit
   * overtaken by a blur, a click on another row while the first is still
   * saving — each of those is two writes in flight over ONE draft, and they
   * are not independent: the second is derived from what the first did (the
   * id an `add` answers with, the place a move produced, whether the text
   * saved at all). Run concurrently they interleave, and the failure is
   * invisible in a way this whole design is written against: nobody would see
   * the second one land against the row the first one moved.
   *
   * So it is a queue of one ({@link ./queue.ts}, which is where the reason a
   * step that THROWS must not wedge the ones after it lives) — and the
   * sequencing the header promises is this line rather than a habit of
   * awaiting in the right places.
   *
   * What is NOT queued is what a person must never wait for: typing
   * ({@link Editor.type} is a signal write) and `Escape`, which abandons.
   */

  /** The caret's own three facts, memoised so typing does not move them. */
  const where = createMemo<Where>(() => {
    const held = draft()
    if (held === null) return NOWHERE
    if (held.kind === "new") {
      return { place: null, pending: besideOf(held.at), field: null }
    }
    return { place: held.place, pending: null, field: held.field }
  }, NOWHERE, {
    equals: (a, b) =>
      a.place === b.place && a.field === b.field &&
      a.pending?.kind === b.pending?.kind && a.pending?.id === b.pending?.id,
  })

  /**
   * THE PAGE AS THE EYE RUNS DOWN IT, walked once per frame and only while a
   * caret is in a row.
   *
   * Three things in this file need it and each used to walk the tree for
   * itself: `follow` re-finds the row a draft is drawn at, `row` looks that row
   * up, and `step` takes the next one along. `flatten` is the whole VISIBLE
   * tree, so an open draft paid it once per FRAME for `follow` — which is an
   * effect, so a keystroke anywhere in the vault or a mark somebody else set
   * runs it — and again per CALL for the other two, which arrive from key
   * handlers outside any tracking scope
   * (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/reactivity-after-the-flip.md §4.8). One memo is one
   * walk per frame, and the other two read what it already answered.
   *
   * GATED ON {@link where}, which is what keeps this from being a fourth cost
   * rather than a saving: a page with no caret in it walks nothing, and `where`
   * compares its three primitives by value, so a person TYPING does not move it
   * — the memo re-runs on frames, which is exactly when the answer changes. A
   * row draft is the one state all three readers are reachable from, and it is
   * the one state with a `field` on it.
   */
  const drawn = createMemo<ReadonlyArray<Row>>(() =>
    where().field === null ? NO_ROWS : flatten(page.rows(), page.collapsed())
  )

  /** Every blank ON THE PAGE — the parked ones, and the live draft when it is
   *  one. What the wire is drawn from, so the three keys that walk it
   *  ({@link step}, {@link merge}, {@link resketching}) see the same lines. */
  const blanks = (held: Draft | null): ReadonlyArray<Pending> =>
    held?.kind === "new" ? [...ghosts(), held] : ghosts()

  /**
   * Whether a REDRAW of the row the caret is in is still expected.
   *
   * It answers two questions that are one question: whether the caret is owed
   * back, and whether a blur is OURS. A row that moves among its siblings
   * keeps its editor and its place, so nothing else can tell the document
   * moving an element from a person clicking away — and closing the row
   * somebody is mid-keystroke in is the one thing that must not happen.
   *
   * It is NOT the lifetime of the call, which is the obvious reading and the
   * wrong one: the write answers on one channel and the file arrives on
   * another, so clearing this when the procedure resolves would leave the
   * redraw — the thing that takes the focus — outside the window it exists to
   * cover. So it is cleared by the FRAME (below), and by a refusal (which
   * writes nothing, so no frame will ever come and a debt left owing would
   * suppress every later blur in the session).
   */
  let settling = false

  /** The caret is settled on the frame that redraws the row, and again when
   *  the write answers — because the two arrive in either order. The server
   *  publishes the new revision inside the commit and answers afterwards, so
   *  the redraw may come before the procedure resolves or after it; taking the
   *  caret once on each is what covers both, and the second focus of an
   *  already-focused input costs nothing. */
  const settle = () => {
    // Tracked, and read first: the frame that redrew the row is what this is
    // waiting for, and an effect runs after that row has been moved.
    //
    // THE FRAME COUNT and not the rows, which is a correction the page reading
    // forced (`https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`'s PR 10). This used to
    // read `page.rows()`, and it worked because the rows were a fresh array on
    // every frame — the tab derived them from its own copy of the set. They
    // arrive on a subscription now, whose value is a RECONCILED STORE: the
    // array's identity survives every frame and its elements move underneath,
    // so a shallow read of it notifies for nothing and a mark that did not move
    // the row would leave this debt owing for ever — suppressing every later
    // blur in the session. What this is waiting for is a FRAME, and that is
    // what it now reads (`../reading.tsx`'s `Reading.at`).
    page.frames()
    if (!settling) return
    settling = false
    setCaret((n) => n + 1)
  }
  createEffect(settle)

  /**
   * The row a draft is drawn at, found again when it has moved.
   *
   * A draft names a ROW, and where that row is drawn is a `Row.key` — the
   * chain of ids from the root of the page — so `Tab` changes it: the row that
   * was `…/install/measure` is `…/handles/measure` the moment the file says
   * so. That is the honest consequence of having no optimistic UI. It is also
   * how a row that did not exist when `Enter` was pressed gets located:
   * `landed` leaves the place `null` and the frame carrying the new row fills
   * it in.
   *
   * The RULE itself is `./order.ts`'s (`refound`), because a multi-selection
   * needs the same one over a set of places — this is the effect that applies
   * it to the one place a caret is in.
   */
  const follow = () => {
    // The PRIMITIVES, so typing does not run this: what it needs is where the
    // caret is and which record it is about, and neither moves per keystroke.
    const at = where().place
    const held = untrack(draft)
    if (held === null || held.kind !== "row") return
    const moved = refound(drawn(), held.row, at)
    if (moved !== undefined && moved !== at) setDraft({ ...held, place: moved })
  }
  createEffect(follow)

  /**
   * The write. Answers what the edit turned out to be about — the node, and
   * whatever the rollup had to say about it — or `null` when it was refused,
   * in which case the reason is on the draft that CAUSED it.
   *
   * `from` is which editor that is, and it is not ceremony: a refusal arrives
   * after the write, and by then the caret may be somewhere else. Pinned, a
   * reason lands on the row whose text is still unsaved; unpinned, the next
   * row inherits an alarm about a write it had nothing to do with. The queue
   * above makes that rare and this makes it impossible.
   */
  const send = async (edit: Edit, from: Slot): Promise<Landed | null> => {
    const pending = runAsync(olai.procedures.edit.apply(edit))
    // A blur can leave focus on the page before this reply arrives. Reserve
    // its place now so Undo pressed there follows this write, including when
    // there are older edits already on the stack.
    undo.record(pending.then((outcome) =>
      Result.isSuccess(outcome) ? outcome.success.undo : undefined
    ))
    const outcome = await pending
    if (Result.isSuccess(outcome)) {
      return outcome.success
    }
    setDraft((held) =>
      held !== null && sameSlot(slotOf(held), from) ? refused(held, outcome.failure) : held
    )
    return null
  }

  /**
   * Commit what is in the editor, if anything, and say whether the caret can
   * carry on: `false` only when a write was refused, which is the one outcome
   * that stops a sequence. What the draft BECAME is read off `draft()`
   * afterwards — the signal is where it lives, and a second copy in a return
   * value would be one to keep in step.
   */
  const commit = async (): Promise<boolean> => {
    const current = draft()
    if (current === null) return true
    const edit = commitOf(current)
    // Nothing to say: an untouched row is not a write, and an empty new row is
    // not a node.
    if (edit === null) return true
    idle.clear()
    const done = await send(edit, slotOf(current))
    if (done === null) return false
    // Only when the editor is still on the same draft: a commit that landed
    // while the reader had already moved on must not drag them back.
    setDraft((held) => (held === current ? landed(current, done.id, done.nudge) : held))
    // Remaining ghosts at the same place: `before`/`first`/`under` re-aim
    // onto the row that landed, so they stay above it (and a start line
    // that has just unmounted is not the last they are seen). `after`
    // keeps its neighbour.
    if (current.kind === "new") {
      setGhosts((list) => reaimed(list, current.at, done.id))
    }
    return true
  }

  /**
   * A structure key on a BLANK, before it goes anywhere near the queue.
   *
   * The two lives of one key: a row that EXISTS is moved by the ops layer — a
   * write, the queue, the redraw, the caret-follow and all — but a sketch is
   * alive before any of that: it moves by its ANCHOR alone, and the whole key
   * is the local one — no write, no round trip, nothing on disk. A refusal the
   * ops layer would otherwise have harangued about never exists, because the
   * row it would have pinned hasn't been asked for — and the one thing a key
   * CAN still say no to is a seat with no side to slip on.
   *
   * Computed on the WIRE the blank is drawn by ({@link ./order.ts}’s
   * `reanchored`) — where the anchor points the same way the eye walks. One
   * rule with the commit the sketch becomes: this walks the same anchors.
   */
  const resketching = (
    how: "in" | "out" | "up" | "down",
    name: (draft: RowDraft) => Edit,
    at?: Caret,
  ): void => {
    const sketch = emptyPendingOf(draft())
    if (sketch !== null) {
      const next = reanchored(page.rows(), page.collapsed(), sketch, how, ghosts())
      if (next === undefined) return
      // The seat is a drawing address — if the branch that holds it reads
      // COLLAPSED, the key lifts the fold first: the ghost must be ON the
      // page it says it is at, and the row `Enter` commits may not land in
      // a fold (Workflowy's own answer, the review of #493's demand).
      if (next.open !== undefined) setFolded([next.open], false)
      idle.clear()
      // A NEW SLOT for the new seat. The anchor IS a drawing address, so the
      // blank jumps somewhere else on the page and the input remounts there —
      // and the blur from the ONE going belongs to that address: it arrives
      // with the slot of this sketch's past self, and `sameSlot`'s whole
      // "the row it opened is not this one's to close" then holds as written,
      // because the old element and the new one genuinely hold different
      // addresses now. Keeping one slot made the remount's blur park the very
      // draft the key was rearranging.
      setDraft({ ...sketch, at: next.at, slot: mintSlot() })
      return
    }
    enqueue(() => structural(name, at))
  }

  /** The idle commit. Scheduled by every keystroke and cancelled by every
   *  commit, so a person who keeps typing causes one write rather than one per
   *  pause. */
  const idle = debounce(() => enqueue(commit), IDLE_COMMIT)
  if (draft() !== null) idle()

  /** The row the caret is in, as the page is drawing it now. */
  const row = (): Row | undefined => {
    const held = draft()
    if (held === null || held.kind !== "row") return undefined
    return drawn().find((one) => one.key === held.place)
  }

  /** Put the caret in another row's title, committing whatever was being typed
   *  first. A refusal stops it: the row that would not save is the row to
   *  stay in. */
  const move = async (to: Row | undefined) => {
    const next = to === undefined ? null : opened(to, "title")
    if (next === null) return
    if (!(await commit())) return
    setDraft(next)
  }

  /**
   * A write that REDRAWS the row it was pressed in — every structural key, and
   * both of the compound ones.
   *
   * ONE place owns the `settling` debt, because the two halves of it are a rule
   * rather than a step: it is noted BEFORE the write (the frame that redraws
   * the row can arrive while the call is still in flight) and cleared when the
   * write is REFUSED (no write means no frame, so nothing is owed — and a debt
   * left standing goes on suppressing blurs, which means the next thing typed
   * into this row is never committed at all; `Tab` on the first of its siblings
   * is the ordinary way to reach that). Three callers each remembering both
   * halves is the rule kept in memory rather than in code.
   */
  const redrawing = async (edit: Edit, from: Slot) => {
    settling = true
    const done = await send(edit, from)
    if (done === null) settling = false
    return done
  }

  /**
   * An op for the row the caret is in: commit the text, then ask.
   *
   * The id is read AFTER the commit, so `Tab` works on a line that did not
   * exist when the key was pressed — the add has landed by then and the draft
   * is the row it created.
   *
   * WHETHER A REDRAW IS OWED is asked of the EDIT ({@link ./redraws.ts}) rather
   * than passed in by the caller: not every write here can move the row, the
   * answer is a fact about the verb, and a per-call-site flag is something the
   * next caller can get wrong in a way nothing notices. That file holds the
   * list, the argument for each side of it, and the measurement of what being
   * wrong actually costs — which is narrower than it sounds and was overstated
   * once.
   */
  const structural = async (
    name: (draft: RowDraft) => Edit,
    /** Where the caret is in the line. Handed to every key that has one, and
     *  read only by the writes {@link ./redraws.ts}'s `rekeys` names — which
     *  is what keeps "does this key owe the caret its place" a fact about the
     *  VERB rather than something each new key has to remember. */
    at?: Caret,
  ) => {
    if (!(await commit())) return
    const open = draft()
    if (open === null || open.kind !== "row") return
    const edit = name(open)
    /**
     * WHERE THE CARET GOES if this row's editor is drawn again somewhere else,
     * written onto the draft BEFORE the write goes.
     *
     * A write that rekeys the row replaces the editor rather than moving it, so
     * a fresh one opens at the end of the text and somebody who pressed `Tab`
     * mid-word is thrown to the end of their own title
     * ({@link ./redraws.ts} carries the argument). The draft is what survives
     * the row being redrawn, so the offset rides on it, exactly as a split's
     * and a merge's do ({@link ./draft.ts}'s `caret`).
     *
     * BEFORE the write, and that is the load-bearing half: the frame that
     * redraws the row can arrive while the call is still in flight, and by then
     * `follow` has already moved the draft and the new editor has already
     * opened. A caret put on the draft afterwards would be a caret set after
     * the box that reads it was drawn.
     *
     * Every other write puts the SAME draft back, which the signal absorbs —
     * one statement rather than a branch around a write that does nothing.
     */
    const held: RowDraft = at !== undefined && rekeys(edit) ? { ...open, caret: at.start } : open
    setDraft(held)
    const slot = slotOf(held)
    const moved = redraws(edit)
      ? await redrawing(edit, slot)
      : await send(edit, slot)
    // The caret stays in the row that just moved: the same draft, with
    // whatever the write had to say — a `Ctrl+Enter` is the key most likely
    // to earn a nudge, and it never goes through `commit`. A cancel that
    // landed while the write was in flight is left alone (`kept`); putting
    // `held` back is how Escape after a completion bounced the editor open.
    // The caret is taken again because a row that merely moved among its
    // siblings keeps its editor and loses the focus anyway — the document
    // moved the element.
    setDraft((current) => kept(current, held, moved?.nudge))
    setCaret((n) => n + 1)
  }

  /** `Enter`: commit this row, and open an editor where the next one goes. The
   *  new row is not written until it has text — see {@link ./draft.ts}. On an
   *  empty draft, the current one stays on screen and a fresh empty one opens
   *  beside it, which is how Enter Enter Enter becomes a skeleton. */
  const continued = async () => {
    if (!(await commit())) return
    const held = draft()
    if (held === null) return
    if (held.kind === "new") {
      parkIfEmpty(held)
      openPending(held.at)
      return
    }
    openPending(after(held))
  }

  /** `Enter` at column 0 of a titled row: a blank draft ABOVE it. The words
   *  stay; nothing is written until the blank has a title. */
  const inserted = async () => {
    if (!(await commit())) return
    const held = draft()
    if (held === null || held.kind !== "row") return
    openPending(before(held))
  }

  /**
   * `Enter` WITH TEXT ON BOTH SIDES OF THE CARET: this row becomes two.
   *
   * ONE WRITE, and the two halves are the draft's own text — so what is typed
   * and the cut it is being given land together rather than as a commit
   * followed by a split. That is not an optimisation: a commit and then a
   * write derived from it are two revisions, and the one thing a person may
   * never lose is the half of a sentence they had just typed.
   *
   * A row that does NOT EXIST YET is the one case that needs the commit first,
   * for the reason every structural key needs it: there is no node to split
   * until the `add` its draft becomes has landed. `commit()` writes the whole
   * line — nothing is lost even if the split that follows is refused — and the
   * draft it leaves is the row it made.
   *
   * The caret follows the TAIL, at its head, which is where the eye is: the
   * words after the cut are the ones that moved.
   *
   * IT NAMES THE ROW'S OWN RECORD, not the node the row shows — the same id a
   * `merge` names, and the opposite of what a plain text edit does. A split is
   * two things at once: it says what a node SAYS, and it puts a second row on
   * the page. The second half is what decides, because it is the half a reader
   * is looking at: named through a mirror, the tail would be minted beside the
   * TARGET, in the file that node lives in — a page this reader may not have
   * open, where a mirror draws its target's children and never its siblings.
   * The two halves of one sentence would stop being siblings on screen, and the
   * caret would follow the tail off the page (`follow` cannot find a row that is
   * not drawn here, so no editor mounts at all). So a placement is refused, in
   * the ops layer's own `notANode` words, exactly as a merge at one is.
   */
  const split = async (at: Caret) => {
    if (draft()?.kind === "new" && !(await commit())) return
    const held = draft()
    if (held === null || held.kind !== "row" || held.field !== "title") return
    const title = held.text.slice(0, at.start)
    const rest = held.text.slice(at.end)
    idle.clear()
    // WHERE THE TAIL LANDS is this browser's one addition to what the key
    // has always sent — and it is a fact about what is ON SCREEN, which is
    // why it is read here and never on the server: an expanded head's next
    // line is its first CHILD, so a tail placed as the next sibling would
    // land below the whole subtree and carry the caret a page away. A folded
    // or childless head keeps the sibling, which on those pages IS the next
    // line.
    const underRow = row()
    const under = underRow !== undefined && underRow.children.length > 0 &&
      !page.collapsed().has(foldIdOf(underRow))
    const done = await redrawing(
      { verb: "split", id: held.row, title, rest, ...(under ? { under: true } : {}) },
      slotOf(held),
    )
    if (done === null) return
    setDraft(opening(done, 0))
    setCaret((n) => n + 1)
  }

  /**
   * `Backspace` AT THE START OF A LINE: this row joins the one above it.
   *
   * AN EMPTY BLANK is the ordinary abandon — but an abandon WITH AN AIM,
   * which is the one thing Escape is not: the sketch dies — it is NOT
   * parked — and the caret lands on the line above it, the line the ↑ key
   * would have walked to, at the END of its text — the seam a merge with
   * words would have left. A PARKED blank above is a line the eye stops on
   * too (the arrows say so), so a skeleton of blanks is deleted up one line
   * at a time. There is nothing to commit and nothing to refuse: an empty
   * new row is not a node, no write goes out, and "a node needs a title"
   * answered a question this key never asks (the human's report on #493).
   * Nothing above it — the start line is such a page — is where the key has
   * nothing to say, as at the end of any walk.
   *
   * FOR A ROW THAT EXISTS, the commit comes FIRST — and the asymmetry with
   * a split is the ops layer's: a merge joins the two titles THE SET HOLDS
   * and carries no text at all, so a half-typed line has to be on disk
   * before it can be joined onto anything. That is the ordinary "I meant
   * this on the previous line" gesture: `Enter`, type, `Home`, `Backspace`.
   *
   * The ONE case the commit would die on is the case the text is the point:
   * a title ERASED to nothing — select-all, Backspace, then the joining
   * Backspace on what is now an empty line. The erase was the intent; the
   * refusal "a node needs a title" that used to meet it answered a question
   * nobody asked (the human's report on #493). So nothing is committed:
   * the merge CARRIES what the row says now — nothing — the survivor's
   * title stands untouched, and the record keeps its title in the archive,
   * which is what ⌘Z puts back. It is the blank's answer one layer up, to
   * the same key.
   *
   * The caret lands on the SEAM, which is the length of what the row above
   * says now minus the length of what was joined onto it. Both numbers come
   * from the write: the row's own text is what this tab was typing in, and
   * what the row above says is the answer's ({@link ../../../../surface/src/edit.ts}'s
   * `Applied.title`) — never this tab's reading of a tree it drew.
   */
  const merge = async () => {
    const before = draft()
    if (before === null) return
    // A note is prose; the keys that edit a ROW are the row's. (The matcher
    // says the same thing one layer up — this is the guard for a caller that
    // is not the matcher.)
    if (before.kind === "row" && before.field !== "title") return
    const sketch = emptyPendingOf(before)
    if (sketch !== null) {
      const { walk, at } = seated(page.rows(), page.collapsed(), blanks(sketch), {
        kind: "draft",
        slot: sketch.slot,
      })
      const above = walk[at - 1]
      if (above === undefined) return
      if (above.kind === "draft") {
        // The line above is another parked sketch: `take` resumes it, and
        // the one this key was pressed in just ceases — nothing parks it.
        take(above.pending.slot)
        return
      }
      const title = above.row.kind === "node" || above.row.kind === "mirror"
        ? above.row.shows.node.title
        : undefined
      // A dangling row has no title to land in: as good a place to stop as
      // the end of any walk is.
      if (title === undefined) return
      setDraft(opened(above.row, "title", { caret: title.length }))
      return
    }
    // An ERASED title: what the row says NOW is the nothing it was emptied
    // to — commit would refuse it, and the record's title must not be what
    // joins. The merge carries it (the docstring above), and the caret is
    // where any merge's seam is.
    if (before.kind === "row" && before.text.trim() === "") {
      const done = await redrawing(
        { verb: "merge", id: before.row, title: before.text },
        slotOf(before),
      )
      if (done === null) return
      setDraft(opening(done, done.title.length - before.text.length))
      setCaret((n) => n + 1)
      return
    }
    if (!(await commit())) return
    const held = draft()
    if (held === null || held.kind !== "row") return
    const done = await redrawing({ verb: "merge", id: held.row }, slotOf(held))
    if (done === null) return
    setDraft(opening(done, done.title.length - held.text.length))
    setCaret((n) => n + 1)
  }

  /** The row a compound key left the caret in, as the draft that edits it —
   *  the node the write answered with, the text it says now, and where in that
   *  text the caret belongs. Its `place` is `null` because the row it names is
   *  a frame away from being drawn, which is what `follow` fills in. */
  const opening = (done: Landed, caret: number): Draft => ({
    kind: "row",
    row: done.id,
    id: done.id,
    place: null,
    field: "title",
    text: done.title,
    saved: done.title,
    caret,
    ...(done.nudge === undefined ? {} : { nudge: done.nudge }),
  })

  /** `Shift+Enter`: open the note under this row, or close the one that is
   *  open and go back to the title. A note is committed by closing it, the
   *  same way a title is. */
  const note = async () => {
    const open = draft()
    const at = row()
    if (!(await commit())) return
    if (at === undefined) return
    if (open?.kind === "row" && open.field === "desc") {
      await move(at)
      return
    }
    setDraft(opened(at, "desc"))
  }

  /** A row, as the draft that edits it. One place mints these, so the two ids
   *  and the place are read off the row together rather than assembled at
   *  every call site. */
  const opened = (at: Row, field: "title" | "desc", here?: OpenAt): Draft | null => {
    if (at.kind !== "node" && at.kind !== "mirror") return null
    const saved = (field === "title" ? at.shows.node.title : at.shows.node.desc) ?? ""
    const from = here?.caret
    const caret = from === undefined
      ? undefined
      : Math.max(0, Math.min(from, saved.length))
    return {
      kind: "row",
      row: at.at.node.id,
      id: at.shows.node.id,
      place: at.key,
      field,
      text: saved,
      saved,
      caret,
    }
  }

  /**
   * What each key does. A table rather than a chain of `if`s, so the set of
   * actions and the set of behaviours are one list the compiler checks: an
   * action added to {@link EditAction} and not answered here does not compile.
   */
  const ACTIONS: Record<EditAction, (at?: Caret) => void> = {
    // NOT queued: abandoning is the one key that must not wait for a write it
    // is abandoning. A commit already in flight still answers — to the slot it
    // was sent for, which is no longer open, so nothing lands anywhere.
    cancel: () => {
      idle.clear()
      setDraft(null)
    },
    add: () => enqueue(continued),
    insert: () => enqueue(inserted),
    // The two COMPOUND keys. `split` is the only action that needs to know
    // where in the LINE it was pressed — it is what decides the cut — and the
    // matcher cannot spell one without it: an `Enter` with no caret to read is
    // an `Enter` at the end of a line, which `editKey` answers as `add`
    // (../keys.ts). So there is nothing here for a missing one to mean.
    split: (at) => {
      if (at !== undefined) enqueue(() => split(at))
    },
    merge: () => enqueue(merge),
    note: () => enqueue(note),
    // The vertical pair carry the caret's column with them; the horizontal
    // pair is claimed only AT an edge (../keys.ts), and the edge they arrive
    // from is the offset the new line opens with.
    prev: (at) => enqueue(() => step(-1, at?.start)),
    next: (at) => enqueue(() => step(1, at?.start)),
    left: () => enqueue(() => step(-1, Number.POSITIVE_INFINITY)),
    right: () => enqueue(() => step(1, 0)),
    // The MARK is a fact about the node a row SHOWS — which is what the
    // checkbox beside it draws — so a mirror ticks off its target. All three
    // mark keys name that id, and none of them says where the write goes: the
    // two `toggle`s send the mark and let the server read the direction, `walk`
    // sends neither and lets it read both. What a row carries is a fact about
    // the set, and this tab is looking at a frame of it.
    toggle: (at) =>
      enqueue(() => structural((held) => ({ verb: "toggle", id: held.id, mark: "done" }), at)),
    // The FOURTH MARK's key, and the same verb one word over: `toggle` already
    // took the mark it is about, so calling a row off and taking that back is
    // the one intent the server reads the direction of (`../../server`'s
    // `edit.ts`). It is not on the `walk` ring, and that is the ring's own
    // argument — a mark that stamps an instant and lands on a day's page is not
    // a thing to pass through on the way to `doing`.
    "cancel-mark": (at) =>
      enqueue(() =>
        structural((held) => ({ verb: "toggle", id: held.id, mark: "cancelled" }), at)
      ),
    walk: (at) => enqueue(() => structural((held) => ({ verb: "walk", id: held.id }), at)),
    // The DUPLICATE names the ROW's own record, where the two mark keys above
    // name what the row SHOWS — the same split `split` and `merge` make, and
    // the same argument: this key puts rows on the page a reader has open, and
    // a copy of a mirror's TARGET would be a subtree appearing in a file nobody
    // is looking at. So a placement is refused in the ops layer's own words.
    duplicate: (at) =>
      enqueue(() => structural((held) => ({ verb: "duplicate", id: held.row }), at)),
    // The ONE key here that writes nothing: it opens the move-to picker on this
    // row (`../move/moving.tsx`), and what lands is chosen in it. It is the
    // three picking keys' shape rather than a write's — commit what is being
    // typed, then leave the caret — because the panel is what takes focus next,
    // and a draft still open behind it would be a second live editor with the
    // same keys claimed twice.
    moveTo: () => enqueue(() => picking((place, record) => moving.open({ record, place }))),
    // A MOVE is about the row itself, so a mirror moves as the placement it is
    // and the node it stands for stays where it lives.
    // The three that LEAVE the caret. Each commits what is being typed first —
    // a pick is not a way to abandon a draft, Escape is — and then closes it,
    // because a caret and a pick are never both live (`../keys.ts` says why
    // that is what lets the two layers share a key).
    selectUp: () => enqueue(() => picking((from) => {
      selection.start(from)
      selection.grow(-1)
    })),
    selectDown: () => enqueue(() => picking((from) => {
      selection.start(from)
      selection.grow(1)
    })),
    selectAll: () => enqueue(() => picking((from) => selection.widen(from))),
    // Every one of them hands the caret's offset down, and only the two that
    // give the row a new parent read it — which is `./redraws.ts`'s `rekeys`,
    // not a decision made here. An indent draws the row in a branch that did
    // not exist; a reorder leaves it in the one it was in.
    //
    // The BLANK takes the four first: a sketch is re-shaped as a sketch —
    // only its anchor moves, nothing is written — and the key is already
    // right under the finger it was laid out with. `resketching` holds the
    // drawing rule.
    in: (at) => resketching("in", (held) => ({ verb: "move", id: held.row, how: "in" }), at),
    out: (at) => resketching("out", (held) => ({ verb: "move", id: held.row, how: "out" }), at),
    up: (at) => resketching("up", (held) => ({ verb: "move", id: held.row, how: "up" }), at),
    down: (at) => resketching("down", (held) => ({ verb: "move", id: held.row, how: "down" }), at),
    // The BULLET's page, from the key rather than the pointer — and the row
    // being zoomed INTO is the one being typed in, which is why this is
    // `picking`'s three steps exactly: commit, leave the caret, then let the
    // address do the work. The destination is the row's own RECORD, the same
    // reading the bullet's click makes — mirrors included.
    zoomIn: () => enqueue(() => picking((_, record) => zooming.into(record))),
    // ...and the way back, which needs the row the caret was in BEFORE the
    // commit closes it — see `outOf`.
    zoomOut: () => enqueue(() => outOf()),
    // The fold trio writes to the BROWSER's own memory and nowhere else — no
    // queue, no commit: folding hides the row's CHILDREN, so the row with the
    // caret never leaves the screen and the draft is simply left on it.
    fold: () => foldCaret("toggle"),
    collapse: () => foldCaret(true),
    expand: () => foldCaret(false),
  }

  /**
   * `((` chose a node: a second placement of it, drawn as a row.
   *
   * TWO PLACES IT CAN GO, and which one is a fact about the line the widget was
   * typed in rather than a setting:
   *
   *   - a line that is still a DRAFT and holds nothing else becomes the mirror.
   *     That is the Workflowy gesture exactly — `Enter`, `((`, choose — and it
   *     falls out of what a draft already is: an empty one writes no node
   *     ({@link ./draft.ts}), so the row that was going to be minted there
   *     simply is the placement instead, at the same anchor.
   *   - anywhere else, the mirror is the NEXT row: the line keeps its words
   *     (committed first, like every structural key) and the placement lands
   *     immediately after it. A mirror is a whole row in this format — exactly
   *     `{id, parent, ord, mirror}`, with no text of its own — so it cannot be
   *     put INSIDE a sentence the way Workflowy's inline reference is. Beside
   *     the sentence is the honest reading of the same gesture.
   *
   * The anchor names the ROW rather than what it shows, which is `Enter`'s own
   * rule: the placement appears where the reader is looking.
   */
  const mirrored = async (target: string): Promise<void> => {
    const before = draft()
    const empty = emptyPendingOf(before)
    if (empty !== null) {
      const done = await send({ verb: "mirror", target, at: empty.at }, slotOf(empty))
      if (done === null) return
      // The line the caret was standing on is a record the file holds now, and
      // it is not one this editor can type in — so the draft is spent rather
      // than followed.
      setDraft(null)
      return
    }
    // Everything else — including a draft line that DOES have words — is the
    // ordinary commit-then-op, and it does not redraw the row: what the write
    // answers with is the PLACEMENT's id and the TARGET's title, neither of
    // them this draft's, and the row itself does not move.
    await structural((held) => ({
      verb: "mirror",
      target,
      at: { kind: "after", id: held.row },
    }))
  }

  /**
   * Leave the caret, and hand the row it was in to whatever takes it next.
   *
   * The draft is COMMITTED first, and a refusal stops it — the row that would
   * not save is the row to stay in, which is the rule the arrows and a click on
   * another title already follow. Then the draft is closed, because a caret and
   * a pick are never live together: that is what lets `Tab` mean one thing at
   * any moment rather than needing a second grammar for bulk.
   *
   * FOUR KEYS do this now, and the fourth leaves the caret for something that
   * is not a pick: `⌘⇧M` opens the move-to picker, which is a panel with a box
   * to type in. Same three steps for the same reason — a draft left open behind
   * it would be two live editors with the same keys claimed twice.
   *
   * What the callback is handed is both halves of "which row was that": WHERE
   * it was drawn, which is what a selection is a set of, and the RECORD it is,
   * which is what a write names. The three picking keys read the first; the
   * picker needs both.
   */
  const picking = async (
    pick: (place: string, record: string) => void,
  ): Promise<void> => {
    const held = draft()
    if (held === null || held.kind !== "row" || held.place === null) return
    const from = held.place
    if (!(await commit())) return
    idle.clear()
    setDraft(null)
    pick(from, held.row)
  }

  /**
   * The three fold keys, one write: the same call the triangle in the gutter
   * makes (`../Tree.tsx`), answered off the same READING the tree folds by —
   * which is the page's `collapsed`, node ids and all (`../fold/reading.ts`).
   * A row with no children folds nothing, for the reason the gutter draws no
   * triangle on one.
   */
  const foldCaret = (to: boolean | "toggle"): void => {
    const at = row()
    if (at === undefined || at.children.length === 0) return
    setFolded(
      [foldOf(at)],
      to === "toggle" ? !page.collapsed().has(foldIdOf(at)) : to,
    )
  }

  /**
   * `⌘,` / `Alt+,`: zoom OUT — to the nearest page that still shows the row
   * the caret is in.
   *
   * TWO SHAPES, and the caret's key chain decides which: a row drawn under a
   * parent row goes to THAT row's page (its `at.node.id`, the record, the
   * same reading `zoomIn` makes) — on the page of `install`, the caret in
   * `handles` goes to `install`. A row with NO parent on this page — one of
   * the page's own top lines — goes to the page ABOVE its subject, which is
   * `zooming.out`'s to say: the crumb the Breadcrumbs row would offer, the
   * file itself, and nothing at all on a whole outline, where `out` is
   * absent and the key says nothing. A zoom from a mirror lands where a
   * click on the breadcrumb lands (the node's canonical page), one address
   * per node, the page's promise.
   *
   * DECIDED BEFORE THE COMMIT: the parent row is looked up in `drawn`, which
   * is the tree through the caret's eyes and answers with nothing the moment
   * the draft closes (`drawn`'s `where` gate, above) — so the destination is
   * worked out while the caret is still standing in it, and only then is the
   * line let go. `picking` could not order that: its callback runs after the
   * draft is gone.
   *
   * AND THE DRAFT GOES: the zoom pair leaves the caret behind. That used to
   * be two answers wearing one key — `out` committed but kept the draft,
   * which followed the journey only when the destination happened to be
   * another node page (the pane need not remount there, so the editor and
   * its draft survived), and was destroyed by the OUTLINE it often is. What
   * decides which page lands must not decide whether a line stays open, and
   * keeping the caret the other way round is not available either: the
   * zoomed page's heading is not an editor, so `⌘.` has nowhere to carry
   * one to. The pair's answer is therefore one — the same close `picking`
   * does — and re-opening a row on arrival is the click's business, the way
   * the bullet's own zoom has always worked.
   */
  const outOf = async (): Promise<void> => {
    const held = draft()
    if (held === null || held.kind !== "row" || held.place === null) return
    // The destination is a thunk, decided up here and taken after the close:
    // `drawn`'s gate gives no rows once the draft is down, and `zooming.out`'s
    // existence IS the answer "is there a page above", asked while standing.
    let act: (() => void) | null = null
    const parentKey = parentKeyOf(held.place)
    if (parentKey !== "") {
      const parent = drawn().find((one) => one.key === parentKey)
      if (parent === undefined) return
      act = () => zooming.into(parent.at.node.id)
    } else {
      const out = zooming.out
      if (out === undefined) return
      act = out
    }
    if (!(await commit())) return
    idle.clear()
    setDraft(null)
    act()
  }

  /**
   * The arrows: the next LINE the eye would reach — a row that is written,
   * or a blank still being laid out — and where in its text the caret lands.
   *
   * `neighbour` walked rows alone, which was true to the keys while the only
   * way DOWN was a row: `wire` threads the drafts through the same walk the
   * ghosts are drawn by, so the caret steps ONTO a blank rather than over it,
   * and lands BACK on the same one walking up — the eye skips nothing. `Wire`
   * is walked fresh here rather than memoised: this is the one reader's key
   * handler that asks, asked once per press, and a walk cached against three
   * signals that move on every keystroke is a cost, not a saving.
   *
   * `column` is the offset the key wants carried over: ↑/↓ hand in the caret's
   * own column, clamped by a shorter line; ← arriving from the row after hands
   * in the END of the one it enters, → the start — the two ways a person reads
   * a sentence off the end of a line. Absent is an editor opened the old way.
   */
  const step = async (by: 1 | -1, column?: number): Promise<void> => {
    const held = draft()
    if (held === null) return
    // A row a frame away from being drawn has no place to step FROM, which is
    // what `follow` fills in a moment later.
    const standing: Standing | null = held.kind === "new"
      ? { kind: "draft", slot: held.slot }
      : held.place === null
      ? null
      : { kind: "row", place: held.place }
    if (standing === null) return
    const { walk, at } = seated(page.rows(), page.collapsed(), blanks(held), standing)
    const target = at === -1 ? undefined : walk[at + by]
    if (target === undefined) return
    // Landing on a ghost is the same answer as clicking its row: the blank is
    // resumed, not made again, and a wordless draft is parked rather than
    // dropped if the step walks further.
    if (target.kind === "draft") {
      resume(target.pending.slot)
      return
    }
    parkIfEmpty(held)
    if (!(await commit())) return
    setDraft(
      opened(target.row, "title", column === undefined ? undefined : { caret: column }),
    )
  }

  const take = (slot: string): void => {
    const found = ghosts().find((g) => g.slot === slot)
    if (found === undefined) return
    setGhosts((list) => list.filter((g) => g.slot !== slot))
    setDraft(found)
    setCaret((n) => n + 1)
    if (found.text.trim() !== "") idle()
  }

  const resume = (slot: string): void => {
    if (ghosts().every((g) => g.slot !== slot)) return
    const held = draft()
    if (held?.kind === "new" && held.slot === slot) return
    if (emptyPendingOf(held) !== null) {
      parkIfEmpty(held)
      take(slot)
      return
    }
    enqueue(async () => {
      if (!(await commit())) {
        // The write that would have let this ghost take the caret was
        // refused. Focus is still in the parked input, whose keys we
        // swallow — put the caret back on the draft that is holding the
        // reason.
        setCaret((n) => n + 1)
        return
      }
      // AFTER the commit: that is the call that re-aims parked `before`
      // ghosts onto the row that just landed. Capturing the ghost before
      // it would install a stale anchor — the blank above the new row
      // drawn below it.
      take(slot)
    })
  }

  return {
    takeRange: (slot) => {
      if (retainedRange === undefined || slot === undefined || !sameSlot(retainedRange.slot, slot)) return undefined
      const range = retainedRange
      retainedRange = undefined
      return range
    },
    rememberRange: (range) => { memory.range = range },
    completionDismissal: (slot) => {
      if (slot === undefined || memory.completion.slot === undefined
        || !sameSlot(slot, memory.completion.slot)) {
        memory.completion.slot = slot
        memory.completion.dismissed[1](null)
      }
      return memory.completion.dismissed
    },
    draft,
    ghosts,
    resume,
    where,
    caret,
    open: (at, field, here) => {
      const next = opened(at, field, here)
      if (next === null) return
      // A caret arriving puts the pick away, and it happens HERE rather than at
      // the click that asked, so no later door can forget it. Synchronously,
      // ahead of the queue: the bar and the window key listener are the pick's,
      // and leaving them up while a commit is in flight would be exactly the
      // state this invariant exists to make unreachable.
      selection.clear()
      enqueue(async () => {
        // Whatever was being typed is committed on the way out, and a REFUSAL
        // stops the move: the row that would not save is the row to stay in,
        // which is the rule the arrows already followed. Without the wait,
        // clicking another title started a write of the first row and opened
        // the second, and a refusal then landed on a row that had nothing to
        // do with it — with the first row's text gone from the screen.
        // An empty pending is parked rather than dropped, so a skeleton
        // survives a click into a titled row.
        parkIfEmpty(draft())
        if (!(await commit())) return
        idle.clear()
        setDraft(next)
      })
    },
    type: (text) => {
      setDraft((held) => (held === null ? held : typed(held, text)))
      idle()
    },
    typeParked: (slot, text) => {
      setGhosts((list) => list.map((ghost) => ghost.slot === slot ? { ...ghost, text } : ghost))
      // Activation may have completed between the input event and this call.
      setDraft((held) => held?.kind === "new" && held.slot === slot ? typed(held, text) : held)
    },
    blur: (from, left) => {
      // A blur we caused ourselves — see `settling`.
      if (settling) return
      // A blur nobody caused on purpose: the editor's element is not in the
      // document any more, so it was REMOVED by a re-render rather than left
      // by a person. The commit below is still right (what was typed should be
      // written); closing the draft is not, because the reader has not gone
      // anywhere — the row they are in is being redrawn around them, by an
      // agent's write or another tab's, at a moment nothing here chose.
      if (!left) {
        enqueue(commit)
        return
      }
      const before = draft()
      // The editor this blur came from is not the one that is open any more —
      // `Enter` moved on, and the row it opened is not this one's to close.
      if (before === null || !sameSlot(slotOf(before), from)) return
      enqueue(async () => {
        // Refused: the draft stays, with its text and its reason, so nothing
        // typed is lost to a click somewhere else.
        if (!(await commit())) return
        // Closed only if this is still the same editor. A click on another
        // row's title fires this blur first, and closing then would shut the
        // row the reader was aiming at.
        //
        // `stillAt` rather than the slot alone, because the commit above may
        // have MOVED this editor's address: a line that did not exist yet is
        // now the row it wrote (`./draft.ts`'s `was`). Asked of the new address
        // the answer was "somebody else is typing" about the same caret with
        // the same words in it, so the click-away wrote the line and left the
        // caret in it.
        //
        // The `isConnected` read that made this a click (`left`) is not the
        // whole truth either: the browser answers a redraw taking the row out
        // from under a focused input with the same blur, and when the just
        // born line is the one being moved, it answers with the element STILL
        // attached. What says the two apart is what changed since: a redraw
        // MOVED the row (the place the caret is now is not the place the blur
        // came from) — a click did not.
        // An empty pending is parked: click-away is not Escape, and a
        // skeleton of blanks should survive leaving the last one.
        setDraft((held) => {
          if (held === null || !stillAt(held, from) || held.text !== before.text) {
            return held
          }
          if (
            held.kind === "row" &&
            before.kind === "row" &&
            held.place !== before.place
          ) {
            return held
          }
          parkIfEmpty(held)
          return null
        })
      })
    },
    press: (action, at) => ACTIONS[action](at),
    // The `!` widget's write, and it is `structural`'s shape rather than a new
    // one: commit the line the day was typed into, then send ONE `date` edit —
    // through `datePick`, which is the ONE constructor for that edit and the
    // reason the pill's picker, the `•••` menu and this widget cannot quietly
    // send three different things. It does not redraw the row, so no caret is
    // owed. `held.id` is the node the row SHOWS, so a day picked at a mirror
    // lands on its target, which is the standing rule for everything a node
    // SAYS. A row that did not exist when `!` was typed is written by the
    // commit first, which is why this can name an id at all.
    dated: (day) => enqueue(() => structural((held) => datePick(held.id, day))),
    mirrored: (target) => enqueue(() => mirrored(target)),
    start: (at) => {
      selection.clear()
      idle.clear()
      parkIfEmpty(draft())
      openPending(at)
    },
  }
}
