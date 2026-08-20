/**
 * WHICH of the directory's nodes an `@` query means — the other half of the
 * list `../file/matching.ts` starts.
 *
 * ## No second matcher, for `../file/matching.ts`'s reason with a better answer
 *
 * The file half had to invent a matcher, because nothing else in olai matches
 * a PATH. A node is the opposite case: the matcher exists, it is the one every
 * other door already asks (`@olai/format`'s `parseFilter` / `matching`), and a
 * prefix rule written here would mean `@cab` in this box and `cab` in the
 * filter bar two lines up selecting different rows of the same directory. That
 * is the drift docs/search.md was written to forbid, and it is worse in a
 * completion than anywhere else: the list is where somebody LEARNS what a query
 * means, so a list with private rules teaches the wrong thing about every other
 * box in the app.
 *
 * So the query is read by the grammar and matched by the matcher, and the order
 * is the order (`ranked`, which came down into the format for this door — a
 * completion cannot make a round trip per keystroke, and a second opinion about
 * whether a finished node outranks an open one is exactly the kind of thing
 * nobody notices until two lists disagree in front of them). The other doors
 * ask that same rule through the wire; this one imports it, and that is the
 * whole of the difference between them.
 *
 * What that buys, free and unasked for: `@is:blocked` names something waiting,
 * `@#home` names by tag, `@date:today` names something scheduled — and
 * `@is:trashed` reaches what was put away, which is the only way to reach it
 * (below). What it does NOT buy is a survey: an operator with no word in it
 * scores every match the same, so all that orders the eight is the rule that
 * puts finished work last, and then the directory's own order. That is honest
 * rather than clever — `@` NAMES one node, the ⌘K palette SEARCHES — and it is
 * the matcher's own answer rather than a cap this file invented.
 *
 * ## ONE TOKEN, because a completion may not swallow the sentence
 *
 * The `@` query ends at whitespace (`./completion.ts`), and that fence does not
 * move for the grammar's sake. A query with spaces in it would be a completion
 * eating the rest of somebody's message on the chance that the next word was
 * meant for it — the exact failure that file's "what ends a trigger" section
 * exists to prevent. So what fits in one token works (`is:blocked`, `#home`,
 * `prop:pr`, a word) and what needs a space does not (`"kitchen remodel"`,
 * `a OR b`). The box for those is the one with no sentence around it.
 *
 * An EMPTY query offers no node at all, and that is the grammar's answer rather
 * than a floor invented here: nothing typed parses to the `nothing` filter,
 * which selects nothing. It is also the right answer — a bare `@` shows the
 * directory (tens of files, all of them nameable), where the first eight of a
 * vault's thousands of rows would be an answer to no question.
 *
 * A REFUSED query — `@is:everything`, `@"open` — draws nothing, and this is
 * the one place in olai a refusal is not shown. Every other door draws the
 * grammar's sentence beside the empty answer, because there the text IS a
 * query. Here it is a word in the middle of a message, and most of the words
 * that fail to parse were never queries at all: `@example.com:8080` in a note
 * to an agent would otherwise pop up a grammar lesson. The rule this box
 * already has covers it — an `@` that matches nothing draws nothing and types
 * straight through.
 *
 * ## What was put away is not offered, and `@is:trashed` is how you ask
 *
 * Zero lines here, which is the point: {@link matching} reads the query's own
 * `speaksOfTrash` before it walks, so #226's ruling ("what is put away is
 * drawn on the Trash and nowhere else", docs/search.md's one-page rule) arrives
 * inherited. A door that respelled it is a door that can drift from it.
 *
 * The FILE half of the same list goes the other way — `_olai/Trash.olai` is in it —
 * and the two are right for their own reasons rather than by oversight: a path
 * names bytes an agent will read, where a node names a row of a reading, and
 * "what did we put away last month" is answered by naming the file or by
 * asking for it in the grammar. The third door on this question is the row
 * editor's `#tag` list (`../complete/tags.ts`), which counts only the live set.
 * All three say so in their own headers, one `grep` apart.
 */

import {
  ancestorTitles,
  type Derived,
  matching,
  parseFilter,
  ranked,
  type SearchField,
} from "@olai/format"

import { nodePlace } from "../search/place.ts"

/** One node the query means, ready to draw: what taking it WRITES, what a
 *  person READS to choose it, and where it sits. Flattened out of the match
 *  here rather than in the composer, so the rule for what a row says is
 *  testable without a browser. */
export interface NodeMatch {
  /** The id — the handle every olai tool takes, and what taking the row writes
   *  into the message. */
  readonly id: string
  /** The node's own title, or its id for a row with nothing written in it: a
   *  label has to say something, and the id is the only thing such a node has. */
  readonly label: string
  /** Where it sits — the ancestors nearest first, or the file for a node at the
   *  top of one. `../search/place.ts`'s answer, which is what the ⌘K palette,
   *  the header box, the `((` widget and the edge panel all draw. */
  readonly place: string
  /**
   * WHETHER THE ROW OWES AN EXPLANATION: the words were found in the node's
   * note and nowhere better.
   *
   * A row says why it is here only when the reason is not already ON it. Three
   * of the four fields a word is looked for in are visible in the row as drawn
   * — the title is the label, the id is in the hint, and a tag is written
   * inside the title — so naming them would be pointing at what a reader can
   * see. A note is the fourth, and it is the one that produces the row nobody
   * can account for: `@hinges` answering `order the new cabinets` reads as a
   * bug until something says the word is in the note underneath.
   *
   * It is the query's own answer (`Match.field`, the highest-weighted field
   * that carried a word), not a second reading of the record.
   */
  readonly note: boolean
}

/**
 * The nodes `query` names, best first, at most `limit` of them.
 *
 * `now` is what the grammar's relative words count from (`date:today`), and it
 * is the TAB's own day (`../clock.ts`) — the same clock the filter over the
 * page parses with, since both are read by whoever is sitting here.
 */
export const matchNodes = (
  derived: Derived,
  query: string,
  now: string,
  limit: number,
): ReadonlyArray<NodeMatch> =>
  ranked(derived, matching(derived, parseFilter(query, now)))
    .slice(0, limit)
    .map(({ at, match }) => ({
      id: at.node.id,
      label: at.node.title.trim() === "" ? at.node.id : at.node.title,
      // Situated for the ROWS THAT ARE DRAWN and not for the ones that matched:
      // an ancestor walk per hit over a common word is a walk per node in the
      // vault, and the shortlist above has already thrown all but eight away.
      // The ops layer answers a hit the same way round, for the same reason.
      place: nodePlace({ file: at.file, path: ancestorTitles(derived, at.node.id) }),
      note: match.field !== null && !SHOWN_ON_THE_ROW.has(match.field),
    }))

/**
 * The fields a row shows for itself, as a set the compiler keeps whole.
 *
 * Written as what IS visible rather than as `field === "desc"`, so the rule and
 * the code say the same thing: a row owes an explanation when the reason is not
 * already on it. Spelled the other way round, a FIFTH search field would
 * silently become an unexplained row that compiles clean — and `Match.field`'s
 * own doc calls its list "closed" while `Match.props` exists precisely because
 * it has been under pressure. Typed off `SearchField` so a field this list has
 * never heard of is a type error here rather than a quiet default.
 *
 * The three: the title IS the label, the id is written in the hint, and a tag
 * is written inside the title — pointed at rather than named.
 */
const SHOWN_ON_THE_ROW: ReadonlySet<SearchField> = new Set(["title", "id", "tag"])
