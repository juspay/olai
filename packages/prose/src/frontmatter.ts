/**
 * WHERE A FILE'S FRONTMATTER ENDS — the `---` block at the top of a `.md`,
 * and the body below it.
 *
 * Only the edge lives here. What the block SAYS — its keys, read into a
 * record's properties — is `@olai/format`'s `frontmatterIn`, which asks
 * {@link matterIn} where the block is. The edge is here because every reader
 * of a document's text needs it, the page as much as the index, and the page
 * must not load the format's reading of YAML to find it.
 *
 * A NOTE UNDER A ROW HAS NO FRONTMATTER: it is not a file, and a leading `---`
 * there is a thematic break like any other. So this is asked of a file's
 * body, never of a title or a note.
 */

/**
 * A body with its frontmatter taken off — the text every reading of a
 * document's CONTENT is about.
 *
 * IDENTITY for a body that opens with none, which is nearly all of them: the
 * scan below answers `null` on the first character of the first line, so this
 * costs a `startsWith` per document and allocates nothing.
 *
 * IT IS THE ONE SPELLING OF THE SKIP, for the index and the browser alike:
 * `@olai/format` reads a document's title, headings, tags and links off what
 * this leaves, and its search fold asks it so a word only the block holds is
 * found by `prop:` rather than by typing it; the faces that draw a whole file
 * strip the block with this call before the markdown pipeline sees it. So the
 * page and the face cannot disagree about which lines a document has — they
 * are the same function, rather than two rules held together by a test.
 *
 * A `remark-frontmatter` in that pipeline was the other way to do it, and it
 * is wrong for a reason worth keeping written down: that is ONE pipeline for
 * every piece of markdown the app draws, so the plugin would change the dialect
 * for a node's NOTE and for the agent's replies as well — hiding a leading
 * `---` block off the screen while the index went on reading it as the prose
 * it is. Two readings of one block, which is the thing this module exists to
 * end.
 */
export const proseIn = (body: string): string => {
  const matter = matterIn(body)
  return matter === null ? body : body.slice(matter.from)
}

/** Number of source lines removed before the prose, shared by search and rendering. */
export const proseLineOffset = (body: string): number =>
  body.slice(0, body.length - proseIn(body).length).split("\n").length - 1

/** Where a body's frontmatter is: the text BETWEEN the fences, and the offset
 *  the prose begins at. `null` for a body that carries none — which includes
 *  one whose opening fence is never closed. Unclosed is not frontmatter, which
 *  is micromark's answer too. */
export const matterIn = (body: string): { readonly text: string; readonly from: number } | null => {
  // The cheap negative first, and it is the answer for every document in a
  // directory but the few that carry a block: the fence is the FIRST line, so
  // one character decides it.
  if (body.charCodeAt(0) !== DASH) return null
  const opens = body.indexOf("\n")
  if (opens === -1 || !isFence(body, 0, opens)) return null
  let at = opens + 1
  while (at < body.length) {
    const end = body.indexOf("\n", at)
    if (isFence(body, at, end === -1 ? body.length : end)) {
      return { text: body.slice(opens + 1, at), from: end === -1 ? body.length : end + 1 }
    }
    if (end === -1) break
    at = end + 1
  }
  // UNCLOSED IS NOT FRONTMATTER: the block runs to the closing fence or it
  // is not a block.
  return null
}

const DASH = "-".charCodeAt(0)
const SPACE = " ".charCodeAt(0)
const TAB = "\t".charCodeAt(0)
const RETURN = "\r".charCodeAt(0)

/**
 * Is the span `[from, to)` of `text` the block's fence — exactly three dashes
 * at the left margin, and after them nothing a line ending may carry?
 *
 * OVER OFFSETS rather than over a line, which is what keeps the walk above
 * allocation-free on the path that matters: an UNCLOSED `---` is scanned to
 * the end of the file before it can be refused, and a line materialised per
 * line of a whole document is a cost every reader of a body refuses. Every
 * line of that walk costs three `charCodeAt`s and stops on the first one that
 * is not a dash.
 */
const isFence = (text: string, from: number, to: number): boolean =>
  to - from >= 3 && text.charCodeAt(from) === DASH && text.charCodeAt(from + 1) === DASH &&
  text.charCodeAt(from + 2) === DASH && blank(text, from + 3, to)

/** Whether the span holds only the whitespace a line ending may drag along —
 *  spaces, tabs, and the `\r` of a file written on Windows. */
const blank = (text: string, from: number, to: number): boolean => {
  for (let at = from; at < to; at++) {
    const char = text.charCodeAt(at)
    if (char !== SPACE && char !== TAB && char !== RETURN) return false
  }
  return true
}
