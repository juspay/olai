import { carrySession } from "@olai/web/client/carry.ts"
import { landings } from "../landings.ts"
import type { CarriedNodes } from "../../carry.ts"

import type { Row } from "@olai/format"
import type { Edit } from "@olai/surface"
import { type Accessor, createContext, createSignal, useContext } from "solid-js"

import { placeable } from "./places.ts"
import type { Said } from "@olai/web/client/saying.ts"
import { useUndo } from "../edit/undoing.ts"
import { createLifting } from "@olai/web/client/lifting.ts"
import { applyingAll } from "../writes.ts"
import { chainOf } from "../select/range.ts"
import { useAir } from "./air.ts"
import { type Aim, type Aimed, aimAt } from "./aim.ts"
import { useFields } from "./fields.ts"
import { measureBox, paneOf } from "./lines.ts"
import type { Landing } from "./plan.ts"

export const HANDLE = "data-handle"

interface Lifted {
  readonly rows: ReadonlyArray<Row>
  readonly from: string
  readonly pages: ReadonlyArray<Aimed>
}

export interface Dragging {
  readonly carrying: (key: string) => boolean
  readonly aim: Accessor<Aim | null>
  readonly grab: (event: PointerEvent, row: Row) => void
  readonly heldMenu: (event: Event) => void
  readonly dragged: () => boolean
}

const DraggingContext = createContext<Dragging>()

export const useDragging = (): Dragging => {
  const dragging = useContext(DraggingContext)
  if (dragging === undefined) throw new Error("a drag consumer outside <Editable>")
  return dragging
}

export const DraggingProvider = DraggingContext.Provider

export const createDragging = (
  page: {
    readonly selection: {
      readonly keys: Accessor<ReadonlySet<string>>
      readonly rows: Accessor<ReadonlyArray<Row>>
      readonly clear: () => void
      readonly say: (said: Said | null) => void
    }
  },
): Dragging => {
  const air = useAir()
  const [aim, setAim] = createSignal<Aim | null>(null)
  const fields = useFields()
  const undo = useUndo()

  const measure = (rows: ReadonlyArray<Row>): Lifted | null => {
    const from = rows[0]?.at.file
    if (from === undefined) return null
    const held = new Set(rows.map((one) => one.at.node.id))
    const pages = fields.all().flatMap((field): ReadonlyArray<Aimed> => {
      const drawn = field.element()
      if (drawn === undefined) return []
      const box = measureBox(paneOf(drawn))
      if (box === null) return []
      return [{ file: field.file, box, placed: placeable(field, drawn, from, held) }]
    })
    return { rows, from, pages }
  }

  const gesture = createLifting((row: Row) => {
    const picked = page.selection.keys()
    const carried = picked.has(row.key) ? page.selection.rows() : [row]
    if (!picked.has(row.key)) page.selection.clear()
    const lifted = measure(carried)
    if (lifted === null) return null
    air.lift(new Set(carried.map(one => one.at.node.id)))
    const ids = [...picked]
      .flatMap(key => carried.filter(one => one.key === key).map(one => one.at.node.id))
      .concat(picked.has(row.key) ? [] : [row.at.node.id])
    const table = landings()
    const receiver = table && carrySession({ kind: "outlines.nodes", ids, file: lifted.from } satisfies CarriedNodes, table)
    return {
      onPage: (x: number, y: number) => {
        setAim(receiver?.aim(x, y) ? null : aimAt(lifted.pages, lifted.from, x, y))
      },
      onEnd: (up: PointerEvent | null) => {
        void receiver?.end(up !== null).then(why => { if (why) page.selection.say({ tone: "alarm", text: why }) })
        const target = up === null ? null : aim()
        air.lift(new Set<string>())
        setAim(null)
        if (target === null) return
        if (target.kind === "refused") {
          page.selection.say({ tone: "alarm", text: target.refusal.why })
          return
        }
        void drop(target.landing, lifted.rows)
      },
    }
  })

  const drop = async (target: Landing, carried: ReadonlyArray<Row>): Promise<void> => {
    let after = target.after
    const edits: Array<Edit> = []
    for (const row of carried) {
      edits.push({ verb: "place", id: row.at.node.id, parent: target.parent, after })
      after = row.at.node.id
    }
    page.selection.say(await applyingAll(edits, undo.record) ?? null)
  }

  return {
    carrying: (key) => chainOf(key).some(air.has),
    aim,
    grab: gesture.grab,
    heldMenu: gesture.heldMenu,
    dragged: gesture.dragged,
  }
}
