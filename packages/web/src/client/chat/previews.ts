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
 * Keyed by file NAME, because the name is what the row carries and the server
 * makes it unique inside a conversation (a collision gets a `-1`). Inside ONE
 * conversation, which is why {@link forget} exists: names are re-minted from
 * scratch in the next one, so a cache that outlived the conversation would
 * answer a new row with an old picture. {@link ./state.ts} empties it when the
 * session changes, where that is known.
 *
 * Bounded twice, and by BYTES as well as by count: the policy lets one file be
 * 50 MB, so twenty-four of them is a bound of "up to a gigabyte" — a number
 * nobody meant to write. The oldest go first, and losing one costs a thumbnail
 * or a size, never the chip.
 */

/** How many files a tab remembers, and how much of them. Enough that a
 *  conversation's recent rows are all drawn in full; small enough that a tab
 *  left open for a week is not carrying a week of screenshots. */
const KEPT = 24
const KEPT_BYTES = 64 * 1024 * 1024

const blobs = new Map<string, Blob>()

/** Hold on to what was just sent. */
export const remember = (name: string, blob: Blob): void => {
  // A file larger than the whole budget would evict everything and then sit
  // there alone; the bare name is the better answer for one of those.
  if (blob.size > KEPT_BYTES) return
  blobs.set(name, blob)
  // Map iterates in insertion order, so the first key is the oldest.
  while (blobs.size > KEPT || held() > KEPT_BYTES) {
    const oldest = blobs.keys().next()
    if (oldest.done === true) return
    blobs.delete(oldest.value)
  }
}

/** The Blob for a named attachment, if this tab is the one that sent it. */
export const previewOf = (name: string): Blob | undefined => blobs.get(name)

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

/** The conversation these belonged to is over. The next one starts naming its
 *  files from `shot.png` again, and none of them are these. */
export const forget = (): void => {
  blobs.clear()
}

const held = (): number => {
  let bytes = 0
  for (const blob of blobs.values()) bytes += blob.size
  return bytes
}
