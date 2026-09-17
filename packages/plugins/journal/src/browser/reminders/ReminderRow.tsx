import { Row } from "@olai/ui-primitives/SettingRow.tsx"
import { Segmented } from "@olai/ui-primitives/Segmented.tsx"
import type { Channel } from "olai-plugin-alerts/contract"
import type { RemindersState } from "./said.ts"

const choices = [{ value: "off", label: "Off" }, { value: "on", label: "On" }] as const
export function ReminderRow(props: { readonly channel: Channel; readonly state: RemindersState }) {
  const hint = () => !props.channel.alertsOn()
    ? "Alerts are off, so nothing will remind you."
    : props.state.on()
      ? "Once a day, a notification says what is overdue and on today, with a chime if you have clicked the page since it opened."
      : "Nothing says the day has work on it. The Agenda entry still shows it."
  return <Row label="Reminders" pref="reminders" hint={hint()}>
    <Segmented choices={choices} value={props.state.on() ? "on" : "off"}
      onPick={value => props.state.setOn(value === "on")} frozen={!props.channel.alertsOn()} />
  </Row>
}
