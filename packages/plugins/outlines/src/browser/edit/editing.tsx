import { writeEdit } from "../writes.ts"
import type { Row } from "@olai/format"
import type { Anchor, Edit } from "@olai/surface"
import { debounce } from "@solid-primitives/scheduled"
import {
  type Accessor,
  type Signal,
  createComputed,
  createContext,
  createEffect,
  createMemo,
  type JSX,
  batch,
  untrack,
  useContext,
  createSelector,
} from "solid-js"
import { createStore, unwrap } from "solid-js/store"
import { Result } from "effect"

import { datePick } from "../date/pick.ts"
import { setFolded } from "../fold/memory.ts"
import { foldIdOf, foldOf } from "../fold/rows.ts"
import type { Caret, EditAction } from "@olai/web/client/keys.ts"
import { runAsync } from "@olai/web/client/run.ts"
import type { Moving } from "../move/moving.tsx"
import { parentKeyOf } from "../select/range.ts"
import type { Selection } from "../select/selection.ts"
import { client } from "../../client.ts"
import {
  after,
  before,
  besideOf,
  commitOf,
  emptyPending,
  emptyPendingOf,
  ghostOf,
  type Ghost,
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
  seatKept,
  seatOf,
  type Slot,
  slotOf,
  stillAt,
  typed,
  walked,
} from "./draft.ts"
import { flatten, reanchored, refound, seated } from "./order.ts"
import type { Standing } from "./order.ts"
import { editorMemory, type EditorMemory, type EditorRange } from "./memory.ts"
import { redraws, rekeys } from "./redraws.ts"
import { useUndo } from "./undoing.ts"

export interface Editor {
  readonly takeRange: (slot: Slot | undefined) => EditorRange | undefined
  readonly takeForwarded: (was: Slot) => EditorRange | undefined
  readonly rememberRange: (range: EditorRange) => void
  readonly completionDismissal: (slot: Slot | undefined) => Signal<string | null>
  readonly draft: Accessor<Draft | null>
  readonly ghosts: Accessor<ReadonlyArray<Pending>>
  readonly live: Accessor<Ghost | null>
  readonly pendingAt: (kind: Beside["kind"], id: string) => boolean
  readonly ghostsAt: (kind: Beside["kind"], id: string) => ReadonlyArray<Pending>
  readonly resume: (slot: string) => void
  readonly resuming: Accessor<string | null>
  readonly displayAt: (at: Anchor) => Anchor
  readonly isEditing: (key: string) => boolean
  readonly where: Accessor<Where>
  readonly onCaret: (take: () => void) => () => void
  readonly open: (row: Row, field: "title" | "desc", at?: OpenAt) => void
  readonly type: (text: string) => void
  readonly typeParked: (slot: string, text: string) => void
  readonly blur: (from: Slot, left: boolean) => void
  readonly press: (action: EditAction, at?: Caret) => void
  readonly dated: (day: string) => void
  readonly mirrored: (target: string) => void
  readonly start: (at: Anchor) => void
}

export interface OpenAt {
  readonly caret?: number
}

export interface Zooming {
  readonly into: (id: string) => void
  readonly out?: () => void
}

export interface Where {
  readonly place: string | null
  readonly pending: Beside | null
  readonly field: "title" | "desc" | null
}

const NOWHERE: Where = { place: null, pending: null, field: null }

const NO_ROWS: ReadonlyArray<Row> = []

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

export const useEditor = (): Editor => {
  const editor = useContext(EditorContext)
  if (editor === undefined) throw new Error("a row editor outside <EditorProvider>")
  return editor
}

