/**
 * WHAT THIS ORIGIN MAY TELL SOMEBODY WHO IS NOT LOOKING AT IT: one notification
 * seam, and the permission it needs.
 *
 * It sits at the client's root rather than inside the feature that raises the
 * only notification there is today, and that is the same placement `./run.ts`
 * and `./grumble.ts` argue for themselves: what a BROWSER will let this origin
 * do is a fact about the app, not about the chat panel. Three things follow
 * from it, and each of them is why this is not filed under `chat/`:
 *
 *   - there is ONE click listener per origin and one page-lifetime "ask at most
 *     once" latch. A second consumer that grew its own would route a press
 *     twice and prompt twice;
 *   - the preferences panel reports what this browser has answered, and a
 *     settings row reaching three folders into a feature to learn it is a
 *     dependency on the wrong thing;
 *   - the CLICK PAYLOAD is a union the whole app shares, because the worker
 *     hands it back with no idea which feature raised it. Today it has one arm.
 *
 * The seam itself is the framework's (`@kolu/surface-app/notify`), and taking
 * it rather than calling the platform is not a preference — both of the
 * landmines on this path are ones a hand-rolled version steps on:
 *
 *   - **`new Notification()` is an illegal constructor in an installed PWA.**
 *     Code that works in a tab dies at precisely the moment somebody commits
 *     to the app. Only `registration.showNotification` works there, which is
 *     why olai's server serves a worker at all
 *     (`packages/server/src/listener.ts`) and why `main.tsx` registers it.
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
 * shaped by the ruling that the chat's alerts are ON by default. A default-on
 * feature has no "first enable" click to hang a prompt on, and the two obvious
 * answers are both wrong: at boot is the prompt every reader has been trained
 * to refuse before they know what the page is, and never at all is a feature
 * that is on and cannot work. So it is asked at the FIRST MOMENT IT WOULD BE
 * USED — something has actually happened that nobody is looking at — which is
 * the only time the sentence in the prompt is about something happening.
 *
 * ONCE PER PAGE, whatever the answer. A browser that requires a user gesture
 * for the prompt (Firefox and Safari both do) REJECTS an ask made from a
 * background event and leaves the permission at `default`, so an unguarded
 * version would ask again on every notification forever. The reader's door for
 * that case is the preferences row, which is a gesture and says so
 * (`./settings/Panel.tsx`).
 *
 * **Refusal costs the notification and nothing else.** Whatever else a caller
 * does to get somebody's attention is its own — the chat's chime and icon mark
 * need no permission and go on working (the ruling), which is why this is a
 * module with its own `if` rather than a gate in front of all three.
 */

import { type Accessor, createSignal } from "solid-js"
import { createNotify } from "@kolu/surface-app/notify"

/**
 * What a press asks this app for — the payload the worker relays back, from a
 * notification that may be older than the tab reading it.
 *
 * ONE ARM today: the chat's, meaning "the agent is waiting on me, take me
 * there". It is a `kind`-discriminated union rather than a bare string because
 * the second arm is what the shape is for, and because {@link notifyClick} has
 * to be able to refuse a pre-upgrade envelope — or the `{}` a degraded worker
 * substitutes — rather than mis-route it.
 *
 * It does NOT name a THING — which question, which commit. What a press means
 * is "take me to it", and what "it" is is a fact the app has when the press
 * lands and the notification did not necessarily have when it was raised.
 */
export interface NotifyClick {
  readonly kind: "ask"
}

/** Read a click envelope the worker relayed, or `undefined` for anything that
 *  is not one of ours. Handed to `createNotify` as its validator, so a stale
 *  or malformed payload is dropped loudly rather than routed. */
export const notifyClick = (data: unknown): NotifyClick | undefined => {
  if (typeof data !== "object" || data === null) return undefined
  return (data as { kind?: unknown }).kind === "ask" ? { kind: "ask" } : undefined
}

/** A notification, as the seam takes it. */
export interface Notice {
  /** The dedup/replace key — the OS replaces a same-`tag` notification rather
   *  than stacking a duplicate, which is what stops two tabs of one olai from
   *  double-pinging. */
  readonly tag: string
  readonly title: string
  readonly body: string
  readonly data: NotifyClick
}

/** The origin's one seam. Module-scoped because it IS the origin's: a second
 *  instance would be a second click listener on one worker, and a press
 *  routed twice. */
const seam = createNotify<NotifyClick>(notifyClick)

/** What a browser answers about drawing notifications — the platform's own
 *  three words, plus the one for a browser that has none at all. */
export type Consent = NotificationPermission | "unsupported"

/** What the browser says right now. `Notification.permission` and NOT the
 *  Permissions API, even though both answer: the delivery path reads this one,
 *  so this one is the truth. (They can disagree — a headless Chromium reports
 *  `denied` here for an origin the Permissions API calls `granted`, because it
 *  has nowhere to draw one.) */
const asked = (): Consent =>
  typeof Notification === "undefined" ? "unsupported" : Notification.permission

const [consent, setConsent] = createSignal<Consent>(asked())

const reread = (): void => {
  setConsent(asked())
}

/**
 * Whether this browser will draw notifications — as a signal, so a panel that
 * reports it redraws when the answer moves.
 *
 * It is a MIRROR and never a store: the permission belongs to the browser and
 * is changeable and revocable outside this app, so it is re-read rather than
 * remembered. Nothing decides anything from this except what to SAY — whether
 * one is actually drawn is asked of the platform at the moment of drawing it,
 * by the seam.
 *
 * IT FOLLOWS THE BROWSER ITSELF, and that is the difference from a value a
 * consumer has to remember to refresh. A permission revoked in browser
 * settings with this page open is exactly the case a stale mirror gets wrong,
 * and "call this when your panel opens" is an obligation the one caller would
 * meet and the second would not. `navigator.permissions` is the only API that
 * says WHEN it moved; what it says it moved TO is ignored, for the reason
 * above.
 */
export const notifyConsent: Accessor<Consent> = consent

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
 * Ask for permission, at most once per page.
 *
 * It answers NOTHING, deliberately: whether a notification is actually drawn
 * is the seam's question at the moment of drawing one, and a boolean here
 * would be a second answer to it that a caller could act on a second later,
 * when it had already stopped being true. What a caller wants to SAY about the
 * permission it reads off {@link notifyConsent}.
 *
 * `force` is the preferences row's: a person pressing "Allow notifications" is
 * a gesture, and a gesture is exactly what the browsers that refused the
 * background ask were holding out for.
 */
export const askToNotify = async (force = false): Promise<void> => {
  const held = consent()
  if (held === "granted" || held === "unsupported") return
  if (prompted && !force) return
  prompted = true
  await seam.requestPermission()
  reread()
}

/** Put one up (or replace the one with this tag). Never throws and never
 *  rejects: no worker, no active worker, no permission and an operational
 *  browser failure are each a logged no-op, which is what lets a caller fire
 *  and forget it. */
export const notify = async (notice: Notice): Promise<void> => {
  await askToNotify()
  await seam.show(notice)
}

/** Follow presses — both the live path and the one a press that had to OPEN a
 *  window arrives on. Returns the unsubscribe. */
export const onNotifyPress = (press: (asked: NotifyClick) => void): (() => void) =>
  seam.onClick(press)
