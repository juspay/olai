import { type Accessor, createSignal } from "solid-js"

import { createDrags, TRAVEL_PX } from "@olai/web/client/pointer.ts"
import { type Line, measureLines } from "./lines.ts"
import { planSweep, type Run, type Sweep } from "./sweep.ts"

export const SWEEP = "data-sweep"

export interface Sweeping {
  readonly band: Accessor<Sweep | null>
  readonly begin: (event: PointerEvent) => void
}

interface Picked {
  readonly keys: Accessor<ReadonlySet<string>>
  readonly across: (keys: Iterable<string>, from: string, to: string) => void
  readonly clear: () => void
}

export const createSweeping = (
  selection: Picked,
  page: () => Element | undefined,
): Sweeping => {
  const [band, setBand] = createSignal<Sweep | null>(null)
  const drags = createDrags()

  const begin = (event: PointerEvent): void => {
    if (event.button !== 0 || event.pointerType === "touch") return
    const on = event.target
    if (!(on instanceof Element) || !on.hasAttribute(SWEEP)) return
    if (selection.keys().size > 0) selection.clear()

    const from = event.pageY
    let rows: ReadonlyArray<Line> = []
    let told: Run | null = null

    const plan = (y: number): void => {
      const next = planSweep(rows, from, y)
      setBand(next)
      const run = next?.run ?? null
      if (run?.from === told?.from && run?.to === told?.to) return
      told = run
      if (run === null) selection.clear()
      else selection.across(run.keys, run.from, run.to)
    }
    drags.start(event, {
      threshold: TRAVEL_PX,
      onStart: () => {
        const box = page()
        rows = box === undefined ? [] : measureLines(box)
      },
      onPage: (_x, y) => plan(y),
      onEnd: () => setBand(null),
    })
  }

  return { band, begin }
}
