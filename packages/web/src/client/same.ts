export const sameList = <A>(
  a: ReadonlyArray<A>,
  b: ReadonlyArray<A>,
): boolean => a.length === b.length && a.every((one, at) => one === b[at])

export const sameMap = <K, V>(
  a: ReadonlyMap<K, V>,
  b: ReadonlyMap<K, V>,
  same: (one: V, other: V) => boolean = Object.is,
): boolean => {
  if (a.size !== b.size) return false
  for (const [key, one] of a) {
    const other = b.get(key)
    if (other === undefined || !same(one, other)) return false
  }
  return true
}
