/** Chat owns notification permission state and observers. Each activation reads
 * current permission; disposal removes click/permission listeners and prevents
 * delayed permission responses from delivering a departed activation's notice.
 * The framework owns the service-worker delivery and click handshake. */

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

/** Notification permission and delivery belong to one chat activation. */
export type Consent = NotificationPermission | "unsupported"
const asked = (): Consent => typeof Notification === "undefined" ? "unsupported" : Notification.permission

export interface NotificationOptions {
  readonly seam?: ReturnType<typeof createNotify<NotifyClick>>
  readonly permission?: () => Consent
  readonly query?: () => Promise<Pick<PermissionStatus, "addEventListener" | "removeEventListener">>
}

export const createNotifications = (options: NotificationOptions = {}) => {
  const seam = options.seam ?? createNotify<NotifyClick>(notifyClick)
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
    onPress: (press: (asked: NotifyClick) => void): (() => void) => {
      if (!active) return () => {}
      const stop = seam.onClick(value => { if (active) press(value) })
      releases.add(stop)
      return () => { if (releases.delete(stop)) stop() }
    },
    dispose: () => {
      if (!active) return
      active = false
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
const read = () => {
  if (!current) throw new Error("The notification provider is unavailable")
  return current
}
export const notifyConsent: Accessor<Consent> = () => read().consent()
export const askToNotify = (force = false): Promise<void> => read().ask(force)
export const notify = (notice: Notice): Promise<void> => read().notify(notice)
export const onNotifyPress = (press: (asked: NotifyClick) => void): (() => void) => read().onPress(press)
