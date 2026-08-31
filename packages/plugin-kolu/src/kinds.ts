/**
 * WHAT KOLU TEACHES THE VAULT'S VOCABULARY — one word, and what a value of it
 * has to be.
 *
 * `@olai/format` owns seven kinds and none of them is a terminal. A `terminal`
 * value is a padi id, or a prefix of one that resolves to exactly one row
 * (`@olai/kolu-client/wire`'s `resolveTerminal`) — which is a thing only this
 * side of the wall knows, so the word, the clause a refusal names it with and
 * the test a value has to pass are declared together, here, as one entry.
 *
 * ## TWO LAYERS, AND THE VAULT IS THE OUTER ONE
 *
 * What decides whether a value is a terminal is a DECLARATION — never a key's
 * spelling — and a declaration now comes from either of two places, folded once
 * (`@olai/format`'s `withClaims`):
 *
 *   1. **the vault's row** in `_olai/Properties.olai`, which always wins; and
 *   2. **this kind's `claims`**, the key kolu owns by convention, which applies
 *      to a vault that has said nothing about that key.
 *
 * So an enabled kolu draws its door out of the box, and a board that wants the
 * column called `pty` writes one row and gets it there instead. A board that
 * declares `terminal` something else — `{"type":"path"}` — has said what it
 * means and the door goes dark. Nothing ever writes anybody's vault.
 *
 * `TERMINAL_KEY` is `@olai/kolu-client`'s name for the COLUMN — the string the
 * fleet's own arithmetic reads. The claim above IS that constant, so the key
 * kolu conventionally owns and the key kolu's client reads cannot become two
 * words. What it is not is the KIND: the kind is the word a declaration writes,
 * and everything that judges a value follows it — the ownership walk
 * ({@link ./claimants.ts}), the value gate, and the browser's dressing table.
 *
 * FOR ONE PR WINDOW THE BROWSER FOLLOWED THE KEY, because a vault's
 * declarations deliberately do not travel to a tab (juspay/olai#395) and the key
 * was all it had — so the server and the page agreed only while a vault named
 * its column after the kind. The close is `@olai/format`'s `Licence`: the same
 * consult that answers what a value NAMES answers what claims it. The two
 * spellings are one again, and a later edit that believed the old paragraph
 * would re-introduce the name-matching this whole kind exists to end.
 *
 * ## This module's graph
 *
 * It is reached from `./server.ts`, where the vocabulary is spent by the
 * validator and the write planner, and from `./plugin.ts` for the WORD alone —
 * the dressing is looked up by it, so one constant serves the probe and the
 * face. What it may not do is drag this plugin's SolidJS faces onto the graph of
 * a process that renders nothing, and it does not: what it imports is one
 * constant from `@olai/kolu-client/wire`, which is schemas and names.
 *
 * The shape it satisfies is `@olai/plugins`' `PropKind`, and a plugin may not
 * import that package, so the fit is proved at the registry like every other
 * half of this manifest.
 */

import { name } from "./wire.ts"

/** The BARE word this plugin contributes. The registry prefixes it with this
 *  plugin's name, so what a vault actually writes is {@link TERMINAL_TYPE}. */
export const TERMINAL_KIND = "terminal"

/**
 * ...and the word a DECLARATION writes:
 * `{"title":"terminal","custom":{"type":"kolu-terminal"}}`.
 *
 * `@olai/plugins`' `kindWordOf` composes this at the registry, and this is the
 * SAME composition spelled a second time — because this package's own walk
 * ({@link ./claimants.ts}) reads declarations, and a plugin may not import
 * `@olai/plugins` (the registry imports every plugin; a dependency back is a
 * cycle). The two spellings are held equal by `@olai/plugins`' `kinds.test.ts`,
 * which is the same trade every other structural agreement in this package
 * makes.
 */
export const TERMINAL_TYPE = `${name}-${TERMINAL_KIND}`

/**
 * A padi id, or a prefix of one — hex and hyphens, and at least one character.
 *
 * DELIBERATELY A SHAPE AND NOT A LOOKUP. Whether the id is in the fleet is a
 * question about a daemon that may not be running, and a validator whose
 * verdict moved with a socket would make one file two answers on one machine.
 * What this fences is the mistake typing exists for: `terminal a uuid, and a
 * remark about it` is a value with a story stapled to it, and the story belongs
 * in the note.
 *
 * A PREFIX IS LEGAL because the fleet resolves one (`resolveTerminal` matches
 * on `startsWith`, and answers `many` for a prefix that names several). A value
 * naming three terminals is a true string that claims none of them, and the
 * block says so in words where a reader can act on it — which is a different
 * failure from a value that was never an id at all, and is not this gate's.
 */
export const admitsTerminal = (value: string): boolean => /^[0-9a-fA-F-]+$/.test(value)

/**
 * The contribution, as `@olai/plugins`' registry reads it — one entry, spent at
 * three doors: the live write's refusal, the broken file's error, and the fold
 * that decides what a key is declared as.
 *
 * `claims` IS THE BUILT-IN DECLARATION. A vault that has said nothing about
 * `terminal` is declaring it this kind, so turning kolu on is the whole of
 * turning the door on — nobody hand-writes a row in `_olai/Properties.olai` to
 * get a face an enabled plugin already knows how to draw, and **nothing ever
 * writes anybody's vault**.
 *
 * It is `TERMINAL_KEY` and not a literal: the key kolu conventionally owns is
 * `@olai/kolu-client`'s own constant, the one the fleet's arithmetic reads, so
 * the claim and the column cannot drift into two words.
 *
 * A VAULT ROW ALWAYS WINS over this, including a row that declares the key
 * something else and takes the door away (`@olai/format`'s `withClaims`, which
 * is the one place precedence lives). That is a board saying what it means, and
 * a default that argued back would be this plugin overruling the person.
 */
export const kinds = [{
  kind: TERMINAL_KIND,
  takes: `\`${TERMINAL_TYPE}\` (a padi terminal id, or a prefix of one)`,
  admits: admitsTerminal,
}] as const

/** THIS PLUGIN'S OWN VOCABULARY, as `@olai/format` takes one — for the walks in
 *  this package, which read the vault's declarations and must see the claim
 *  above folded in exactly as every other reader does.
 *
 *  BOTH HALVES ARE THE SAME TABLE, and that is honest rather than a shortcut: a
 *  walk in this package runs only on a serve that composed this plugin, so its
 *  own kind is enabled by construction. What it must NOT do is spell the
 *  precedence itself — it hands this to the shared fold and gets back one map,
 *  like every consumer in the tree. */
const OWN = new Map(
  kinds.map((one) => [TERMINAL_TYPE, { ...one, kind: TERMINAL_TYPE, claims: TERMINAL_TYPE }]),
)
export const ownKinds = { built: OWN, enabled: OWN }
