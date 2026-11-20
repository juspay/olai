import { TESTID } from "@olai/ui-primitives/testids.ts"
import { For } from "solid-js"


import { TARGET } from "@olai/ui-primitives/touch.ts"

export interface Choice<T extends string> {
  readonly value: T
  readonly label: string
}

export const SEGMENT =
  `${TARGET} olai-segment inline-flex items-center px-3 text-label [--olai-ring-offset:-2px] md:min-h-0 md:py-1`

export const SEGMENT_IN_FORCE = "bg-accent/10 text-ink"

export const SEGMENT_STRIP = "inline-flex overflow-hidden rounded-full border border-rule"

export function Segmented<T extends string>(props: {
  readonly choices: ReadonlyArray<Choice<T>>
  readonly value: T
  readonly onPick?: (value: T) => void
  readonly frozen?: boolean
}) {
  const frozen = (): boolean => props.frozen === true
  const isInForce = (value: T): boolean => props.value === value

  return (
    <div class={`${SEGMENT_STRIP} ${frozen() ? "opacity-60" : ""}`}>
      <For each={props.choices}>
        {(choice) => (
          <button
            type="button"
            class={`${SEGMENT} ${
              isInForce(choice.value)
                ? SEGMENT_IN_FORCE
                : `text-muted ${frozen() ? "" : "hover:text-ink"}`
            }`}
            data-testid={TESTID.prefsChoice}
            data-value={choice.value}
            aria-pressed={isInForce(choice.value) ? "true" : "false"}
            aria-disabled={frozen() ? true : undefined}
            onClick={() => {
              if (!frozen()) props.onPick?.(choice.value)
            }}
          >
            {choice.label}
          </button>
        )}
      </For>
    </div>
  )
}
