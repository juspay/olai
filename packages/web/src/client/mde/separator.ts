/**
 * WHAT A FILE ENDS ITS LINES WITH, when that is a thing it does consistently.
 *
 * CodeMirror splits an incoming document on `/\r\n?|\n/` and joins it back
 * with `"\n"`, so a `.md` written on Windows comes in as CRLF and goes out as
 * LF: one keystroke would rewrite every OTHER line's ending, and the autosave
 * would send that as though a person had done it. That is the law
 * `./codemirror.ts` states — bytes nobody touched must not move — arriving
 * through the line breaks instead of through the markup.
 *
 * A separator is named ONLY for a file that is consistent about it, and
 * `undefined` is the answer for every other file. A mixed one has no separator
 * to name, and naming one anyway is worse than the default: the odd bare
 * `\n` would stop being a break and become a character sitting inside a line.
 *
 * Its own module because it is a fact about TEXT rather than about an editor —
 * which is what makes it a unit test rather than a browser one.
 */
export const separatorOf = (doc: string): string | undefined => {
  const breaks = doc.split("\n").length - 1
  const crlf = doc.split("\r\n").length - 1
  return crlf > 0 && crlf === breaks ? "\r\n" : undefined
}
