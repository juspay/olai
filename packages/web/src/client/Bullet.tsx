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
 */

import { Link } from "./router.tsx"
import { TESTID } from "./testids.ts"

export function Bullet(props: { readonly id: string }) {
  return (
    <Link
      route={{ kind: "node", id: props.id }}
      // The gutter of a tree row is the one place the 44px rule cannot be
      // obeyed in both directions: a 44px-wide bullet and a 44px-wide toggle
      // at every level of indent leave a phone no room for the title they are
      // in front of. So the height carries it — 2.75rem, the full target, in
      // the axis where a miss lands on the WRONG NODE — and the width is the
      // 1.75rem the racket original used for the same control on the same
      // screen. Above 48rem it is the compact bullet a mouse gets.
      class="inline-flex h-11 w-7 shrink-0 items-center justify-center text-center text-muted no-underline hover:text-accent md:h-auto md:w-4"
      testid={TESTID.zoom}
      title="zoom into this node"
      label={`zoom into ${props.id}`}
    >
      •
    </Link>
  )
}
