import { type Agenda, nothingDue } from "@olai/format"
import { Show } from "solid-js"

import { Empty } from "@olai/web/client/Empty.tsx"
import { useNarrowed } from "olai-plugin-outlines/filter"
const unfiltered = (view: ReturnType<typeof useNarrowed>) => !view.active()
import { PAGE_TITLE } from "@olai/web/client/look.ts"
import { TESTID } from "../../testids.ts"
import { Spine } from "./Spine.tsx"

export function AgendaPage(props: {
  readonly agenda: Agenda
  readonly today: string
}) {
  const narrowed = useNarrowed()
  const nothing = () => nothingDue(props.agenda)

  return (
    <section data-testid={TESTID.agendaPage} data-date={props.today}>
      <header class="mb-10 flex items-baseline gap-3">
        <h1 class={`${PAGE_TITLE} italic`}>Agenda</h1>
        <span class="text-body text-muted tabular-nums">{props.today}</span>
      </header>

      <Show when={unfiltered(narrowed) && nothing()}>
        <Empty testid={TESTID.agendaEmpty} line="Nothing due" detail="Rows with a date show up here." />
      </Show>

      <Show when={!nothing()}>
        <Spine agenda={props.agenda} today={props.today} />
      </Show>
    </section>
  )
}
