export const inBundleOrder = <A>(
  items: Iterable<A>,
  keyOf: (one: A) => string,
  rank: (plugin: string) => number,
): ReadonlyArray<A> =>
  [...items].sort((one, other) => rank(keyOf(one)) - rank(keyOf(other)))
