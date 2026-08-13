/**
 * One field of a question, as the control it asks for.
 *
 * Six kinds and two shapes: something to PICK (a single choice, several
 * choices, yes or no) and something to TYPE (free text, a number). Everything
 * pickable is a row of tappable chips rather than a `<select>` or a radio
 * group, for the reason the panel is a 26rem column beside a page and is also a
 * bottom sheet under a thumb: the options are the question, they should be
 * readable without opening anything, and each of them has to be 44px of target.
 *
 * `yes`/`no` is a pair of those chips rather than a checkbox on purpose. A
 * checkbox has two states and the field has three — yes, no, and nobody said —
 * and the third is the one that matters here: an unanswered boolean must not
 * arrive at the agent as a `false` somebody never chose.
 *
 * The control never decides anything. It reads the values it is given and
 * reports the values it would become, so the same component draws a live field,
 * a field being filled in, and the disabled record of one that was answered
 * three turns ago.
 */

import { type AskField, YES_NO } from "@olai/surface"
import { For, Match, Show, Switch } from "solid-js"

import { CARD, LIFT, PICKED, WELL } from "../surface.ts"
import { TESTID } from "../testids.ts"

/** Yes and no, as the two choices they are. The VALUES are the surface's, not
 *  ours: the far end reads them back into an actual boolean, so a spelling the
 *  two ends agreed by comment is one that eventually stops agreeing — silently,
 *  because a word that no longer matches just stops registering. */
const BOOLEAN = [
  { value: YES_NO.yes, label: "yes" },
  { value: YES_NO.no, label: "no" },
]

export function AskControl(props: {
  readonly field: AskField
  /** What is picked or typed right now. */
  readonly values: ReadonlyArray<string>
  readonly disabled: boolean
  readonly onChange: (values: ReadonlyArray<string>) => void
}) {
  const picked = (value: string) => props.values.includes(value)

  /** A chip pressed: the only one for a single choice, one more or one fewer
   *  for a multi-select. Pressing the picked one again clears it — a question
   *  nothing is required by can be un-answered, and the alternative is a choice
   *  you cannot take back once you have touched it. */
  const toggle = (value: string, many: boolean) => {
    if (!many) {
      props.onChange(picked(value) ? [] : [value])
      return
    }
    props.onChange(
      picked(value)
        ? props.values.filter((each) => each !== value)
        : [...props.values, value],
    )
  }

  return (
    <Switch>
      <Match when={props.field.kind === "choice" || props.field.kind === "choices"}>
        <Chips
          choices={props.field.choices}
          many={props.field.kind === "choices"}
          picked={picked}
          disabled={props.disabled}
          onPick={toggle}
        />
      </Match>

      <Match when={props.field.kind === "boolean"}>
        <Chips
          choices={BOOLEAN.map((option) => ({ ...option, hint: null }))}
          many={false}
          picked={picked}
          disabled={props.disabled}
          onPick={toggle}
        />
      </Match>

      <Match when={true}>
        <input
          type={props.field.kind === "text" ? "text" : "number"}
          // A whole number is asked for with the browser's own stepper rather
          // than with a message after the fact; the server checks it again,
          // because an input's `step` is a hint and not a gate.
          step={props.field.kind === "integer" ? 1 : undefined}
          // A BOX TO TYPE IN IS A WELL (`../surface.ts`): a field is a hollow in
          // the surface holding it, which is what an input has looked like off a
          // screen for a hundred years and what the hairline rectangle was
          // standing in for. Focus fills the well's own edge with the accent.
          class={`w-full rounded-lg ${WELL} px-2.5 py-1.5 text-sm outline-none focus:inset-ring-2 focus:inset-ring-accent disabled:text-muted`}
          data-testid={TESTID.chatAskText}
          data-field={props.field.key}
          placeholder={props.field.attachedTo === null
            ? undefined
            : props.field.label ?? "something else"}
          aria-label={props.field.label ?? props.field.key}
          disabled={props.disabled}
          value={props.values[0] ?? ""}
          onInput={(event) => props.onChange([event.currentTarget.value])}
        />
      </Match>
    </Switch>
  )
}

function Chips(props: {
  readonly choices: ReadonlyArray<{
    readonly value: string
    readonly label: string
    readonly hint?: string | null
  }>
  readonly many: boolean
  readonly picked: (value: string) => boolean
  readonly disabled: boolean
  readonly onPick: (value: string, many: boolean) => void
}) {
  return (
    <div class="flex flex-wrap gap-1.5">
      <For each={props.choices}>
        {/* An option LOOKS LIFTABLE and, once taken, looks taken: it lifts a
            pixel under the pointer, and the one that was chosen fills with the
            accent tint and takes the accent ring (`../surface.ts`). Both are the
            depth grammar rather than this control's invention — what changed
            here is that a chip no longer says "pickable" with a hairline round
            it, which on fifteen palettes said it fifteen different amounts. */}
        {(choice) => (
          <button
            type="button"
            class={`min-h-11 rounded-xl px-3 py-1.5 text-left text-sm ${
              props.picked(choice.value)
                ? `${PICKED} font-semibold text-accent`
                : `${CARD} ${LIFT} text-ink`
            }`}
            data-testid={TESTID.chatAskChoice}
            data-value={choice.value}
            aria-pressed={props.picked(choice.value)}
            disabled={props.disabled}
            onClick={() => props.onPick(choice.value, props.many)}
          >
            <span class="block">{choice.label}</span>
            {/* The option's own second line, when the agent wrote one. Dim and
                under the label rather than in a `title`: what an option MEANS
                is most of what a person is choosing between, and hover is not
                something a thumb has. */}
            <Show when={choice.hint}>
              {(hint) => <span class="block text-xs text-muted">{hint()}</span>}
            </Show>
          </button>
        )}
      </For>
    </div>
  )
}
