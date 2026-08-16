/**
 * `/media/…` — the one address in this app that is not a surface member.
 *
 * A picture cannot travel the surface: a document's `![](shot.png)` becomes an
 * `<img src>`, and the browser fetches that URL itself. So there is exactly one
 * HTTP route besides the bundle, and it has two ends — the renderer that WRITES
 * the URL (`@olai/web`) and the route that READS it (`@olai/server`) — which
 * live in packages that cannot import each other.
 *
 * A PAGE is fetched here too, and by the same reasoning taken one step further.
 * A `.html` preview is a frame with a `src` now rather than markup handed over
 * in a `srcdoc` (`./seal.ts` argues why, and `@olai/web`'s `Hypertext.tsx` is
 * the frame), so the file has a real URL — and every relative address inside it
 * resolves against that URL, which is the whole reason to give it one. So this
 * route answers a page, its pictures, its stylesheet, its script and its font:
 * the vault's own directory shape, as a URL space, which is what makes a
 * saved page's addresses correct without anything of the file being rewritten.
 * {@link mediaTarget} is still the only thing that decides what that admits,
 * and `@olai/format`'s `isAsset` is still the only list of suffixes in it.
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

import { isAsset } from "@olai/format"

export const MEDIA_PREFIX = "/media/"

/**
 * The URL a served file is fetched from — a picture a markdown document points
 * at, or the `.html` a preview frame is pointed AT.
 *
 * One function for both, because it is one URL space and the second caller is
 * what makes that visible: the frame's `src` is this route at the file's own
 * path, so the browser resolves the file's own relative addresses under the
 * same route with no help from anybody. A second spelling of "what a media URL
 * looks like", in a package that cannot import this one, is exactly the
 * contract-kept-by-memory this file was written to prevent.
 */
export const mediaHref = (file: string): string =>
  // Per SEGMENT, so a directory in the path stays a path rather than a run of
  // `%2F` — and it is exactly what {@link mediaTarget} decodes at the other end.
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
 *   - the name must be something a page may fetch, by `@olai/format`'s
 *     `isAsset` — the page itself, a picture, a stylesheet, a script, a font.
 *     That list is where the argument for each of those lives, and what it
 *     leaves out (`.md`, `.olai`, `.svg`, data) is the more interesting half of
 *     it. It is WIDER than the allowlist the renderer rewrites a relative
 *     `![](…)` against, and deliberately: markdown may still name a picture and
 *     nothing else, because that is a rule about what markdown MEANS, while
 *     this is a rule about what a browser may ask this server for.
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
  return isAsset(file) ? file : null
}
