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
 * fleet's own arithmetic reads — and it is NOT what this plugin claims. The
 * claimed key is {@link TERMINAL_TYPE}, the composed word, which is what makes a
 * built-in declaration safe: enabling kolu can only ever declare a key carrying
 * kolu's name, so a column somebody else calls `terminal` is untouchable by a
 * flag on the machine.
 *
 * Nor is `TERMINAL_KEY` the KIND. The kind is the word a declaration writes, and
 * everything that judges a value follows it — the ownership walk
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
 * validator and the write planner, and from `./browser.tsx` for the WORD alone
 * — the face is registered under it, so one constant serves the probe and the
 * face. (It was `./plugin.ts` on that second door, when a browser half was a
 * manifest object; the half is a Cordis plugin now and the constant it wants is
 * the same one.) What it may not do is drag this plugin's SolidJS faces onto the
 * graph of a process that renders nothing, and it does not: what it imports is
 * one constant from `@olai/kolu-client/wire`, which is schemas and names.
 *
 * The shape it satisfies is `@olai/plugin-api`'s `PropKind`. That used to be an
 * agreement nothing here could annotate — the package held the REGISTRY as well
 * as the interface, so a plugin importing it was a cycle, and the fit was proved
 * at the registry's `satisfies`. The registry is `@olai/bundle`'s now and this
 * package imports the interface for real, so the fit is proved where the row is
 * SPENT: `ctx.kinds.register` takes a `PropKind` (`./server.ts`), and a row that
 * stopped fitting is red on that line rather than on a list's.
 */

import { name } from "./wire.ts"

/** The BARE word this plugin contributes. The SERVICE prefixes it with this
 *  plugin's name — read off the registering fiber rather than off anything
 *  handed in — so what a vault actually writes is {@link TERMINAL_TYPE}. */
export const TERMINAL_KIND = "terminal"

/**
 * ...and the word a DECLARATION writes:
 * `{"title":"terminal","custom":{"type":"kolu-terminal"}}`.
 *
 * `@olai/plugin-api`'s `kindWordOf` composes this inside the SERVICE, off the
 * registering fiber's own name — `ctx.kinds` on the server and `ctx.slots` in
 * the tab, so one word cannot become two spellings — and the constant here is
 * that SAME composition spelled a second time, for this package's own walk
 * ({@link ./claimants.ts}), which reads declarations.
 *
 * It was written when a plugin could not import `@olai/plugin-api` at all: that
 * package held the registry as well as the interface, and the registry imports
 * every plugin, so a dependency back was a cycle. That premise is gone — the
 * registry is `@olai/bundle`'s — and the second spelling stays anyway, for a
 * reason of its own: the walk wants the composed word at MODULE SCOPE, where no
 * registration has happened and there is no fiber to compose it off. The two
 * spellings are held equal by `@olai/bundle`'s `kinds.test.ts`, which is the
 * same trade every other structural agreement in this package makes.
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
 * The contribution, as `ctx.kinds` takes it — one entry, spent at three doors:
 * the live write's refusal, the broken file's error, and the fold that decides
 * what a key is declared as.
 *
 * `claims` IS THE BUILT-IN DECLARATION, and the key it claims is
 * {@link TERMINAL_TYPE} — `kolu-terminal`, never the bare `terminal`. A vault
 * that has said nothing about THAT key is declaring it this kind, so turning
 * kolu on is the whole of turning the door on: nobody hand-writes a row in
 * `_olai/Properties.olai` to get a face an enabled plugin already knows how to
 * draw, and **nothing ever writes anybody's vault**.
 *
 * THE CLAIMED KEY IS THE COMPOSED WORD ITSELF, and it is not a choice this
 * plugin gets to make: nothing in this row says `claims` at all.
 * `ctx.kinds.register` sets it equal to the word it just composed
 * (`@olai/plugin-api`'s `services.ts`), out of the registering fiber's own name
 * — it was a `kindsOf` over two lists a composition root held, and it is a
 * registration off the fiber now, which is what made the field unspellable here
 * rather than merely unspelt. That equality is what makes a built-in declaration
 * safe — enabling kolu can only ever declare `kolu-terminal`, so a column
 * somebody else calls `terminal` is untouchable by a flag on the machine.
 *
 * It is deliberately NOT `TERMINAL_KEY`, which is what `@olai/kolu-client` calls
 * the fleet's own column and is no business of a declaration's.
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
