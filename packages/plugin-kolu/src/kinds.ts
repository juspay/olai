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
 * ## THE KIND IS THE ONE WORD, and `TERMINAL_KEY` is not it
 *
 * `TERMINAL_KEY` is what `@olai/kolu-client` calls a COLUMN — the string the
 * fleet's own arithmetic reads and the drawer's fact line wears. This is the
 * word a VAULT DECLARES, and everything that decides whether a value is a
 * terminal follows it: the ownership walk ({@link ./claimants.ts}), the value
 * gate, and — since the page began carrying the licence per drawn value — the
 * browser's dressing table too ({@link ./plugin.ts}'s `dressings`, keyed by
 * `TERMINAL_KIND`).
 *
 * So a lane whose column is called `pty` or `where` wears the door the day its
 * row says `{"type":"terminal"}`, and a property somebody happened to name
 * `terminal` in a vault that declares nothing does not. That is the behaviour
 * change and it is the point of it.
 *
 * FOR ONE PR WINDOW THE BROWSER FOLLOWED THE KEY, because a vault's
 * declarations deliberately do not travel to a tab (juspay/olai#395) and the
 * key was all it had — so the server and the page agreed only while a vault
 * named its column after the kind, and this file's header said so. The close is
 * `@olai/format`'s `Licence`: the same consult that answers what a value NAMES
 * answers what claims it, as an answer per drawn value rather than as a rule.
 * The two spellings are one again, and a later edit that believed the old
 * paragraph would re-introduce the name-matching this whole kind exists to end.
 * ## This module's graph
 *
 * It is reached from `./server.ts` and from nowhere else, which is where the
 * vocabulary is spent: the validator and the write planner render nothing, and
 * a kind table reached through the manifest would drag this plugin's SolidJS
 * faces onto that process's graph (`@olai/plugins`' `server.ts` argues the
 * door). It imports nothing at all — the shape it satisfies is
 * `@olai/plugins`' `PropKind`, and a plugin may not import that package, so the
 * fit is proved at the registry like every other half of this manifest.
 */

/** The word a declaration writes: `{"title":"terminal","custom":{"type":"terminal"}}`. */
export const TERMINAL_KIND = "terminal"

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

/** The contribution, as `@olai/plugins`' registry reads it — one entry, spent at
 *  both doors (the live write's refusal and the broken file's error) and by the
 *  walk that licences the door. */
export const kinds = [{
  kind: TERMINAL_KIND,
  takes: "`terminal` (a padi terminal id, or a prefix of one)",
  admits: admitsTerminal,
}] as const
