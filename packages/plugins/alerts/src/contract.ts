/**
 * What a press asks this app for — the payload the worker relays back, from a
 * notification that may be older than the tab reading it.
 *
 * THREE ARMS: chat asks for the waiting question; journal asks for the agenda;
 * a plugin this vault defines asks for its own page. This is a
 * `kind`-discriminated union because the validator has
 * to be able to refuse a pre-upgrade envelope — or the `{}` a degraded worker
 * substitutes — rather than mis-route it.
 *
 * ## Two of the arms do NOT name a thing, and the third HAS to
 *
 * `ask` and `due` carry a kind and nothing else, and that was the whole
 * argument: what a press means is "take me to it", and what "it" is is a fact
 * the app has when the press lands and the notification did not necessarily
 * have when it was raised. The question a conversation is waiting on may not be
 * the one it was waiting on four minutes ago, and today's agenda is today's
 * whichever day the banner was raised.
 *
 * A PLUGIN IS NOT LIKE THAT, and the asymmetry is exact rather than an
 * exception. There is no "the plugin": a vault can hold five, two of them can
 * reach **Ready for you** in the same minute, and the one a person is being
 * told about is a fact only the raise knows. An arm with no name would land
 * that press on whichever plugin the app happened to pick, which is the
 * mis-route this union exists to make impossible. So the word rides with it,
 * and the reading that the other two arms get for free — *which one* — is here
 * answered by the notification that was actually pressed.
 *
 * It is still not a ROUTE: `/plugins/<word>` is the address grammar's to
 * spell, and a payload carrying a URL would be this contract holding the
 * app's own spelling of where a page lives.
 *
 * ## Why a plugin rings at all
 *
 * Because a plugin somebody asked an agent to build finishes while they are
 * somewhere else, and the two endings it can have — *Ready for you*, meaning
 * read the code and decide, and *Couldn't start*, meaning it is stuck — are
 * both a person's to answer. That is the same shape chat's waiting question
 * has, so it reaches a person the same way: the same chime, the same banner,
 * the same badge and the same press plumbing. A second mechanism for one more
 * kind of waiting would be a second set of consent rules, a second mute switch
 * and a second thing to get wrong.
 *
 * The kind is CLAIMED by `olai-plugin-vault-plugins`' browser half, which is
 * also what raises it; nothing in this row knows a plugin exists.
 */
import { serviceTag } from "@olai/plugin-api/contracts"
import type { Accessor } from "solid-js"
export type NotifyClick =
  | { readonly kind: "ask" }
  | { readonly kind: "due" }
  | { readonly kind: "plugin"; readonly name: string }

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
