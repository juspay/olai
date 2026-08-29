/**
 * THE SOCKET — everything the browser's kolu half needs from the app, in one
 * component with two pins.
 *
 * ## Why this exists before the package does
 *
 * The sixth sitting ruled kolu's implementation out of the non-kolu packages,
 * and every seat ranked THIS commit first: "a wall around an uninverted
 * appliance is a new room with the same wiring." Before this file, `../App.tsx`
 * reached into four kolu-named surface members by hand — `cells.kolu`,
 * `collections.fleet`, `procedures.screen.text`, `streams.terminal.unenrolled` —
 * and bound each one in the app's composition root. Moving those files to a
 * package while the composition root still spelled their member names would
 * have produced a literal dependency cycle at the registration seam and a
 * "wall" the app reached straight through.
 *
 * So the contact is inverted first, in place, where it can be reviewed against
 * today's tree line by line. What the app passes is the composed client WHOLE
 * and a clock. Which members exist, what they are called, and how a pane's
 * subscription is bound are this side's business.
 *
 * ## The client pin is STRUCTURAL, and that is the point
 *
 * `KoluClient` below is not `@olai/surface`'s client type — it is the shape
 * this appliance reads, written out. A structural pin is what lets the app hand
 * over `olai` whole without this file importing the app's composition, and it
 * is what a suite substitutes: a test stands up an object with these four
 * members and nothing else, rather than a whole surface client.
 *
 * It also means the member NAMES live here. The day padi's stream is renamed,
 * this file changes and `../App.tsx` does not — which is the wall doing its job
 * one commit before it is a package.
 *
 * ## The two pins, and why they are pins rather than imports
 *
 * `client` because the wire is the app's to compose, and `now` because the
 * CADENCE is olai's judgement, not kolu's. kolu's Dock ticks its wait chip
 * every second; this ticks every minute, because an outline can carry forty
 * lanes and a per-second tick per row is a re-render storm bought for a digit
 * nobody is watching in a document somebody is reading. That argument is about
 * olai's pages, so it stays on olai's side of the socket and arrives here as a
 * value (`../clock.ts`'s `createTicking`, via `./recency.ts`).
 *
 * ## What does NOT come through here
 *
 * The block TABLE. `registerBlock(TERMINAL_KEY, TerminalBlock)` is the app's
 * call, made in `./PropsDrawer.tsx` against the exported constant — never the
 * string. A self-registering renderer would put the appliance in charge of the
 * app's table and make the import direction a lie.
 */

import type { Accessor, JSX } from "solid-js"

import { unenrolledStreamCall } from "@kolu/surface/client"
import type { Effect, Stream } from "effect"

import type {
  FleetTerminal,
  KoluEvent,
  KoluLink,
  KoluMutes,
  Snapshot,
  TerminalFrame,
  WatchPulse,
} from "@olai/surface"

import { FleetProvider, readingScreen, watchingTerminal } from "./fleet.tsx"

/**
 * THE MEMBERS this appliance reads, structurally — the three cells (the
 * link, the pulse and the drawer's foot), the two collections (`fleet`
 * and the watcher's `events`), the screen read and the live pane.
 *
 * Written as the shape rather than imported as the client's type for the reason
 * the header gives: a pin a suite can satisfy, and a name-change that stops
 * here. Each member is spelled at the depth the surface client presents it, so
 * the app can pass `olai` with no adapter at the call site.
 */
export interface KoluClient {
  readonly cells: {
    readonly kolu: { use: () => { readonly value: Accessor<KoluLink | undefined> } }
    /** The pill's liveness cell — the beat the watcher last stamped, or
     *  `null` before the boot pulse is ever read. */
    readonly pulse: { use: () => { readonly value: Accessor<WatchPulse | null | undefined> } }
    /** The drawer's foot — who is muted, and which file says so. */
    readonly mutes: { use: () => { readonly value: Accessor<KoluMutes | undefined> } }
  }
  readonly collections: {
    readonly fleet: { use: () => { readonly fold: unknown } }
    /** The watcher's ring — added with events, so a hand-built mock from
     *  before them must say so at the type level rather than draw a feed
     *  off nothing. */
    readonly events: { use: () => { readonly fold: unknown } }
  }
  readonly procedures: {
    readonly screen: {
      readonly text: (input: { terminal: string }) => Effect.Effect<Snapshot, unknown>
    }
  }
  readonly streams: {
    readonly terminal: {
      readonly unenrolled: unknown
    }
  }
}

/**
 * Mount the browser's kolu half over the page.
 *
 * One subscription per tab, however many rows draw a terminal — the economy
 * `./fleet.tsx` exists for — and the un-enrolled binding of the pane's stream,
 * which is appliance knowledge rather than app knowledge: a pane's re-attach is
 * normal and self-healing, so enrolling it would flash the app's Disconnected
 * overlay every time somebody resized a terminal. That carve-out used to be
 * spelled in the composition root with a comment explaining it to a reader who
 * had no other reason to be thinking about panes.
 */
export function KoluUi(props: {
  readonly client: KoluClient
  readonly now: Accessor<number>
  readonly children: JSX.Element
}): JSX.Element {
  return (
    <FleetProvider
      now={props.now}
      sources={{
        link: props.client.cells.kolu.use().value,
        pulse: props.client.cells.pulse.use().value,
        mutes: props.client.cells.mutes.use().value,
        fold: props.client.collections.fleet.use().fold as never,
        events: props.client.collections.events.use().fold as never,
        read: readingScreen(props.client.procedures.screen.text),
        watch: watchingTerminal((input) =>
          unenrolledStreamCall(
            props.client.streams.terminal.unenrolled as never,
            input,
          ) as Stream.Stream<TerminalFrame, unknown>
        ),
      }}
    >
      {props.children}
    </FleetProvider>
  )
}

/** Re-exported so a reader of this socket sees the whole contact in one file —
 *  the row type the fold yields is what every consumer of the context reads. */
export type { FleetTerminal }
