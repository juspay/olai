/**
 * The tags the loaded set already uses, and which of them a prefix means.
 *
 * ## Why this is not asked of the server, when node search is
 *
 * The `((` widget next door searches through the server's own procedure, and
 * `../search/nodes.ts` argues at length that a browser must not grow a second
 * matcher: what the ⌘K palette finds and what an agent's `search_nodes` finds
 * have to be one reading. That argument is about RANKING — a query language, a
 * score, four weighted fields — and none of it is here.
 *
 * What is here is an ENUMERATION: every tag written in a title of the set this
 * tab is holding, counted, filtered by prefix. The walk is the format's own
 * (`titleParts`, the same call that draws the pills a row already shows), the
 * set is the one the page is drawing, and there is no ordering question a
 * server could answer differently. Asking the wire for it would put a round
 * trip and a debounce inside a completion that has to keep up with typing, to
 * re-derive a fact this tab is already holding — and it would need a procedure
 * MCP has no equivalent of, which is a parity question this feature does not
 * have to open.
 *
 * If a tag facet ever becomes a REPORT — "every tag, most used first, across a
 * corpus this tab does not hold" — that is a reading, it belongs on both faces,
 * and this file becomes its caller. Recorded rather than pre-built.
 *
 * ## The two sigils are two lists
 *
 * `#alice` and `@alice` are different tags (`@olai/format`'s `TAG_SIGILS`), so
 * typing `@` offers what has been written with an `@` and typing `#` offers
 * what has been written with a `#`. Offering one namespace's names under the
 * other's sigil would be the widget inventing tags the set does not hold.
 */

import {
  type Derived,
  isArchived,
  isMirror,
  mayHoldTag,
  type TagSigil,
  titleParts,
} from "@olai/format"

/** One tag of the set, and how much of it there is. */
export interface Tag {
  readonly sigil: TagSigil
  /** The name, without the sigil. */
  readonly name: string
  /** ...folded for case, once, when the set is walked. Matching happens per
   *  keystroke over every tag of the set; folding there would be a throwaway
   *  string per tag per character typed. */
  readonly folded: string
  /** How many nodes carry it — what orders the list, because the tag somebody
   *  means is usually the tag they have used before. */
  readonly count: number
}

/** How many rows the widget offers. A row's popup is a shortlist. */
const LIMIT = 8

/**
 * Every tag in the set, most-used first and alphabetical within a count.
 *
 * MIRRORS ARE SKIPPED, which is the same rule every other reading of the set
 * follows: a placement has no title of its own, so a tag counted through one
 * would be the same node's tag counted twice.
 *
 * WHAT WAS PUT AWAY IS SKIPPED TOO, and the count is why (ruled 2026-08-17:
 * archived nodes are drawn on the trash page and nowhere else). This number
 * says how much the LIVE set uses a name, and the list is which names are worth
 * reusing: counting the archive would rank a word by rows only the trash draws,
 * and would go on offering a tag whose every user is put away. The tag stays
 * WRITABLE, exactly as any word is — this list is what the set has used, never
 * what a title may say.
 *
 * THE OTHER COMPLETION IN THIS APP GOES THE OTHER WAY ON PURPOSE, and the two
 * are cross-referenced so that neither is "harmonized" into the other by
 * somebody meeting one of them alone: the chat composer's `@` offers every file
 * the directory serves, ARCHIVES INCLUDED (`../chat/files.ts`, argued in
 * docs/chat.md). They differ because they complete different things. That one
 * completes a PATH a person is about to name in a sentence — "what did we put
 * away last month" is a fair thing to ask an agent, and a path half-remembered
 * reaches it as a file that is not there. This one ranks the vocabulary of the
 * set a reader is looking at, and what is put away is not in it.
 *
 * ONE WALK PER DERIVATION, kept in a `WeakMap` keyed on the derivation itself.
 * The alternative — a memo in the component — walks the whole set again every
 * time a `TitleEditor` mounts, and one mounts per row the caret is moved to; a
 * hundred `↑`/`↓` presses with the editor open would be a hundred walks of the
 * corpus. Keyed on the VALUE rather than cached by time, so a frame the store
 * publishes is walked once and the old answer is collectable with the old
 * derivation. `undefined` (no set yet) is no tags rather than a throw.
 */
const walked = new WeakMap<Derived, ReadonlyArray<Tag>>()

export const tagsOf = (derived: Derived | undefined): ReadonlyArray<Tag> => {
  if (derived === undefined) return []
  const seen = walked.get(derived)
  if (seen !== undefined) return seen
  const counted = walk(derived)
  walked.set(derived, counted)
  return counted
}

const walk = (derived: Derived): ReadonlyArray<Tag> => {
  const counts = new Map<string, Tag>()
  for (const located of derived.nodes) {
    if (isMirror(located.node) || isArchived(located.file)) continue
    // The format's own cheap negative first: `titleParts` runs a global regex
    // and allocates a part per segment, and most titles hold no sigil at all.
    if (!mayHoldTag(located.node.title)) continue
    for (const part of titleParts(located.node.title)) {
      if (part.kind !== "tag") continue
      const key = `${part.sigil}${part.tag}`
      const before = counts.get(key)
      counts.set(
        key,
        before === undefined
          ? {
            sigil: part.sigil,
            name: part.tag,
            folded: part.tag.toLowerCase(),
            count: 1,
          }
          : { ...before, count: before.count + 1 },
      )
    }
  }
  return [...counts.values()].sort((a, b) =>
    b.count - a.count || a.name.localeCompare(b.name)
  )
}

/**
 * The tags of one sigil that `query` could be the start of, best first.
 *
 * A PREFIX first and a substring second, folded for case: typing `ho` puts
 * `#home` above `#household-of` and both above `#new-home`. That order is the
 * one property this needs — the tag somebody is typing towards is nearly always
 * one they have started spelling — and it is deliberately not a score.
 *
 * An EMPTY query answers with the whole list (capped), which is what makes a
 * bare `#` a way of seeing what this set even uses.
 *
 * ONE PASS, and the two buckets are filled rather than filtered twice: the
 * "buried" test used to be the negation of the "starts with" test written out
 * again, which is two predicates that have to stay opposite, and this runs per
 * keystroke over every tag the set holds.
 */
export const matchTags = (
  tags: ReadonlyArray<Tag>,
  sigil: TagSigil,
  query: string,
): ReadonlyArray<Tag> => {
  const wanted = query.toLowerCase()
  const starts: Array<Tag> = []
  const buried: Array<Tag> = []
  for (const tag of tags) {
    if (tag.sigil !== sigil) continue
    if (wanted === "" || tag.folded.startsWith(wanted)) starts.push(tag)
    else if (tag.folded.includes(wanted)) buried.push(tag)
    if (starts.length >= LIMIT) break
  }
  return [...starts, ...buried].slice(0, LIMIT)
}
