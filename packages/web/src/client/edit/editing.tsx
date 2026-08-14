/**
 * The editor: one draft, the keys that move it, and the writes they cause.
 *
 * Everything here is about ONE row at a time — there is exactly one draft in
 * this tab, because there is exactly one caret — and every write it makes is
 * the surface's one `edit` procedure, which is a single op at the same write
 * gate the agent's tools go through. Nothing in this module touches an
 * outline, a record or a placement: what `Tab` MEANS is resolved on the
 * server, against the snapshot the write is judged against
 * (`packages/server/src/edit.ts`).
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
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  untrack,
  useContext,
} from "solid-js"
import { Result } from "effect"

import type { EditAction } from "../keys.ts"
import { runAsync } from "../run.ts"
import type { Selection } from "../select/selection.ts"
import { olai } from "../wire.ts"
import {
  after,
  anchorRow,
  commitOf,
  IDLE_COMMIT,
  type Draft,
  type Editing as RowDraft,
  landed,
  refused,
  sameSlot,
  type Slot,
  slotOf,
  typed,
} from "./draft.ts"
import { flatten, neighbour, refound } from "./order.ts"
import { serial } from "./queue.ts"
import { useUndo } from "./undoing.ts"

export interface Editor {
  /** The draft, or `null` when nothing is being typed. It carries what the
   *  last write said, refused or not — one value, so replacing it cannot leave
   *  a stale reason on screen.
   *
   *  Read it INSIDE a row that {@link where} has already matched. Every row of
   *  the tree asks whether the caret is in it, and this value changes on every
   *  keystroke — so a tree that matched on this would re-run its whole depth
   *  per character typed. */
  readonly draft: Accessor<Draft | null>
  /** WHERE the caret is, and nothing about what is being typed there: the
   *  `Row.key` of the row being edited, the id of the row a new line is being
   *  drawn after, and which field. Three primitives, so they answer the same
   *  value while a person types and a row's match stops propagating. */
  readonly where: Accessor<Caret>
  /** A counter the open editor watches: every bump means "take the caret
   *  back". It is bumped after the ops that redraw the row the key was pressed
   *  in, because moving an element in the document is what takes focus off it
   *  (`./RowEditor.tsx` says the rest). */
  readonly caret: Accessor<number>
  /** Start editing a row's title (a click on it) or its note. */
  readonly open: (row: Row, field: "title" | "desc") => void
  /** What has just been typed. Starts the idle clock. */
  readonly type: (text: string) => void
  /** The editor at this slot lost focus: commit, and close if it landed. It
   *  says which slot because a blur arrives after the draft may already have
   *  moved on — see {@link ./draft.ts}'s `Slot` — and whether the element is
   *  still IN the document, because an editor removed by a re-render did not
   *  lose focus to a person. */
  readonly blur: (from: Slot, left: boolean) => void
  /** One of the editing keys. Which row it was pressed in is the draft's to
   *  say — there is one caret, and it knows where it is. */
  readonly press: (action: EditAction) => void
  /** Open an editor for a row a page has nowhere else to offer — the first row
   *  of an empty outline, the first child of an empty branch. */
  readonly start: (at: Anchor) => void
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
export interface Caret {
  /** The `Row.key` being edited, or `null` — no row draft, or one whose row
   *  is not drawn yet. */
  readonly place: string | null
  /** The id of the row a NEW line is being drawn after, or `null` when there
   *  is no pending draft or it belongs to a page's start line. */
  readonly after: string | null
  readonly field: "title" | "desc" | null
}

