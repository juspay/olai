/** Per-conversation drafts state, created by the conversation UI owner.
 * It survives folding within this tab activation and leaves with that owner. */

import { createSignal } from "solid-js"

/** `\u0000` is not in a JSON Schema property name or a transcript key, so one
 *  map does the work of a map of maps. */
const SEPARATOR = "\u0000"

export const createDrafts = () => {
const [drafts, setDrafts] = createSignal<ReadonlyMap<string, ReadonlyArray<string>>>(
  new Map(),
)

const slot = (ask: string, field: string): string => `${ask}${SEPARATOR}${field}`

/** What has been typed or picked for one field, or nothing yet. */
const draftOf = (ask: string, field: string): ReadonlyArray<string> =>
  drafts().get(slot(ask, field)) ?? []

const setDraft = (
  ask: string,
  field: string,
  values: ReadonlyArray<string>,
): void => {
  setDrafts((held) => new Map(held).set(slot(ask, field), values))
}

/** Everything filled into one question, as the answers a verb takes. Fields
 *  nobody touched are absent, which is what says they were left alone. */
const draftAnswers = (
  ask: string,
  fields: ReadonlyArray<string>,
): ReadonlyArray<{ readonly key: string; readonly values: ReadonlyArray<string> }> =>
  fields
    .map((key) => ({ key, values: draftOf(ask, key) }))
    .filter((answer) => answer.values.length > 0)

/** Let go of a question that has stopped waiting. Not required for
 *  correctness — a settled row reads its answers off the entry — but a draft
 *  nobody can reach again is memory the tab keeps for its own sake. */
const forgetDraft = (ask: string): void => {
  setDrafts((held) => {
    const next = new Map(held)
    for (const key of next.keys()) {
      if (key.startsWith(`${ask}${SEPARATOR}`)) next.delete(key)
    }
    return next
  })
}

return { draftOf, setDraft, draftAnswers, forgetDraft }
}
