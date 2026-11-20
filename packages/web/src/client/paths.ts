import { byPath } from "@olai/format"

export const sortByPath = (paths: Iterable<string>): ReadonlyArray<string> =>
  [...paths].sort(byPath)
