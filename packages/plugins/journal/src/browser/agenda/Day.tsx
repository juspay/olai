import { isOverdue, owedFact, type Standing } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { createMemo, Show } from "solid-js"

import { CRUMB } from "olai-plugin-outlines/chrome"
import { DayNode } from "../day/DayNode.tsx"
import { placeOf } from "../day/place.ts"
import { useNarrowed } from "olai-plugin-outlines/filter"
const unfiltered = (view: ReturnType<typeof useNarrowed>) => !view.active()
import { Link } from "olai-plugin-navigation/routing"
import { TESTID } from "../../testids.ts"
import { useToday } from "../clock.ts"
import {
  QUIET_INDENT,
  SPINE_CELL,
  SPINE_DOT,
  SPINE_INDENT,
  SPINE_LINE,
  SPINE_NOW,
} from "./gutter.ts"
import { inkOf, lineOf, NOW_RING, type Rung, rowsOn } from "./spine.ts"
import { dayRoute } from "../routes.ts"

interface Face {
  readonly heading: string
  readonly lead: string
  readonly dot: string
  readonly ring: string | undefined
  readonly distance: "leads" | "beside"
}

const FACE: Record<Standing, Face> = {
  late: {
    heading: "text-label font-semibold text-alarm",
    lead: "",
    dot: SPINE_DOT,
    ring: undefined,
    distance: "leads",
  },
  today: {
    heading: "text-caption font-semibold text-accent",
    lead: "uppercase tracking-[0.08em]",
    dot: SPINE_NOW,
    ring: NOW_RING,
    distance: "leads",
  },
  ahead: {
    heading: "text-label font-semibold text-ink",
    lead: "",
    dot: SPINE_DOT,
    ring: undefined,
    distance: "beside",
  },
}

export function Day(props: {
  readonly rung: Rung
}) {
  const felt = () => props.rung.felt
  const face = (): Face => FACE[felt().standing]
  const today = useToday()
  const narrowed = useNarrowed()
  const rows = createMemo(() => rowsOn(props.rung.day))
  const leads = (): string | undefined =>
    face().distance === "leads" ? felt().distance : undefined
  const gloss = (): string | undefined =>
    face().distance === "beside" ? felt().distance : undefined

  return (
    // `flow-root`: a row carries its own bottom margin, and the last one in a
    // day would otherwise collapse THROUGH this box and out of it, leaving the
    // section shorter than its content and the line broken between days.
    <section
      class="relative flow-root"
      data-testid={TESTID.agendaDay}
      data-date={props.rung.day.date}
      data-when={felt().standing}
    >
      <span aria-hidden="true" class={SPINE_LINE} style={{ background: lineOf(props.rung) }} />

      <div class="relative" style={{ height: `${props.rung.quiet.space}rem` }}>
        <Show when={props.rung.quiet.label}>
          {(label) => (
            <span
              class={`${QUIET_INDENT} text-caption italic text-muted opacity-60`}
              data-testid={TESTID.agendaQuiet}
              data-days={String(props.rung.quiet.days)}
            >
              {label()}
            </span>
          )}
        </Show>
      </div>

      <div style={{ opacity: String(felt().fade) }}>
        <h2 class="m-0 mb-1.5 flex items-center">
          <span class={SPINE_CELL} aria-hidden="true">
            <span
              class={face().dot}
              // An absent ring is an absent declaration: Solid drops a style
              // whose value is `undefined`, so the two faces need no branch.
              style={{ background: inkOf(felt().tone), "box-shadow": face().ring }}
            />
          </span>
          <span class="flex min-w-0 items-baseline gap-2">
            <Link
              route={dayRoute(props.rung.day.date)}
              class={`${CRUMB} ${face().heading}`}
            >
              {/* The crumb is an `inline-flex`, and a bare " · " beside the
                  word would become a flex item of its own with its spaces
                  trimmed off. Inside a normal inline box the separator keeps
                  the spaces it was written with. */}
              <span>
                <Show when={leads()}>
                  {(word) => (
                    <>
                      <span class={face().lead}>{word()}</span>
                      {" · "}
                    </>
                  )}
                </Show>
                {felt().calendar}
              </span>
            </Link>
            <Show when={gloss()}>
              {(distance) => (
                <span class="shrink-0 text-caption text-muted">
                  {distance()}
                </span>
              )}
            </Show>
          </span>
        </h2>

        <Show
          when={rows().length > 0}
          fallback={
            <Show when={unfiltered(narrowed)}>
              <p class={`m-0 ${SPINE_INDENT} text-label italic text-muted opacity-80`}>
                Nothing due today
              </p>
            </Show>
          }
        >
          <ul class={`m-0 list-none p-0 ${SPINE_INDENT}`}>
            <Key each={rows()} by={placeOf}>
              {(dated) => (
                <DayNode
                  dated={dated()}
                  trail="under"
                  pill={owedFact(
                    dated().date,
                    isOverdue(dated().shows.node, today()),
                    felt(),
                  )}
                />
              )}
            </Key>
          </ul>
        </Show>
      </div>
    </section>
  )
}
