import { type Row, shownRecord } from "@olai/format"

export interface Fold {
  readonly id: string
  readonly file: string
}

export const foldIdOf = (row: Row): string => shownRecord(row).node.id

export const foldOf = (row: Row): Fold => {
  const record = shownRecord(row)
  return { id: record.node.id, file: record.file }
}

export const foldsUnder = (row: Row): ReadonlyArray<Fold> => {
  const out: Fold[] = []
  const seen = new Set<string>()
  const walk = (here: Row): void => {
    if (here.children.length > 0) {
      const fold = foldOf(here)
      if (!seen.has(fold.id)) {
        seen.add(fold.id)
        out.push(fold)
      }
    }
    for (const child of here.children) walk(child)
  }
  walk(row)
  return out
}
