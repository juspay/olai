/**
 * THE SOCKET — everything the browser's kolu half needs from the app, in one
 * component with two pins.
 *
 * ## Why this exists before the package does
 *
 * The sixth sitting ruled kolu's implementation out of the non-kolu packages,
 * and every seat ranked THIS commit first: "a wall around an uninverted
 * appliance is a new room with the same wiring." Before this file, `../App.tsx`
 * reached into four of kolu's surface members by hand — the link cell, the
 * fleet collection, the screen procedure's `text` verb and the terminal
 * stream's un-enrolled binding — and bound each one in the
 * app's composition root. Moving those files to a
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
 * It also means the member NAMES live here, in ONE file, and a name-change
 * STOPS here — this file changes, `../App.tsx` does not, and no pane, row or
 * chip below ever learns what the members are called.
 *
 * THE KEYS ARE BARE, and it is worth saying why they are not something else.
 * This appliance's members are declared in `olai-plugin-kolu`'s own surface
 * under their own names, and core composes that surface as a SIBLING — so what
 * a browser holds is this plugin's OWN client, whose accessors are `link`,
 * `fleet`, `screen.text`. The namespace is the client, not the key.
 *
 * An earlier attempt made every key a punctuated string — the plugin's name
 * folded into the member's — and it is recorded because the way it was wrong
 * generalises: a member name is not a namespace. `@kolu/surface` mints channel
 * names, MCP resource paths and tool names out of one, so a punctuated member
 * aliases another member's channel, needs percent-encoding to be read as a
 * resource, and yields a tool name outside the character set a strict host
 * accepts. The framework's own sibling composition is the axis, and this pin
 * is written against a sibling's client.
 *
 * ## The two pins, and why they are pins rather than imports
 *
 * `client` because the wire is the app's to compose, and `now` because the
 * CADENCE is olai's judgement, not kolu's. kolu's Dock ticks its wait chip
 * every second; this ticks every minute, because an outline can carry forty
 * lanes and a per-second tick per row is a re-render storm bought for a digit
 * nobody is watching in a document somebody is reading. That argument is about
 * olai's pages, so it stays on olai's side of the socket and arrives here as a
 * value — minted by `olai-plugin-kolu`'s mount off the clock and the units the
 * app hands every plugin across. It used to come from a `recency.ts` inside
 * `@olai/web` and that module is gone with the composition root's own call: the
 * decision is unchanged and it is made one wall out, where olai's judgement
 * ABOUT kolu now lives.
 *
 * ## What does NOT come through here
 *
 * The block TABLE. Which key wears `TerminalBlock` is DECLARED on
 * `olai-plugin-kolu`'s manifest, against the exported constant and never the
 * string, and REGISTERED by the app from that manifest. A self-registering
 * renderer would put the appliance in charge of the app's table and make the
 * import direction a lie.
 */

import type { Accessor, JSX } from "solid-js"

import { unenrolledStreamCall } from "@kolu/surface/client"
import type { Effect, Stream } from "effect"

import type {
  FleetTerminal,
  KoluEvent,
  KoluKnobs,
  KoluLink,
  Snapshot,
  TerminalFrame,
  WatchPulse,
} from "olai-plugin-kolu/appliance/wire"

import { FleetProvider, readingScreen, watchingTerminal } from "./fleet.tsx"

/**
 * THE MEMBERS this appliance reads, structurally — the three cells (the link,
 * the pulse and the drawer's foot), the two collections (the fleet and the
 * watcher's events), the screen read and the live pane.
 *
 * Written as the shape rather than imported as the client's type for the reason
 * the header gives: a pin a suite can satisfy, and a name-change that stops
 * here. Each member is spelled at the depth this appliance's OWN surface client
 * presents it — `cells.link`, `procedures.screen.text` — which is what
 * `packages/plugins/kolu/src/wire.ts` declares and therefore what a sibling
 * client hands back, so the app can pass this plugin's client with no adapter
 * at the call site.
 */
export interface KoluClient {
  readonly cells: {
    /** The DIAL, read: whether this server found padi and what it found.
     *  Called `link` rather than `kolu` because a cell named for its own
     *  appliance, composed under that appliance, would read
     *  `surface/kolu/kolu/get` — the word twice and the thing once. */
    readonly link: {
      use: () => { readonly value: Accessor<KoluLink | undefined> }
    }
    /** The pill's liveness cell — the beat the watcher last stamped, or
     *  `null` before the boot pulse is ever read. */
    readonly pulse: {
      use: () => { readonly value: Accessor<WatchPulse | null | undefined> }
    }
    /** The drawer's foot — which file decides the watch. */
    readonly knobs: {
      use: () => { readonly value: Accessor<KoluKnobs | undefined> }
    }
  }
  readonly collections: {
    readonly fleet: { use: () => { readonly fold: unknown } }
    /** The watcher's ring — added with events, so a hand-built mock from
     *  before them must say so at the type level rather than draw a feed
     *  off nothing. */
    readonly events: { use: () => { readonly fold: unknown } }
  }
  readonly procedures: {
    /** The screen read. The MOUNT renames the procedure and stops there: the
     *  verb underneath is still `text`, because a verb is addressed within its
     *  procedure and never collides with another plugin's. */
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
        link: props.client.cells.link.use().value,
        pulse: props.client.cells.pulse.use().value,
        knobs: props.client.cells.knobs.use().value,
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
