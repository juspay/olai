/**
 * `/media/…` — the one address in this app that is not a surface member.
 *
 * A picture cannot travel the surface: a document's `![](shot.png)` becomes an
 * `<img src>`, and the browser fetches that URL itself. So there is exactly one
 * HTTP route besides the bundle, and it has two ends — the renderer that WRITES
 * the URL (`@olai/web`) and the route that READS it (`@olai/server`) — which
 * live in packages that cannot import each other.
 *
 * That is why the bijection is declared here, in the package whose whole job is
 * the contract both ends speak. Two copies of "what a media URL looks like"
 * would be a contract kept by memory, and the failure would be silent in the
 * usual direction: a URL the client writes and the server does not recognise is
 * a broken image, and a URL the server recognises more loosely than the client
 * writes is a file nobody meant to serve.
 *
 * Writing and reading sit beside each other for the same reason `routes.ts`
 * keeps `hrefOf` and `routeOf` together: they are one bijection, and the test
 * that round-trips them is what says so.
 */

import { isPicture } from "@olai/format"

export const MEDIA_PREFIX = "/media/"

/** The URL a served picture is fetched from. Encoded per segment, so a
 *  directory in the path stays a path rather than a run of `%2F`. */
export const mediaHref = (file: string): string =>
  MEDIA_PREFIX + file.split("/").map(encodeURIComponent).join("/")

/**
 * What a `/media/…` request names, as a path relative to the served directory
 * — or `null` for a request this route does not answer at all.
 *
 * This is the traversal guard, and it is the whole of it:
 *
 *   - the path is DECODED first and judged after, so `%2e%2e` is refused for
 *     the same reason `..` is. Nothing here resolves a `..`, which is what
 *     makes "under the root" a property of the answer rather than of the
 *     arithmetic that produced it;
 *   - a segment that is empty, `.`, `..`, or carries a separator or a NUL is a
 *     request to mean something other than one segment of a relative path, and
 *     there is no such meaning;
 *   - the name must be a picture, by `@olai/format`'s allowlist — the same one
 *     the renderer rewrites a relative `src` against.
 */
export const mediaTarget = (url: string): string | null => {
  // The query and fragment are not part of the name. Cut before decoding, so a
  // `%3F` in a file name stays a character rather than becoming a delimiter.
  const cut = url.search(/[?#]/)
  const path = cut === -1 ? url : url.slice(0, cut)
  if (!path.startsWith(MEDIA_PREFIX)) return null

  const segments: Array<string> = []
  for (const raw of path.slice(MEDIA_PREFIX.length).split("/")) {
    let segment: string
    try {
      segment = decodeURIComponent(raw)
    } catch {
      // A malformed escape names nothing.
      return null
    }
    if (segment === "" || segment === "." || segment === "..") return null
    if (segment.includes("/") || segment.includes("\\") || segment.includes("\0")) {
      return null
    }
    segments.push(segment)
  }

  const file = segments.join("/")
  return isPicture(file) ? file : null
}
