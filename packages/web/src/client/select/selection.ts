/**
 * The multi-selection: which rows are picked, the gestures that pick them, and
 * the bulk verbs they answer to.
 *
 * ONE PAGE'S, like the caret it sits beside (`../edit/Editable.tsx` creates
 * both): a selection names places in the tree that is drawn, and carrying one
 * to another outline would be a set of keys about rows nobody is looking at.
 *
 * **A selection is not a caret, and the two are exclusive.** There is one draft
 * in this tab because there is one caret; picking rows puts the caret away, and
 * clicking into a row's title puts the selection away. That is Workflowy's own
 * model, and it is what lets the bulk keys be the row keys: `Tab` with rows
 * picked indents them, `Tab` with a caret in one indents that one, and nothing
 * has to decide which was meant.
 *
 * **Nothing here is a new op.** A bulk verb is the edit the single-row key
 * already sends, once per row, in the order that produces the shape asked for
 * (`./bulk.ts`) — which is exactly what an agent does when it is told to indent
 * three things. The consistency rule (HACKING.md) is kept by construction: a
 * gesture this face has that MCP does not would have needed a verb on the wire,
 * and there is none.
 *
 * **A refusal stops the run.** Half of an indent is a shape nobody asked for,
 * so the first write that comes back refused is the last one sent, and its
 * sentence — the ops layer's own — is what the bar says
 * ({@link ./SelectionBar.tsx}). The rows that did land stay landed, exactly as
 * they would have if a person had pressed the key once per row.
 *
 * **The keys follow the rows.** A place is a chain of ids, so a row that
 * indents is drawn at a different key the moment the file says so — and a
 * selection that held the old ones would go out on the frame that answered it.
 * A selected place that stops being drawn is looked up again by the record it
 * named, which is the rule the caret already follows (`../edit/editing.tsx`'s
 * `follow`).
 */

import type { Row } from "@olai/format"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  useContext,
} from "solid-js"

import { flatten, neighbour, refound } from "../edit/order.ts"
import { serial } from "../edit/queue.ts"
import type { Said } from "../edit/undoing.ts"
import { useUndo } from "../edit/undoing.ts"
import { applyingAll } from "../writes.ts"
import { type Bulk, bulkEdits } from "./bulk.ts"
import { alongside, recordOf, spanning, topmost } from "./range.ts"

export interface Selection {
  /** The places picked, as `Row.key`s. Read by a row to tone itself; every
   *  other question is answered by a method here. */
  readonly keys: Accessor<ReadonlySet<string>>
  /** What a verb is asked of: the picked rows nothing else picked contains, in
   *  drawn order (`./range.ts`). Empty means nothing is selected. */
  readonly rows: Accessor<ReadonlyArray<Row>>
  /** Pick exactly this row, and make it the end every later extension is
   *  measured from. */
  readonly start: (key: string) => void
  /** Modifier-click: add this row, or take it back out. */
  readonly toggle: (key: string) => void
  /** Shift-click: everything between the anchor and this row. */
  readonly extend: (key: string) => void
  /** Shift+arrow: one row further, in the direction pressed. */
  readonly grow: (by: 1 | -1) => void
  /** The ⌘A ladder: this row's siblings first, then every row on the page.
   *  `from` seeds it when there is nothing picked yet (the caret's row). */
  readonly widen: (from?: string) => void
  readonly clear: () => void
  /** Send a bulk verb. One edit per row, one at a time, stopping at the first
   *  refusal. */
  readonly run: (verb: Bulk) => void
  /** What the last run had to say — the ops layer's refusal, or a nudge from a
   *  write that landed. */
  readonly said: Accessor<Said | null>
  readonly say: (said: Said | null) => void
}

const SelectionContext = createContext<Selection>()

/** The page's selection. A throw outside the provider, for the reason
 *  `useEditor` throws: a row drawn outside an editable page has no selection to
 *  join, rather than an empty one. */
export const useSelection = (): Selection => {
  const selection = useContext(SelectionContext)
  if (selection === undefined) throw new Error("a selection consumer outside <Editable>")
  return selection
}

