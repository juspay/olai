/**
 * THE VAULT HALF of a fleet row's owner — which nodes name a terminal.
 *
 * NOT IN `@olai/kolu-client`, and the reason is unchanged by the move: this is
 * a reading of the SET, and it would be exactly this function if the fleet came
 * from somewhere else entirely. The package that dials padi must not learn what
 * an outline record is — its interfaces are PARAMETRIC in the node type
 * precisely so a compiler can hold it to that — so the walk lives on this side
 * and what crosses is four strings per claim (`Claimant`).
 *
 * NOT IN `@olai/server` EITHER. It sat there under a kolu-shaped filename in a
 * general package, and a general package holding "which property means a
 * terminal" is the residue the plugin wall was built to absorb: the walk is
 * olai's own JUDGEMENT about kolu, which is what this package is for
 * ({@link ./index.ts}).
 *
 * The overlay is olai's, the fleet is padi's, and `Claimant` is the only place
 * they meet.
 *
 * ## THE DECLARATION LICENCES THE DOOR
 *
 * This walk used to read the key NAMED `terminal`, so a vault that declared
 * nothing still got a terminal door on any property somebody happened to call
 * that — and `brief` and `worktree`, both `path`, were indistinguishable to
 * anything that wanted to tell two keys apart. The key is found by DECLARED
 * KIND now (`@olai/format`'s `textDeclaredAs`): a row in
 * `_olai/Properties.olai` saying `{"title":"terminal","custom":{"type":"kolu-terminal"}}`
 * is what makes the door on that key, and a column called `pty` carrying that
 * same declaration gets it too.
 *
 * A DECLARATION COMES FROM EITHER OF TWO PLACES, folded once and in this order
 * (`@olai/format`'s `withClaims`): the VAULT'S OWN ROW, which always wins, and
 * the key this kind CLAIMS by convention, which is its own composed word. So a
 * lane carrying `kolu-terminal` wears the door with nothing declared anywhere —
 * enabling kolu is the whole of turning it on — and olai never writes anybody's
 * vault to make that true. A row of the vault's own moves it to a short key, and
 * a row can take it away again.
 *
 * There is still deliberately NO FALLBACK to the key's NAME, and a claim is not
 * one: a fallback reads a key's spelling and guesses, where a claim is a
 * DECLARATION like any other — one this plugin can only ever make about a key
 * carrying its own name, so a column somebody else calls `terminal` is never
 * captured by switching kolu on. Both layers are declarations, because the vault
 * is the only thing that knows which of its keys means what.
 *
 * ## Why the declarations arrive as an argument
 *
 * Because this walk is INJECTED. `@olai/kolu-client` takes it as
 * `(nodes) => Iterable<Claimant>` (`KoluDeps.claimants`) and may not learn what
 * a `Derived` is, so the reading that licences it cannot be looked up in here —
 * the plugin's own serve holds it, off the very revision whose nodes it is
 * about ({@link ./server.ts}). What that keeps is a function of its arguments,
 * with a test that needs no dial.
 */

import {
  declaresKind,
  isRegular,
  type Located,
  type PropDeclarations,
  textDeclaredAs,
} from "@olai/format"
import type { Claimant } from "olai-plugin-kolu/appliance"

import { TERMINAL_TYPE } from "./kinds.ts"

/**
 * Every node carrying a property this vault declares a `terminal`.
 *
 * A GENERATOR, so a revision that claims nothing — which is almost every
 * revision — allocates nothing: the mirror walks this once and keeps only what
 * it found. And the LICENCE is asked BEFORE the loop, so a vault that declares
 * no such key pays one walk of its declarations rather than one per record.
 *
 * MIRRORS ARE SKIPPED. A mirror carries no properties of its own; it is a
 * second placement of the node that does, so asking it would be asking the
 * wrong record — and its target is in this same walk.
 */
export function* claimantsIn(
  declarations: PropDeclarations,
  nodes: ReadonlyArray<Located>,
): Generator<Claimant> {
  if (!declaresKind(declarations, TERMINAL_TYPE)) return
  for (const located of nodes) {
    if (!isRegular(located)) continue
    const terminal = textDeclaredAs(declarations, located.node, TERMINAL_TYPE)
    if (terminal === undefined) continue
    yield {
      id: located.node.id,
      title: located.node.title,
      file: located.file,
      terminal,
    }
  }
}
