/**
 * What a commit nobody wrote a message for says.
 *
 * PURE — what is waiting in, one string out — which is what makes it a table of
 * words beside a test rather than something you have to run git to look at.
 *
 * Two rules, and both are about a log a person reads years later:
 *
 *   - **every message starts with `olai`.** In a project repository that prefix
 *     is what separates tool writes from yours: `git log --grep '^olai'` is the
 *     audit view, and `--invert-grep` gives back your real history.
 *   - **the subject names the biggest thing that happened**, by the fixed order
 *     `./changes.ts`'s `Sort` declares, with the rest in the body. A subject
 *     that said "12 edits" and nothing else would make the log a list of
 *     numbers.
 *
 * The words are the reference implementation's — `capture:` / `done:` /
 * `doing:` / `move:` / `archive:` / `create:` / `see:` — because a log somebody
 * already knows how to read is worth more than a better one they do not. One
 * of them has been corrected: a `date` used to print as `move:`, which beside
 * real reparenting ops read as a structural change that never happened.
 *
 * **It lives HERE, and it used to live in `@olai/ops` beside the commit path.**
 * The comment there said the package below had no business knowing how olai
 * spells a commit, and that was right while the composer had exactly one
 * caller. It has two now, and the second is a BROWSER: the panel's checkboxes
 * make the message a function of a SELECTION, so unticking a file has to
 * recompose the message on screen — and a round trip to the server for every
 * checkbox, or a second composer written in the client, are both worse than
 * moving the pure function to the floor both faces stand on. What is still the
 * ops layer's is how a commit is MADE: the trailer, the prefixing, the
 * subprocess.
 */

import { biggestOf, type NodeChange, type Sort } from "./changes.ts"
import type { Other } from "./committing.ts"

/** Every message olai writes starts with this. In a project repository the
 *  prefix is what separates tool writes from a person's: `git log --grep
 *  '^olai'` is the audit view, and `--invert-grep` gives back real history. */
export const MESSAGE_PREFIX = "olai"

/** What each kind of change is called in a commit line. The reference
 *  implementation's vocabulary; the panel keeps its own, in its own words
 *  (`packages/web/src/client/commit/said.ts`), because one of them is a log
 *  and the other is a sentence on screen. */
const VERB: Readonly<Record<Sort, string>> = {
  created: "capture",
  archived: "archive",
  gone: "gone",
  done: "done",
  undone: "undone",
  doing: "doing",
  "not-doing": "not-doing",
  moved: "move",
  scheduled: "date",
  unscheduled: "date",
  noted: "note",
  renamed: "rename",
  linked: "see",
  edited: "edit",
}

/** How many detail lines a body carries before it stops listing. A commit that
 *  swept up two hundred nodes has a subject that says so; two hundred lines
 *  under it would be the diff this feature exists not to show. Applied to each
 *  list separately, because a hundred node changes must not be able to push
 *  every filename out of the body. */
const BODY_LINES = 20

/**
 * The message for what is waiting when nobody supplied one.
 *
 * TWO LISTS, because there are two kinds of row: node-level changes to the
 * outlines olai serves, and the other files in the repository that moved.
 * Whichever there are, the subject says so and the body names them — a commit
 * that recorded a hand-edited `README.md` and nothing else must not read as
 * `olai: nothing`.
 */
export const composed = (
  changes: ReadonlyArray<NodeChange>,
  others: ReadonlyArray<Other> = [],
): string => {
  const biggest = biggestOf(changes)
  if (biggest === null && others.length === 0) return `${MESSAGE_PREFIX}: nothing`

  const lines = changes
    .slice(0, BODY_LINES)
    .map((change) => `${VERB[change.sort]}: ${change.title}`)
  const rest = changes.length - lines.length
  if (rest > 0) lines.push(`… and ${rest} more`)

  if (others.length > 0) {
    // A blank line between the two lists when there are both, so the paths do
    // not read as another node change.
    if (lines.length > 0) lines.push("")
    for (const other of others.slice(0, BODY_LINES)) {
      lines.push(`${other.how}: ${other.path}`)
    }
    const left = others.length - Math.min(others.length, BODY_LINES)
    if (left > 0) lines.push(`… and ${left} more`)
  }

  return `${subjectOf(changes, others, biggest)}\n\n${lines.join("\n")}\n`
}

/**
 * The subject line, in the three shapes what is waiting can take.
 *
 * The TITLE, not the id. The design's example named an id and read well because
 * the roadmap's ids are slugs somebody chose (`outlines-collection done`) — but
 * `add_node` MINTS one when nobody supplies it, so the moment an agent captures
 * a node the same subject reads `1vax4izq created`. A log line nobody can read
 * is the failure this whole convention exists to avoid, and the title is the one
 * field that is always meant for a person. (A mirror has no title of its own,
 * and `NodeChange.title` already answers with its id there, which is the right
 * fallback and the only one needed.)
 */
const subjectOf = (
  changes: ReadonlyArray<NodeChange>,
  others: ReadonlyArray<Other>,
  biggest: NodeChange | null,
): string => {
  const files = `${others.length} ${others.length === 1 ? "file" : "files"}`
  if (biggest === null) {
    // Files only, which is the whole of what this feature added: the subject
    // names the first one, because a subject that said "3 files" would be the
    // list of numbers the convention exists to prevent.
    const first = others[0]?.path ?? ""
    const more = others.length > 1 ? ` and ${others.length - 1} more` : ""
    return `${MESSAGE_PREFIX}: ${files} — ${first}${more}`
  }
  const outlines = new Set(changes.map((change) => change.file))
  const count = `${changes.length} ${changes.length === 1 ? "edit" : "edits"}`
  const where = outlines.size === 1 ? ` to ${stemOf(biggest.file)}` : ""
  const also = others.length === 0 ? "" : ` · ${others.length} other ${
    others.length === 1 ? "file" : "files"
  }`
  return `${MESSAGE_PREFIX}: ${count}${where} — ${biggest.title} ${biggest.sort}${also}`
}

/** An outline's name without its extension — `roadmap`, not `roadmap.jsonl`.
 *  A subject is read at a glance and the extension is the same on every one of
 *  them. */
const stemOf = (file: string): string => {
  const name = file.slice(file.lastIndexOf("/") + 1)
  return name.endsWith(".jsonl") ? name.slice(0, -".jsonl".length) : name
}
