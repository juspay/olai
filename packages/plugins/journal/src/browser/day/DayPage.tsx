import type { DayGroup } from "@olai/format"
import { For, Show } from "solid-js"

import { useNarrowed } from "olai-plugin-outlines/filter"
const unfiltered = (view: ReturnType<typeof useNarrowed>) => !view.active()
import { PAGE_TITLE } from "@olai/web/client/look.ts"
import { TESTID } from "../../testids.ts"
import { DayGroups } from "./DayGroups.tsx"
import { DayMint } from "./DayMint.tsx"
import { DayNote } from "./DayNote.tsx"

export function DayPage(props: {
  readonly date: string
  readonly groups: ReadonlyArray<DayGroup>
  readonly drawnNotes: ReadonlyArray<string>
  readonly hasNote: boolean
  readonly today: string
}) {
  const narrowed = useNarrowed()
  return (
    <section data-testid={TESTID.dayPage} data-date={props.date}>
      <header class="mb-8 flex items-baseline justify-between gap-4">
        <div class="flex items-baseline gap-2">
          <h1 class={`${PAGE_TITLE} tabular-nums`}>{props.date}</h1>
          <Show when={props.date === props.today}>
            <span class="text-body text-accent">Today</span>
          </Show>
        </div>
        <Show when={!props.hasNote}>
          <DayMint date={props.date} />
        </Show>
      </header>

      <For each={props.drawnNotes}>{(file) => <DayNote file={file} />}</For>

      <Show
        when={unfiltered(narrowed) && props.groups.length === 0 &&
          props.drawnNotes.length === 0}
      >
        <p class="text-muted" data-testid={TESTID.dayEmpty}>
          {props.date === props.today
            ? "Nothing is on today."
            : `Nothing is on ${props.date}.`}
        </p>
      </Show>

      <DayGroups groups={props.groups} heading="h2" />
    </section>
  )
}
