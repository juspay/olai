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
import { CONTROL } from "./touch.ts"

export function Bullet(props: { readonly id: string }) {
  return (
    <Link
      route={{ kind: "node", id: props.id }}
      // Sized from ./touch.ts, which is where the gutter's one exception to
      // the 44px rule is argued and where everything that moves with it lives.
      class={`${CONTROL} text-center text-muted no-underline hover:text-accent`}
      testid={TESTID.zoom}
      title="zoom into this node"
      label={`zoom into ${props.id}`}
    >
      •
    </Link>
  )
}
