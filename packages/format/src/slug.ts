/**
 * WHAT A HEADING IN A BODY IS CALLED.
 *
 * The other half of the address grammar's `[document]#[element]`: a `#` after
 * a `.md` names a heading (`./address.ts` says why the DOCUMENT decides that),
 * and what it names it by is the words of the heading, folded down to
 * something a URL can carry. `## Install the app` is `#install-the-app`.
 *
 * DERIVED, NOT STORED, and that is the round's ruling rather than an
 * implementation detail: a `.md` has nowhere to write an id, so the words are
 * the identity — and rewording a heading breaks the address that named it. The
 * later evolution is an opt-in explicit `## Install {#setup}`, which is named
 * in the design (docs/brainstorming/first-class-documents.md) and not designed
 * here.
 *
 * ## Why the rule is here and not in the renderer
 *
 * Two things have to agree about a slug and they run in different processes.
 * The FACE says which headings a document has ({@link ./document.ts}), so a
 * backlink onto `README.md#install` can be checked and a page can say what it
 * points at; the BROWSER puts the id on the `<h2>` it draws, so the address
 * lands somewhere. A slug spelled twice is an address the app writes and
 * cannot open, which is the whole class of bug the address grammar was
 * centralised to end — so {@link slugOf} is the one spelling, and the client's
 * markdown pipeline asks it rather than reaching for `rehype-slug`
 * (`@olai/web`'s `markdown/slugs.ts`, which is that plugin and nothing else).
 *
 * WHERE THEY STILL PART is WHICH LINES ARE HEADINGS, and it is said here
 * rather than left to be discovered. The browser has a markdown parser and
 * this package deliberately has none — it is the floor the validator stands
 * on, and putting a parser under the write gate is the trade `./derive.ts`
 * already refuses for the same reason. So {@link headingsIn} reads LINES: ATX
 * headings (`## Words`), setext headings (a line underlined with `=` or `-`),
 * and nothing inside a fenced code block, which is the one construct whose
 * contents look like headings often enough to matter (`# comment` in a shell
 * fence). A heading built out of anything subtler than that — one inside a
 * blockquote or a list item, one whose text is an image — is drawn with an id
 * and is missing from the face's list, which costs a backlink and never a
 * broken page. `@olai/web`'s `markdown/slugs.test.ts` holds the two readings
 * to each other over the fixture vault, so the gap is measured rather than
 * assumed.
 */

import { Slug } from "./address.ts"

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

/**
 * The slugs of a whole body, in document order and never repeated — the list
 * the face carries.
 *
 * DEDUPED THE WAY A RENDERER DEDUPES, because two headings with the same words
 * are two places and an address may only name one of them: the first keeps the
 * bare slug, and each one after it takes the next `-1`, `-2`. That rule is
 * `github-slugger`'s counter, and it is here rather than in the plugin for the
 * reason {@link slugOf} is — one of them is the id on the page and the other
 * is the id the face promises exists.
 *
 * A heading that slugs to nothing is LEFT OUT rather than counted: it is not
 * an address, so it is not an element this document has.
 */
export const slugsIn = (body: string): ReadonlyArray<Slug> =>
  deduped(headingsIn(body).map(slugOf))

/**
 * The same counter the renderer runs, over slugs that are already spelled —
 * shared so the browser's plugin and the face cannot come to disagree about
 * what the SECOND `## Notes` in a document is called.
 *
 * `seen` counts how many times a slug has been HANDED OUT under its own name,
 * so the third `notes` is `notes-2`: the first took `notes`, the second took
 * `notes-1`. A generated name that is itself already taken (a document with
 * `## Notes`, `## Notes` and `## Notes 1`) keeps counting rather than
 * colliding.
 */
export const deduped = (slugs: ReadonlyArray<Slug>): ReadonlyArray<Slug> => {
  const seen = new Map<string, number>()
  const given: Array<Slug> = []
  for (const slug of slugs) {
    if (slug === "") continue
    given.push(claim(seen, slug))
  }
  return given
}

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

/**
 * The TEXT of every heading of a body, in document order.
 *
 * Line by line, with two constructs read and everything else left alone (the
 * header says why this package reads lines rather than a tree):
 *
 *   - a FENCE (``` or ~~~) opens a region nothing in it is a heading, and it
 *     closes on a fence of the same character at least as long. That is the
 *     one construct whose contents look like headings by accident — every
 *     shell example with a `# comment` in it — and leaving it out is the
 *     difference between a face that lists a document's sections and one that
 *     lists its code samples.
 *   - an ATX heading is one to six `#` and a space; the trailing run of `#`
 *     markdown allows as a closing fence comes off, exactly as
 *     {@link ./documents.ts}'s `firstLine` takes it off the title.
 *   - a SETEXT heading is a line of ordinary prose with a rule under it, `=`
 *     for the first level and `-` for the second. It needs the line ABOVE to
 *     be text, which is what tells `---` under a paragraph (a heading) from
 *     `---` after a blank line (a thematic break) and from the `---` that
 *     closes frontmatter.
 *
 * The heading's INLINE MARKUP is left as written, which is where the browser's
 * reading and this one part company most often: `## **Install**` is `install`
 * on the page (the parser sees emphasis around a word) and `install` here too,
 * since `*` is not a character a slug is made of — but `## [Install](x.md)`
 * is `install` there and `installxmd` here. Said rather than fixed: stripping
 * markup correctly is having a parser.
 */
export const headingsIn = (body: string): ReadonlyArray<string> => {
  const found: Array<string> = []
  let fence: string | null = null
  let previous: string | null = null
  for (const raw of body.split("\n")) {
    const line = raw.trim()
    if (fence !== null) {
      if (closes(line, fence)) fence = null
      previous = null
      continue
    }
    const opened = opensFence(line)
    if (opened !== null) {
      fence = opened
      previous = null
      continue
    }
    const atx = ATX.exec(line)
    if (atx !== null) {
      found.push(atx[1]!.replace(/\s+#+$/, "").trim())
      previous = null
      continue
    }
    if (previous !== null && SETEXT.test(line)) {
      found.push(previous)
      previous = null
      continue
    }
    previous = line === "" ? null : line
  }
  return found
}

/** One to six hashes, a space, and the words. The space is required by
 *  markdown itself: `#tag` at the start of a line is a tag somebody wrote, not
 *  a heading, and this format has plenty of those. */
const ATX = /^#{1,6}[ \t]+(.*)$/

/** The rule under a setext heading: one character, repeated, and nothing
 *  else. */
const SETEXT = /^(?:=+|-+)$/

/** What a line opens a fence with, or `null` — the run of backticks or tildes,
 *  kept so the closing fence can be held to being at least as long (markdown's
 *  own rule, and what lets a fence hold a shorter fence inside it). */
const opensFence = (line: string): string | null => {
  const fence = /^(`{3,}|~{3,})/.exec(line)
  return fence === null ? null : fence[1]!
}

/** Whether a line closes the fence that is open: the same character, at least
 *  as long, and nothing after it. */
const closes = (line: string, fence: string): boolean =>
  new RegExp(`^${fence[0] === "`" ? "`" : "~"}{${fence.length},}\\s*$`).test(line)
