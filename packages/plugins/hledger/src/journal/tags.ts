/**
 * THE `key:value` PAIRS ONE COMMENT CARRIES — hledger's tags, in the order
 * written.
 *
 * hledger's rule, which is not the one a guess would pick: a KEY is one token
 * and a VALUE runs to the next comma or the end of the comment, so
 * `; trip:berlin paid:card` is ONE tag whose value is `berlin paid:card` — the
 * comma is what separates two (`; trip:berlin, paid:card`).
 */

/** One `key:value` from a comment. A `key:` with nothing after it keeps a null
 *  value rather than an empty string, because the empty string is a value
 *  somebody could have written. */
export interface Tag {
  readonly key: string
  readonly value: string | null
}

/** What one comment says: its tags, and the PROSE left between them — a page
 *  draws the prose once and the tags once, rather than the whole comment and
 *  then the tags again out of it. */
export interface Commented {
  readonly tags: ReadonlyArray<Tag>
  readonly prose: string
}

/** The tags one comment carries, in the order written, and the prose around
 *  them. A tag's own text — the key, the colon and the value that runs to the
 *  next comma — is not prose, and neither is the comma that separated it from
 *  the next one. */
export const tagsIn = (comment: string): Commented => {
  const tags: Array<Tag> = []
  let prose = ""
  let at = 0
  const pattern = /([^\s:;,]+):\s*([^,]*),?/g
  for (let found = pattern.exec(comment); found !== null; found = pattern.exec(comment)) {
    prose += comment.slice(at, found.index)
    const value = (found[2] as string).trim()
    tags.push({ key: found[1] as string, value: value === "" ? null : value })
    at = found.index + (found[0] as string).length
  }
  prose += comment.slice(at)
  return { tags, prose: prose.replace(/\s+/g, " ").trim() }
}
