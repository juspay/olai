/**
 * WHICH TERMINAL A `terminal` VALUE NAMES — the one resolution, read by both
 * ends.
 *
 * The board writes a `terminal` property as an EIGHT-CHARACTER PREFIX
 * (`cb9dcd13`) far more often than as a full uuid: seventy-eight of the
 * vault's ninety-odd bare values, against nine written out. padi keys its
 * fleet by the whole uuid. So a lookup that asked the map for the value it was
 * given answered `undefined` for the ordinary case, and the chip drew the
 * hollow "no longer in the fleet" face over a terminal that was working — the
 * first of the two defects the human found in production.
 *
 * ## A prefix is padi's OWN addressing, not olai guessing
 *
 * This is worth being exact about, because `../../web/src/client/props/door.ts`
 * spends itself refusing fuzzy matching and this looks like fuzzy matching. It
 * is not. `kolu`'s own CLI takes a terminal id as "any unique prefix"
 * (`kolu-cli`'s argument description), so a prefix IS a way of naming a
 * terminal in the vocabulary the fleet is keyed in — the vault is using kolu's
 * spelling, not an abbreviation olai decided to be generous about.
 *
 * What door.ts refuses is deciding which PART of somebody's sentence was the
 * point, and that refusal stands here: the WHOLE value has to be a prefix. A
 * value with prose after the id (`8ad34c07 (claude --model opus, dispatched
 * …)`, which about ten of the board's values are) is not a prefix of anything
 * and resolves to nothing. Pulling the id out of it would be exactly the wrong
 * door — and the fix for those is the vault writing the id bare, which is what
 * the other seventy-eight already do.
 *
 * ## Three answers, because ambiguity is a fact and not a failure
 *
 * A prefix can name more than one terminal. That is not an error and not an
 * absence: it is a true statement that this value cannot say which. It gets
 * its own arm so a reader is told THAT rather than shown a dot for whichever
 * row happened to sort first — the same reason `KoluLink` has three arms
 * instead of a boolean.
 *
 * ## Why it lives in the surface
 *
 * Both ends resolve, and they must agree. The SERVER resolves to join the
 * ownership overlay onto the fleet and to turn a click into a padi call; the
 * BROWSER resolves to draw the dot. Two implementations of "which terminal is
 * this" is how a chip comes to show a green dot for a terminal whose snapshot
 * answers "no such terminal" — so there is one, here, beside the vocabulary
 * both ends already share.
 *
 * That same argument is what put {@link whoOf} at the foot of this file. It
 * answers the OTHER question both ends ask of one row — not *which terminal is
 * this* but *who do we call it* — and it was spelled twice, on two sides of a
 * package wall, until the drift a second spelling promises finally arrived.
 * Its own header tells that story.
 */

/** What a value turned out to name. */
export type Resolved =
  /** Exactly one terminal — the full id, which is what padi is keyed by and
   *  what every verb must be handed. */
  | { readonly kind: "one"; readonly id: string }
  /** Nothing in the fleet. A retired terminal, a typo, or a value that is not
   *  an id at all (a bare word, an id with prose after it). */
  | { readonly kind: "none" }
  /** More than one — a prefix too short to be an address. `count` is what the
   *  reader is told, because "three" is the fact that makes the next move
   *  obvious (write more of it). */
  | { readonly kind: "many"; readonly count: number }

/** Nothing named — minted once, since it carries no fields and is the answer
 *  every empty fleet gives to everything. */
const NONE: Resolved = { kind: "none" }

/**
 * Resolve one `terminal` value against the ids the fleet is holding.
 *
 * AN EXACT MATCH WINS OUTRIGHT, before the prefix walk. Today no uuid is a
 * strict prefix of another (they are one length), so the two rules cannot
 * disagree — but "the id you named is the id you get" should not depend on
 * that remaining true, and reading it first is one line.
 *
 * The comparison is byte-exact. Case-folding would be a second generosity on
 * top of the prefix one, and the values in play are lowercase hex written by
 * one program; a value in another case is a value somebody typed by hand, and
 * telling them it names nothing is better than quietly matching something.
 */
export const resolveTerminal = (value: string, ids: Iterable<string>): Resolved => {
  // An empty property names nothing, and asking the fleet would make it name
  // EVERYTHING — every id has the empty string as a prefix.
  if (value === "") return NONE
  let found: string | undefined
  let count = 0
  for (const id of ids) {
    if (id === value) return { kind: "one", id }
    if (!id.startsWith(value)) continue
    count += 1
    if (found === undefined) found = id
  }
  if (count === 1 && found !== undefined) return { kind: "one", id: found }
  return count === 0 ? NONE : { kind: "many", count }
}

/**
 * WHO A ROW IS — kolu's own `repo·branch` spelling, folded once for both ends.
 *
 * The label alone is not an address. Three terminals on three checkouts of the
 * same project all label themselves `master`, and a sentence naming one of
 * them names all three; the repo is the disambiguator, and `·` is the joiner
 * kolu's own Dock writes between them. Everything olai says ABOUT a row to a
 * person — the doorbell's plain-text line, the events feed's WHO column — says
 * this name.
 *
 * ## Two scalars rather than a row
 *
 * The two callers hold two different rows: {@link ./kolu.ts}'s `FleetTerminal`
 * on the server's side, and the FROZEN pip inside a `KoluEvent` on the
 * browser's. Both carry `repo` and `label`, and neither carries anything else
 * this fold reads — so the narrow signature is precisely what lets one
 * function serve both. A row-shaped parameter would have needed a structural
 * type meaning "the two fields" anyway, at the cost of a name for it and of a
 * fold that looks like it might read a third.
 *
 * ## The blank label is where the two spellings parted
 *
 * A terminal with no intent line and no branch carries `label: ""` — the wire
 * types it as a plain string and nothing guarantees a word — so a fold that
 * always joins answers `olai·`, a name ending in a joiner with nothing joined
 * to it, in a sentence a person reads rather than in a debug dump. The blank
 * drops the separator and the repo stands alone; {@link ./terminals.test.ts}
 * pins that once, for both ends.
 *
 * IT USED TO BE SPELLED TWICE, one spelling on each side of a package wall:
 * `olai-plugin-kolu`'s `doorbell.ts` composed the clause into its sentence,
 * `olai-plugin-kolu`'s `ui/padi/events.ts` folded it for the feed, and each header
 * promised the reader that the two answered identically for the same row.
 * They did not. The blank-label case above was live in BOTH and had to be
 * repaired in BOTH, in lockstep, inside one diff — which is the whole of what
 * a promise between two headers cannot do, and what one function does by
 * having nothing left to disagree with.
 *
 * WHY HERE, rather than in either caller. The standing argument against was
 * that this package is the DIAL and the vocabulary while `repo·label` is
 * olai's judgement about how to NAME a row — and it loses twice over: the
 * spelling is not olai's invention but kolu's Dock's, and a wording that MUST
 * be identical in two processes is a fact about the wire between them rather
 * than a preference either end holds alone. The mechanics agree with the
 * reading: `olai-plugin-kolu`'s server door may not reach a SolidJS package
 * and a browser may not reach a `node:` one, so the only floor a shared fold
 * can stand on is the one below both. It is a pure string fold and adds
 * nothing to this entry's closure, which is what the fence argued in
 * {@link ./index.ts} demands of everything that lands here.
 */
export const whoOf = (repo: string | null, label: string): string => {
  const named = label.trim()
  if (repo === null) return named
  return named === "" ? repo : `${repo}·${named}`
}
