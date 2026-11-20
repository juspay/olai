import { For, Show } from "solid-js"
import { NO_ROSTER } from "@olai/surface"
import type { BrowserManagement } from "@olai/surface/management"
import { Row } from "@olai/ui-primitives/SettingRow.tsx"
import { Control } from "./contracts/Control.tsx"
import { knobFrozen, labelOf, promotedValues, rowValues } from "./rows.ts"

export function PromotedRows(props: {
  readonly plugin: string
  readonly management: BrowserManagement
}) {
  const roster = props.management.roster()
  const plugin = () => (roster() ?? NO_ROSTER).built.find((one) => one.name === props.plugin)
  const values = () => {
    const row = plugin()
    return row === undefined ? [] : promotedValues(rowValues(row))
  }
  const frozen = () => knobFrozen(roster() ?? NO_ROSTER, props.management.changing())
  return (
    <Show when={plugin()?.running === true}>
      <For each={values().map((one) => one.key)}>{key => {
        const value = () => values().find((one) => one.key === key)!
        return (
          <Row label={labelOf(key)} pref={`plugin-${props.plugin}-${key}`} frozen={frozen() !== undefined}>
            <Control name={props.plugin} value={value()} configure={props.management.configure} frozen={frozen()} label={false} />
          </Row>
        )
      }}</For>
    </Show>
  )
}
