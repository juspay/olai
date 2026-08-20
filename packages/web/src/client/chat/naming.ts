/**
 * WHAT AN `@` OFFERS: the directory's files, and the directory's nodes, in one
 * list of eight.
 *
 * Two halves with a matcher each ({@link ../file/matching.ts},
 * {@link ./nodes.ts}) and one rule here about how they share a popup — which
 * is the whole of what this file is, and the reason it is not two lists on
 * screen.
 *
 * ## Two blocks, never interleaved
 *
 * A file's rank is three buckets — the name first, the path second, a substring
 * last — and `../file/matching.ts` says out loud that this "is not a score".
 * A node's rank IS a score, the format's own (title 1000, id 750, tag 500, note 250,
 * with a bonus for starting the field and a penalty for being finished). To mix
 * them into one order somebody has to say what bucket two is worth in points,
 * and that number would be the only ranking rule in this codebase with nothing
 * behind it — invented here, re-ordering both halves on every keystroke, and
 * unanswerable when a reader asks why their file sank.
 *
 * So the two are two answers to two questions, drawn one after the other under
 * a word each, and the person picks. An ambiguous prefix is not a conflict to
 * resolve: `@cab` offers `notes/cabinets.md` AND `order the new cabinets`,
 * which is what the query honestly means.
 *
 * ## FILES FIRST, and each half keeps four
 *
 * Files first because `@cab` followed by Enter has written a path since the `@`
 * list shipped (#213), and a completion that quietly changes what Enter does is
 * a completion that has to be re-learned. It costs the node half almost
 * nothing: a vault holds tens of files and thousands of nodes, so the file
 * block is usually short and gives its slack away.
 *
 * Which is the other half of the rule — a RESERVE rather than a queue. Each
 * kind is guaranteed {@link RESERVE} rows and may take the other's unused ones,
 * so nine matching filenames can never push every node off the list and a vault
 * full of matching rows can never bury the file somebody types every day.
 *
 * Both halves are asked for the WHOLE cap and trimmed here, which is not the
 * same as asking each for its share: `../file/matching.ts` stops walking the
 * directory once its best bucket is full, so a file half asked for three rows
 * could not grow back to eight when the node half came back empty. Ask for
 * eight, keep what fits.
 *
 * ## The two halves no longer arrive together, and the reserve is why that is fine
 *
 * The files are matched here, out of the key sets this tab holds; the nodes are
 * a debounce and a round trip away since `search-server-side`
 * (docs/brainstorming/vault-in-browser.md). So the node block can appear a beat
 * after the file block, and the file block can be standing alone when a reader
 * starts walking it. That is exactly the case {@link RESERVE} was written for
 * from the other direction — each kind keeps its rows whatever the other found
 * — and it is why the list does not reshuffle under a cursor when the answer
 * lands: what a late node half can take is the slack the file half was never
 * using. What it CANNOT do is move a file row somebody is already on.
 */

import type { NodeHit } from "@olai/surface"

import { dirOf, folded, matchFiles, nameOf } from "../file/matching.ts"
import { nodeMatches, type NodeMatch } from "./nodes.ts"

/** How many rows the list offers — the eight every shortlist in this app shows
 *  (`../complete/tags.ts`, `../file/matching.ts`). */
const LIMIT = 8

/** ...and how many of them belong to a kind that has rows, whatever the other
 *  kind found. Half the list each: any other split would be this file having an
 *  opinion about which kind somebody meant, which is the opinion it exists not
 *  to have. */
const RESERVE = 4

/** One row of the list, before the composer gives it something to do. `value`
 *  is what taking it WRITES — a path, or a node's id — and it is what a
 *  scenario names the row by. */
export interface Offer {
  /** WHICH HALF answered, for the composer: a node is armed when it is taken
   *  and a file is not ({@link ./Composer.tsx}). */
  readonly kind: "file" | "node"
  /** ...and the word over the first row of its block, which is this file's to
   *  say because this file is what decides where a block starts. A ternary at
   *  the drawing end would put the label a reader sees one module away from the
   *  arithmetic that groups the rows under it. */
  readonly section: string
  readonly value: string
  /** What a person READS to choose it: a file's own name, a node's title. */
  readonly label: string
  /** Where it sits, and — for a node — the id the row writes, first, because a
   *  truncated line loses its end and the id is the only always-unique half. */
  readonly hint: string
}

/**
 * The whole list, in the order it is drawn.
 *
 * `files` is the served directory's paths, already folded once per version of
 * it by {@link folded}; `hits` is what the server said the same query names,
 * capped there at the same eight (`../search/nodes.ts`). There is no clock
 * argument any more: the relative words in a node query (`@date:today`) are
 * counted on the side that matches them, which is the server — the same clock
 * the ⌘K palette and an agent's `search_nodes` have always counted from.
 */
export const offers = (
  files: ReadonlyArray<string>,
  hits: ReadonlyArray<NodeHit>,
  query: string,
): ReadonlyArray<Offer> => {
  const paths = matchFiles(folded(files), query, LIMIT).map((file) => file.path)
  // An answer that has not arrived yet is no rows rather than no list: the file
  // half answers alone and the nodes join it when they land.
  const nodes = nodeMatches(hits)
  const forFiles = Math.min(paths.length, Math.max(RESERVE, LIMIT - nodes.length))
  const forNodes = Math.min(nodes.length, LIMIT - forFiles)
  return [
    ...paths.slice(0, forFiles).map((path): Offer => ({
      kind: "file",
      section: "files",
      value: path,
      // The NAME is what a person reads for, and where it sits is the hint
      // beside it — a vault of daily notes is a column of identical prefixes
      // otherwise. What is written is the whole path either way.
      label: nameOf(path),
      hint: dirOf(path),
    })),
    ...nodes.slice(0, forNodes).map((node): Offer => ({
      kind: "node",
      section: "nodes",
      value: node.id,
      label: node.label,
      hint: hintFor(node),
    })),
  ]
}

/**
 * What a node row says beside its title: the id it writes, why it is here when
 * that is not visible, and where it sits.
 *
 * THE `·` IS THE PLACE'S ALONE. `../search/place.ts` joins ancestor crumbs with
 * it — the same line four other search surfaces draw — so a hint that also used
 * it between its own parts would be one glyph doing two jobs on one line, with
 * a reader left to work out which dots are boundaries and which are ancestry.
 * The parts are separated the way a sentence separates them: the aside in
 * brackets, the place after a dash.
 *
 * THE ID FIRST, because it is what the row writes into the message and it is
 * what tells two nodes of one title in one place apart when even the place
 * cannot. (What it does not survive is a long TITLE: the row truncates as one
 * line, so a title that fills it takes the hint with it. That is the row shape
 * this list has for every kind of row, and buying a second one for this half
 * would cost the thing the list is — one shortlist, one shape, one cursor.)
 */
const hintFor = (node: NodeMatch): string => {
  const why = node.note ? " (in the note)" : ""
  return `@${node.id}${why} — ${node.place}`
}
