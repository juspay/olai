/**
 * The thumbnails only the tab that pasted can draw.
 *
 * A transcript row names its pictures and stops there — the bytes are in a tmp
 * directory the browser cannot reach, and `/media/*` deliberately cannot help:
 * it is guarded to the served directory, which is exactly where these files are
 * NOT. So every reader gets a chip with a file name on it, which is what a row
 * needs to say.
 *
 * The tab that did the pasting has something nobody else has: the Blob it
 * encoded. Keeping it is free, and it turns that tab's own row into a picture.
 * This is a per-tab CACHE and nothing more — a reload empties it and the chip
 * takes over, which is the honest thing for it to do.
 *
 * Keyed by file NAME, because the name is what the row carries and the server
 * makes it unique inside a conversation (a collision gets a `-1`). Inside ONE
 * conversation, which is why {@link forget} exists: names are re-minted from
 * scratch in the next one, so a cache that outlived the conversation would
 * answer a new row with an old picture. {@link ./state.ts} empties it when the
 * session changes, where that is known.
 *
 * Bounded twice, and by BYTES as well as by count: the policy lets one picture
 * be 50 MB, so twenty-four of them is a bound of "up to a gigabyte" — a number
 * nobody meant to write. The oldest go first, and losing one costs a
 * thumbnail.
 */

/** How many pictures a tab remembers, and how much of them. Enough that a
 *  conversation's recent rows are all pictures; small enough that a tab left
 *  open for a week is not carrying a week of screenshots. */
const KEPT = 24
const KEPT_BYTES = 64 * 1024 * 1024

const blobs = new Map<string, Blob>()

/** Hold on to what was just sent. */
export const remember = (name: string, blob: Blob): void => {
  // A picture larger than the whole budget would evict everything and then sit
  // there alone; the chip is the better answer for one of those.
  if (blob.size > KEPT_BYTES) return
  blobs.set(name, blob)
  // Map iterates in insertion order, so the first key is the oldest.
  while (blobs.size > KEPT || held() > KEPT_BYTES) {
    const oldest = blobs.keys().next()
    if (oldest.done === true) return
    blobs.delete(oldest.value)
  }
}

/** The Blob for a named picture, if this tab is the one that sent it. */
export const previewOf = (name: string): Blob | undefined => blobs.get(name)

/** The conversation these belonged to is over. The next one starts naming its
 *  pictures from `shot.png` again, and none of them are these. */
export const forget = (): void => {
  blobs.clear()
}

const held = (): number => {
  let bytes = 0
  for (const blob of blobs.values()) bytes += blob.size
  return bytes
}