export const SelectionProvider = SelectionContext.Provider

export const createSelection = (
  page: {
    readonly rows: Accessor<ReadonlyArray<Row>>
    readonly collapsed: Accessor<ReadonlySet<string>>
  },
): Selection => {
  const [keys, setKeys] = createSignal<ReadonlySet<string>>(new Set())
  const [said, setSaid] = createSignal<Said | null>(null)
  /** The two ends of the range gestures: where the selection was started, and
   *  which end an arrow or a shift-click moves. Held apart from `keys` because
   *  a modifier-click can leave a set no span describes, and the next
   *  shift-click still has to know where to measure from. */
  const [anchor, setAnchor] = createSignal<string | null>(null)
  const [focus, setFocus] = createSignal<string | null>(null)
  /** How far ⌘A has been pressed on this selection. Reset by every other
   *  gesture, which is what makes the ladder a ladder rather than a mode. */
  let widened = 0
  const undo = useUndo()
  /** One bulk run at a time, and one edit at a time inside it — the editor's
   *  own queue, for the editor's own reason: each edit is judged against what
   *  the one before it did, and two in flight are two writes derived from a
   *  state neither can see. */
  const enqueue = serial()

  const drawn = (): ReadonlyArray<Row> => flatten(page.rows(), page.collapsed())

  const pick = (chosen: Iterable<string>, at: string | null, end: string | null) => {
    widened = 0
    setKeys(new Set(chosen))
    setAnchor(at)
    setFocus(end)
    setSaid(null)
  }

  /**
   * The picked places, found again wherever their records are drawn now.
   *
   * The caret's rule at set size (`../edit/order.ts`'s `refound`): a bulk
   * indent redraws every row it moved under a new chain of ids, and a pick
   * still holding the old chain would go dark on the frame that proved it
   * worked.
   */
  createEffect(() => {
    const rows = drawn()
    const held = keys()
    if (held.size === 0) return
    const again = (key: string): string | undefined => refound(rows, recordOf(key), key)
    // Nothing moved: the ordinary frame, and the one that must not mint a new
    // set — every row of the tree reads this signal.
    if ([...held].every((key) => again(key) === key)) return

    setKeys(new Set([...held].flatMap((key) => {
      const found = again(key)
      return found === undefined ? [] : [found]
    })))
    const at = anchor()
    if (at !== null) setAnchor(again(at) ?? null)
    const end = focus()
    if (end !== null) setFocus(again(end) ?? null)
  })

  /** A MEMO, because three readers ask for it and one of them is a window key
   *  listener: the bar draws it, the verbs are asked of it, and every keystroke
   *  on the page asks whether anything is picked at all. Recomputed only when
   *  the pick or the rows move. */
  const rows = createMemo<ReadonlyArray<Row>>(() => topmost(drawn(), keys()))

  const run = async (verb: Bulk): Promise<void> => {
    const chosen = rows()
    if (chosen.length === 0) return
    setSaid(null)
    setSaid(await applyingAll(bulkEdits(verb, chosen), undo.record) ?? null)
  }

  return {
    keys,
    rows,
    start: (key) => pick([key], key, key),
    toggle: (key) => {
      const held = new Set(keys())
      if (held.has(key)) held.delete(key)
      else held.add(key)
      pick(held, key, key)
    },
    extend: (key) => {
      const at = anchor() ?? key
      pick(spanning(drawn(), at, key), at, key)
    },
    grow: (by) => {
      const end = focus() ?? anchor()
      if (end === null) return
      const next = neighbour(page.rows(), page.collapsed(), end, by)
      if (next === undefined) return
      const at = anchor() ?? end
      pick(spanning(drawn(), at, next.key), at, next.key)
    },
    widen: (from) => {
      const step = widened
      const at = anchor() ?? from ?? null
      if (at === null) return
      const chosen = step === 0
        ? alongside(drawn(), at)
        : drawn().map((row) => row.key)
      pick(chosen, at, at)
      widened = step + 1
    },
    clear: () => pick([], null, null),
    run: (verb) => enqueue(() => run(verb)),
    said,
    say: setSaid,
  }
}
