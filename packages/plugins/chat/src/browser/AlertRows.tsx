/** Chat owns both controls; preferences only supplies their location. */
import { Show } from "solid-js"
import { askToNotify, notifyConsent } from "@olai/web/client/notify.ts"
import { Row } from "@olai/web/client/settings/Row.tsx"
import { Segmented } from "@olai/web/client/settings/Segmented.tsx"
import { TARGET } from "@olai/ui-primitives/touch.ts"
import { TESTID } from "@olai/web/client/testids.ts"
import { alertsOn, alertSoundOn, setAlertsOn, setAlertSoundOn } from "./alerts.ts"

/** Off / On, for both alert rows — being told, and being told AUDIBLY. One
 *  constant because they are the same pair and a second name for it is a
 *  second thing to keep in step. */
const ALERT_CHOICES = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
] as const

export function AlertRows() {
  return <>
      {/* THE AGENT'S TWO ROWS, and they are here for the same test the
          reader's rows meet: "tell me when the agent stops on me" is a claim
          about the reader, and the panel it is about has nowhere to hang a
          switch — it is a drawer that is shut in exactly the case this
          setting is for. Two rows and
          not one strip of three, because they are two independent facts:
          being told and being told AUDIBLY, and folding them together would
          make turning the chime off cost the banner too. Sound is drawn under
          Alerts and reads as its second half; with alerts off it is frozen
          rather than hidden, so what it would be is still on screen. */}
      <Row label="Alerts" pref="alerts" hint={alertsHint()} under={<AllowNotify />}>
        <Segmented
          choices={ALERT_CHOICES}
          value={alertsOn() ? "on" : "off"}
          onPick={(value) => setAlertsOn(value === "on")}
        />
      </Row>

      <Row label="Alert sound" pref="alert-sound" hint={soundHint()}>
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
 * it is actually wanted (`../notify.ts`) — which is the moment
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
function AllowNotify() {
  return (
    <Show when={alertsOn() && notifyConsent() === "default"}>
      <button
        type="button"
        // `mt-2` here rather than on a wrapper in `./Row.tsx`: the slot is
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

const alertsHint = (): string => {
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
const soundHint = (): string => {
  if (!alertsOn()) return "Alerts are off, so nothing will sound."
  return alertSoundOn()
    ? "A short chime with each notification. The first plays only after you " +
      "click the page."
    : "Notifications, but no sound."
}

