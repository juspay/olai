export interface Tag {
  readonly key: string
  readonly value: string | null
}

export interface Commented {
  readonly tags: ReadonlyArray<Tag>
  readonly prose: string
}

export const tagsIn = (comment: string): Commented => {
  const tags: Array<Tag> = []
  let prose = ""
  let at = 0
  // hledger's rule: a tag key is one word, and its value runs to the next comma or
  // the end of the comment — https://hledger.org/journal.html#tags
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
