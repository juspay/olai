/**
 * The bullet on a node, which is the link to that node's own page.
 *
 * One component, because it is one promise: every place a node is drawn — a
 * row in a tree, an entry on a day — the dot in front of it goes to `/n/<id>`.
 * Two copies of this would be two chances for the label a screen reader
 * announces, or the testid the browser tests find it by, to drift apart while
 * both still compiled.
 *
 * The link is on the RECORD's id, whatever that record turns out to show: a
 * mirror's id resolves through its chain to the same canonical page, so the
 * two spellings agree and nothing has to resolve anything here.
 *
 * Drawn as a filled circle (Workflowy's bullet), never a text glyph: a `•`
 * is a different size and weight in every font, and the gray halo around a
 * collapsed parent has nowhere to sit on a character. The halo is the signal
 * that children are hidden; it is only drawn when the caller says so.
 */

import { Link } from "./router.tsx"
import { TESTID } from "./testids.ts"
import { CONTROL } from "./touch.ts"

export function Bullet(props: {
  readonly id: string
  /** True when this row has children that are currently hidden. Workflowy's
   *  gray circular halo around the dot. */
  readonly collapsed?: boolean
}) {
  const halo = () => props.collapsed === true

  return (
    <Link
      route={{ kind: "node", id: props.id }}
      // Sized from ./touch.ts, which is where the gutter's one exception to
      // the 44px rule is argued and where everything that moves with it lives.
      class={`${CONTROL} group/bullet relative text-center no-underline`}
      testid={TESTID.zoom}
      title="zoom into this node"
      label={`zoom into ${props.id}`}
      // The halo is a FACT about the reading, not a colour: a scenario asks
      // for it the same way it asks for data-collapsed on the row.
      halo={halo()}
    >
      {/* Halo behind the dot — always for collapsed; also on hover so the
          one control that navigates has a Workflowy-style affordance. */}
      <span
        class="pointer-events-none absolute left-1/2 top-1/2 h-[0.95rem] w-[0.95rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-muted/55 bg-muted/15 group-hover/bullet:visible"
        classList={{ invisible: !halo() }}
        aria-hidden="true"
      />
      {/* The filled round bullet — accents on hover like the old glyph did. */}
      <span
        class="relative block h-[0.375rem] w-[0.375rem] rounded-full bg-ink group-hover/bullet:bg-accent"
        aria-hidden="true"
      />
    </Link>
  )
}
