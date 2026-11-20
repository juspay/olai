import { TESTID } from "@olai/ui-primitives/testids.ts"
import { type JSX, Show } from "solid-js"

export function Row(props: {
  readonly label: string
  readonly value?: string
  readonly hint?: string | null
  readonly pref: string
  readonly setBy?: string
  readonly frozen?: boolean
  readonly stacked?: boolean
  readonly under?: JSX.Element
  readonly children: JSX.Element
}) {
  const saidId = (): string => `prefs-set-by-${props.pref}`

  const label = (
    <div class="min-w-0 flex-1">
      <div class="flex items-baseline gap-2">
        <span class="text-body text-ink">{props.label}</span>
        <Show when={props.value}>
          {(value) => <span class="truncate text-label capitalize text-muted" data-testid={TESTID.prefsValue}>{value()}</span>}
        </Show>
      </div>
      <Show when={props.hint}>
        {(said) => (
          <p class="mt-0.5 text-label leading-snug text-muted" data-testid={TESTID.prefsHint}>
            {said()}
          </p>
        )}
      </Show>
    </div>
  )

  return (
    <div
      class="py-1 md:py-2"
      data-testid={TESTID.prefsRow}
      data-pref={props.pref}
      data-pinned={props.frozen ? "true" : undefined}
    >
      <div
        class={props.stacked
          ? "flex flex-col gap-1.5 md:gap-2.5"
          : "flex min-h-11 items-center justify-between gap-4 md:min-h-8"}
      >
        {label}
        <div
          class={`flex min-w-0 flex-wrap items-center gap-1 ${props.stacked ? "md:gap-1.5" : "shrink-0 justify-end"}`}
          role="group"
          aria-label={props.label}
          aria-describedby={props.setBy ? saidId() : undefined}
        >
          {props.children}
        </div>
      </div>
      <Show when={props.setBy}>
        {(said) => (
          <p id={saidId()} class="mt-1 text-label leading-snug text-muted" data-testid={TESTID.prefsSetBy}>
            {said()}
          </p>
        )}
      </Show>
      {props.under}
    </div>
  )
}
