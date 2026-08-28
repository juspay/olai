/**
 * THE VAULT HALF of a fleet row's owner — which nodes name a terminal.
 *
 * HERE rather than in `@olai/kolu-client` because it is a reading of the SET
 * and nothing to do with kolu: it would be exactly this function if the fleet
 * came from somewhere else entirely. Keeping it on this side is what lets that
 * package name `@olai/surface` and nothing else — a walk over `Located` there
 * would have put the vault's format in "how olai reaches kolu", which is two
 * subjects in one manifest.
 *
 * What crosses is four strings per claim (`@olai/kolu-client`'s `Claimant`).
 * The overlay is olai's, the fleet is padi's, and that shape is the only place
 * they meet.
 */

import { customText, isRegular, type Located } from "@olai/format"
import type { Claimant } from "@olai/kolu-client"
import { TERMINAL_KEY } from "@olai/surface"

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
 * The KEY is `@olai/surface`'s constant rather than a string here: which
 * property the door hangs off is one fact, and this would have been the second
 * place that had to remember it. When typed properties land and the door keys
 * off a declared type, that constant is what moves.
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
