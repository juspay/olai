import { Row } from "@olai/ui-primitives/SettingRow.tsx"
import { Switch } from "@olai/ui-primitives/Switch.tsx"
import { TESTID } from "@olai/ui-primitives/testids.ts"
import type { Channel } from "olai-plugin-alerts/contract"
import type { RemindersState } from "./said.ts"

export function ReminderRow(props: { readonly channel: Channel; readonly state: RemindersState }) {
  return <Row label="Reminders" pref="reminders" hint="A daily summary of what's due">
    <Switch label="Reminders" on={props.state.on()} frozen={!props.channel.alertsOn()} testid={TESTID.prefsSwitch}
      onPick={value => props.state.setOn(value === "on")} />
  </Row>
}
