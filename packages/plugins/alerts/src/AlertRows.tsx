/**
 * The alerts row owns both controls; preferences supplies their location.
 * Moved from chat when journal became a second consumer of the channel;
 * both consumers acquire alerts.channel on their components.
 */
import { TESTID } from "./testids.ts"
import { Show } from "solid-js"
import type { Channel } from "./contract.ts"
import { Row } from "@olai/ui-primitives/SettingRow.tsx"
import { Segmented } from "@olai/ui-primitives/Segmented.tsx"
import { TARGET } from "@olai/ui-primitives/touch.ts"



/** Off / On, for both alert rows — being told, and being told AUDIBLY. One
 *  constant because they are the same pair and a second name for it is a
 *  second thing to keep in step. */
const ALERT_CHOICES = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
] as const

export function AlertRows(props: { readonly channel: Channel }) {
  const { alertsOn, alertSoundOn, setAlertsOn, setAlertSoundOn } = props.channel
  return <>
      {/* Two independent choices shared by chat and journal: being told and
          being told audibly. Turning the chime off keeps the banner. Sound
          sits under Alerts and is frozen, rather than hidden, with Alerts off. */}
      <Row label="Alerts" pref="alerts" hint={alertsHint(props.channel)} under={<AllowNotify channel={props.channel} />}>
        <Segmented
          choices={ALERT_CHOICES}
          value={alertsOn() ? "on" : "off"}
          onPick={(value) => setAlertsOn(value === "on")}
        />
      </Row>

      <Row label="Alert sound" pref="alert-sound" hint={soundHint(props.channel)}>
        <Segmented
          choices={ALERT_CHOICES}
          value={alertSoundOn() ? "on" : "off"}
          onPick={(value) => setAlertSoundOn(value === "on")}
          frozen={!alertsOn()}
        />
      </Row>


  </>
}

/**
 * THE ONE GESTURE THAT CAN RAISE THE PERMISSION PROMPT, on the row it belongs
 * to.
 *
 * Alerts are on by default (ruled), so there is no "first enable" press for
 * the browser's own prompt to ride. The banner asks for itself the first time
 * it is actually wanted (`./notify.ts`) — which is the moment
 * the prompt's sentence is about something happening — but Firefox and Safari
 * both REFUSE a prompt raised from a background event, and a person who was
 * away when the question arrived is exactly the person that rule is about. So
 * this is the door that always works: a press, which is what those browsers
 * were holding out for.
 *
 * Drawn only while there is something for it to do — alerts on, and a browser
 * that has neither granted nor refused. A button offering to ask a question
 * that has been answered is a control with nothing to do.
 */
function AllowNotify(props: { readonly channel: Channel }) {
  const { alertsOn, consent: notifyConsent, ask: askToNotify } = props.channel
  return (
    <Show when={alertsOn() && notifyConsent() === "default"}>
      <button
        type="button"
        // `mt-2` here rather than on a wrapper in `@olai/ui-primitives/SettingRow.tsx`: the slot is
        // rendered bare, so a row whose button is not showing draws nothing at
        // all — see there.
        class={`${TARGET} mt-2 rounded-full border border-rule px-3 text-xs text-ink hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-h-0 md:py-1`}
        data-testid={TESTID.prefsAllowNotify}
        onClick={() => void askToNotify(true)}
      >
        Allow notifications
      </button>
    </Show>
  )
}

const alertsHint = ({ alertsOn, consent: notifyConsent }: Channel): string => {
  if (!alertsOn()) {
    return "A question from the agent arrives silently. The header button still " +
      "shows it."
  }
  const said = "A question you cannot see chimes, raises a notification and " +
    "marks the app icon."
  switch (notifyConsent()) {
    case "granted":
      return said
    case "denied":
      return `${said} You have blocked notifications here, so there is no banner.`
    case "unsupported":
      return `${said} This browser has no notifications, so there is no banner.`
    default:
      return `${said} The banner needs this browser's permission.`
  }
}

/** What the sound row in force means — and, with alerts off, why it is inert
 *  rather than absent: the choice is still on screen, it just has nothing to
 *  be about. */
const soundHint = ({ alertsOn, alertSoundOn }: Channel): string => {
  if (!alertsOn()) return "Alerts are off, so nothing will sound."
  return alertSoundOn()
    ? "A short chime with each notification. The first plays only after you " +
      "click the page."
    : "Notifications, but no sound."
}

