/**
 * AN ADDRESS CUT ONCE — the path, the query and the fragment of a link as a
 * text wrote it. `./read.ts` cuts every link it reads; the page cuts the
 * `href` it draws with the same function. Parser-free, so a caller that only
 * cuts an address carries no parser with it.
 */

/** An address as written, cut once: the path before any `?` or `#`, the
 *  query between them, the fragment after the `#`. */
export interface Cut {
  /** The address as the text wrote it, escapes and references decoded. */
  readonly url: string
  readonly path: string
  readonly query: string | null
  readonly fragment: string | null
}

/** Cut an address into its three parts, once. */
export const cut = (url: string): Cut => {
  const hash = url.indexOf("#")
  const before = hash === -1 ? url : url.slice(0, hash)
  const question = before.indexOf("?")
  return {
    url,
    path: question === -1 ? before : before.slice(0, question),
    query: question === -1 ? null : before.slice(question + 1),
    fragment: hash === -1 ? null : url.slice(hash + 1),
  }
}
