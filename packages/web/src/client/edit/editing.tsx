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
 * against a record whose title is still the old one. Everything is sequenced
 * through one promise chain for the same reason.
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
 * ROW, and where that row is drawn is looked up rather than remembered
 * (`follow`). The alternative — echoing the move locally so the row never
 * appears to leave — is the optimistic UI this whole design is written
 * against.
 */

import type { Row } from "@olai/format"
import type { Anchor, Edit, OpFailure } from "@olai/surface"
import { debounce } from "@solid-primitives/scheduled"
import {
  type Accessor,
  createContext,
  createEffect,
  createSignal,
  type JSX,
  useContext,
} from "solid-js"
import { Result } from "effect"

import type { EditAction } from "../keys.ts"
import { runAsync } from "../run.ts"
import { olai } from "../wire.ts"
import {
  after,
  commitOf,
  type Draft,
  type Editing as RowDraft,
  landed,
  refused,
  sameSlot,
  type Slot,
  slotOf,
  typed,
} from "./draft.ts"
import { flatten, neighbour } from "./order.ts"

/** How long a person stops typing before what they typed is written. Long
 *  enough that a pause mid-sentence is not a git commit, short enough that
 *  walking away from the keyboard cannot lose the line. */
const IDLE = 1200

export interface Editor {
  /** The draft, or `null` when nothing is being typed. It carries what the
   *  last write said, refused or not — one value, so replacing it cannot leave
   *  a stale reason on screen. */
  readonly draft: Accessor<Draft | null>
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
   *  moved on — see {@link ./draft.ts}'s `Slot`. */
  readonly blur: (from: Slot) => void
  /** One of the editing keys. Which row it was pressed in is the draft's to
   *  say — there is one caret, and it knows where it is. */
  readonly press: (action: EditAction) => void
  /** Open an editor for a row a page has nowhere else to offer — the first row
   *  of an empty outline, the first child of an empty branch. */
  readonly start: (at: Anchor) => void
}

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
): Editor => {
  const [draft, setDraft] = createSignal<Draft | null>(null)
  const [caret, setCaret] = createSignal(0)

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
  createEffect(() => {
    // Tracked, and read first: the frame that redrew the row is what this is
    // waiting for, and an effect runs after that row has been moved.
    page.rows()
    if (!settling) return
    settling = false
    setCaret((n) => n + 1)
  })

  /**
   * The row a draft is drawn at, found again when it has moved.
   *
   * A draft names a ROW, and where that row is drawn is a `Row.key` — the
   * chain of ids from the root of the page — so `Tab` changes it: the row that
   * was `…/install/measure` is `…/handles/measure` the moment the file says
   * so. That is the honest consequence of having no optimistic UI, and this is
   * the one line that answers it. It is also how a row that did not exist when
   * `Enter` was pressed gets located: `landed` leaves the place `null` and the
   * frame carrying the new row fills it in.
   *
   * By the row's OWN record rather than the node it shows: a mirrored node is
   * drawn at more than one place, and the caret belongs to the placement the
   * reader was typing in.
   */
  createEffect(() => {
    const held = draft()
    if (held === null || held.kind !== "row") return
    const drawn = flatten(page.rows(), page.collapsed())
    if (held.place !== null && drawn.some((row) => row.key === held.place)) return
    const moved = drawn.find((row) => row.at.node.id === held.row)
    if (moved !== undefined) setDraft({ ...held, place: moved.key })
  })

  /** The write. Answers what the edit turned out to be about — the node, and
   *  whatever the rollup had to say about it — or `null` when it was refused,
   *  in which case the reason is already on the draft. */
  const send = async (edit: Edit): Promise<{ id: string; nudge?: string } | null> => {
    const outcome = await runAsync(olai.procedures.edit.apply(edit))
    if (Result.isSuccess(outcome)) return outcome.success
    setDraft((held) => (held === null ? held : refused(held, outcome.failure)))
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
    const done = await send(edit)
    if (done === null) return false
    // Only when the editor is still on the same draft: a commit that landed
    // while the reader had already moved on must not drag them back.
    setDraft((held) => (held === current ? landed(current, done.id, done.nudge) : held))
    return true
  }

  /** The idle commit. Scheduled by every keystroke and cancelled by every
   *  commit, so a person who keeps typing causes one write rather than one per
   *  pause. */
  const idle = debounce(() => void commit(), IDLE)

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
    if (to === undefined || (to.kind !== "node" && to.kind !== "mirror")) return
    if (!(await commit())) return
    setDraft(opened(to, "title"))
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
    const moved = await send(name(held))
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
   *  and the place are read off the row together rather than assembled at four
   *  call sites. */
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
    cancel: () => {
      idle.clear()
      setDraft(null)
    },
    add: () => void continued(),
    note: () => void note(),
    prev: () => void step(-1),
    next: () => void step(1),
    // The MARK is a fact about the node a row SHOWS — which is what the
    // checkbox beside it draws — so a mirror ticks off its target.
    toggle: () =>
      void structural((held) => ({ verb: "toggle", id: held.id, mark: "done" })),
    // A MOVE is about the row itself, so a mirror moves as the placement it is
    // and the node it stands for stays where it lives.
    in: () => void structural((held) => ({ verb: "move", id: held.row, how: "in" })),
    out: () => void structural((held) => ({ verb: "move", id: held.row, how: "out" })),
    up: () => void structural((held) => ({ verb: "move", id: held.row, how: "up" })),
    down: () => void structural((held) => ({ verb: "move", id: held.row, how: "down" })),
  }

  /** The arrows: the next row the eye would reach, folds and all. */
  const step = (by: 1 | -1) => {
    const held = draft()
    if (held === null || held.kind !== "row" || held.place === null) return
    void move(neighbour(page.rows(), page.collapsed(), held.place, by))
  }

  return {
    draft,
    caret,
    open: (at, field) => {
      const next = opened(at, field)
      if (next === null) return
      // Whatever was being typed is committed on the way out. The blur of the
      // editor being left normally does this first and there is then nothing
      // to say (the text is already saved) — this is the promise rather than
      // the usual path: a draft is never replaced by another one without what
      // it held being written.
      if (draft() !== null) void commit()
      idle.clear()
      setDraft(next)
    },
    type: (text) => {
      setDraft((held) => (held === null ? held : typed(held, text)))
      idle()
    },
    blur: (from) => {
      // A blur we caused ourselves — see `settling`.
      if (settling) return
      const before = draft()
      // The editor this blur came from is not the one that is open any more —
      // `Enter` moved on, and the row it opened is not this one's to close.
      if (before === null || !sameSlot(slotOf(before), from)) return
      void commit().then((ok) => {
        // Refused: the draft stays, with its text and its reason, so nothing
        // typed is lost to a click somewhere else.
        if (!ok) return
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
