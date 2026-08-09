/**
 * Where a zoomed node sits, and the way back up.
 *
 * The CANONICAL parent chain, always — the same crumbs whether you scrolled to
 * this node, followed a permalink, or zoomed a mirror of it three files away.
 * A trail that recorded how you arrived would give one node several pages that
 * disagreed about where it lives, and a reader no way to tell which was true.
 *
 * The trail roots at the node's own outline, because a file is where a node's
 * ancestry actually stops: `parent` never crosses one. The sidebar is still
 * the way out of the file.
 */

import type { LocatedRegular } from "@olai/format"
import { For } from "solid-js"

import { Link } from "./router.tsx"
import { TESTID } from "./testids.ts"

const CRUMB =
  "rounded px-1 text-inherit no-underline hover:bg-rule hover:text-ink"

export function Breadcrumbs(props: {
  readonly file: string
  readonly trail: ReadonlyArray<LocatedRegular>
}) {
  return (
    <nav
      class="flex flex-wrap items-baseline gap-1 text-sm text-muted"
      aria-label="breadcrumbs"
      data-testid={TESTID.breadcrumbs}
    >
      <Link
        route={{ kind: "outline", file: props.file }}
        class={`${CRUMB} font-mono`}
        testid={TESTID.crumb}
      >
        {props.file}
      </Link>
      <For each={props.trail}>
        {(crumb) => (
          <>
            <Separator />
            <Link
              route={{ kind: "node", id: crumb.node.id }}
              class={CRUMB}
              testid={TESTID.crumb}
            >
              {crumb.node.title}
            </Link>
          </>
        )}
      </For>
    </nav>
  )
}

/** Punctuation, not content: a screen reader announcing "chevron" between
 *  every crumb is reading the styling out loud. */
function Separator() {
  return <span aria-hidden="true">›</span>
}
