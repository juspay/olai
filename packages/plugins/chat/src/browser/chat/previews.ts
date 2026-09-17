/**
 * What only the tab that attached knows about the bytes it sent.
 *
 * A transcript row names its attachments and stops there — the bytes are in a
 * tmp directory the browser cannot reach, and `/media/*` deliberately cannot
 * help: it is guarded to the served directory, which is exactly where these
 * files are NOT. So every reader gets a chip with a file name on it, which is
 * what a row needs to say.
 *
 * The tab that did the attaching has something nobody else has: the Blob it
 * encoded. Keeping it is free, and it is worth two different things depending
 * on what the file IS — a thumbnail for a picture, and for everything else the
 * one fact a name does not carry, which is how big it is. This is a per-tab
 * CACHE and nothing more — a reload empties it and the bare name takes over,
 * which is the honest thing for it to do.
 *
 * Keyed by the live upload scope and file name. Names are unique within that
 * scope; another conversation can use the same name for different bytes.
 * Switching nodes or remounting the drawer can return to a still-live scope,
 * while a server restart creates a new one even for the same stored session.
 *
 * Bounded twice, and by BYTES as well as by count: the policy lets one file be
 * 50 MB, so twenty-four of them is a bound of "up to a gigabyte" — a number
 * nobody meant to write. The oldest go first, and losing one costs a thumbnail
 * or a size, never the chip.
 */

const key = (scope: string | null, name: string) => JSON.stringify([scope, name])
const KEPT = 24
const KEPT_BYTES = 64 * 1024 * 1024

/** One activation's bounded cache, with an explicit upload lifetime at each
 * access. Two conversations never replace a global current scope. */
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

/**
 * How big it is, in the shortest true words.
 *
 * What a document chip says where a picture shows a thumbnail. A size is the
 * one thing a name cannot tell you and the one thing a person dropping a file
 * at an agent might doubt — "did the whole PDF go, or the first page of it" —
 * so it is the honest thing to put beside `Type 04-C.pdf`.
 *
 * Three digits at most, and the unit it is exact in: bytes are whole (`940 B`,
 * never `0.9 KB`), and anything larger keeps one decimal unless it lands flat.
 * 1024 rather than 1000, matching {@link MAX_ATTACHMENT_BYTES}, so the number
 * beside a file and the number in the refusal that would turn it away are
 * measured the same way.
 */
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
