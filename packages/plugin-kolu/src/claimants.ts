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
 * NOT IN `@olai/server` EITHER, which is the move. It sat there under a
 * kolu-shaped filename in a general package, and a general package holding
 * "which property means a terminal" is the residue the plugin wall was built to
 * absorb: the walk is olai's own JUDGEMENT about kolu, which is what this
 * package is for ({@link ./index.ts}). Nothing about the function changed —
 * only the wall it is inside — except the door `TERMINAL_KEY` is read through:
 * `@olai/surface` used to re-export the constant and no longer names an
 * appliance at all, so it is read from the package that DECLARES it.
 *
 * The overlay is olai's, the fleet is padi's, and `Claimant` is the only place
 * they meet.
 */

import { customText, isRegular, type Located } from "@olai/format"
import type { Claimant } from "@olai/kolu-client"
import { TERMINAL_KEY } from "@olai/kolu-client/wire"

/**
 * Every node carrying a `terminal` property.
 *
 * A GENERATOR, so a revision that claims nothing — which is almost every
 * revision — allocates nothing: the mirror walks this once and keeps only what
 * it found.
 *
 * MIRRORS ARE SKIPPED. A mirror carries no properties of its own; it is a
 * second placement of the node that does, so asking it would be asking the
 * wrong record — and its target is in this same walk.
 *
 * The KEY is `@olai/kolu-client/wire`'s constant rather than a string here:
 * which property the door hangs off is one fact, and this would have been the
 * second place that had to remember it. It is read from the package that
 * DECLARES it now rather than from the composed spec, which is the extraction's
 * own direction — core carries no appliance's vocabulary to re-export. When the
 * door keys off a declared KIND rather than a key, that constant is what moves.
 */
export function* claimantsIn(nodes: ReadonlyArray<Located>): Generator<Claimant> {
  for (const located of nodes) {
    if (!isRegular(located)) continue
    const terminal = customText(located.node, TERMINAL_KEY)
    if (terminal === undefined) continue
    yield {
      id: located.node.id,
      title: located.node.title,
      file: located.file,
      terminal,
    }
  }
}
