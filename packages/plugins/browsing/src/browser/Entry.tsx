/**
 * THE DOOR TO THE BROWSER in the sidebar column and on the collapsed rail —
 * the one way to `/browser` on a phone, where the health popover's rows leave
 * the bar and the palette needs a keyboard.
 *
 * A `top` entry beside Agenda and Today, sharing their left edge, and current
 * whenever a pane shows one of this row's pages. Its dot is the standing's
 * tone (`./said.ts`), so a browser that failed says so from the column; a
 * quiet tone draws no dot.
 */
import { Tip } from "@olai/web/client/Tip.tsx"
import { RailButton } from "@olai/ui-primitives/RailButton.tsx"
import { ENTRY_SHAPE } from "olai-plugin-layout/entry"
import { TONE } from "olai-plugin-layout/slots"
import { Link, useRouter } from "olai-plugin-navigation/routing"
import type { Route } from "olai-plugin-navigation/routes"
import { type Accessor, Show } from "solid-js"
import { TESTID } from "../testids.ts"
import type { Standing } from "../wire.ts"
import { lookOf } from "./said.ts"

export interface Door {
  readonly route: Route
  /** Is this route one of the browser's pages? */
  readonly showing: (route: Route) => boolean
  readonly standing: Accessor<Standing>
}

export function BrowserEntry(props: { readonly door: Door }) {
  const router = useRouter()
  const look = () => lookOf(props.door.standing())
  return (
    // WHERE THE BROWSER STANDS, which the word "Browser" and the dot beside
    // it do not say. The tip is what a pointer gets; `label` is the same
    // fact in the link's name, spelled as the bar's own pill spells it
    // (`./Header.tsx`) so one sentence is not two.
    <Link route={props.door.route} class={ENTRY_SHAPE} testid={TESTID.browserEntry}
      current={props.door.showing(router.route())} tip={look().detail} label={`Browser: ${look().detail}`}>
      <span class="min-w-0 truncate">Browser</span>
      <Show when={TONE[look().tone].dot}>
        {(dot) => <span class={`ml-auto size-2 shrink-0 rounded-full ${dot()}`} data-health={look().tone} aria-hidden="true" />}
      </Show>
    </Link>
  )
}

/** The same door, collapsed. */
export function BrowserRail(props: { readonly door: Door }) {
  const router = useRouter()
  return (
    // The rail's button is an icon alone, so the tip is the only place its
    // word is drawn — and `label` is the same fact for a reader who is not
    // hovering, which is what keeps the tip a convenience.
    <Tip text="Browser">
      <RailButton testid={TESTID.railBrowser} label="Open the browser" href={router.routes.href(props.door.route)}
        data={{ "data-standing": props.door.standing().kind }}>
        <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4">
          <circle cx="8" cy="8" r="6.25" />
          <path d="M1.75 8h12.5M8 1.75c1.9 1.8 2.75 3.9 2.75 6.25S9.9 12.45 8 14.25M8 1.75C6.1 3.55 5.25 5.65 5.25 8S6.1 12.45 8 14.25" />
        </svg>
      </RailButton>
    </Tip>
  )
}
