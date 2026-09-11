/** Moved from chat when journal became a second consumer. The alerts row
 * owns the channel; consumers acquire alerts.channel on their components. */
/** Chat owns notification permission state and observers. Each activation reads
 * current permission; disposal removes click/permission listeners and prevents
 * delayed permission responses from delivering a departed activation's notice.
 * The framework owns the service-worker delivery and click handshake. */

/**
 * ## IT LIVES WITH ITS ONE ROW NOW
 *
 * This module was `@olai/web`'s `client/notify.ts` — a general door carrying a
 * module-scope holder and a `read()` that threw — and every reader of it is in
 * this package: the alert rows ask for consent, the attention rule raises a
 * notice, and this row's own activation is what starts and stops the
 * permission listener. A live value on a general package's door with one row
 * behind it is the Cordis audit's §12 whether or not a second row ever opened
 * it, and the honest fix for a helper nobody else uses is to put it behind the
 * wall of the row that owns it.
 */
import { createSignal } from "solid-js"
import { createPresses } from "./presses.ts"
import { createNotify } from "@kolu/surface-app/notify"

import type { Consent, Notice, NotifyClick } from "./contract.ts"
/** Read a click envelope the worker relayed, or `undefined` for anything that
 *  is not one of ours. Handed to `createNotify` as its validator, so a stale
 *  or malformed payload is dropped loudly rather than routed. */
export const notifyClick = (data: unknown): NotifyClick | undefined => {
  if (typeof data !== "object" || data === null) return undefined
  const kind = (data as { kind?: unknown }).kind
  return kind === "ask" || kind === "due" ? { kind } : undefined
}

const asked = (): Consent => typeof Notification === "undefined" ? "unsupported" : Notification.permission

export interface NotificationOptions {
  readonly seam?: ReturnType<typeof createNotify<NotifyClick>>
  readonly permission?: () => Consent
  readonly query?: () => Promise<Pick<PermissionStatus, "addEventListener" | "removeEventListener">>
}

export const createNotifications = (options: NotificationOptions = {}) => {
  const seam = options.seam ?? createNotify<NotifyClick>(notifyClick)
  const presses = createPresses()
  // The framework consumes cold-start payloads synchronously here. Hold them
  // before publishing the channel, until their kind has a consumer.
  const stopPresses = seam.onClick(presses.receive)
  const permission = options.permission ?? asked
  const [consent, setConsent] = createSignal<Consent>(permission())
  let active = true
  let prompted = false
  const releases = new Set<() => void>()
  const reread = () => { if (active) setConsent(permission()) }
  const query = options.query ?? (typeof navigator !== "undefined" && navigator.permissions
    ? () => navigator.permissions.query({ name: "notifications" as PermissionName }) : undefined)
  void query?.().then(status => {
    if (!active) return
    status.addEventListener("change", reread)
    releases.add(() => status.removeEventListener("change", reread))
  }).catch(() => {})
  const ask = async (force = false): Promise<void> => {
    if (!active) return
    const held = consent()
    if (held === "granted" || held === "unsupported" || (prompted && !force)) return
    prompted = true
    await seam.requestPermission()
    reread()
  }
  return {
    consent,
    ask,
    notify: async (notice: Notice): Promise<void> => {
      if (!active) return
      await ask()
      if (active) await seam.show(notice)
    },
    onPress: presses.onPress,
    dispose: () => {
      if (!active) return
      active = false
      presses.dispose()
      stopPresses()
      for (const release of releases) release()
      releases.clear()
    },
  }
}
let current: ReturnType<typeof createNotifications> | undefined
export const followNotifications = (): (() => void) => {
  if (current) throw new Error("A notification provider is already active")
  const state = createNotifications()
  current = state
  return () => {
    if (current === state) current = undefined
    state.dispose()
  }
}
export const readNotifications = () => {
  if (!current) throw new Error("The notification provider is unavailable")
  return current
}
