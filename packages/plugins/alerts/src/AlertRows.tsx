/**
 * The alerts rows own both controls; preferences supplies their location.
 * Two independent choices shared by chat and journal: being told, and being
 * told audibly. Sound sits under Alerts and is frozen, rather than hidden,
 * with Alerts off — the switch above it says why.
 */
import { TESTID } from "./testids.ts"
import { Show } from "solid-js"
import type { Channel } from "./contract.ts"
import { Row } from "@olai/ui-primitives/SettingRow.tsx"
import { Switch } from "@olai/ui-primitives/Switch.tsx"
import { TESTID as PRIMITIVES } from "@olai/ui-primitives/testids.ts"
import { TARGET } from "@olai/ui-primitives/touch.ts"

export function AlertRows(props: { readonly channel: Channel }) {
  const { alertsOn, alertSoundOn, setAlertsOn, setAlertSoundOn } = props.channel
  return <>
    <Row label="Alerts" pref="alerts" hint={alertsHint(props.channel)} under={<AllowNotify channel={props.channel} />}>
      <Switch label="Alerts" on={alertsOn()} testid={PRIMITIVES.prefsSwitch}
        onPick={(value) => setAlertsOn(value === "on")} />
    </Row>
    <Row label="Sound" pref="alert-sound">
      <Switch label="Sound" on={alertSoundOn()} frozen={!alertsOn()} testid={PRIMITIVES.prefsSwitch}
        onPick={(value) => setAlertSoundOn(value === "on")} />
    </Row>
  </>
}

/**
 * THE ONE GESTURE THAT CAN RAISE THE PERMISSION PROMPT, on the row it belongs
 * to. Alerts are on by default, so there is no "first enable" press for the
 * browser's prompt to ride, and Firefox and Safari refuse a prompt raised from
 * a background event (`./notify.ts`). So this is the door that always works —
 * drawn only while it can help: alerts on, and a browser that has neither
 * granted nor refused. Once refused, only the browser's own settings can undo
 * it, and a button here would do nothing.
 */
function AllowNotify(props: { readonly channel: Channel }) {
  const { alertsOn, consent: notifyConsent, ask: askToNotify } = props.channel
  return (
    <Show when={alertsOn() && notifyConsent() === "default"}>
      <button
        type="button"
        class={`${TARGET} mb-1 mt-1.5 rounded-full border border-rule px-3 text-label text-ink hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-h-0 md:py-1`}
        data-testid={TESTID.prefsAllowNotify}
        onClick={() => void askToNotify(true)}
      >
        Allow notifications
      </button>
    </Show>
  )
}

/** The one line under Alerts: what it is for, or — only while it applies —
 *  why the browser will not show the banner. */
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
