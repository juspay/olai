import { TESTID } from "./testids.ts"
import { Show } from "solid-js"
import type { Channel } from "./contract.ts"
import { Row } from "@olai/ui-primitives/SettingRow.tsx"
import { Switch } from "@olai/ui-primitives/Switch.tsx"
import { TESTID as PRIMITIVES } from "@olai/ui-primitives/testids.ts"
import { TARGET } from "@olai/ui-primitives/touch.ts"

export function AlertRows(props: { readonly channel: Channel }) {
  return <>
    <Row label="Alerts" pref="alerts" hint={alertsHint(props.channel)} under={<AllowNotify channel={props.channel} />}>
      <Switch label="Alerts" on={props.channel.alertsOn()} testid={PRIMITIVES.prefsSwitch}
        onPick={(value) => props.channel.setAlertsOn(value === "on")} />
    </Row>
    <Row label="Sound" pref="alert-sound">
      <Switch label="Sound" on={props.channel.alertSoundOn()} frozen={!props.channel.alertsOn()} testid={PRIMITIVES.prefsSwitch}
        onPick={(value) => props.channel.setAlertSoundOn(value === "on")} />
    </Row>
  </>
}

function AllowNotify(props: { readonly channel: Channel }) {
  return (
    <Show when={props.channel.alertsOn() && props.channel.consent() === "default"}>
      <button
        type="button"
        class={`${TARGET} mb-1 mt-1.5 rounded-full border border-rule px-3 text-label text-ink hover:border-accent [--olai-ring-radius:9999px] md:min-h-0 md:py-1`}
        data-testid={TESTID.prefsAllowNotify}
        onClick={() => void props.channel.ask(true)}
      >
        Allow notifications
      </button>
    </Show>
  )
}

const alertsHint = ({ alertsOn, consent: notifyConsent }: Channel): string => {
  if (alertsOn()) {
    switch (notifyConsent()) {
      case "denied":
        return "Notifications are blocked in this browser"
      case "unsupported":
        return "This browser can't show notifications"
    }
  }
  return "When the agent needs you"
}
