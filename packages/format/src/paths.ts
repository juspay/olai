const SEPARATOR = "/".charCodeAt(0)

export const byPath = (one: string, other: string): -1 | 0 | 1 => {
  const shared = Math.min(one.length, other.length)
  for (let at = 0; at < shared; at++) {
    const left = one.charCodeAt(at)
    const right = other.charCodeAt(at)
    if (left === right) continue
    if (left === SEPARATOR) return -1
    if (right === SEPARATOR) return 1
    return left < right ? -1 : 1
  }
  return one.length === other.length ? 0 : one.length < other.length ? -1 : 1
}

export const basenameOf = (file: string): string =>
  file.slice(file.lastIndexOf("/") + 1)