const NOWHERE: Caret = { place: null, after: null, field: null }

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
  /** The rows on screen and what is folded — the two halves of "what is
   *  drawn", which is what the arrows move through and where a row that has
   *  moved is found again. */
  page: {
    readonly rows: Accessor<ReadonlyArray<Row>>
    readonly collapsed: Accessor<ReadonlySet<string>>
  },
  /** The page's multi-selection, for the three keys that LEAVE the caret and
   *  pick rows instead (`../select/selection.ts`). Handed in rather than read
   *  from a context, because the two are created together by the same page and
   *  the order between them is what makes "a caret or a pick, never both" a
   *  fact about this file rather than a habit. */
  selection: Pick<Selection, "start" | "grow" | "widen">,
): Editor => {
  const [draft, setDraft] = createSignal<Draft | null>(null)
  const [caret, setCaret] = createSignal(0)
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
  const enqueue = serial()

  /** The caret's own three facts, memoised so typing does not move them. */
  const where = createMemo<Caret>(() => {
    const held = draft()
    if (held === null) return NOWHERE
    if (held.kind === "new") {
      return { place: null, after: anchorRow(held.at), field: null }
    }
    return { place: held.place, after: null, field: held.field }
  }, NOWHERE, { equals: (a, b) => a.place === b.place && a.after === b.after && a.field === b.field })

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
    page.rows()
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
    const moved = refound(flatten(page.rows(), page.collapsed()), held.row, at)
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
  const send = async (
    edit: Edit,
    from: Slot,
  ): Promise<{ id: string; nudge?: string } | null> => {
    const outcome = await runAsync(olai.procedures.edit.apply(edit))
    if (Result.isSuccess(outcome)) {
      // What would take this back, straight onto the stack ⌘Z spends — the
      // server's own answer, derived from the snapshot this write was judged
      // against ({@link ./undoing.ts}). EVERY write that has an inverse, the
      // text ones included: a draft that has committed is an op like any
      // other, and the DRAFT is what Escape and blur own. The two were
      // conflated once, and what it cost was ⌘Z answering "nothing to undo" to
      // somebody who had just retyped a title.
      undo.record(outcome.success.undo)
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
    return true
  }

  /** The idle commit. Scheduled by every keystroke and cancelled by every
   *  commit, so a person who keeps typing causes one write rather than one per
   *  pause. */
  const idle = debounce(() => enqueue(commit), IDLE_COMMIT)

  /** The row the caret is in, as the page is drawing it now. */
  const row = (): Row | undefined => {
    const held = draft()
    if (held === null || held.kind !== "row") return undefined
    return flatten(page.rows(), page.collapsed()).find((one) => one.key === held.place)
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

  /** A structural op for the row the caret is in: commit the text, then ask.
   *  The id is read AFTER the commit, so `Tab` works on a line that did not
   *  exist when the key was pressed — the add has landed by then and the draft
   *  is the row it created. */
  const structural = async (name: (draft: RowDraft) => Edit) => {
    if (!(await commit())) return
    const held = draft()
    if (held === null || held.kind !== "row") return
    // Noted BEFORE the write: the frame that redraws the row can arrive while
    // it is still in flight.
    settling = true
    const moved = await send(name(held), slotOf(held))
    // REFUSED: no write, so no frame, so nothing is owed — and a debt left
    // standing would go on suppressing blurs, which would mean the next thing
    // typed into this row never got committed at all. `Tab` on the first of
    // its siblings is the ordinary way to reach this.
    if (moved === null) settling = false
    // The caret stays in the row that just moved: the draft is restored in
    // case its editor was destroyed and blurred on the way out, and the caret
    // is taken again because a row that merely moved among its siblings keeps
    // its editor and loses the focus anyway — the document moved the element.
    // Whatever the write had to say rides back with it — a `Ctrl+Enter` is the
    // key most likely to earn a nudge, and it never goes through `commit`.
    setDraft((current) => noted(current ?? held, moved?.nudge))
    setCaret((n) => n + 1)
  }

  /** A draft carrying what the write that just landed said, when it said
   *  anything. */
  const noted = (held: Draft, nudge: string | undefined): Draft =>
    nudge === undefined || held.kind !== "row" ? held : { ...held, nudge }

  /** `Enter`: commit this row, and open an editor where the next one goes. The
   *  new row is not written until it has text — see {@link ./draft.ts}. */
  const continued = async () => {
    if (!(await commit())) return
    const held = draft()
    if (held === null || held.kind !== "row") return
    setDraft({ kind: "new", at: after(held), text: "" })
  }

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
  const opened = (at: Row, field: "title" | "desc"): Draft | null => {
    if (at.kind !== "node" && at.kind !== "mirror") return null
    const text = (field === "title" ? at.shows.node.title : at.shows.node.desc) ?? ""
    return {
      kind: "row",
      row: at.at.node.id,
      id: at.shows.node.id,
      place: at.key,
      field,
      text,
      saved: text,
    }
  }

  /**
   * What each key does. A table rather than a chain of `if`s, so the set of
   * actions and the set of behaviours are one list the compiler checks: an
   * action added to {@link EditAction} and not answered here does not compile.
   */
  const ACTIONS: Record<EditAction, () => void> = {
    // NOT queued: abandoning is the one key that must not wait for a write it
    // is abandoning. A commit already in flight still answers — to the slot it
    // was sent for, which is no longer open, so nothing lands anywhere.
    cancel: () => {
      idle.clear()
      setDraft(null)
    },
    add: () => enqueue(continued),
    note: () => enqueue(note),
    prev: () => enqueue(() => step(-1)),
    next: () => enqueue(() => step(1)),
    // The MARK is a fact about the node a row SHOWS — which is what the
    // checkbox beside it draws — so a mirror ticks off its target. Both mark
    // keys name that id, and neither says where the write goes: `toggle` sends
    // the mark and lets the server read the direction, `walk` sends neither
    // and lets it read both. What a row carries is a fact about the set, and
    // this tab is looking at a frame of it.
    toggle: () =>
      enqueue(() => structural((held) => ({ verb: "toggle", id: held.id, mark: "done" }))),
    walk: () => enqueue(() => structural((held) => ({ verb: "walk", id: held.id }))),
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
    in: () => enqueue(() => structural((held) => ({ verb: "move", id: held.row, how: "in" }))),
    out: () => enqueue(() => structural((held) => ({ verb: "move", id: held.row, how: "out" }))),
    up: () => enqueue(() => structural((held) => ({ verb: "move", id: held.row, how: "up" }))),
    down: () =>
      enqueue(() => structural((held) => ({ verb: "move", id: held.row, how: "down" }))),
  }

  /**
   * Leave the caret, and start picking rows from the one it was in.
   *
   * The draft is COMMITTED first, and a refusal stops it — the row that would
   * not save is the row to stay in, which is the rule the arrows and a click on
   * another title already follow. Then the draft is closed, because a caret and
   * a pick are never live together: that is what lets `Tab` mean one thing at
   * any moment rather than needing a second grammar for bulk.
   */
  const picking = async (pick: (from: string) => void): Promise<void> => {
    const held = draft()
    if (held === null || held.kind !== "row" || held.place === null) return
    const from = held.place
    if (!(await commit())) return
    idle.clear()
    setDraft(null)
    pick(from)
  }

  /** The arrows: the next row the eye would reach, folds and all. */
  const step = async (by: 1 | -1): Promise<void> => {
    const held = draft()
    if (held === null || held.kind !== "row" || held.place === null) return
    await move(neighbour(page.rows(), page.collapsed(), held.place, by))
  }

  return {
    draft,
    where,
    caret,
    open: (at, field) => {
      const next = opened(at, field)
      if (next === null) return
      enqueue(async () => {
        // Whatever was being typed is committed on the way out, and a REFUSAL
        // stops the move: the row that would not save is the row to stay in,
        // which is the rule the arrows already followed. Without the wait,
        // clicking another title started a write of the first row and opened
        // the second, and a refusal then landed on a row that had nothing to
        // do with it — with the first row's text gone from the screen.
        if (!(await commit())) return
        idle.clear()
        setDraft(next)
      })
    },
    type: (text) => {
      setDraft((held) => (held === null ? held : typed(held, text)))
      idle()
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
        setDraft((held) =>
          held !== null && sameSlot(slotOf(held), from) && held.text === before.text
            ? null
            : held
        )
      })
    },
    press: (action) => ACTIONS[action](),
    start: (at) => {
      idle.clear()
      setDraft({ kind: "new", at, text: "" })
    },
  }
}
