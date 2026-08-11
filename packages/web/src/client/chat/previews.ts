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
 * Keyed by file NAME rather than path, because the name is what the row
 * carries, and the server makes it unique inside a conversation (a collision
 * gets a `-1`). Bounded, because a tab left open for a week pasting screenshots
 * should not hold all of them: the oldest go first, and losing one costs a
 * thumbnail.
 */

/** How many pictures a tab remembers. Enough that a conversation's recent rows
 *  are all pictures; small enough that it is not a leak. */
const KEPT = 24

const blobs = new Map<string, Blob>()

/** Hold on to what was just sent. */
export const remember = (name: string, blob: Blob): void => {
  blobs.set(name, blob)
  // Map iterates in insertion order, so the first key is the oldest.
  while (blobs.size > KEPT) {
    const oldest = blobs.keys().next()
    if (oldest.done === true) return
    blobs.delete(oldest.value)
  }
}

/** The Blob for a named picture, if this tab is the one that sent it. */
export const previewOf = (name: string): Blob | undefined => blobs.get(name)
