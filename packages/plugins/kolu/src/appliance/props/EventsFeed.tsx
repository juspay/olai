import { createMemo } from "solid-js"

import { For, type JSX, Show } from "solid-js"

import { StatePip } from "@kolu/solid-statepip"
import { RowLabel } from "@kolu/solid-dockrow"
import { narrowRowVocab } from "@kolu/solid-dockrow/rowValues"
import { Tip } from "@olai/web/client/Tip.tsx"

import type { KoluEvent } from "olai-plugin-kolu/appliance/wire"

import { eventLine } from "../padi/events.ts"
import { padiSaid } from "../padi/said.ts"
import { TESTID } from "../../contracts/appliance-testids.ts"
import { useFleet } from "./fleet.tsx"

export function EventRow(props: {
  readonly event: KoluEvent
  readonly now: () => number
}): JSX.Element {
  const line = createMemo(() => eventLine(props.event, props.now()))
  const row = () => props.event.row
  const vocab = () =>
    row() === null ? undefined : narrowRowVocab({ pip: row()!.pip, bucket: row()!.bucket })
  const about = () => line().about
  return (
    <li
      data-testid={TESTID.eventsRow}
      data-kind={props.event.kind}
      data-asking={line().asking}
    >
      <Tip text={about() ?? ""} disabled={about() === undefined}>
        {row() === null
          ? (
            <div class="flex items-baseline gap-2">
              <span class="shrink-0 text-caption text-muted" aria-hidden="true">
                ⌁
              </span>
              <span class="min-w-0 flex-1 text-caption text-muted">{line().words}</span>
              <span class="shrink-0 text-caption text-muted">{line().age}</span>
            </div>
          )
          : (
            <div class="flex gap-1.5">
              <span class="mt-0.5 inline-flex shrink-0 items-start">
                <Show when={vocab()}>
                  {(v) => (
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
                  <RowLabel
                    markdown={line().who === "" ? props.event.row!.terminal : line().who}
                    render={(markdown) => markdown}
                    class="min-w-0 text-body leading-4"
                    color={line().labelColor === ""
                      ? undefined
                      : line().labelColor}
                  />
                  <span class="ml-auto shrink-0 text-caption text-muted">
                    {line().age}
                  </span>
                </div>
                <div class="text-caption text-muted" data-testid={TESTID.eventsWords}>
                  {line().words}
                </div>
              </div>
            </div>
          )}
        <Show when={about()}>{(said) => <span class="sr-only">{said()}</span>}</Show>
      </Tip>
    </li>
  )
}

export function EventsFeed(): JSX.Element {
  const fleet = useFleet()
  const events = createMemo(() => [...fleet.events().values()].reverse().filter((e) => e.kind !== "heartbeat"))
  return (
    <Show
      when={events().length !== 0}
      fallback={
        <p class="text-body text-muted" data-testid={TESTID.eventsEmpty}>
          {padiSaid(fleet.link()).detail}
        </p>
      }
    >
      <ol
        class="flex flex-col gap-2"
        data-testid={TESTID.eventsFeed}
        aria-label="Recent activity"
      >
        <For each={events()}>
          {(event) => <EventRow event={event} now={() => fleet.now()} />}
        </For>
      </ol>
    </Show>
  )
}
