import { createSignal } from "solid-js"
import { createPresses } from "./presses.ts"
import { createNotify } from "@kolu/surface-app/notify"

import type { Consent, Notice, NotifyClick } from "./contract.ts"
export const notifyClick = (data: unknown): NotifyClick | undefined => {
  if (typeof data !== "object" || data === null) return undefined
  const { kind, name } = data as { kind?: unknown; name?: unknown }
  if (kind === "ask" || kind === "due") return { kind }
  if (kind === "plugin" && typeof name === "string" && name !== "") return { kind, name }
  return undefined
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
