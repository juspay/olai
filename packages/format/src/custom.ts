/**
 * `custom`: the one open field on a record, and the only one.
 *
 * Everything else a node carries is a FIELD this format declares — `title`,
 * `done`, `date`, `after` — and the top level is closed, so a key olai has no
 * meaning for is a `bad-record` naming it. That closure is load-bearing (a
 * typo'd `titel` is caught rather than kept), and it is also the whole problem
 * this field exists to solve: a person who wants to say "this node is about PR
 * #176" has nowhere to put it, and the fact ends up as prose in `desc` that
 * every reader re-parses by eye.
 *
 * So one field is open, and it is open all the way: any key, and olai gives
 * none of them a meaning. `{"custom":{"pr":"https://…","agent":"claude-opus"}}`
 * costs the format nothing and needs no declaration anywhere — the day a
 * reading wants `isbn`, the key is already sayable.
 *
 * ONE OPEN FIELD RATHER THAN AN OPEN RECORD is the whole of the design
 * (https://github.com/juspay/oss.olai/blob/master/olai/brainstorming/properties.md, ratified 2026-08-15 after two shapes that
 * did not survive review). The alternative — let unknown top-level keys through
 * as user properties — would have bought the same expressiveness by giving up
 * the refusal that catches typos, and it would have put `pr` and `title` in one
 * namespace where a `custom` key called `done` reads as a mark and is not one.
 * Here the two namespaces are two places, and which is which is a fact about
 * where the key sits rather than a rule somebody has to remember.
 *
 * NOTHING IN OLAI READS A KEY IN HERE. The system fields are read by the
 * journal, the checkbox, the blocking graph; these are read by the person who
 * wrote them, by `prop:` in a query, and by the drawer that draws them. That is
 * the difference, and it is the only one.
 */

import { Schema } from "effect"

/**
 * What one custom key holds: text, or a list of it.
 *
 * The list arm is for the same reason the record's edges are lists — a fact can
 * be several — and it is deliberately as far as the types go. Typed values are
 * a door this does not open: a URL is a string that looks like a URL, and a
 * value that wants to be a number can be one the day a reading needs it rather
 * than the day a writer guesses.
 */
export const CustomValue = Schema.Union([Schema.String, Schema.Array(Schema.String)])
export type CustomValue = typeof CustomValue.Type

/** The map itself. Freeform: any key, and olai gives no key a meaning. */
export const Custom = Schema.Record(Schema.String, CustomValue)
export type Custom = typeof Custom.Type

/** A record that may carry one — the shape every reader below asks for, so none
 *  of them needs the whole `./node.ts`'s `RegularNode` and none of them can
 *  reach a field that is not this map. */
export interface HasCustom {
  readonly custom?: Custom | undefined
}

/** Every custom key the node carries, EMPTY for one that carries none — the
 *  `?? {}` written once rather than at each reader. */
export const customOf = (node: HasCustom): Custom => node.custom ?? {}

/** One key's value as TEXT — `undefined` when it is absent, and `undefined`
 *  when it holds a list, which is a value a text reading has no answer for. */
export const customText = (node: HasCustom, key: string): string | undefined => {
  const value = node.custom?.[key]
  return typeof value === "string" ? value : undefined
}

/**
 * The keys of a map in the order a file writes them: alphabetical.
 *
 * CANONICAL, for the reason the record's field order is (./write.ts): two files
 * that mean the same thing must not differ byte for byte, because the format's
 * bet is that a line-based git merge is safe. A map's insertion order is
 * whatever the writer that built it happened to do — for a record read off disk
 * and edited, the order the last writer used — so it is not a contract and
 * cannot decide. What a DRAWER shows is a view's business and could still be
 * anything; what a FILE holds has to be a function of the map alone.
 */
export const customKeys = (custom: Custom): ReadonlyArray<string> =>
  Object.keys(custom).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

/**
 * The keys of a map in the order THIS MAP holds them — what a DRAWER reads.
 *
 * The paragraph above says a map's insertion order "is not a contract and
 * cannot decide" what a FILE holds, and that stands: {@link customKeys} is
 * still what a writer spends, and a record olai wrote is alphabetical on disk
 * because of it. This is the other half of that same sentence — "what a DRAWER
 * shows is a view's business and could still be anything" — answered once,
 * here, rather than left to each view to decide by accident.
 *
 * WHAT IT IS is the order the keys arrived in, which for a record read off disk
 * is the order the bytes have them: `JSON.parse` keeps a key order, the schema
 * decode over it keeps it (`./parse.ts`), and a value put on the wire and read
 * back keeps it again. So a file a HAND wrote — `agent`, then `brief`, then
 * `worktree`, because that is the order the person thinks about the lane in —
 * is drawn the way it was written, and a file olai wrote is drawn
 * alphabetically because that is how olai wrote it. Neither case is a view
 * re-sorting anything under the reader.
 *
 * `Object.keys` and no comparator is the whole implementation, and it is a
 * NAMED function anyway: "the drawer does not sort" is a decision, and a bare
 * `Object.keys(custom)` at a call site is that decision spelled as an accident.
 */
export const customOrder = (custom: Custom): ReadonlyArray<string> => Object.keys(custom)

/**
 * The map with one key set, or — for a value that is NOTHING — taken out.
 *
 * Every write of a custom key goes through here, so "absent has one spelling"
 * (./write.ts's `nothing`) is decided at the moment a key is set rather than at
 * the moment a file is written: a key holding `""` and a key that is gone are
 * one file on disk, and they must be one map in hand too, or the diff a commit
 * message is built from would report a change nobody made.
 *
 * The map comes back FRESH rather than mutated, because a record read off a
 * snapshot is shared with everything else holding that revision.
 */
export const withCustom = (
  custom: Custom | undefined,
  key: string,
  value: CustomValue | undefined,
): Custom => {
  const next: Record<string, CustomValue> = { ...custom }
  if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    delete next[key]
  } else {
    next[key] = value
  }
  return next
}
