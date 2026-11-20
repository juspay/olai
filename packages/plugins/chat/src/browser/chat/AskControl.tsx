import { type AskField, YES_NO } from "@kolu/acp/wire"
import { Key } from "@solid-primitives/keyed"
import { Match, Show, Switch } from "solid-js"

import { TESTID } from "../../testids.ts"

const BOOLEAN = [
  { value: YES_NO.yes, label: "Yes" },
  { value: YES_NO.no, label: "No" },
]

export function AskControl(props: {
  readonly field: AskField
  readonly values: ReadonlyArray<string>
  readonly disabled: boolean
  readonly onChange: (values: ReadonlyArray<string>) => void
}) {
  const picked = (value: string) => props.values.includes(value)

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
          step={props.field.kind === "integer" ? 1 : undefined}
          class="w-full rounded-control border border-rule bg-paper px-2 py-1.5 text-body outline-none focus:border-accent disabled:text-muted"
          data-testid={TESTID.chatAskText}
          data-field={props.field.key}
          placeholder={props.field.attachedTo === null
            ? undefined
            : props.field.label ?? "Something else"}
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
      <Key each={props.choices} by="value">
        {(choice) => (
          <button
            type="button"
            class={`min-h-11 rounded-control border px-2 py-1 text-left text-body ${
              props.picked(choice().value)
                ? "border-accent text-accent"
                : "border-rule text-ink hover:border-accent"
            } disabled:hover:border-rule`}
            data-testid={TESTID.chatAskChoice}
            data-value={choice().value}
            aria-pressed={props.picked(choice().value)}
            disabled={props.disabled}
            onClick={() => props.onPick(choice().value, props.many)}
          >
            <span class="block">{choice().label}</span>
            <Show when={choice().hint}>
              {(hint) => <span class="block text-label text-muted">{hint()}</span>}
            </Show>
          </button>
        )}
      </Key>
    </div>
  )
}
