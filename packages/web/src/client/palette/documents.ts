/**
 * THE DIRECTORY'S DOCUMENTS, as palette rows — the half of the ⌘K box that
 * had nothing to say about a `.md` at all.
 *
 * The palette streamed node hits and captured a line to the inbox, and a
 * document was reachable from it by no row of any kind: not by name, not by
 * path, not by the address the router has served all along
 * (`../routes.ts`'s `/doc/`). A reader who knew a file existed had to leave
 * the modal, find the sidebar, open the folder it lives in and click it —
 * which is the `md-second-class` table's ⌘K row, and the one line of it that
 * was unargued rather than decided.
 *
 * ## Keyed on the NAME AND THE PATH, and on nothing else
 *
 * This is the doctrine the rest of the table keeps, not an exception carved
 * out of it: *a document is prose, and this grammar selects nodes*
 * (`../routes.ts`, `../markdown/tags.ts`, the website). Nothing here reads a
 * BODY — the palette's node grammar is untouched and still answers about
 * nodes, and no `.md` text is matched, indexed or fetched to draw a row.
 * Searching what is INSIDE a document is a separate, brainstorm-gated item
 * (`search-document-bodies`), and this is deliberately not a down payment on
 * it: a row here says "this file is called that", which is exactly what the
 * sidebar has always said and what an address can be written from.
 *
 * So the matcher is the one the served paths already have
 * (`../file/matching.ts`) — name first, path second, substring last, no fuzzy
 * score — which is the same rule the chat composer's `@` completes a path
 * with. Two doors, one answer, for `../search/nodes.ts`'s reason one kind of
 * hit over.
 *
 * ## Every file a `/doc/` address opens, which is the registry's answer
 *
 * A `.md` and a `.html`, because that is what "the pages made of a body" IS
 * (`@olai/format`'s `bodyKind`) — the same question the sidebar's tree asks to
 * pick a row's glyph and the same one `../file/kinds.ts` asks to pick its
 * route. Naming the `.md` half by hand here would be a second answer to it,
 * free to disagree the day a fourth kind is registered, and it would have made
 * the palette the one door in this client where a saved page in the vault is
 * not a thing you can open.
 *
 * ## What is NOT here: a way to MAKE one
 *
 * The sidebar has `+ New document` beside `+ New outline` (`../file/making.ts`)
 * and this list has neither. That is parity rather than an omission: the
 * palette has never carried a create row for an outline either, so a
 * `New document` row would be a NEW idea in this surface — a second door to
 * `create_document` with a path box the palette has no shape for — offered to
 * documents and not to outlines, which is the imbalance the parity work exists
 * to remove rather than to invert. If the palette ever grows a create row, it
 * grows both on the same day.
 */

import { bodyKind, type BodyKind } from "@olai/format"

import { dirOf, folded, type Folded, matchFiles, nameOf } from "../file/matching.ts"
import { routeTo } from "../file/kinds.ts"
import type { PaletteItem } from "./items.ts"

/** How many document rows a query may draw — the eight every shortlist in this
 *  app shows (`../search/nodes.ts`, `../chat/naming.ts`), for the same reason:
 *  this is a block inside a list a reader is standing over, not a report. */
const LIMIT = 8

/**
 * The bodied paths of one directory, folded for matching — kept per version of
 * the served list rather than rebuilt per keystroke.
 *
 * `../file/matching.ts`'s `folded` is already a `WeakMap` over that same list,
 * so what this adds is the FILTER: which of the served paths are pages to open
 * at all. Doing it inside the match instead would be a walk of the whole vault
 * per character typed, and doing it after the match would be worse than slow —
 * `matchFiles` stops once its best bucket has filled the cap, so a list
 * narrowed afterwards could answer with three rows while five more matched.
 */
const bodied = new WeakMap<ReadonlyArray<string>, ReadonlyArray<Folded>>()

const documentsIn = (paths: ReadonlyArray<string>): ReadonlyArray<Folded> => {
  const before = bodied.get(paths)
  if (before !== undefined) return before
  const now = folded(paths).filter((file) => bodyKind(file.path) !== null)
  bodied.set(paths, now)
  return now
}

/**
 * One document as a row: its own name, where it sits, and the page it opens.
 *
 * The FACE is the sidebar's, because it is the same object in the same
 * directory and a reader should not have to learn it twice — the kind's glyph
 * (`../file/icons.tsx`) in front of the name, which is what tells an outline
 * from a document from a saved page in the tree.
 *
 * The NAME is the label and the FOLDER is the place line, which is
 * `../chat/naming.ts`'s division for the same reason: a directory of daily
 * notes is a column of identical prefixes when the whole path is the label,
 * and two files of one name are told apart by the line under it. A file at the
 * root has no folder, so it draws no place line rather than an empty one.
 *
 * WHERE IT GOES is `../file/kinds.ts`'s derivation and not a literal spelled
 * here: a row of this list opens the same page the sidebar's row opens,
 * because both ask the registry the same question.
 */
const documentItem = (path: string, of: BodyKind): PaletteItem => {
  const folder = dirOf(path)
  return {
    id: `doc-${path}`,
    label: nameOf(path),
    of,
    place: folder === "" ? undefined : folder,
    action: { kind: "route", route: routeTo(of, path) },
    // Never filtered locally a second time: `documentItems` has already
    // decided these match, exactly as the server decides it for a node hit
    // (`./items.ts`'s `nodeItem`).
    search: "",
  }
}

/**
 * The document rows for `query`, best first — and NONE at all for an empty
 * box.
 *
 * That last part is the one rule this list has of its own, and it is about
 * what the palette IS. A bare `@` in a message completes to the whole
 * directory on purpose, because that popup is a file picker; an untouched ⌘K
 * is a list of commands, and pouring every `.md` in the vault into it would
 * bury the rows a reader opened it for behind a directory listing they did not
 * ask for. The first character typed is what asks.
 */
export const documentItems = (
  paths: ReadonlyArray<string>,
  query: string,
  limit: number = LIMIT,
): ReadonlyArray<PaletteItem> => {
  const wanted = query.trim()
  if (wanted === "") return []
  return matchFiles(documentsIn(paths), wanted, limit).flatMap((path) => {
    // `documentsIn` kept only the paths this can answer for, so the guard
    // never fires — it is what makes that a fact in the types rather than a
    // claim in a comment, and a row with no kind would have no glyph and
    // nowhere to go.
    const of = bodyKind(path)
    return of === null ? [] : [documentItem(path, of)]
  })
}
