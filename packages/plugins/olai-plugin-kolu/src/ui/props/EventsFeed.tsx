/**
 * THE EVENTS FEED — what recently wanted attention, as a log.
 *
 * The panel half of the Padi pill's press: the SERVER watches the fleet and
 * keeps a ring of what it saw (`@olai/kolu-client`'s `watch.ts`); this is
 * what a reader reads. It is a LOG, not a list of current affairs, and that
 * is the one rule every row obeys: a row is the frozen draw — its pip, its
 * label, its hold — at the moment the event fired. A terminal that found
 * its answer ten minutes ago still shows the ask it was; the draw moves on.
 *
 * What is read off the live fleet HERE is nothing. No second per-property
 * lookup, no re-folding of agent states: the event carries its own words
 * (`../padi/events.ts`), backed by the same narrowing the live door rows
 * use over the wire's frozen BAG, which is vocabulary rather than state —
 * the wire's `label` travels verbatim, the same line the live row draws.
 *
 * The subscription is `../fleet.tsx`'s own: the events fold is held by the
 * one provider, with every feed a reader off the context — the one log the
 * server keeps is the one the tab is subscribed to, which is also why an
 * empty FEED on a live wire is a healthy false: the ring is the server's,
 * and a fresh olai watching a watched vault answers from the one it runs.
 *
 * ATTENTION ONLY: the beat left this drawer. Liveness and the boot pulse
 * live on the pill (the wire's `pulse` cell — `@olai/kolu-client`'s
 * `watch.ts`); the rows here name a TERMINAL or they are nothing. The
 * single hinge that keeps it so is the one fold below the `useFleet()`
 * — and a reader served from an older ring eats heartbeats as silently
 * skipped rows, never as odd paint.
 */

import { For, type JSX, Show } from "solid-js"

import { StatePip } from "@kolu/solid-statepip"
import { RowLabel } from "@kolu/solid-dockrow"
import { narrowRowVocab } from "@kolu/solid-dockrow/rowValues"

import type { KoluEvent } from "@olai/kolu-client/wire"

import { eventLine } from "../padi/events.ts"
import { padiSaid } from "../padi/said.ts"
import { TESTID } from "../testids.ts"
import { useFleet } from "./fleet.tsx"

/**
 * THE ONE EVENT — the frozen draw.
 *
 * A row's pip is ASKED rather than recomputed: `narrowRowVocab` over the
 * frozen bag gives the StatePip everything typed, and the live flags are
 * what they were at fire time — the event's own wire record
 * (`@olai/kolu-client`'s `watch.ts`) has stamped `active` and `bytesLive`
 * false already, because a two-hour-old event flashing LIVE is a lie the
 * wire carries, not one the browser must see.
 */
export function EventRow(props: {
  readonly event: KoluEvent
  readonly now: () => number
}): JSX.Element {
  const line = () => eventLine(props.event, props.now())
  const row = () => props.event.row
  // THE NARROWING over the FROZEN bag — one fold, the same as the live
  // door's: the vocabulary on the wire is not typed until kolu's row package
  // says so, and the vocab the door reads is the vocab the feed reads.
  const vocab = () =>
    row() === null ? undefined : narrowRowVocab({ pip: row()!.pip, bucket: row()!.bucket })
  return (
    <li
      data-testid={TESTID.eventsRow}
      data-kind={props.event.kind}
      data-asking={line().asking}
      title={line().about ?? undefined}
    >
      {row() === null
        ? (
          // THE PULSE, in one line — see the fold for the sentence of a
          // watcher that has nothing else to say.
          <div class="flex items-baseline gap-2">
            <span class="shrink-0 text-[0.6875rem] text-muted" aria-hidden="true">
              ⌁
            </span>
            <span class="min-w-0 flex-1 text-[0.6875rem] text-muted">{line().words}</span>
            <span class="shrink-0 text-[0.6875rem] text-muted">{line().age}</span>
          </div>
        )
        : (
          <div class="flex gap-1.5">
            <span class="mt-0.5 inline-flex shrink-0 items-start">
              <Show when={vocab()}>
                {(v) => (
                  // The FROZEN bag, passed through whole — the wire's own
                  // active/bytesLive are already false, so motion folds to
                  // none and the pip is a memory rather than a flare.
                  <StatePip
                    variant={v().pip.variant}
                    glyph={v().pip.glyph}
                    motion={v().pip.motion}
                    bytesLive={v().pip.bytesLive}
                  />
                )}
              </Show>
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline gap-2">
                {/* THE WHO — `repo·label` in the Dock's own spelling, fed
                    from the fold's `who` (the frozen `label` alone is
                    what made three repos read `master` alike). */}
                <RowLabel
                  markdown={line().who === "" ? props.event.row!.terminal : line().who}
                  render={(markdown) => markdown}
                  class="min-w-0 text-[0.8125rem] leading-4"
                  color={line().labelColor === ""
                    ? undefined
                    : line().labelColor}
                />
                <span class="ml-auto shrink-0 text-[0.6875rem] text-muted">
                  {line().age}
                </span>
              </div>
              <div class="text-[0.6875rem] text-muted" data-testid={TESTID.eventsWords}>
                {line().words}
              </div>
            </div>
          </div>
        )}
    </li>
  )
}

/**
 * What the drawer says when there is nothing to say.
 *
 * DELIBERATELY a sentence and never a blank panel: the events the server
 * keeps are short-lived memory, and a fresh server over a machine whose
 * terminals are all happy answers the same whether the watch is a minute
 * or a day old. One thing is always true and worth saying: that the
 * absence is an ABSENCE of memory rather than of machines (so the link's
 * own words say which, when a machine is there). The third case — the
 * quiet-and-broken one — stopped being a thing this drawer diagnoses: the
 * watcher itself answers on the pill's register.
 */
export function EventsFeed(): JSX.Element {
  const fleet = useFleet()
  // ATTENTION ONLY — the one knockout this drawer keeps (see the header).
  const events = () => [...fleet.events().values()].reverse().filter((e) => e.kind !== "heartbeat")
  return (
    <Show
      when={events().length !== 0}
      fallback={
        <p class="text-[0.8125rem] text-muted" data-testid={TESTID.eventsEmpty}>
          {padiSaid(fleet.link()).detail}
        </p>
      }
    >
      <ol
        class="flex flex-col gap-2"
        data-testid={TESTID.eventsFeed}
        aria-label="what recently wanted attention"
      >
        <For each={events()}>
          {(event) => <EventRow event={event} now={() => fleet.now()} />}
        </For>
      </ol>
    </Show>
  )
}
