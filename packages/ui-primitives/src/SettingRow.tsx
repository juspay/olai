/**
 * One preference: what it is called, and the control that sets it — on one
 * line, the way a system settings pane draws it.
 *
 * A LINE UNDER IT IS THE EXCEPTION. Every row used to carry a paragraph read
 * off the choice in force, and a panel of eight paragraphs is a manual rather
 * than a settings pane. What is left is at most one short quiet line
 * ({@link Row.hint}) where the label alone does not say what the control does,
 * and conditional news (`under`) drawn only while it applies.
 *
 * ## THE SOURCE LINE AND THE FREEZE ARE TWO PROPS
 *
 * {@link Row.setBy} says WHERE the choice in force came from when it was not
 * this browser, and {@link Row.frozen} carries the DOM claim that the control
 * will not move (`data-pinned`). They are separate because a row can have a
 * source and still be pressable. `aria-describedby` is keyed on the WORDS.
 */
import { TESTID } from "@olai/ui-primitives/testids.ts"
import { type JSX, Show } from "solid-js"

export function Row(props: {
  /** What this preference is called, and the accessible name of the group of
   *  controls beside it. */
  readonly label: string
  /** The choice in force, drawn once, quietly, beside the label — for a
   *  control that does not spell its own value out (the theme swatches). */
  readonly value?: string
  /** One short quiet line under the label (under about 60 characters), only
   *  where the label does not already say what the control does. Absent draws
   *  nothing. */
  readonly hint?: string | null
  /** Which preference this is, for a scenario that has to find one row. */
  readonly pref: string
  /** WHERE the choice in force came from, when it was not this browser. */
  readonly setBy?: string
  /** WHETHER THE CONTROL WILL MOVE — `data-pinned` for the suite. */
  readonly frozen?: boolean
  /** The control on its own line under the label rather than beside it — for
   *  a control too wide to share a line (a row of swatches). */
  readonly stacked?: boolean
  /** Conditional news under the row — an Allow button, a warning — rendered
   *  bare; the caller owns its spacing and draws nothing when it has nothing. */
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
      class="py-2"
      data-testid={TESTID.prefsRow}
      data-pref={props.pref}
      data-pinned={props.frozen ? "true" : undefined}
    >
      <div
        class={props.stacked
          ? "flex flex-col gap-2.5"
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
