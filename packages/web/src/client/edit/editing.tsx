/**
 * The editor: one draft, the keys that move it, and the writes they cause.
 *
 * Everything here is about ONE row at a time — there is exactly one draft in
 * this tab, because there is exactly one caret — and every write it makes is a
 * surface procedure, which is a single op at the same write gate the agent's
 * tools go through. Nothing in this module touches an outline, a record or a
 * placement: what `Tab` MEANS is resolved on the server, against the snapshot
 * the write is judged against (`packages/server/src/edit.ts`).
 *
 * So the whole of what this file owns is the loop a person is in:
 *
 *   - what is being typed, and into which row ({@link ./draft.ts});
 *   - when that gets committed — blur, `Enter`, idle;
 *   - where the caret goes afterwards;
 *   - what is shown when a write comes back refused.
 *
 * **A structural key does not race the draft it interrupted.** `Tab` on a
 * half-typed row commits the text first and then moves the row, in that order,
 * because the two are one thought and the second would otherwise land against
 * a record whose title is still the old one. Everything is sequenced through
 * one promise chain for the same reason.
 *
 * **Which id an edit names is a rule, and it is here.** An edit to what a node
 * SAYS — its title, its note, its mark — names the node the row SHOWS, so
 * typing in a mirror edits the node it stands for, which is what a mirror is
 * for. An edit to where a row SITS names the row's own record, so moving a
 * mirror moves the placement and leaves the node where it lives. Both halves
 * are one line each below, and both are what the reader is looking at.
 *
 * **Nothing is optimistic, and the caret is what that costs.** A row moves on
 * screen when the file says so — so between `Tab` and the frame that answers
 * it, the row being typed in is still where it was, and then it is somewhere
 * else, drawn by a branch that did not exist before. Keeping a person's place
 * across that is this file's real work, and it is one rule: a draft is about a
 * NODE, and the place it is drawn at follows the node (`follow` below). The
 * alternative — echoing the move locally so the row never appears to leave —
 * is the optimistic UI this whole design is written against.
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

import type { EditAction } from "../keys.ts"
import { run } from "../run.ts"
import { olai } from "../wire.ts"
import {
  after,
  commitOf,
  type Draft,
  type Editing as RowDraft,
  landed,
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

/**
 * What a commit came to.
 *
 * Three answers, because the callers branch differently on each: the draft as
 * it reads afterwards (carry on from there), `"nothing"` (there was no draft,
 * or a new row with nothing typed in it — so there is nothing to carry on
 * from), and `null`, the refusal, which stops the sequence and leaves the
 * draft on screen holding its text.
 */
type Committed = RowDraft | "nothing" | null

