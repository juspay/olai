export interface Editing {
  readonly key: string
  readonly value: string
}

export const sending = (
  was: Editing | null,
  key: string,
  value: string,
): {
  readonly key: string
  readonly value: string
  readonly was: string | null
} => ({
  key: (was === null ? key : was.key).trim(),
  value,
  was: was === null ? null : was.value,
})

export const writes = (was: Editing | null, key: string, value: string): boolean => {
  const sent = sending(was, key, value)
  if (was === null) return sent.key !== "" && sent.value !== ""
  return value !== was.value
}

export type ClosedBy = "enter" | "escape" | null

export const leavingCommits = (closedBy: ClosedBy): boolean => closedBy === null

export const openedOn = (
  editing: Editing | null | undefined,
  entry: { readonly key: string; readonly system: boolean },
): Editing | undefined =>
  editing != null && !entry.system && editing.key === entry.key ? editing : undefined
