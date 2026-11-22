/**
 * A TITLE WRITTEN AS ONE LINK around an address, cut into its two halves —
 * `undefined` for every other title.
 *
 * A SHORTCUT, under the rule every shortcut here lives by: the browser reads a
 * title this way at first paint, before the parser has loaded, and
 * `./linked.test.ts` holds it equal to the parse over every title in the
 * fixture outlines — a reading with exactly one link, no wikilink, and nothing
 * drawn but that link's own words.
 *
 * Here because several readers cut it, on opposite sides of a wire, and a
 * regex spelled twice is a rule that eventually disagrees with itself. The
 * SHELF's reading takes the target of it (`@olai/format`'s `shelf.ts`,
 * resolving what a pin's node is called), and the BROWSER takes both halves —
 * the target to read as a page, and the label as the name somebody chose
 * (`olai-plugin-navigation`'s `address/address.ts`, website/docs/format.md's
 * Pins). Neither of them is the other's caller, and both are about one
 * sentence of that convention. The WRITER stays where the escaping is
 * (`@olai/format`'s `pinTitle`).
 *
 * DELIBERATELY NARROW: exactly one link and nothing around it. A title with
 * prose either side of a link is a sentence somebody wrote, not a place with a
 * name on it — and reading it as one would make a door out of a note.
 *
 * The halves come back AS WRITTEN. What an empty label means, and what the
 * target names, are the readers' own questions — this one is only where the
 * brackets are.
 */

/** The label and the address of a title that is one link. */
export const linkedTitle = (
  title: string,
): { readonly label: string; readonly at: string } | undefined => {
  const linked = LINKED.exec(title.trim())
  return linked === null ? undefined : { label: linked[1] ?? "", at: linked[2] ?? "" }
}

/** One markdown link and nothing else: `[label](target)`, with no whitespace or
 *  parenthesis in the target — the shape {@link linkedTitle} reads. */
const LINKED = /^\[([^\]]*)\]\(([^()\s]+)\)$/
