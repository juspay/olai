/**
 * What has been filled into a question that has not been submitted yet.
 *
 * MODULE-SCOPED, for the reason the folds are ({@link ./folds.ts}): the panel is
 * rebuilt from nothing whenever the drawer is closed and opened, and a draft
 * kept in the form's own `createSignal` comes back empty. A half-answered
 * question is the worst possible thing to lose that way — the turn is stopped
 * on it, so the only way forward is to type it all again.
 *
 * Keyed by the ask's globally unique row id and the field's key, flat, with a separator no key
 * can contain. Nothing is stored and nothing is sent: a draft belongs to a
 * reading, and the moment it is submitted the answer on the row is the truth.
 */

import { createSignal } from "solid-js"

/** `\u0000` is not in a JSON Schema property name or a transcript key, so one
 *  map does the work of a map of maps. */
const SEPARATOR = "\u0000"

const [drafts, setDrafts] = createSignal<ReadonlyMap<string, ReadonlyArray<string>>>(
  new Map(),
)

const slot = (ask: string, field: string): string => `${ask}${SEPARATOR}${field}`

/** What has been typed or picked for one field, or nothing yet. */
export const draftOf = (ask: string, field: string): ReadonlyArray<string> =>
  drafts().get(slot(ask, field)) ?? []

export const setDraft = (
  ask: string,
  field: string,
  values: ReadonlyArray<string>,
): void => {
  setDrafts((held) => new Map(held).set(slot(ask, field), values))
}

/** Everything filled into one question, as the answers a verb takes. Fields
 *  nobody touched are absent, which is what says they were left alone. */
export const draftAnswers = (
  ask: string,
  fields: ReadonlyArray<string>,
): ReadonlyArray<{ readonly key: string; readonly values: ReadonlyArray<string> }> =>
  fields
    .map((key) => ({ key, values: draftOf(ask, key) }))
    .filter((answer) => answer.values.length > 0)

/** Let go of a question that has stopped waiting. Not required for
 *  correctness — a settled row reads its answers off the entry — but a draft
 *  nobody can reach again is memory the tab keeps for its own sake. */
export const forgetDraft = (ask: string): void => {
  setDrafts((held) => {
    const next = new Map(held)
    for (const key of next.keys()) {
      if (key.startsWith(`${ask}${SEPARATOR}`)) next.delete(key)
    }
    return next
  })
}
