export interface Named {
  readonly id: string
  readonly chunk: string | null
  readonly generation?: number
}

export const signatureOf = (names: ReadonlyArray<Named>): string =>
  names
    .map((one) => `${one.id}\t${one.chunk ?? ""}\t${one.generation ?? 0}`)
    .join("\n")

export const restartRows = (
  before: ReadonlyArray<Named>,
  after: ReadonlyArray<Named>,
): ReadonlyArray<string> => {
  const was = new Map(before.map((one) => [one.id, one]))
  return after
    .filter((one) => {
      const old = was.get(one.id)
      if (old === undefined) return false
      if (old.chunk !== one.chunk) return true
      return (old.generation ?? 0) !== 0 && (old.generation ?? 0) !== (one.generation ?? 0)
    })
    .map((one) => one.id)
}
