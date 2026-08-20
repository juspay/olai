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
 * PURE — over a title, and over the ONE fact about the directory a title cannot
 * carry ({@link nameOf}'s `shows`) — so what counts as an address and what an
 * address is called are decided in a unit test rather than in a component. That
 * fact is the server's for both faces now: the shelf takes it off the `pins`
 * member and a row takes it off its page's own reading, which {@link shownIn}
 * at the bottom of this file is the reader for.
 */

import { addressWritten, basenameOf, linkedTitle } from "@olai/format"

import type { Names } from "../names.ts"
import { hrefOf, type Route, routeIn } from "../routes.ts"

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
  const address = addressWritten(text)
  if (/\s/.test(address)) return undefined
  return routeIn(address) ?? undefined
}

/** The name written INTO a title, for the address somebody named — `undefined`
 *  for the bare form, which is what this app writes and what {@link nameOf}
 *  answers for. An empty label (`[](/#herbs)`) is no name: a door with a blank
 *  on it is worse than one the set can name. */
export const labelIn = (title: string): string | undefined => {
  const label = linkedTitle(title)?.label.trim()
  return label === undefined || label === "" ? undefined : label
}

/** What a face drawn for a title says, and what it may BE — see
 *  {@link titleFace}. */
export interface Faced {
  /** The words to draw. */
  readonly name: string
  /**
   * Whether those words are somebody's OWN, which is the only kind a face may
   * make a link of: pressing a written name opens its address, and a bare
   * address is left as it was so a click there opens the editor on the address
   * itself (docs/format.md's Pins).
   *
   * It rides HERE rather than being asked again at the call site because it is
   * the same reading — a label was written, or it was not — and two readings of
   * one title is what this module exists to refuse. What the caller adds is
   * whether it may hold an anchor at all.
   */
  readonly written: boolean
}

/**
 * WHAT A TITLE THAT NAMES A PLACE IS CALLED — the whole rule, in the one place
 * it is spelled.
 *
 * A name somebody WROTE into the title wins, because it is authored rather than
 * derived and nothing can disagree with it later; otherwise the address answers
 * for itself ({@link nameOf}). That precedence is docs/format.md's Pins, and it
 * used to live inside the face until the two callers started learning the set's
 * half from opposite sides of the wire — at which point it was about to be two
 * `??` chains that had to stay in step, which is the shape this module exists
 * to refuse.
 */
export const titleFace = (
  title: string,
  route: Route,
  /** {@link nameOf}'s missing fact — from the server for a shelf row, from
   *  {@link shownIn} for a row of an open page. */
  shows: string | undefined,
): Faced => {
  const written = labelIn(title)
  return { name: written ?? nameOf(route, shows), written: written !== undefined }
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
 * Where nothing can say — an address at a node that was deleted — this answers
 * the ADDRESS, which is at least the truth about where it goes.
 *
 * ## It is PURE over the address, and `shows` is why
 *
 * Exactly ONE arm of this switch is a question about the directory rather than
 * about the address: a bare `#id` is called whatever that node is called right
 * now, and everything else names itself — a file by its own filename, a day by
 * its date, the pages that spell a word by the word. So the node's title is
 * handed IN, and who asked it is the caller's business, which is what let the
 * two callers end up on opposite sides of the wire:
 *
 *   - the pinned SHELF takes it off the server's answer (`../pins/pins.ts`,
 *     the `pins` cell), because a shelf is a reading of the whole vault and
 *     the browser no longer holds one (`docs/brainstorming/vault-in-browser.md`);
 *   - an ORDINARY OUTLINE ROW whose title is an address takes it off the
 *     reading of the page it is drawn in ({@link shownIn}), which the same
 *     design moved with the rest of a page's readings.
 *
 * One switch, one set of words, two ways of learning the one fact it cannot
 * work out for itself.
 */
export const nameOf = (
  route: Route,
  /** What the node this address names is CALLED, when it names one and
   *  somebody could say — `undefined` for every other address, and for a node
   *  the set does not declare. */
  shows: string | undefined,
): string => {
  switch (route.kind) {
    case "at": {
      const address = route.address
      // `null` is the front page — "whichever outline was found first" — and it
      // has no filename to draw, so it takes the word a reader would use for
      // it.
      if (address === null) return "Home"
      // A NODE is the one address that does not name itself: what it is called
      // is a fact about the set, so what is drawn is what somebody answered —
      // and its own address when nothing did, which is the honest dead row
      // (docs/format.md's Pins).
      if (address.kind === "node") return shows ?? hrefOf(route)
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

/**
 * WHAT THE SET SAYS A NODE ADDRESS NAMES — {@link nameOf}'s missing fact, read
 * off the names the PAGE was sent with.
 *
 * Its one caller is an ordinary outline row whose title turns out to be an
 * address (`../NodeTitle.tsx`); the other face that draws addresses, the pinned
 * shelf, takes the same fact off its own member (`../pins/pins.ts`). Both are
 * the server's answer now — the same `nodeNamed`, run where the set is — which
 * is what keeps the shelf and the file's own page from having two answers about
 * one title, and it is what PR 10 of `docs/brainstorming/vault-in-browser.md`
 * took: this was the last address resolution a browser did over a copy of the
 * vault.
 *
 * THE TABLE IS THE PAGE'S, which is the bound worth naming: it holds the ids
 * THIS page points at, so a title that addresses a node no row here mentions is
 * not in it — and cannot be, since the reading is built by walking exactly the
 * records this page draws. A row's own title is one of those.
 *
 * `undefined` for every address that is not a node's, for a node the set does
 * not declare, and for the frame before the reading arrives — three states with
 * one answer, because a name nobody can say is a name nobody can say.
 */
export const shownIn = (
  names: Names,
  route: Route,
): string | undefined => {
  const address = route.kind === "at" ? route.address : null
  if (address === null || address.kind !== "node") return undefined
  return names(address.id)?.title
}
