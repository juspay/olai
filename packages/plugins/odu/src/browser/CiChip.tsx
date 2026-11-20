import { createMemo } from "solid-js"

import { createEffect, Show } from "solid-js"

import { type CiRun, liveOf } from "olai-plugin-odu/appliance/wire"

import { TESTID } from "../testids.ts"
import { useClocks } from "./clocks.tsx"
import type { ChipContext } from "./app.ts"
import { useRuns } from "./runs.tsx"
import { runningIn, type CiTone, wordsFor } from "./words.ts"
import { Tip } from "@olai/web/client/Tip.tsx"

const CHIP =
  "inline-flex min-w-0 max-w-full shrink-0 items-baseline gap-1 rounded-full border px-2 py-px text-label tabular-nums"

const TONE: Record<CiTone, string> = {
  going: "border-accent/20 bg-accent/10 text-accent",
  ok: "border-rule bg-panel text-done",
  red: "border-alarm/40 bg-alarm/10 text-alarm",
  quiet: "border-rule bg-desk text-muted",
}

export function CiChip(context: ChipContext) {
  const runs = useRuns()
  const run = () => runs.runOf(context.entry.value)
  const started = (): number | null => {
    const held = run()
    if (held === undefined || !liveOf(held.state)) return null
    return runningIn(held)?.startedAt ?? null
  }
  const clocks = useClocks()
  const now = clocks.createNow(started)
  closeWithTheRow(run, context)
  return (
    <Show when={run()}>
      {(held) => {
        const said = createMemo(() => wordsFor(held(), now(), clocks.tickingOf))
        return (
        <Show
          when={context.onToggle}
          fallback={
            <Tip text={said().title} say>
              <span
                class={`${CHIP} ${TONE[said().tone]}`}
                data-testid={TESTID.ciChip}
                data-state={said().tone}
                data-run={context.entry.value}
              >
                {said().text}
              </span>
            </Tip>
          }
        >
          {(toggle) => (
            <Tip text={`${said().title} · Show all runs`}>
              <button
                type="button"
                class={`${CHIP} ${TONE[said().tone]} cursor-pointer`}
                data-testid={TESTID.ciChip}
                data-state={said().tone}
                data-run={context.entry.value}
                data-open={context.opened ? "yes" : "no"}
                onClick={(event) => {
                  event.stopPropagation()
                  toggle()()
                }}
              >
                {said().text}<span class="sr-only"> — {said().title} · show all runs</span>
              </button>
            </Tip>
          )}
        </Show>
        )
      }}
    </Show>
  )
}

const closeWithTheRow = (
  run: () => CiRun | undefined,
  context: ChipContext,
): void => {
  createEffect(() => {
    if (run() === undefined && context.opened) context.onToggle?.()
  })
}
