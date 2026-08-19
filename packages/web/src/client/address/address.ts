/**
 * AN ADDRESS WRITTEN IN A TITLE — what it is, and what it is called.
 *
 * A node's title is verbatim text that this app renders at view time: markdown
 * and `#tags` are decided when it is drawn (`../markdown/title.ts`), never on
 * disk. This module adds one more reading to that list — a title that names a
 * PLACE IN THIS APP — and it is the reading the pinned shelf is built out of
 * (`../pins/`, docs/format.md's Pins).
 *
 * IT LIVES HERE RATHER THAN IN `../pins/` because the shelf turned out to be
 * one consumer of it and not the axis. The axis is *what an address in a title
 * means*, and the second consumer is the outline itself: a row of `Pins.olai`
 * opened as the ordinary outline it is drew `/orchestrator/instructions.md`
 * — the plumbing, in a place the design invites people to browse (maintainer,
 * 2026-08-18, on a screenshot). One resolver, read by whoever is drawing, is
 * what keeps the shelf and the tree from having two answers about one title.
 *
 * PURE, over the indexes it is handed, so what counts as an address and what
 * an address is called are decided in a unit test rather than in a component.
 */

import { basenameOf, type Derived, nodeNamed } from "@olai/format"

import { hrefOf, type Route, routeIn } from "../routes.ts"

/**
 * A title written as one markdown link, cut into its two halves.
 *
 * Deliberately narrow: exactly one link and nothing around it. A title with
 * prose either side of a link is a sentence somebody wrote, not a place with a
 * name on it — and reading it as one would make a door out of a note. What
 * this must NOT become is a markdown parser: this module decides whether a
 * title names a place, and `../markdown/` decides what a title looks like.
 */
const LINKED = /^\[([^\]]*)\]\(([^()\s]+)\)$/

/**
 * The address a title names, or `undefined`.
 *
 * IT IS THE SAME QUESTION A LINK IN RENDERED MARKDOWN IS READ BY
 * (`../routes.ts`'s {@link routeIn}), and asking it there rather than here is
 * the whole of this function's rule: `routeOf` answers the DEFAULT OUTLINE for
 * anything it does not recognise, which is the right kindness for somebody who
 * typed into the address bar and exactly wrong here — every title beginning
 * with a slash would become a door to the front page. The parser says for
 * itself whether it recognised a page, `/etc/passwd` is a title, and a pin and
 * a written link cannot come to two answers about one address.
 *
 * AND IT IS TOTAL over any string, which is a promise it can only make because
 * the parser makes it first. A title spelled with an escape nothing can read —
 * `/%`, `/%ZZ.md` — used to throw a `URIError` out of the parse, and a throw
 * here is not a skipped row: it happens during render, so it takes the tree
 * that was rendering with it, on a file the format invites a hand and an agent
 * to edit (found in review, 2026-08-18). Such a title reads as what it is — an
 * address nothing could have written, so not an address — and lands with prose
 * and `/etc/passwd`.
 *
 * That is a different answer from a WELL-FORMED address whose target is gone:
 * `/#deleted-id` is a place this app can read, so it is drawn, labelled with
 * its own address ({@link nameOf}) — the honest dead row. What is refused here
 * is text that is not an address at all.
 */
export const addressIn = (title: string): Route | undefined => {
  const text = title.trim()
  // Cheap first: nearly every title in a directory is neither, and this runs
  // once per title per draw now that the tree reads it too.
  if (!text.startsWith("/") && !text.startsWith("[")) return undefined
  const linked = LINKED.exec(text)
  const address = linked === null ? text : (linked[2] ?? "")
  if (/\s/.test(address)) return undefined
  return routeIn(address) ?? undefined
}

/** The name written INTO a title, for the address somebody named — `undefined`
 *  for the bare form, which is what this app writes and what {@link nameOf}
 *  answers for. An empty label (`[](/#herbs)`) is no name: a door with a blank
 *  on it is worse than one the set can name. */
export const labelIn = (title: string): string | undefined => {
  const label = LINKED.exec(title.trim())?.[1]?.trim()
  return label === undefined || label === "" ? undefined : label
}

/**
 * WHAT THE PAGE AN ADDRESS OPENS IS CALLED.
 *
 * A reading of the SET rather than a property of the address, and that is the
 * point: an address stores where it goes and nothing else, so `/#herbs` is
 * called whatever that node is called RIGHT NOW. Rename the node anywhere — in
 * the tree, from an agent, in vim — and every face drawn from that address
 * says the new name on the frame the store publishes, because there was never
 * a second copy of it to go stale.
 *
 * ## Not `../pane/label.ts`, and the placement was argued rather than assumed
 *
 * That module names a PANE and this one names a PLACE, and they are two total
 * switches over one `Route` — which is the shape to justify, because "name a
 * route" is one kind of operation and a second table for it is how concepts
 * multiply. Three things decide it:
 *
 *   - **they answer differently, not just more.** A pane label is asked of the
 *     route ALONE, deliberately, so a tab strip has a label before the set has
 *     been read and keeps it when a file will not parse — which is why a zoomed
 *     node there is its id. A door with an id written on it is a door nobody
 *     can read, so this one is asked of the set. And a pane draws a file's
 *     whole PATH (two panes on `a/x.olai` and `b/x.olai` have to be tellable
 *     apart) where a shelf row draws its NAME, in a column too narrow for
 *     either path.
 *   - **so unifying them needs a mode flag**, and a mode flag is the braid
 *     rather than the fix: one function answering "short or long, with the set
 *     or without" is two callers' layouts pushed into one signature.
 *   - **and the axis they share is held by the COMPILER already.** What is
 *     volatile about a route is the union itself, and both switches are total
 *     over it, so a seventh kind of page is two compile errors rather than one
 *     table quietly falling behind the other.
 *
 * Where the set has nothing to say — an address at a node that was deleted —
 * this answers the ADDRESS, which is at least the truth about where it goes.
 */
export const nameOf = (route: Route, derived: Derived | undefined): string => {
  switch (route.kind) {
    case "at": {
      const address = route.address
      // `null` is the front page — "whichever outline was found first" — and it
      // has no filename to draw, so it takes the word a reader would use for
      // it.
      if (address === null) return "Home"
      if (address.kind === "node") {
        // The node at the end of whatever chain the id addresses — the set's
        // one answer to "what does this id mean" (`@olai/format`'s
        // `nodeNamed`), the same one a `see` link's text comes from.
        const shows = derived === undefined ? undefined : nodeNamed(derived, address.id)
        return shows?.node.title ?? hrefOf(route)
      }
      // A FILE is its own name, through the format's own spelling of "the last
      // segment of a path" rather than a second slice — and a heading is
      // named by the file it is in, because a pin to a section of a document is
      // a pin to that document as far as a row four columns wide is concerned.
      return basenameOf(address.path)
    }
    case "day":
      return route.date
    case "today":
      return "Today"
    case "agenda":
      return "Agenda"
    case "trash":
      return "Trash"
  }
}
