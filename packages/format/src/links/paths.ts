/**
 * THE ARITHMETIC OF A RELATIVE ADDRESS — where a path written in one file
 * lands in the served directory, and the refusals that keep it inside. No rule
 * here knows what kind of file it lands on: that is `./standard.ts`'s and the
 * registry's.
 */

/** Spell a served path beside the file whose prose names it. */
export const relativeFrom = (from: string, path: string): string => {
  const directory = from.split("/").slice(0, -1)
  const target = path.split("/")
  let same = 0
  while (same < directory.length && same < target.length && directory[same] === target[same]) same++
  return [...directory.slice(same).map(() => ".."), ...target.slice(same)].join("/")
}

/** Join `to` onto the directory of `from`, collapsing `.` and `..`. A `..` that
 *  would climb above the served directory is dropped rather than escaping it:
 *  there is nothing up there to name, and every caller matches the answer
 *  against files that were actually found. */
export const resolveRelative = (from: string, to: string): string => {
  const segments = from.split("/").slice(0, -1)
  for (const segment of to.split("/")) {
    if (segment === "" || segment === ".") continue
    if (segment === "..") segments.pop()
    else segments.push(segment)
  }
  return segments.join("/")
}

/**
 * The file under the served directory a markdown address names, before anyone
 * asks WHAT KIND of file it has to be — or `null` for an address this app does
 * not resolve at all.
 *
 * The refusals live here, once, because there are two sinks and they are two
 * different things: a picture becomes a `/media/…` URL the server answers, a
 * link becomes the document's own address, which the client opens. A refusal added to one of
 * them and not the other would be a widening nobody meant — and the two lists
 * were character-for-character identical the moment there were two.
 *
 * No scheme (so no `http:`, no `data:`, no `javascript:`), no `//host`, no
 * absolute path, no bare fragment: everything on that list is either somewhere
 * else's business or a way of naming something that is not a file in this
 * directory. A `..` is not refused but CLAMPED by {@link resolveRelative}.
 *
 * A `%20` is a space in the filename, not a filename that contains a percent
 * sign. Markdown's portable spelling of a space in a destination is the
 * encoding, and the parser writes it into the href; decoding HERE — once,
 * per segment, the way a written address is read — is what stops the page
 * printer from encoding the percent again.
 */
const relativeTo = (from: string, to: string): string | null => {
  if (refusedHref(to)) return null
  const decoded = decodeHref(to)
  if (decoded === null || (decoded !== to && refusedHref(decoded))) return null
  return resolveRelative(from, decoded)
}

/** The refusals {@link relativeTo} applies to the href as written and again
 *  after decoding, so `%2Fetc/passwd.md` cannot sneak past as a relative path. */
const refusedHref = (href: string): boolean =>
  href === "" || href.startsWith("/") || href.startsWith("#") || SCHEME.test(href)

/**
 * Percent-decode one path, per segment — or `null` for an escape nothing
 * could have written. Per segment so `%2F` is a slash in a name rather than
 * a separator, matching how a written address is read.
 */
export const decodeHref = (href: string): string | null => {
  if (!href.includes("%")) return href
  const segments = href.split("/").map(decodedSegment)
  return segments.includes(null) ? null : segments.join("/")
}

const decodedSegment = (segment: string): string | null => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}


/**
 * The path in this directory that a relative reference names, whatever suffix
 * it turns out to have — or `null` for a string that names no path at all.
 *
 * THE SIBLING of {@link pictureOf}, and the one that asks less rather than
 * more. The picture rule ends at an allowlist because its caller cannot ask
 * the directory: a markdown renderer rewrites an `href` without knowing what
 * the vault holds, so "is this a picture" has to be answered from the name.
 * THIS one's caller can ask — a property value becomes a link only where the
 * tab is holding the path in its file list (`@olai/web`'s `props/door.ts`) —
 * and existence is a stronger answer than any suffix rule: it lets an `.olai`
 * be named, which `bodyKind` refuses because an outline is a tree rather than
 * a body, and it refuses a `.md` the directory has not got, which a rendered
 * link would otherwise rewrite for a page the vault does not have.
 *
 * WHAT IT STILL OWNS is the half that is not the suffix, and it is the half
 * that matters: {@link relativeTo}'s refusals — no scheme, no `//host`, no
 * absolute path, no bare fragment — and {@link resolveRelative}'s clamping of
 * `..` to the served root. Those are one spelling for both of these, which
 * is exactly the arrangement the paragraph above {@link relativeTo} is
 * written to keep.
 */
export const pathedOf = (from: string, href: string): string | null =>
  relativeTo(from, href)

/** A URL scheme, or the `//host` that borrows the page's own. Tested before
 *  resolution, because a `:` is a character a path resolver would happily
 *  treat as part of a file name. */
const SCHEME = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/