export const createEditor = (
  page: {
    readonly rows: Accessor<ReadonlyArray<Row>>
    readonly collapsed: Accessor<ReadonlySet<string>>
    readonly frames: Accessor<number>
  },
  selection: Pick<Selection, "start" | "grow" | "widen" | "clear">,
  moving: Pick<Moving, "open">,
  zooming: Zooming,
  memory: EditorMemory = editorMemory(),
): Editor => {
  const { draft: storedDraft, setDraft: setStoredDraft, ghosts, setGhosts, requestCaret, onCaret, resuming, setResuming, mintSlot, enqueue } = memory
  const subject = createMemo(() => {
    const held = storedDraft()
    return held?.kind === "row" ? { row: held.row, place: held.place } : null
  }, null, { equals: (a, b) => a?.row === b?.row && a?.place === b?.place })
  const hasRowDraft = createMemo(() => storedDraft()?.kind === "row")
  const drawn = createMemo<ReadonlyArray<Row>>(() =>
    hasRowDraft() ? flatten(page.rows(), page.collapsed()) : NO_ROWS
  )
  const currentPlace = createMemo(() => {
    const held = subject()
    return held === null ? undefined : refound(drawn(), held.row, held.place)
  })
  const draft = createMemo(() => {
    const held = storedDraft()
    const place = currentPlace()
    return held?.kind === "row" && place !== undefined && place !== held.place ? { ...held, place } : held
  })
  const setDraft = (next: Draft | null | ((before: Draft | null) => Draft | null)): Draft | null => {
    const value = typeof next === "function" ? next(untrack(draft)) : next
    return batch(() => {
      if (value === null) { memory.completion.slot = undefined; memory.completion.dismissed[1](null) }
      return setStoredDraft(value)
    })
  }
  let retainedRange = memory.range
  memory.range = undefined

  const parkIfEmpty = (held: Draft | null): void => {
    setGhosts((list) => parked(list, held))
  }
  const openPending = (at: Anchor): void => {
    setDraft(emptyPending(at, mintSlot()))
    requestCaret()
  }
  const undo = useUndo()

  // Keep the write anchor authoritative, but retain its prior visual seat until
  // the new anchor row is present.
  const noAnchors = new Set<string>()
  const present = createMemo(() => {
    if (memory.placements().size === 0) return noAnchors
    page.frames()
    return new Set(flatten(page.rows(), new Set()).map((row) => row.at.node.id))
  })
  const displayAt = (at: Anchor): Anchor => walked(at, placements(), present())
  const placements = createMemo(() => new Map([...memory.placements()].filter(([id]) => !present().has(id))))


  const where = createMemo<Where>(() => {
    const held = draft()
    if (held === null) return NOWHERE
    if (held.kind === "new") {
      return { place: null, pending: seatOf(held, placements(), present()), field: null }
    }
    const blank = ghostOf(held)
    if (blank === null) return { place: held.place, pending: null, field: held.field }
    const at = seatKept(held.row, placements()) ?? { kind: "after", id: held.row }
    return { place: null, pending: besideOf(at), field: held.field }
  }, NOWHERE, {
    equals: (a, b) =>
      a.place === b.place && a.field === b.field &&
      a.pending?.kind === b.pending?.kind && a.pending?.id === b.pending?.id,
  })

  const [locations, setLocations] = createStore<Record<string, { live: boolean; parked: ReadonlyArray<Pending> } | undefined>>({})
  const locationKey = (kind: Beside["kind"], id: string) => `${kind}\0${id}`
  const noGhosts: ReadonlyArray<Pending> = []
  createComputed(() => {
    const next = new Map<string, { live: boolean; parked: Pending[] }>()
    const seat = (at: Beside) => {
      const key = locationKey(at.kind, at.id)
      let value = next.get(key)
      if (!value) next.set(key, value = { live: false, parked: [] })
      return value
    }
    const pending = where().pending
    if (pending) seat(pending).live = true
    for (const ghost of ghosts()) {
      const at = besideOf(displayAt(ghost.at))
      if (at) seat(at).parked.push(ghost)
    }
    untrack(() => batch(() => {
      for (const key of Object.keys(locations)) if (!next.has(key)) setLocations(key, undefined)
      for (const [key, value] of next) {
        const old = locations[key]
        if (old?.live === value.live && old.parked.length === value.parked.length
          && unwrap(old.parked).every((ghost, index) => ghost === value.parked[index])) continue
        setLocations(key, value)
      }
    }))
  })

  const blanks = (held: Draft | null): ReadonlyArray<Pending> =>
    held?.kind === "new" ? [...ghosts(), held] : ghosts()

  let settling = false
  let takingDraft = false
  let restoringCaret = false

  const settle = () => {
    page.frames()
    if (!settling && resuming() === null) return
    settling = false
    restoringCaret = true
    requestCaret()
    queueMicrotask(() => { restoringCaret = false })
  }
  createEffect(settle)

  const send = async (edit: Edit, from: Slot): Promise<Landed | null> => {
    const pending = runAsync(writeEdit(edit))
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

  const commit = async (): Promise<boolean> => {
    const current = draft()
    if (current === null) return true
    const edit = commitOf(current)
    if (edit === null) return true
    idle.clear()
    const done = await send(edit, slotOf(current))
    if (done === null) return false
    batch(() => {
    if (current.kind === "new") {
      memory.setPlacements((held) => new Map(placements()).set(done.id, current.at))
    }
    setDraft((held) => (held === current ? landed(current, done.id, done.nudge) : held))
    if (current.kind === "new") {
      setGhosts((list) => reaimed(list, current.at, done.id))
    }
    })
    return true
  }

  const resketching = (
    how: "in" | "out" | "up" | "down",
    name: (draft: RowDraft) => Edit,
    at?: Caret,
  ): void => {
    const sketch = emptyPendingOf(draft())
    if (sketch !== null) {
      const next = reanchored(page.rows(), page.collapsed(), sketch, how, ghosts())
      if (next === undefined) return
      if (next.open !== undefined) setFolded([next.open], false)
      idle.clear()
      setDraft({ ...sketch, at: next.at, slot: mintSlot() })
      return
    }
    enqueue(() => structural(name, at))
  }

  const idle = debounce(() => enqueue(commit), IDLE_COMMIT)
  if (draft() !== null) idle()

  const row = (): Row | undefined => {
    const held = draft()
    if (held === null || held.kind !== "row") return undefined
    return drawn().find((one) => one.key === held.place)
  }

  const move = async (to: Row | undefined) => {
    const next = to === undefined ? null : opened(to, "title")
    if (next === null) return
    if (!(await commit())) return
    setDraft(next)
  }

  const redrawing = async (edit: Edit, from: Slot) => {
    settling = true
    const done = await send(edit, from)
    if (done === null) settling = false
    return done
  }

  const structural = async (
    name: (draft: RowDraft) => Edit,
    at?: Caret,
  ) => {
    if (!(await commit())) return
    const open = draft()
    if (open === null || open.kind !== "row") return
    const edit = name(open)
    const held: RowDraft = at !== undefined && rekeys(edit) ? { ...open, caret: at.start } : open
    setDraft(held)
    const slot = slotOf(held)
    const moved = redraws(edit)
      ? await redrawing(edit, slot)
      : await send(edit, slot)
    batch(() => {
      setDraft((current) => kept(current, held, moved?.nudge))
      requestCaret()
    })
  }

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

  const inserted = async () => {
    if (!(await commit())) return
    const held = draft()
    if (held === null || held.kind !== "row") return
    openPending(before(held))
  }

  const split = async (at: Caret) => {
    if (draft()?.kind === "new" && !(await commit())) return
    const held = draft()
    if (held === null || held.kind !== "row" || held.field !== "title") return
    const title = held.text.slice(0, at.start)
    const rest = held.text.slice(at.end)
    idle.clear()
    const underRow = row()
    const under = underRow !== undefined && underRow.children.length > 0 &&
      !page.collapsed().has(foldIdOf(underRow))
    const done = await redrawing(
      { verb: "split", id: held.row, title, rest, ...(under ? { under: true } : {}) },
      slotOf(held),
    )
    const current = draft()
    if (done === null || current === null || !sameSlot(slotOf(current), slotOf(held))) return
    setDraft(opening(done, 0))
    requestCaret()
  }

  const merge = async () => {
    const before = draft()
    if (before === null) return
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
        take(above.pending.slot)
        return
      }
      const title = above.row.kind === "node" || above.row.kind === "mirror"
        ? above.row.shows.node.title
        : undefined
      if (title === undefined) return
      setDraft(opened(above.row, "title", { caret: title.length }))
      return
    }
    if (before.kind === "row" && before.text.trim() === "") {
      const done = await redrawing(
        { verb: "merge", id: before.row, title: before.text },
        slotOf(before),
      )
      if (done === null) return
      setDraft(opening(done, done.title.length - before.text.length))
      requestCaret()
      return
    }
    if (!(await commit())) return
    const held = draft()
    if (held === null || held.kind !== "row") return
    const done = await redrawing({ verb: "merge", id: held.row }, slotOf(held))
    if (done === null) return
    setDraft(opening(done, done.title.length - held.text.length))
    requestCaret()
  }

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

  const ACTIONS: Record<EditAction, (at?: Caret) => void> = {
    cancel: () => {
      settling = false
      setResuming(null)
      idle.clear()
      setDraft(null)
    },
    add: () => enqueue(continued),
    insert: () => enqueue(inserted),
    split: (at) => {
      if (at !== undefined) enqueue(() => split(at))
    },
    merge: () => enqueue(merge),
    note: () => enqueue(note),
    prev: (at) => enqueue(() => step(-1, at?.start)),
    next: (at) => enqueue(() => step(1, at?.start)),
    left: () => enqueue(() => step(-1, Number.POSITIVE_INFINITY)),
    right: () => enqueue(() => step(1, 0)),
    toggle: (at) =>
      enqueue(() => structural((held) => ({ verb: "toggle", id: held.id, mark: "done" }), at)),
    "cancel-mark": (at) =>
      enqueue(() =>
        structural((held) => ({ verb: "toggle", id: held.id, mark: "cancelled" }), at)
      ),
    walk: (at) => enqueue(() => structural((held) => ({ verb: "walk", id: held.id }), at)),
    duplicate: (at) =>
      enqueue(() => structural((held) => ({ verb: "duplicate", id: held.row }), at)),
    moveTo: () => enqueue(() => picking((place, record) => moving.open({ record, place }))),
    selectUp: () => enqueue(() => picking((from) => {
      selection.start(from)
      selection.grow(-1)
    })),
    selectDown: () => enqueue(() => picking((from) => {
      selection.start(from)
      selection.grow(1)
    })),
    selectAll: () => enqueue(() => picking((from) => selection.widen(from))),
    in: (at) => resketching("in", (held) => ({ verb: "move", id: held.row, how: "in" }), at),
    out: (at) => resketching("out", (held) => ({ verb: "move", id: held.row, how: "out" }), at),
    up: (at) => resketching("up", (held) => ({ verb: "move", id: held.row, how: "up" }), at),
    down: (at) => resketching("down", (held) => ({ verb: "move", id: held.row, how: "down" }), at),
    zoomIn: () => enqueue(() => picking((_, record) => zooming.into(record))),
    zoomOut: () => enqueue(() => outOf()),
    fold: () => foldCaret("toggle"),
    collapse: () => foldCaret(true),
    expand: () => foldCaret(false),
  }

  const mirrored = async (target: string): Promise<void> => {
    const before = draft()
    const empty = emptyPendingOf(before)
    if (empty !== null) {
      const done = await send({ verb: "mirror", target, at: empty.at }, slotOf(empty))
      if (done === null) return
      setDraft(null)
      return
    }
    await structural((held) => ({
      verb: "mirror",
      target,
      at: { kind: "after", id: held.row },
    }))
  }

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

  const foldCaret = (to: boolean | "toggle"): void => {
    const at = row()
    if (at === undefined || at.children.length === 0) return
    setFolded(
      [foldOf(at)],
      to === "toggle" ? !page.collapsed().has(foldIdOf(at)) : to,
    )
  }

  const outOf = async (): Promise<void> => {
    const held = draft()
    if (held === null || held.kind !== "row" || held.place === null) return
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

  const step = async (by: 1 | -1, column?: number): Promise<void> => {
    const held = draft()
    if (held === null) return
    const standing: Standing | null = held.kind === "new"
      ? { kind: "draft", slot: held.slot }
      : held.place === null
      ? null
      : { kind: "row", place: held.place }
    if (standing === null) return
    const { walk, at } = seated(page.rows(), page.collapsed(), blanks(held), standing)
    const target = at === -1 ? undefined : walk[at + by]
    if (target === undefined) return
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
    if (found === undefined) {
      if (resuming() === slot) setResuming(null)
      return
    }
    takingDraft = true
    try {
      batch(() => {
        setGhosts((list) => list.filter((g) => g.slot !== slot))
        setDraft(found)
        setResuming(null)
        requestCaret()
      })
    } finally {
      queueMicrotask(() => { takingDraft = false })
    }
    if (found.text.trim() !== "") idle()
  }

  const resume = (slot: string): void => {
    if (ghosts().every((g) => g.slot !== slot)) return
    const held = draft()
    if (held?.kind === "new" && held.slot === slot) return
    if (resuming() === slot) return
    setResuming(slot)
    if (emptyPendingOf(held) !== null) {
      parkIfEmpty(held)
      take(slot)
      return
    }
    enqueue(async () => {
      if (resuming() !== slot) return
      if (!(await commit())) {
        setResuming(null)
        requestCaret()
        return
      }
      if (resuming() === slot) take(slot)
    })
  }

  return {
    takeRange: (slot) => {
      if (retainedRange === undefined || slot === undefined || !sameSlot(retainedRange.slot, slot)) {
        return undefined
      }
      const range = retainedRange
      retainedRange = undefined
      return range
    },
    takeForwarded: (was) =>
      memory.range !== undefined && sameSlot(memory.range.slot, was) ? memory.range : undefined,
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
    live: () => ghostOf(draft()),
    pendingAt: (kind, id) => locations[locationKey(kind, id)]?.live === true,
    ghostsAt: (kind, id) => locations[locationKey(kind, id)]?.parked ?? noGhosts,
    resume,
    resuming,
    displayAt,
    isEditing: createSelector(() => where().place),
    where,
    onCaret,
    open: (at, field, here) => {
      const next = opened(at, field, here)
      if (next === null) return
      selection.clear()
      setResuming(null)
      enqueue(async () => {
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
      setDraft((held) => held?.kind === "new" && held.slot === slot ? typed(held, text) : held)
    },
    blur: (from, left) => {
      if (takingDraft || restoringCaret || (settling && !left)) return
      if (left) settling = false
      if (!left) {
        enqueue(() => {
          const held = draft()
          return held !== null && stillAt(held, from) ? commit() : undefined
        })
        return
      }
      const before = draft()
      if (before === null || !sameSlot(slotOf(before), from)) return
      enqueue(async () => {
        if (!(await commit())) return
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
