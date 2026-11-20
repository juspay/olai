import type { Row } from "@olai/format"

export const parentKeyOf = (key: string): string => key.slice(0, key.lastIndexOf("/"))

export const recordOf = (key: string): string => key.slice(key.lastIndexOf("/") + 1)

export const depthOf = (key: string): number => key.split("/").length - 2

export const chainOf = (key: string): ReadonlyArray<string> => key.split("/").slice(1)

export const inside = (ancestor: string, key: string): boolean =>
  key.startsWith(`${ancestor}/`)

export const beneath = (these: ReadonlySet<string>, key: string): boolean =>
  these.has(key) || [...these].some((one) => inside(one, key))

export const spanning = (
  drawn: ReadonlyArray<Row>,
  from: string,
  to: string,
): ReadonlyArray<string> => {
  const at = drawn.findIndex((row) => row.key === from)
  const until = drawn.findIndex((row) => row.key === to)
  if (at === -1 || until === -1) return []
  const [first, last] = at <= until ? [at, until] : [until, at]
  return drawn.slice(first, last + 1).map((row) => row.key)
}

export const topmost = (
  drawn: ReadonlyArray<Row>,
  keys: ReadonlySet<string>,
): ReadonlyArray<Row> => {
  const chosen = drawn.filter((row) => keys.has(row.key))
  return chosen.filter((row) =>
    !chosen.some((other) => other.key !== row.key && inside(other.key, row.key))
  )
}

export const alongside = (
  drawn: ReadonlyArray<Row>,
  key: string,
): ReadonlyArray<string> => {
  if (!drawn.some((row) => row.key === key)) return []
  const parent = parentKeyOf(key)
  return drawn.filter((row) => parentKeyOf(row.key) === parent).map((row) => row.key)
}
