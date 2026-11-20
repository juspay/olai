import { createSelector } from "solid-js"

import { type Claims, composed, type NodeChange, type Other, type Pending } from "@olai/format"
import { type Accessor, createSignal, type Signal } from "solid-js"

export interface Selection {
  readonly ticked: (path: string) => boolean
  readonly toggle: (path: string) => void
  readonly paths: Accessor<ReadonlyArray<string> | undefined>
  readonly changes: Accessor<ReadonlyArray<NodeChange>>
  readonly others: Accessor<ReadonlyArray<Other>>
  readonly message: Accessor<string>
}

/**
 * Derived with plain functions rather than `createMemo`: Solid resolves to its
 * SERVER build under `bun test`, where a memo never recomputes.
 */
export const createSelection = (
  claims: Accessor<Claims | undefined>,
  pending: Accessor<Pending>,
  excluded: Signal<ReadonlySet<string>> = createSignal<ReadonlySet<string>>(new Set()),
): Selection => {
  const [dropped, setDropped] = excluded
  const ticked = createSelector(dropped, (path: string, keys) => !keys.has(path))

  const toggle = (path: string) => {
    setDropped((was) => {
      const next = new Set(was)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const files = (): ReadonlySet<string> => {
    const kept = new Set<string>()
    for (const outline of pending().outlines) {
      if (ticked(outline.path)) kept.add(outline.file)
    }
    return kept
  }

  const changes = () => { const kept = files(); return pending().changes.filter(change => kept.has(change.file)) }
  const others = () => pending().others.filter((other) => ticked(other.path))

  const paths = (): ReadonlyArray<string> | undefined => {
    const every = [
      ...pending().outlines.map((outline) => outline.path),
      ...pending().others.map((other) => other.path),
    ]
    const kept = every.filter(ticked)
    return kept.length === every.length ? undefined : kept
  }

  return {
    ticked,
    toggle,
    paths,
    changes,
    others,
    message: () => {
      const current = claims()
      return current === undefined ? "" : composed(current, changes(), others())
    },
  }
}
