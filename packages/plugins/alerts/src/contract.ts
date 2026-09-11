import { serviceTag } from "@olai/plugin-api/contracts"
import type { Accessor } from "solid-js"

/**
 * What a press asks this app for — the payload the worker relays back, from a
 * notification that may be older than the tab reading it.
 *
 * TWO ARMS: chat asks for the waiting question; journal asks for the agenda.
 * This is a `kind`-discriminated union because the validator has
 * to be able to refuse a pre-upgrade envelope — or the `{}` a degraded worker
 * substitutes — rather than mis-route it.
 *
 * It does NOT name a THING — which question, which commit. What a press means
 * is "take me to it", and what "it" is is a fact the app has when the press
 * lands and the notification did not necessarily have when it was raised.
 */
export type NotifyClick = { readonly kind: "ask" } | { readonly kind: "due" }

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

/** Notification permission and delivery belong to one alerts channel activation. */
export type Consent = NotificationPermission | "unsupported"

export interface Channel {
  readonly alertsOn: Accessor<boolean>
  readonly setAlertsOn: (value: boolean) => void
  readonly alertSoundOn: Accessor<boolean>
  readonly setAlertSoundOn: (value: boolean) => void
  readonly tabWaiting: Accessor<boolean>
  readonly consent: Accessor<Consent>
  readonly ask: (force?: boolean) => Promise<void>
  readonly notify: (notice: Notice) => Promise<void>
  readonly onPress: <K extends NotifyClick["kind"]>(kind: K, press: (asked: Extract<NotifyClick, { kind: K }>) => void) => () => void
  readonly chime: () => void
  readonly wear: (count: number) => void
}
export const alertsChannel = serviceTag<Channel>("alerts.channel")
