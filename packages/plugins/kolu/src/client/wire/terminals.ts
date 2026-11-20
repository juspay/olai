export type Resolved =
  | { readonly kind: "one"; readonly id: string }
  | { readonly kind: "none" }
  | { readonly kind: "many"; readonly count: number }

const NONE: Resolved = { kind: "none" }

export const resolveTerminal = (value: string, ids: Iterable<string>): Resolved => {
  if (value === "") return NONE
  let found: string | undefined
  let count = 0
  for (const id of ids) {
    if (id === value) return { kind: "one", id }
    if (!id.startsWith(value)) continue
    count += 1
    if (found === undefined) found = id
  }
  if (count === 1 && found !== undefined) return { kind: "one", id: found }
  return count === 0 ? NONE : { kind: "many", count }
}

export const whoOf = (repo: string | null, label: string): string => {
  const named = label.trim()
  if (repo === null) return named
  return named === "" ? repo : `${repo}·${named}`
}
