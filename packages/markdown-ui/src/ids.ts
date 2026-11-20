export const namespaceOf = (key: string): string => {
  let hash = 0x811c9dc5
  for (let at = 0; at < key.length; at++) {
    hash ^= key.charCodeAt(at)
    hash = Math.imul(hash, 0x01000193)
  }
  return `md-${(hash >>> 0).toString(36)}`
}

export const idIn = (namespace: string, authored: string): string => `${namespace}-${authored}`
