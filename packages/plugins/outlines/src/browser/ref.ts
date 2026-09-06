/**
 * One target of a drawn relation: the id a link opens, and the text it shows.
 *
 * The DATA half of \`./NodeRefs.tsx\`, in a module of its own so that the readings
 * which produce it — \`./edges/named.ts\`, \`./backlinks/refs.ts\` — can be unit
 * tested without pulling a component and its JSX runtime in behind them. That
 * is not a tidiness split: those readings ARE the thing worth testing, and
 * putting their return type's constructor in a \`.tsx\` is what made one of them
 * untestable the day it stopped being a type-only import.
 */

import type { LocatedRegular } from "@olai/format"

/** Resolving is the caller's, because what an edge NAMES is a question about
 *  the set (\`@olai/format\`'s \`nodeNamed\`) rather than about the row. */
export interface NodeRef {
  readonly id: string
  readonly title: string
  /** Outline the title is written in — handed to \`NodeTitle\` for the markdown
   *  pipeline. Empty when the title is a fallback id with no prose. */
  readonly from: string
}

/**
 * One made FROM A RECORD — the projection for every row whose entries are
 * already records rather than ids.
 *
 * Here rather than at the call sites, which had grown to two hand-written
 * literals of the same three fields (\`./Blocked.tsx\` over the blockers,
 * \`./backlinks/refs.ts\` over the referrers): the next field a ref gains has to
 * be found at each of them, and nothing type-errors when it is not.
 *
 * NOT for a row whose field holds IDS. \`./edges/named.ts\` builds its refs by the
 * id AS WRITTEN — a \`see\` naming a mirror keys by the mirror, which is the
 * identity the write layer's own set is over — so it passes an id this cannot
 * know and keeps its own literal on purpose.
 */
export const refOf = (at: LocatedRegular): NodeRef => ({
  id: at.node.id,
  title: at.node.title,
  from: at.file,
})
