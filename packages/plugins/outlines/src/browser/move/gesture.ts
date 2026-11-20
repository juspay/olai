import { type Accessor, batch, createEffect, createMemo, createSelector, createSignal } from "solid-js"
import { type Moved, type MovingRequest, type Row, sameMovingRequest } from "@olai/format"
import type { Edit } from "@olai/surface"
import { moveMemory } from "./memory.ts"
import { flatten, refound } from "../edit/order.ts"
import { useUndo } from "../edit/undoing.ts"
import { sameIds } from "@olai/web/client/ids.ts"
import { createSaying } from "@olai/web/client/saying.ts"
import { client } from "../../client.ts"
import { applying } from "../writes.ts"

export type Standing =
  | { readonly kind: "picking"; readonly record: string; readonly place: string }
  | {
    readonly kind: "landed"
    readonly record: string
    readonly place: string
    readonly under: string
  }

export const createMoving = (
  page: {
    readonly rows: Accessor<ReadonlyArray<Row>>
    readonly collapsed: Accessor<ReadonlySet<string>>
  },
  back: (row: Row) => void,
  memory = moveMemory(),
) => {
  const undo = useUndo()
  const [heldStanding, setStanding] = memory.standing
  const [hitIds, setHitIds] = createSignal<Accessor<ReadonlyArray<string>>>(NONE)
  const aimed = createMemo<ReadonlyArray<string>, undefined>(() => hitIds()(), undefined, {
    equals: sameIds,
  })
  const saying = createSaying()
  const [sending, setSending] = memory.sending
  const [judging, setJudging] = memory.judging

  const located = createMemo((previous: { source: Standing | null; value: Standing | null } | undefined) => {
    const source = heldStanding()
    const held = previous?.source === source ? previous.value : source
    const resolve = (): Standing | null => {
    if (held === null || sending()) return held
    if (held.kind === "landed" && saying.said() === null) return null
    const drawn = flatten(page.rows(), page.collapsed())
    const moved = refound(drawn, held.record, held.place) ??
      (held.kind === "picking" ? undefined : refound(drawn, held.under, null))
    return moved === undefined ? null : moved === held.place ? held : { ...held, place: moved }
    }
    return { source, value: resolve() }
  })
  const standing = () => located().value
  const showing = createSelector(() => standing()?.place)

  const request = createMemo<MovingRequest | null, undefined>(
    () => {
      const held = standing()
      return held === null ? null : { record: held.record, to: judging() ?? aimed() }
    },
    undefined,
    {
      equals: (a, b) => a === null || b === null ? a === b : sameMovingRequest(a, b),
    },
  )

  const answer = client().streams.moving.use(request)

  const moved = createMemo<Moved | undefined>((held) => {
    const record = standing()?.record
    if (record === undefined) return undefined
    const said = answer()
    if (said === undefined) return held?.id === record ? held : undefined
    return said.moved ?? undefined
  })

  const refusals = createMemo<ReadonlyMap<string, string>>(() => {
    const said = answer()?.refusals ?? []
    const asked = aimed()
    const found = new Map<string, string>()
    asked.forEach((id, at) => {
      const why = said[at]
      if (why !== undefined && why !== null) found.set(id, why)
    })
    return found
  })

  const write = (edit: Edit): void => {
    if (sending()) return
    setJudging(aimed())
    setSending(true)
    const under = edit.verb === "under" ? edit.parent : undefined
    saying.say(null)
    void applying(edit, undo.record)
      .then((said) => batch(() => {
        saying.say(said)
        if (said?.tone === "alarm" || under === undefined) { setJudging(null); return }
        setStanding((held) =>
          held === null
            ? null
            : { kind: "landed", record: held.record, place: held.place, under }
        )
      }))
      .finally(() => setSending(false))
  }

  const close = (): void => {
    const held = standing()
    setStanding(null)
    setJudging(null)
    if (held === null) return
    const row = flatten(page.rows(), page.collapsed()).find((one) => one.key === held.place)
    if (row !== undefined) back(row)
  }

  const aim = (ids: Accessor<ReadonlyArray<string>>) => setHitIds(() => ids)
  return {
    aim,
    write,
    close,
    standing,
    moved,
    refusals,
    saying,
    query: memory.query,
    open: (at: { readonly record: string; readonly place: string }) => {
      saying.say(null)
      batch(() => {
        setJudging(null)
        setHitIds(() => NONE)
        memory.query[1]("")
        setStanding({ kind: "picking", ...at })
      })
    },
    showing,
  }
}

const NONE = (): ReadonlyArray<string> => []
