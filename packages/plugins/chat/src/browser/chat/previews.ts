const key = (scope: string | null, name: string) => JSON.stringify([scope, name])
const KEPT = 24
const KEPT_BYTES = 64 * 1024 * 1024

export const createPreviews = () => {
  const blobs = new Map<string, Blob>()
  const held = () => [...blobs.values()].reduce((bytes, blob) => bytes + blob.size, 0)
  return {
    remember: (name: string, blob: Blob, scope: string | null): void => {
      if (blob.size > KEPT_BYTES) return
      blobs.set(key(scope, name), blob)
      while (blobs.size > KEPT || held() > KEPT_BYTES) {
        const oldest = blobs.keys().next()
        if (oldest.done) return
        blobs.delete(oldest.value)
      }
    },
    previewOf: (name: string, scope: string | null): Blob | undefined => blobs.get(key(scope, name)),
  }
}

export const sizeText = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let size = bytes / 1024
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size = size / 1024
    unit++
  }
  const shown = size >= 10 || Number.isInteger(size) ? Math.round(size) : size.toFixed(1)
  return `${shown} ${units[unit]}`
}
