import { batch } from "solid-js"
import { createStore } from "solid-js/store"

const SEPARATOR = "\u0000"

export const createDrafts = () => {
const [drafts, setDrafts] = createStore<Record<string, ReadonlyArray<string> | undefined>>({})
const EMPTY: ReadonlyArray<string> = []

const slot = (ask: string, field: string): string => `${ask}${SEPARATOR}${field}`

const draftOf = (ask: string, field: string): ReadonlyArray<string> =>
  drafts[slot(ask, field)] ?? EMPTY

const setDraft = (
  ask: string,
  field: string,
  values: ReadonlyArray<string>,
): void => {
  setDrafts(slot(ask, field), values)
}

const draftAnswers = (
  ask: string,
  fields: ReadonlyArray<string>,
): ReadonlyArray<{ readonly key: string; readonly values: ReadonlyArray<string> }> =>
  fields
    .map((key) => ({ key, values: draftOf(ask, key) }))
    .filter((answer) => answer.values.length > 0)

const forgetDraft = (ask: string): void => {
  batch(() => {
    for (const key of Object.keys(drafts)) {
      if (key.startsWith(`${ask}${SEPARATOR}`)) setDrafts(key, undefined)
    }
  })
}

return { empty: () => Object.values(drafts).every(values => !values?.length), draftOf, setDraft, draftAnswers, forgetDraft }
}
