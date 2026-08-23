/**
 * The OS banner: this origin's ONE notification seam, and the permission it
 * needs.
 *
 * The seam is the framework's (`@kolu/surface-app/notify`), and taking it
 * rather than calling the platform is not a preference — both of the landmines
 * on this path are ones a hand-rolled version steps on:
 *
 *   - **`new Notification()` is an illegal constructor in an installed PWA.**
 *     Code that works in a tab dies at precisely the moment somebody commits
 *     to the app. Only `registration.showNotification` works there, which is
 *     why the ruling says the notification goes through the service worker and
 *     why the server serves one at all (`packages/server/src/listener.ts`).
 *   - **`navigator.serviceWorker.ready` never settles where no worker
 *     registers.** In a dev server or a degraded boot it hangs forever, taking
 *     the notification path down silently. The seam asks `getRegistration()`,
 *     which answers "there isn't one".
 *
 * It also owns the click handshake — an ack'd `postMessage` to a window that
 * may still be loading, and a URL handoff for a window that is not open at
 * all — which is a protocol, not a call, and one this app has no business
 * re-deriving.
 *
 * WHEN PERMISSION IS ASKED FOR is the decision this file makes, and it is
 * shaped by the ruling that alerts are ON by default. A default-on feature has
 * no "first enable" click to hang a prompt on, and the two obvious answers are
 * both wrong: at boot is the prompt every reader has been trained to refuse
 * before they know what the page is, and never at all is a feature that is on
 * and cannot work. So it is asked at the FIRST MOMENT IT WOULD BE USED — the
 * agent has actually stopped on a question nobody is looking at — which is the
 * only time the sentence in the prompt is about something happening.
 *
 * ONCE PER PAGE, whatever the answer. A browser that requires a user gesture
 * for the prompt (Firefox and Safari both do) REJECTS an ask made from a
 * background event and leaves the permission at `default`, so an unguarded
 * version would ask again on every question forever. The reader's door for
 * that case is the preferences row, which is a gesture and says so
 * (`../../settings/Panel.tsx`).
 *
 * **Refusal costs the banner and nothing else.** The chime and the badge need
 * no permission, and the ruling is explicit that they go on working — which is
 * why this is its own module with its own `if`, rather than a gate in front of
 * all three.
 */

import { type Accessor, createSignal } from "solid-js"
import { createNotify } from "@kolu/surface-app/notify"

import { type AskClick, askedFor, type Notice } from "./notice.ts"

/** The origin's one seam. Module-scoped because it IS the origin's: a second
 *  instance would be a second click listener on one worker, and a press
 *  routed twice. */
const seam = createNotify<AskClick>(askedFor)

/** What a browser answers about drawing banners — the platform's own three
 *  words, plus the one for a browser that has no notifications at all. */
export type Consent = NotificationPermission | "unsupported"

/** What the browser says right now. `Notification.permission` and NOT the
 *  Permissions API, even though both answer: the delivery path reads this one,
 *  so this one is the truth. (They can disagree — a headless Chromium reports
 *  `denied` here for an origin the Permissions API calls `granted`, because it
 *  has nowhere to draw a banner.) */
const asked = (): Consent =>
  typeof Notification === "undefined" ? "unsupported" : Notification.permission

const [consent, setConsent] = createSignal<Consent>(asked())

const reread = (): void => {
  setConsent(asked())
}

/**
 * Whether this browser will draw banners — as a signal, so the preferences row
 * redraws when the answer moves.
 *
 * It is a MIRROR and never a store: the permission belongs to the browser and
 * is changeable and revocable outside this app, so it is re-read rather than
 * remembered. Nothing decides anything from this except what to SAY — whether
 * a banner is actually drawn is asked of the platform at the moment of drawing
 * one, by the seam.
 *
 * IT FOLLOWS THE BROWSER ITSELF, and that is the difference from a value a
 * consumer has to remember to refresh. A permission revoked in browser
 * settings with this page open is exactly the case a stale mirror gets wrong,
 * and "call this when your panel opens" is an obligation the one caller would
 * meet and the second would not. `navigator.permissions` is the only API that
 * says WHEN it moved; what it says it moved TO is ignored, for the reason
 * above.
 */
export const bannerConsent: Accessor<Consent> = consent

// A browser without the Permissions API, or one that will not answer for
// notifications, leaves the mirror moving only when this page asks — which is
// what it did before, and still covers the case that matters (the ask itself).
if (typeof navigator !== "undefined" && navigator.permissions !== undefined) {
  navigator.permissions
    .query({ name: "notifications" as PermissionName })
    .then((status) => {
      status.addEventListener("change", reread)
    })
    .catch(() => {
      // A browser that will not answer for `notifications` is not a failure to
      // report: the mirror still moves when this page asks, which is the case
      // that matters, and there is nothing a reader could do about it.
    })
}

/** True once anything has raised the prompt on this page — see the header for
 *  why a browser that refuses to raise it must not be asked again. */
let prompted = false

/**
 * Ask for permission, at most once per page. Answers whether banners may be
 * drawn — `false` covers denied, unsupported, and a browser that would not
 * even raise the prompt, which are the same fact to every caller.
 *
 * `force` is the preferences row's: a person pressing "Allow notifications" is
 * a gesture, and a gesture is exactly what the browsers that refused the
 * background ask were holding out for.
 */
export const askToNotify = async (force = false): Promise<boolean> => {
  if (consent() === "granted") return true
  if (consent() === "unsupported") return false
  if (prompted && !force) return false
  prompted = true
  const allowed = await seam.requestPermission()
  reread()
  return allowed
}

/** Put a banner up (or replace the one with this tag). Never throws and never
 *  rejects: no worker, no active worker, no permission and an operational
 *  browser failure are each a logged no-op, which is what lets a caller fire
 *  and forget it. */
export const raise = async (notice: Notice): Promise<void> => {
  await askToNotify()
  await seam.show(notice)
}

/** Follow presses of the banner — both the live path and the one a press that
 *  had to open a window arrives on. Returns the unsubscribe. */
export const onBannerPress = (press: (asked: AskClick) => void): (() => void) =>
  seam.onClick(press)
