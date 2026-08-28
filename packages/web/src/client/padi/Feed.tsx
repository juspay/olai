/**
 * WHAT RECENTLY WANTED ATTENTION — the drawer off the Padi pill.
 *
 * THE CHROME ONLY. What is inside it is the appliance's (`@olai/kolu-ui`'s
 * `EventsFeed`): this file is where the section sits, how wide it is and
 * how the portalled half of `../popover.ts`'s focus cycle finds it — the
 * same contract `../commit/Panel.tsx` and `../settings/Panel.tsx` wear,
 * because a popover that its trigger stops reaching is a bug the chrome
 * half writes, not the log.
 *
 * THE PILL stays beside the pile of badges a page might draw in a place
 * where the header's word is "no". It does NOT carry a summary of its own
 * — the count a drawer reads off a header is the one the panel itself is
 * for, which is `one-git-indicator`'s own door.
 */

import { EventsFeed } from "@olai/kolu-ui"

import { type Anchor, styleOf } from "../anchor.ts"
import { LAYER } from "../layer.ts"
import { TESTID } from "../testids.ts"

export function Feed(props: {
  /** Where to sit, in viewport pixels — see `../anchor.ts`. */
  readonly at: Anchor
  /** The portalled-half handshake (`../popover.ts`'s). */
  readonly inside: (el: HTMLElement | undefined) => void
}) {
  return (
    <section
      ref={props.inside}
      class={`fixed ${LAYER.over} flex min-h-0 w-80 flex-col gap-2 overflow-y-auto overscroll-contain rounded-2xl border-0 bg-panel p-4 text-sm shadow-xl ring-1 ring-rule/40 focus:outline-none`}
      style={styleOf(props.at)}
      // Focusable, never in the tab order — the popover's half of the focus
      // cycle, worn the way every one of these panels wears it.
      tabindex="-1"
      data-testid={TESTID.padiFeed}
      aria-label="what recently wanted attention"
    >
      <h2 class="text-xs font-medium uppercase tracking-wider text-muted">
        recently wanted attention
      </h2>
      <EventsFeed />
    </section>
  )
}