export interface Editor {
  /** The draft, or `null` when nothing is being typed. */
  readonly draft: Accessor<Draft | null>
  /** A counter the open editor watches: every bump means "take the caret
   *  back". It is bumped after the ops that redraw the row the key was pressed
   *  in, because moving an element in the document is what takes focus off it
   *  (`./RowEditor.tsx` says the rest). */
  readonly caret: Accessor<number>
  /** What the last commit was refused with. It belongs to the draft it was
   *  refused for — which is still on screen, still holding the text. */
  readonly refusal: Accessor<OpFailure | null>
  /** Start editing a row's title (a click on it) or its note. */
  readonly open: (row: Row, field: "title" | "desc") => void
  /** What has just been typed. Starts the idle clock. */
  readonly type: (text: string) => void
  /** The editor at this slot lost focus: commit, and close if it landed. It
   *  says which slot because a blur arrives after the draft may already have
   *  moved on — see {@link ./draft.ts}'s `Slot`. */
  readonly blur: (from: Slot) => void
  /** One of the editing keys, in the row it was pressed in — `null` when that
   *  is a row which does not exist yet. */
  readonly press: (action: EditAction, row: Row | null) => void
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
   *  drawn", which is what the arrows move through. */
  page: {
    readonly rows: Accessor<ReadonlyArray<Row>>
    readonly collapsed: Accessor<ReadonlySet<string>>
  },
): Editor => {
  const [draft, setDraft] = createSignal<Draft | null>(null)
  const [refusal, setRefusal] = createSignal<OpFailure | null>(null)
  const [caret, setCaret] = createSignal(0)
  /**
   * Whether the caret is owed back — noted before a structural op, and paid on
   * the frame that redraws the row.
   *
   * TWO settlements, because the write and the frame it causes arrive in
   * either order. The server publishes the new revision inside the commit and
   * answers afterwards, so the row may be redrawn BEFORE the procedure
   * resolves or after it — a fact of two channels, not a bug to remove. Paying
   * only on the answer loses the caret whenever the redraw comes later (it
   * moves the element out from under the focus); paying only on the frame
   * loses it whenever the redraw already happened. So the debt is noted before
   * the write, the frame settles it if there is one owing, and the answer
   * settles it again — the second focus of an already-focused input costs
   * nothing.
   */
  let owed = false
  const takeCaret = () => {
    owed = true
  }

  createEffect(() => {
    // Tracked, and read first: the frame that redrew the row is what this is
    // waiting for, and an effect runs after that row has been moved.
    page.rows()
    if (!owed) return
    owed = false
    setCaret((n) => n + 1)
  })

  /**
   * The caret follows its row when the tree moves under it.
   *
   * A draft names a PLACE, and a place is a row's chain of ids — so `Tab`
   * changes it: the row that was `…/install/measure` is `…/handles/measure`
   * the moment the file says so, and the editor drawn at the old place is
   * simply not drawn any more. That is the honest consequence of having no
   * optimistic UI, and this is the one line that answers it: when a draft's
   * place names nothing on screen and some row shows its NODE, the draft moves
   * to that row. The node is what was being typed in; where it is drawn is the
   * tree's business.
   *
   * It costs a walk of the drawn rows per frame, and only while something is
   * being typed — the early return is what keeps the rows untracked (and the
   * walk unrun) the rest of the time.
   */
  createEffect(() => {
    const held = draft()
    if (held === null || held.kind !== "row") return
    const drawn = flatten(page.rows(), page.collapsed())
    if (drawn.some((row) => row.key === held.place)) return
    const moved = drawn.find((row) =>
      (row.kind === "node" || row.kind === "mirror") && row.shows.node.id === held.id
    )
    if (moved !== undefined) setDraft({ ...held, place: moved.key })
  })

  /** The write, as a promise: the node the edit ended up being about, or
   *  `null` when it was refused. The sequence needs something to wait on —
   *  `Tab` after a retitle must not race it — and {@link ../run.ts} is the one
   *  edge in this client where an Effect is run. */
  const send = (edit: Edit): Promise<string | null> =>
    new Promise((resolve) => {
      run(
        procedureFor(edit),
        (failure) => {
          setRefusal(failure)
          resolve(null)
        },
        (answer) => {
          setRefusal(null)
          resolve(answeredId(edit, answer))
        },
      )
    })

  const commit = async (): Promise<Committed> => {
    const current = draft()
    if (current === null) return "nothing"
    const edit = commitOf(current)
    // Nothing to say: an untouched row is not a write, and an empty new row is
    // not a node. Either way the caret can carry on from where it is.
    if (edit === null) return current.kind === "row" ? current : "nothing"
    idle.clear()
    const id = await send(edit)
    if (id === null) return null
    const next = landed(current, id)
    // Only when the editor is still on the same draft: a commit that landed
    // while the reader had already moved on must not drag them back.
    setDraft((held) => (held === current ? next : held))
    return next
  }

  /** The idle commit. Scheduled by every keystroke and cancelled by every
   *  commit, so a person who keeps typing causes one write rather than one per
   *  pause. */
  const idle = debounce(() => void commit(), IDLE)

  /** Put the caret in another row's title, committing whatever was being typed
   *  first. A refusal stops it: the row that would not save is the row to
   *  stay in. */
  const move = async (to: Row | undefined) => {
    if (to === undefined || (to.kind !== "node" && to.kind !== "mirror")) return
    if ((await commit()) === null) return
    setRefusal(null)
    setDraft({
      kind: "row",
      place: to.key,
      id: to.shows.node.id,
      field: "title",
      text: to.shows.node.title,
      saved: to.shows.node.title,
    })
  }

  /** A structural op for the row the caret is in: commit the text, then ask.
   *  `id` is `null` for a row that did not exist when the key was pressed —
   *  and by the time the commit answers it does, which is what makes `Tab`
   *  work on a line you have only just typed. */
  const structural = async (name: (id: string) => Edit, id: string | null) => {
    const done = await commit()
    if (done === null || done === "nothing") return
    // Noted BEFORE the write: the frame that redraws the row can arrive while
    // this is still in flight.
    takeCaret()
    const moved = await send(name(id ?? done.id))
    // The caret stays in the row that just moved, and both halves of that have
    // to be said. The DRAFT is restored in case the row's editor was destroyed
    // and blurred on its way out; the caret is taken again because a row that
    // merely moved among its siblings keeps its editor and loses the focus
    // anyway — the document moved the element.
    setDraft((held) => held ?? done)
    if (moved === null) {
      // REFUSED: no write, so no frame, so nothing is owed — and a debt left
      // standing would go on suppressing blurs (see `owed`), which would mean
      // the next thing typed into this row never got committed at all.
      // `Tab` on the first of its siblings is the ordinary way to reach this.
      owed = false
      return
    }
    setCaret((n) => n + 1)
  }

  /** `Enter`: commit this row, and open an editor where the next one goes. The
   *  new row is not written until it has text — see {@link ./draft.ts}. */
  const continued = async () => {
    const done = await commit()
    if (done === null || done === "nothing") return
    setDraft({ kind: "new", at: after(done), place: done.place, text: "" })
  }

  /** `Shift+Enter`: open the note under this row, or close the one that is
   *  open and go back to the title. A note is committed by closing it, the
   *  same way a title is. */
  const note = async (row: Row) => {
    const open = draft()
    if ((await commit()) === null) return
    if (open?.kind === "row" && open.field === "desc") {
      await move(row)
      return
    }
    if (row.kind !== "node" && row.kind !== "mirror") return
    const desc = row.shows.node.desc ?? ""
    setRefusal(null)
    setDraft({
      kind: "row",
      place: row.key,
      id: row.shows.node.id,
      field: "desc",
      text: desc,
      saved: desc,
    })
  }

  const press = (action: EditAction, row: Row | null): void => {
    if (action === "cancel") {
      idle.clear()
      setDraft(null)
      setRefusal(null)
      return
    }
    if (action === "add") {
      void continued()
      return
    }
    if (action === "prev" || action === "next") {
      const place = draft()?.place
      if (place === undefined || place === null) return
      void move(
        neighbour(page.rows(), page.collapsed(), place, action === "next" ? 1 : -1),
      )
      return
    }
    if (action === "note") {
      if (row !== null) void note(row)
      return
    }
    if (action === "toggle") {
      // The MARK is a fact about the node a row SHOWS — which is what the
      // checkbox beside it draws — so a mirror ticks off its target.
      void structural(
        (id) => ({ verb: "toggle", id, mark: "done" }),
        row === null || (row.kind !== "node" && row.kind !== "mirror")
          ? null
          : row.shows.node.id,
      )
      return
    }
    // A MOVE is about the row itself, so a mirror moves as the placement it is
    // and the node it stands for stays where it lives.
    void structural(
      (id) => ({ verb: "move", id, how: action }),
      row === null ? null : row.at.node.id,
    )
  }

  return {
    draft,
    caret,
    refusal,
    open: (row, field) => {
      if (row.kind !== "node" && row.kind !== "mirror") return
      const text = (field === "title" ? row.shows.node.title : row.shows.node.desc) ?? ""
      // Whatever was being typed is committed on the way out. The blur of the
      // editor being left normally does this first and there is then nothing
      // to say (the text is already saved) — this is the promise rather than
      // the usual path: a draft is never replaced by another one without what
      // it held being written.
      if (draft() !== null) void commit()
      idle.clear()
      setRefusal(null)
      setDraft({ kind: "row", place: row.key, id: row.shows.node.id, field, text, saved: text })
    },
    type: (text) => {
      // The refusal was about the text that has just been replaced.
      setRefusal(null)
      setDraft((held) => (held === null ? held : typed(held, text)))
      idle()
    },
    blur: (from) => {
      // A blur we caused ourselves. A row that moves among its siblings keeps
      // its editor and its place, so nothing above tells this apart from a
      // person clicking away — but the document moving an element takes the
      // focus off it, and closing the row somebody is mid-keystroke in is the
      // one thing that must not happen. `owed` is exactly the window in which
      // a blur is the reflow's rather than the reader's.
      if (owed) return
      const before = draft()
      // The editor this blur came from is not the one that is open any more —
      // `Enter` moved on, and the row it opened is not this one's to close.
      if (before === null || !sameSlot(slotOf(before), from)) return
      void commit().then((done) => {
        // Refused: the draft stays, with its text and its reason, so nothing
        // typed is lost to a click somewhere else.
        if (done === null) return
        // Closed only if this is still the same editor. A click on another
        // row's title fires this blur first, and closing then would shut the
        // row the reader was aiming at.
        setDraft((held) => (held === before || held === done ? null : held))
      })
    },
    press,
    start: (at) => {
      idle.clear()
      setRefusal(null)
      // No place: a start line draws the editor itself, being the one thing on
      // a page that has no rows to draw it after.
      setDraft({ kind: "new", at, place: null, text: "" })
    },
  }
}

/** The node an answer was about. `add` is the one procedure that answers with
 *  an id, because it is the one edit whose node did not exist yet; every other
 *  one named its node on the way in. */
const answeredId = (edit: Edit, answer: unknown): string | null => {
  if (edit.verb !== "add") return edit.id
  return typeof answer === "object" && answer !== null && "id" in answer
    ? String(answer.id)
    : null
}

/** The procedure one edit is. A switch rather than a table because each arm's
 *  payload is a different shape, and the compiler checking that is what the
 *  union is tagged for. */
const procedureFor = (edit: Edit) => {
  switch (edit.verb) {
    case "add":
      return olai.procedures.edit.add({ at: edit.at, title: edit.title })
    case "move":
      return olai.procedures.edit.move({ id: edit.id, how: edit.how })
    case "toggle":
      return olai.procedures.edit.toggle({ id: edit.id, mark: edit.mark })
    case "retitle":
      return olai.procedures.edit.retitle({ id: edit.id, title: edit.title })
    case "note":
      return olai.procedures.edit.note({ id: edit.id, desc: edit.desc })
  }
}
