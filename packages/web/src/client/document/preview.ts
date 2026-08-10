/**
 * A document, in one line.
 *
 * Wherever a `doc`-carrying node is drawn but not zoomed, it shows the
 * document's first line — enough to know what is in there without opening it,
 * and never so much that a row stops being a row.
 *
 * PLAIN TEXT, not rendered markdown: this sits inside a line beside a title,
 * and a heading, a list or a fenced block drawn there would be a document
 * pretending to be a row. So the first non-blank line is taken and its heading
 * marks are dropped — `# Finishes` is a document called Finishes, and the
 * hashes are markup rather than the name.
 */

export const firstLine = (text: string): string => {
  // Scanned rather than split: a preview reads the top of a document, and
  // `split("\n")` would allocate every line of one to throw all but the first
  // away — on a page that draws this beside every `doc`-carrying row.
  let at = 0
  while (at < text.length) {
    const end = text.indexOf("\n", at)
    const line = (end === -1 ? text.slice(at) : text.slice(at, end)).trim()
    if (line !== "") {
      // Only the heading marks, and only where markdown puts them: leading
      // `#`s, and the optional closing run of them. Everything else stays as
      // written — stripping emphasis and links here would be a second, worse
      // renderer.
      const stripped = line.replace(/^#{1,6}\s+/, "").replace(/\s+#+$/, "")
      return stripped === "" ? line : stripped
    }
    if (end === -1) break
    at = end + 1
  }
  return ""
}
