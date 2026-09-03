/**
 * WHAT ODU TEACHES THE VAULT'S VOCABULARY — one word, and what a value of it
 * has to be.
 *
 * A `worktree` value is a path olai will join `.ci/odu.sock` onto and DIAL in
 * somebody's checkout ({@link ./worktrees.ts}), which is why this kind exists
 * at all rather than the key staying `path`. Both are paths; only one of them
 * licences a socket dial, and `brief` — also a `path`, on the very same rows —
 * is the proof that a shape cannot tell them apart. The vault says which is
 * which, in the one place it says everything else about its keys.
 *
 * ## TWO LAYERS, AND THE VAULT IS THE OUTER ONE
 *
 * What decides whether a value names a checkout is a DECLARATION — never a
 * key's spelling — and a declaration comes from either of two places, folded
 * once (`@olai/format`'s `withClaims`):
 *
 *   1. **the vault's row** in `_olai/Properties.olai`, which always wins; and
 *   2. **this kind's `claims`**, the key odu owns by convention, which applies
 *      to a vault that has said nothing about that key.
 *
 * So an enabled odu draws its chip out of the box, and a board whose column is
 * called `checkout` writes one row and gets it there instead. A board that
 * declares `worktree` a plain `path` — which is what one real board says — has
 * said what it means, and the chip goes dark. Nothing ever writes anybody's
 * vault.
 *
 * That last case is worth sitting with, because it is the highest bar in this
 * package: what a `worktree` licences is a SOCKET DIAL in a directory nobody
 * asked about. A claim gets that bar cleared by an operator turning odu on,
 * which is a decision somebody made on purpose about this host; a vault can
 * always take it back with one row.
 *
 * `WORKTREE_KEY` is `@olai/odu-client`'s name for the COLUMN, and it is NOT
 * what this plugin claims. The claimed key is {@link WORKTREE_TYPE}, the
 * composed word, which is what makes a built-in declaration safe here of all
 * places: enabling odu can only ever declare a key carrying odu's name, so a
 * column somebody else calls `worktree` is never pointed at a socket dial by a
 * flag on the machine.
 *
 * Nor is `WORKTREE_KEY` the KIND. The kind is the word a declaration writes, and
 * everything that judges a value follows it — the walk
 * ({@link ./worktrees.ts}), the value gate, and the browser's dressing table.
 *
 * FOR ONE PR WINDOW THE BROWSER FOLLOWED THE KEY, because a vault's
 * declarations deliberately do not travel to a tab (juspay/olai#395), so the
 * probe and the chip agreed only while a vault named its column after the kind.
 * `@olai/format`'s `Licence` closed it: the same consult that answers what a
 * value NAMES answers what claims it.
 *
 * ## The shape is the FORMAT'S
 *
 * `isPathShaped` and not a second predicate spelled here. This kind is a `path`
 * that promises something further, so what it accepts must not be narrower or
 * wider than what a `path` accepts — a value the format calls a path and this
 * refused would be two answers about one string, which is the family
 * `@olai/format`'s `meaning.ts` header is a list of.
 */

import { isPathShaped } from "@olai/format"

import { name } from "./wire.ts"

/** The BARE word this plugin contributes. The registry prefixes it with this
 *  plugin's name, so what a vault actually writes is {@link WORKTREE_TYPE}. */
export const WORKTREE_KIND = "worktree"

/** ...and the word a DECLARATION writes:
 *  `{"title":"worktree","custom":{"type":"odu-worktree"}}`. The same
 *  composition `@olai/plugin-api`'s `kindWordOf` makes at the registry, spelled a
 *  second time because this package's own walk reads declarations and a plugin
 *  may not import that package. `@olai/plugin-api`'s `kinds.test.ts` holds the two
 *  equal. */
export const WORKTREE_TYPE = `${name}-${WORKTREE_KIND}`

/** The contribution, as `@olai/plugin-api`'s registry reads it — spent by the
 *  validator, by the write planner, and by the fold that decides what a key is
 *  declared as. `claims` is the built-in declaration; the header argues both
 *  layers and which one wins. */
export const kinds = [{
  kind: WORKTREE_KIND,
  takes: `\`${WORKTREE_TYPE}\` (a path to a checkout, no whitespace)`,
  admits: isPathShaped,
}] as const

/** THIS PLUGIN'S OWN VOCABULARY, as `@olai/format` takes one — for the walk in
 *  this package, which reads the vault's declarations and must see the claim
 *  above folded in exactly as every other reader does.
 *
 *  BOTH HALVES ARE THE SAME TABLE, and that is honest rather than a shortcut:
 *  the walk runs only on a serve that composed this plugin, so its own kind is
 *  enabled by construction. What it must NOT do is spell the precedence itself —
 *  it hands this to the shared fold and gets back one map, like every consumer
 *  in the tree. */
const OWN = new Map(
  kinds.map((one) => [WORKTREE_TYPE, { ...one, kind: WORKTREE_TYPE, claims: WORKTREE_TYPE }]),
)
export const ownKinds = { built: OWN, enabled: OWN }
