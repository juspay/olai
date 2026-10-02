import { type Accessor, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import type { Result } from "effect"
import { byActivity } from "./activity-order.ts"
import type { Row } from "./roster.ts"
import type { LocationNode } from "./new-chat.ts"

export interface LocationAnswer { readonly nodes: readonly LocationNode[]; readonly defaultParent: string | null }
/** A mounted query owns its answer and ignores replies to superseded requests. */
export const createLocationQuery = <Q>(query: Accessor<Q>, request: (query: Q) => Promise<Result.Result<LocationAnswer, { readonly message: string }>>) => {
  const [nodes, setNodes] = createSignal<readonly LocationNode[]>([])
  const [defaultParent, setDefaultParent] = createSignal<string | null>(null)
  const [failure, fail] = createSignal<string>()
  const [ready, setReady] = createSignal(false)
  createEffect(() => {
    const input = query()
    setReady(false)
    let alive = true
    onCleanup(() => { alive = false })
    void request(input).then(result => {
      if (!alive) return
      if (result._tag === "Success") {
        setNodes(result.success.nodes); setDefaultParent(result.success.defaultParent)
        setReady(true); fail(undefined)
      } else fail(result.failure.message)
    })
  })
  return { nodes, defaultParent, failure, fail, ready }
}

/** Activity can tick without changing which parents the picker needs. */
export const recentLocationIds = (rows: Accessor<readonly Row[]>) => createMemo(
  () => byActivity(rows()).slice(0, 32).map(row => row.id), undefined,
  { equals: (before, after) => before.length === after.length && before.every((id, index) => id === after[index]) },
)
