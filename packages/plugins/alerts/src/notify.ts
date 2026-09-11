/**
 * The alerts row owns notification permission state and the single framework
 * click listener. Each channel activation reads current permission; disposal
 * removes listeners and prevents delayed permission responses from delivering
 * a departed activation's notice. The framework owns service-worker delivery
 * and the durable click handshake.
 *
 * This seam moved from `@olai/web`'s `client/notify.ts` into chat in #557,
 * because chat was then its only consumer. Journal became a second consumer,
 * so the seam now belongs to the alerts row. Chat's attention component and
 * journal's reminders component acquire `alerts.channel`; neither reads this
 * provider's module state. The channel dispatches presses by kind and holds
 * an unclaimed press until its consumer arrives within this activation.
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
