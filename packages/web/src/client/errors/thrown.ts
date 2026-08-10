/**
 * What a thrown value is, said in text a person can put in a bug report.
 *
 * The one part of the fault surface that is not markup, so it is the part that
 * can be tested without a browser: a fault card is only worth drawing if what
 * it draws is the fault, and "the fault" arrives as `unknown` — a render can
 * throw a string, an `undefined`, a `DOMException`, anything.
 *
 * The STACK when there is one, because the message alone ("undefined is not an
 * object") names no file and the whole reason this card exists is that the
 * alternative was a dead tab with the truth in a console nobody opened. V8
 * prints the message as the stack's first line, so this is not the message
 * twice.
 */

/** The fault, as the card prints it. Never empty: a thrown value that says
 *  nothing about itself is still a fault, and an empty card would read as a
 *  page that broke for no reason. */
export const thrownText = (error: unknown): string => {
  if (error instanceof Error) {
    const named = `${error.name}: ${error.message}`
    // A stack that has lost the message (Safari's, and any Error re-thrown
    // with a new message) gets it put back on the front rather than dropped.
    if (error.stack === undefined || error.stack === "") return named
    return error.stack.startsWith(error.name) ? error.stack : `${named}\n${error.stack}`
  }
  const said = String(error)
  return said === "" ? "the page threw a value that says nothing about itself" : said
}
