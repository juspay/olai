import type { Progress, Status } from "@olai/format"

export interface Branch {
  readonly status?: Status | undefined
  readonly children: ReadonlyArray<Branch>
}

export const doneUnder = (row: Branch): number => {
  let count = 0
  for (const child of row.children) {
    if (child.status === "done") count += 1
    count += doneUnder(child)
  }
  return count
}

export const foldSays = (
  folded: number | undefined,
  rollup: Progress | undefined,
): number | undefined => {
  if (folded === undefined || folded === 0) return undefined
  return rollup?.done === folded ? undefined : folded
}
