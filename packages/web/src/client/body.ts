/**
 * HAS THIS NODE AN OPEN STATE — the one question the pilcrow is the answer to.
 *
 * A row is its title and the facts it carries; the ¶ beside the title is the
 * door onto everything else, and it is drawn only where there IS something
 * else. That list is short and it is exactly what `./NodeBody.tsx` draws when a
 * row is open: the NOTE, and the `see` references under it. Nothing else on a
 * node hangs off the mark — a `doc` is a line drawn whether the row is open or
 * not (a document put out of reach behind a fold would be a whole surface
 * hidden by a keystroke), and the custom properties are the run above, drawn on
 * every row since `props-doors-autoshow`.
 *
 * ## Why it is a module and not a line in each row
 *
 * It was a line in each row: `../Tree.tsx` and `./day/DayNode.tsx` each wrote
 * the same disjunction, the second one carrying a comment saying it was the
 * first one's rule ("because it is one rule about a node and not two about two
 * surfaces") — which is the shape where a rule drifts in one of the two. It
 * drifted immediately and silently: both spelled the note and the properties,
 * neither spelled `see`, so a node whose whole body was a reference had a
 * reference nothing on the page could reach.
 *
 * The rule and what the open state DRAWS have to agree or the pilcrow lies in
 * one direction or the other — a mark that opens onto nothing, or a fact with
 * no door. One spelling is what makes that checkable, and a `.ts` is what lets
 * it be checked without a JSX runtime behind it (`./body.test.ts`).
 */

import type { RegularNode } from "@olai/format"

export const hasBody = (node: RegularNode): boolean =>
  (node.desc !== undefined && node.desc !== "") || (node.see?.length ?? 0) > 0
