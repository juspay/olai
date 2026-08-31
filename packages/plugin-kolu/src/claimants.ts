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
 * is what makes the door, and a column called `pty` carrying that same
 * declaration gets it too.
 *
 * WHAT THAT COSTS IS SAID PLAINLY rather than softened: a vault that declares
 * nothing gets no door where it used to get one, and the repair is one row. There
 * is deliberately NO FALLBACK to the key's name beside the declaration — a
 * fallback is the name-matching defect kept alive under a second name, and it
 * would put both answers back in the codebase for the next reader to pick
 * between.
 *
 * It is now the SAME bar the walk one appliance over asks of itself
 * (`@olai/plugin-odu`'s `worktrees.ts`), where it used to be a lower one, and
 * the two are still different in what they RISK: that walk hands a path to a
 * socket dial in somebody's checkout, and this one looks a value up in a fleet
 * somebody else is keeping, where a wrong value finds nothing and the block says
 * so in words. Both are licensed by a declaration anyway, because the vault is
 * the only thing that knows which of its keys means what.
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
import type { Claimant } from "@olai/kolu-client"

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
