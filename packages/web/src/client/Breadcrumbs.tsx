/**
 * Where a node sits, and the way back up.
 *
 * The CANONICAL parent chain, always — the same crumbs whether you scrolled to
 * this node, followed a permalink, or zoomed a mirror of it three files away.
 * A trail that recorded how you arrived would give one node several pages that
 * disagreed about where it lives, and a reader no way to tell which was true.
 *
 * The trail roots at the node's own outline, because a file is where a node's
 * ancestry actually stops: `parent` never crosses one. The sidebar is still
 * the way out of the file.
 *
 * The file crumb is optional, and the day view is why: a day lists nodes from
 * every outline at once and heads each group with the file they came from, so
 * repeating it above every node would be the same fact twice on one screen.
 * What is left is the ancestry alone, which is what the crumbs are for.
 */

import type { LocatedRegular } from "@olai/format"
import { For, Show } from "solid-js"

import { NodeTitle } from "./NodeTitle.tsx"
import { Link } from "./router.tsx"
import { LIFTS } from "./surface.ts"
import { TESTID } from "./testids.ts"
import { TARGET } from "./touch.ts"

/** A crumb is a link a finger taps, so it is a target below 48rem like every
 *  other one (./touch.ts) — inline-flex rather than a block, because the trail
 *  wraps and a crumb has to keep sitting on the line with the separators
 *  between them.
 *
 *  EXPORTED, because a day page heads each group with the same kind of link to
 *  the same kind of place (./day/DayPage.tsx). Two identical strings would be
 *  two chances for one of them to stop being a target. */
export const CRUMB = `inline-flex ${TARGET} items-center rounded-lg px-1.5 ` +
  `text-inherit no-underline ${LIFTS} hover:text-ink md:min-h-0`

export function Breadcrumbs(props: {
  /** The outline the trail roots at. Left out where the screen has already
   *  said which file this is. */
  readonly file?: string
  readonly trail: ReadonlyArray<LocatedRegular>
}) {
  return (
    <nav
      class="flex flex-wrap items-baseline gap-1 text-sm text-muted"
      aria-label={props.file === undefined ? "ancestors" : "breadcrumbs"}
      data-testid={TESTID.breadcrumbs}
    >
      <Show when={props.file}>
        {(file) => (
          <Link
            route={{ kind: "outline", file: file() }}
            class={`${CRUMB} font-mono`}
            testid={TESTID.crumb}
          >
            {file()}
          </Link>
        )}
      </Show>
      <For each={props.trail}>
        {(crumb, index) => (
          <>
            {/* Between crumbs only: with no file crumb above it, the first
                ancestor has nothing to be separated from. */}
            <Show when={props.file !== undefined || index() > 0}>
              <Separator />
            </Show>
            <Link
              route={{ kind: "node", id: crumb.node.id }}
              class={CRUMB}
              testid={TESTID.crumb}
            >
              {/* links=false: already inside Link — a markdown [a](url) in the
                  title must not nest a second <a>. */}
              <NodeTitle title={crumb.node.title} from={crumb.file} links={false} />
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
