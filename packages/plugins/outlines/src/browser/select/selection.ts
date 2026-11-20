import type { Row } from "@olai/format"
import {
  type Accessor,
  createContext,
  createMemo,
  useContext,
  createSelector, batch,
} from "solid-js"

import { flatten, neighbour } from "../edit/order.ts"
import { selectionMemory } from "./memory.ts"
import type { Said } from "@olai/web/client/saying.ts"
import { useUndo } from "../edit/undoing.ts"
import { applyingAll } from "../writes.ts"
import { type Bulk, bulkEdits } from "./bulk.ts"
import { alongside, recordOf, spanning, topmost } from "./range.ts"

export interface Selection {
  readonly has: (key: string) => boolean
  readonly keys: Accessor<ReadonlySet<string>>
  readonly rows: Accessor<ReadonlyArray<Row>>
  readonly start: (key: string) => void
  readonly toggle: (key: string) => void
  readonly extend: (key: string) => void
  readonly across: (keys: Iterable<string>, from: string, to: string) => void
  readonly grow: (by: 1 | -1) => void
  readonly widen: (from?: string) => void
  readonly clear: () => void
  readonly run: (verb: Bulk) => void
  readonly said: Accessor<Said | null>
  readonly say: (said: Said | null) => void
}

const NOTHING_PICKED: ReadonlyArray<Row> = []

const SelectionContext = createContext<Selection>()

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
  memory = selectionMemory(),
): Selection => {
  const [picked, setKeys] = memory.keys
  const [said, setSaid] = memory.said
  const [pickedAnchor, setAnchor] = memory.anchor
  const [pickedFocus, setFocus] = memory.focus
  const undo = useUndo()
  const enqueue = memory.enqueue

  const drawn = (): ReadonlyArray<Row> => flatten(page.rows(), page.collapsed())

  const pick = (chosen: Iterable<string>, at: string | null, end: string | null) => batch(() => {
    memory.widened = 0
    setKeys(new Set(chosen))
    setAnchor(at)
    setFocus(end)
    setSaid(null)
  })

  type Located = { pick: ReadonlySet<string>; keys: ReadonlySet<string>; anchor: string | null; focus: string | null; rows: ReadonlyArray<Row> }
  const located = createMemo<Located>((previous) => {
    const pick = picked()
    const continuing = previous?.pick === pick
    const held = continuing ? previous.keys : pick
    const at = continuing ? previous.anchor : pickedAnchor()
    const end = continuing ? previous.focus : pickedFocus()
    if (held.size === 0 && at === null && end === null) return { pick, keys: held, anchor: null, focus: null, rows: NOTHING_PICKED }
    const rows = drawn()
    const places = new Set<string>(), records = new Map<string, string>()
    for (const row of rows) {
      places.add(row.key)
      if (!records.has(row.at.node.id)) records.set(row.at.node.id, row.key)
    }
    const find = (key: string | null) => key === null ? null : places.has(key) ? key : records.get(recordOf(key)) ?? null
    return { pick, keys: new Set([...held].flatMap(key => { const found = find(key); return found === null ? [] : [found] })),
      anchor: find(at), focus: find(end), rows }
  })
  const keys = createMemo(() => located().keys, new Set<string>(), {
    equals: (a, b) => a.size === b.size && [...a].every(key => b.has(key)),
  })
  const anchor = () => located().anchor
  const focus = () => located().focus



  const rows = createMemo<ReadonlyArray<Row>>(() =>
    keys().size === 0 ? NOTHING_PICKED : topmost(located().rows, keys())
  )

  const run = async (verb: Bulk): Promise<void> => {
    const chosen = rows()
    if (chosen.length === 0) return
    setSaid(null)
    setSaid(await applyingAll(bulkEdits(verb, chosen), undo.record) ?? null)
  }

  return {
    has: createSelector(keys, (key: string, set) => set.has(key)),
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
    across: pick,
    grow: (by) => {
      const end = focus() ?? anchor()
      if (end === null) return
      const rows = drawn()
      const next = neighbour(rows, end, by)
      if (next === undefined) return
      const at = anchor() ?? end
      pick(spanning(rows, at, next.key), at, next.key)
    },
    widen: (from) => {
      const step = memory.widened
      const at = anchor() ?? from ?? null
      if (at === null) return
      const chosen = step === 0
        ? alongside(drawn(), at)
        : drawn().map((row) => row.key)
      pick(chosen, at, at)
      memory.widened = step + 1
    },
    clear: () => pick([], null, null),
    run: (verb) => enqueue(() => run(verb)),
    said,
    say: setSaid,
  }
}
