import { serviceTag } from "@olai/plugin-api/contracts"
import type { Accessor } from "solid-js"
export type NotifyClick =
  | { readonly kind: "ask" }
  | { readonly kind: "due" }
  | { readonly kind: "plugin"; readonly name: string }

export interface Notice {
  readonly tag: string
  readonly title: string
  readonly body: string
  readonly data: NotifyClick
}

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
