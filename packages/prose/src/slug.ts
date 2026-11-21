/**
 * HOW A HEADING'S WORDS BECOME A SLUG — `## Install the app` is
 * `#install-the-app` — and how a repeated one is numbered.
 *
 * One spelling, read by the face that lists a document's headings and by the
 * page that puts the id on the `<h2>`: a slug spelled twice is an address the
 * app writes and cannot open.
 */
import { Schema } from "effect"

/** What a heading in a body is called: the id it is drawn with — `rehype-slug`'s
 *  derivation of the words in it for a `.md`, and whatever its author wrote for
 *  a `.html`. Derived rather than stored, which is exactly why rewording a
 *  heading breaks the address that names it. */
export const Slug = Schema.String.pipe(Schema.brand("Slug"))
export type Slug = typeof Slug.Type

/**
 * The slug of one heading's words.
 *
 * Case-folded, everything that is not a letter, a number, a dash or an
 * underscore dropped, and the spaces that are left joined with dashes — which
 * is `github-slugger`'s rule as a vault ever meets it, and the rule
 * `rehype-slug` used to apply here through it.
 *
 * WRITTEN AS A KEEP-LIST rather than as that library's drop-list, and the two
 * are the same answer for every heading anybody writes: the drop-list is a
 * hand-maintained run of Unicode punctuation and emoji blocks, and `\p{L}` and
 * `\p{N}` are the runtime's own account of the same division. `héllo` keeps
 * its letter, `C++` is `c`, and `Install & setup` is `install--setup` — one
 * dash per space, including the ones the `&` left behind, which is what the
 * library does too and is worth knowing before it looks like a bug.
 *
 * NOT TOTAL over headings in one respect and it cannot be: a heading of pure
 * punctuation slugs to the empty string. That is left as it falls rather than
 * papered over with a generated name — an empty slug is an address nobody can
 * write down, and inventing `section-3` for it would be an identity that moves
 * when a heading above it is added.
 */
export const slugOf = (text: string): Slug =>
  Slug.make(text.toLowerCase().replace(DROPPED, "").replace(/ /g, "-"))

/** Everything a slug is not made of. The complement of "letters, numbers,
 *  dashes, underscores and the spaces between them", said once. */
const DROPPED = /[^\p{L}\p{N}\-_ ]/gu

/** One slug, taken — the counter's step, so the plugin can spend it a heading
 *  at a time as it walks a tree and this file can spend it over a list. */
export const claim = (seen: Map<string, number>, slug: Slug): Slug => {
  let taken: Slug = slug
  // The counter is kept under the ORIGINAL slug, so a document with three
  // `## Notes` hands out `notes`, `notes-1`, `notes-2` — and the loop is what
  // makes a generated name that is itself already taken (a `## Notes 1`
  // beside them) keep counting rather than collide with it.
  while (seen.has(taken)) {
    const count = (seen.get(slug) ?? 0) + 1
    seen.set(slug, count)
    taken = Slug.make(`${slug}-${count}`)
  }
  seen.set(taken, 0)
  return taken
}
