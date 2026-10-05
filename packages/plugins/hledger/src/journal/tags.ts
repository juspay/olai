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

/** The tags one comment carries, in the order written. */
export const tagsIn = (comment: string): ReadonlyArray<Tag> => {
  const tags: Array<Tag> = []
  const pattern = /([^\s:;,]+):\s*([^,]*)/g
  for (let found = pattern.exec(comment); found !== null; found = pattern.exec(comment)) {
    const value = (found[2] as string).trim()
    tags.push({ key: found[1] as string, value: value === "" ? null : value })
  }
  return tags
}
