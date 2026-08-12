/**
 * What a commit nobody wrote a message for says.
 *
 * PURE — changes in, one string out — which is what makes it a table of words
 * beside a test rather than something you have to run git to look at.
 *
 * Two rules, and both are about a log a person reads years later:
 *
 *   - **every message starts with `olai`.** In a project repository that prefix
 *     is what separates tool writes from yours: `git log --grep '^olai'` is the
 *     audit view, and `--invert-grep` gives back your real history.
 *   - **the subject names the biggest thing that happened**, by the fixed order
 *     `@olai/format`'s `Sort` declares, with the rest in the body. A subject
 *     that said "12 edits" and nothing else would make the log a list of
 *     numbers.
 *
 * The words are the reference implementation's — `capture:` / `done:` /
 * `doing:` / `move:` / `archive:` / `create:` / `see:` — because a log somebody
 * already knows how to read is worth more than a better one they do not. One
 * of them has been corrected: a `date` used to print as `move:`, which beside
 * real reparenting ops read as a structural change that never happened.
 */

import { biggestOf, type NodeChange, type Sort, type Writer } from "@olai/format"

/** Every message olai writes starts with this. In a project repository the
 *  prefix is what separates tool writes from a person's: `git log --grep
 *  '^olai'` is the audit view, and `--invert-grep` gives back real history.
 *
 *  Here rather than in `@olai/format`: it never travels the wire, and the
 *  package below this one has no business knowing how olai spells a commit. */
export const MESSAGE_PREFIX = "olai"

/** The trailer that puts the writer in the commit permanently. */
const WRITER_TRAILER = "X-Olai-Writer"

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
 *  under it would be the diff this feature exists not to show. */
const BODY_LINES = 20

/** The message for a set of changes when nobody supplied one. */
export const composed = (changes: ReadonlyArray<NodeChange>): string => {
  const biggest = biggestOf(changes)
  if (biggest === null) return `${MESSAGE_PREFIX}: nothing`

  const files = new Set(changes.map((change) => change.file))
  const count = `${changes.length} ${changes.length === 1 ? "edit" : "edits"}`
  const where = files.size === 1 ? ` to ${stemOf(biggest.file)}` : ""
  // The TITLE, not the id. The design's example named an id and read well
  // because the roadmap's ids are slugs somebody chose (`outlines-collection
  // done`) — but `add_node` MINTS one when nobody supplies it, so the moment an
  // agent captures a node the same subject reads `1vax4izq created`. A log line
  // nobody can read is the failure this whole convention exists to avoid, and
  // the title is the one field that is always meant for a person. (A mirror has
  // no title of its own, and `NodeChange.title` already answers with its id
  // there, which is the right fallback and the only one needed.)
  const subject =
    `${MESSAGE_PREFIX}: ${count}${where} — ${biggest.title} ${biggest.sort}`

  const lines = changes
    .slice(0, BODY_LINES)
    .map((change) => `${VERB[change.sort]}: ${change.title}`)
  const rest = changes.length - lines.length
  if (rest > 0) lines.push(`… and ${rest} more`)

  return `${subject}\n\n${lines.join("\n")}\n`
}

/**
 * A message as it is actually committed: prefixed, and signed by whoever asked.
 *
 * The trailer is the permanent half of "who wrote this". Commits otherwise take
 * the repository's own name and email, so without it an agent's edits are
 * indistinguishable from the ones a person typed — which would defeat the point
 * of the audit trail.
 */
export const signed = (message: string, writer: Writer): string => {
  const said = message.trim() === "" ? `${MESSAGE_PREFIX}: commit` : message.trim()
  const prefixed = said.startsWith(MESSAGE_PREFIX) ? said : `${MESSAGE_PREFIX}: ${said}`
  return `${prefixed}\n\n${WRITER_TRAILER}: ${writer}\n`
}

/** An outline's name without its extension — `roadmap`, not `roadmap.jsonl`.
 *  A subject is read at a glance and the extension is the same on every one of
 *  them. */
const stemOf = (file: string): string => {
  const name = file.slice(file.lastIndexOf("/") + 1)
  return name.endsWith(".jsonl") ? name.slice(0, -".jsonl".length) : name
}
