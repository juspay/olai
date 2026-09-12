/** Keyboard selection belongs to this menu mount. Queries reset the cursor;
 *  live rows can invalidate a choice without silently selecting a replacement.
 *  DOM events, rendering, and spending a search result stay with the menu. */
import { type Accessor, createEffect, createMemo, createSignal, on } from "solid-js"
import { createCursor } from "@olai/ui-primitives/cursor.ts"
import { type Completing, requiresSelection, tokenOf } from "./completion.ts"

export const createCompletionSelection = (
  completing: Accessor<Completing | null>,
  rows: Accessor<ReadonlyArray<{ readonly value: string }>>,
) => {
  const cursor = createCursor(() => rows().length)
  const question = createMemo(() => {
    const found = completing()
    return found === null ? null : `${tokenOf(found)}:${found.query}`
  })
  const [chosen, setChosen] = createSignal<{ question: string | null; value: string } | null>(null)
  const selected = (): number | null => {
    if (completing() === null || rows().length === 0) return null
    if (!requiresSelection(completing())) return cursor.at()
    return chosen()?.question === question() && chosen()?.value === rows()[cursor.at()]?.value
      ? cursor.at()
      : null
  }
  createEffect(on(question, () => {
    cursor.top()
    setChosen(null)
  }))

  return {
    // Tab can complete the suggested row without first selecting it for Enter.
    suggested: cursor.at,
    selected,
    step: (by: 1 | -1) => {
      if (rows().length === 0) return
      if (selected() !== null) cursor.step(by)
      else cursor.to(by === 1 ? 0 : rows().length - 1)
      const row = rows()[cursor.at()]
      if (row !== undefined) setChosen({ question: question(), value: row.value })
    },
  }
}
