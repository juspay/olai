/**
 * THE ONE FACT a folded row is allowed to say beside its title.
 *
 * A row is its title (`./settings/density.ts`). Everything a node carries —
 * every property, its note, its references — waits for the open state, and the
 * ruling that makes the quiet outline liveable rather than merely quiet is that
 * exactly ONE fact may ride inline after the title, in the same dim voice the
 * tags are now in (human, the quiet outline). Not a column, not a badge, not a
 * box: a word after the words, the way a byline follows a headline.
 *
 * Which fact, in order:
 *
 *   1. **the rollup**, on a branch with tasks under it — `3/5`. What the
 *      children add up to is the single most useful thing to know about a row
 *      you have not opened, and it is the reason the fold is not a loss.
 *   2. **`pr`, on shipped work** — the property this vault puts on a node once
 *      the thing it describes has landed. It is the human's own named example,
 *      and it is deliberately not "any property": a rule that promoted whatever
 *      key happened to be first would put `agent` on one row and `isbn` on the
 *      next, which is a column of noise spelled as a rule.
 *   3. **nothing.** Most rows.
 *
 * `pr` is gated on the node being DONE for the same reason it is gated on the
 * key: the fact is interesting exactly when it is the answer to "where did this
 * go" — a `pr` on unstarted work is a plan, and a plan is what the open state is
 * for.
 *
 * A URL is shown by its last path segment, which for the address this key
 * actually holds is the pull request's number. The whole value rides the
 * `title`, so nothing is hidden — only unspelled, at the size a row can afford.
 * A pure function with a unit test, because that sentence is three decisions and
 * they are the kind that go quietly wrong inside a component.
 */

import { customText, type HasCustom, type Progress, type Status } from "@olai/format"

/** The property key a shipped row may show. One key, named here, so widening
 *  the rule is an edit somebody has to make on purpose. */
export const HOT_PROPERTY = "pr"

/**
 * The fact, as what to draw. A union rather than one shape with optional
 * fields, because the two arms are drawn differently and only one of them needs
 * a key in front of it: `3/5` is its own label, `pr 208` is not.
 */
export type Hot =
  /** The rollup, kept whole so the badge that draws it takes the value it
   *  already takes everywhere else (`./ProgressBadge.tsx`). */
  | { readonly kind: "progress"; readonly progress: Progress }
  | {
    readonly kind: "prop"
    readonly key: string
    /** What is drawn. */
    readonly text: string
    /** The unabbreviated value, when the drawn text is short for something. */
    readonly full?: string
  }

export const hotOf = (
  node: HasCustom | undefined,
  progress: Progress | undefined,
  status: Status | undefined,
): Hot | undefined => {
  if (progress !== undefined) return { kind: "progress", progress }
  if (node === undefined || status !== "done") return undefined
  // `customText` answers `undefined` for a key holding a LIST, which is the
  // answer this wants: a hand-written list is not one fact, so it is not this
  // one — it is drawn in the open state's properties run with everything else.
  const held = customText(node, HOT_PROPERTY)
  if (held === undefined || held === "") return undefined
  const short = shortened(held)
  return {
    kind: "prop",
    key: HOT_PROPERTY,
    text: short,
    full: short === held ? undefined : held,
  }
}

/** A URL by its last non-empty path segment, and anything else verbatim.
 *  Narrow on purpose: a property value is text and nothing here parses it, so
 *  what gets shortened is what is unambiguously an address — the same test
 *  `props/drawer.ts` uses to decide what becomes a link. */
const shortened = (value: string): string => {
  if (!value.startsWith("https://") && !value.startsWith("http://")) return value
  const parts = value.split("?")[0]!.split("#")[0]!.split("/").filter((one) => one !== "")
  const last = parts[parts.length - 1]
  return last === undefined || parts.length <= 2 ? value : last
}
