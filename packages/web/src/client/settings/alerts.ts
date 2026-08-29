/**
 * Whether this browser is TOLD when the agent is waiting on the person at it,
 * and whether being told makes a sound.
 *
 * Two preferences rather than one, because they are two facts and the second
 * is the one people disagree about: "tell me" is about not leaving a turn
 * hanging in a drawer nobody has open, and "make a noise" is about the room
 * you are sitting in. Folding them into a single Off / Banner / Banner+sound
 * would make turning the chime off cost the banner as well — which is exactly
 * the setting most people want.
 *
 * BOTH DEFAULT ON (ruled 2026-08-23). A question nobody has noticed hangs the
 * turn silently forever ({@link ../../../../surface/src/chat.ts}'s `asking`),
 * so the alert is the feature and an alert you have to find and switch on is a
 * feature that helps whoever already knew about it. Off is one press away and
 * is remembered.
 *
 * The circuit is `../preference.ts`, like every other stored value this
 * browser keeps; the cross-tab follow is the same `storage` event the theme
 * rides, started once from `main.tsx`. Nothing here reaches the server: two
 * machines reading the same directory are entitled to disagree about whether
 * this one beeps.
 *
 * The OS's own notification permission is NOT one of these and is deliberately
 * not mirrored into one: it is the browser's answer, it can be changed and
 * revoked outside this app, and a copy of it here would be a second reading
 * free to go stale. What this file says is what the READER asked for; whether
 * a banner can actually be drawn is asked of the browser at the moment of
 * drawing one (`../chat/attention/`).
 */

import type { Accessor } from "solid-js"

import { boolCodec, createPreference } from "../preference.ts"

export const ALERTS_KEY = "olai.alerts"
export const ALERT_SOUND_KEY = "olai.alerts.sound"

/** On, for a browser that has never been asked — and for a value nothing here
 *  ever wrote, which is `boolCodec`'s rule and not this file's. */
const ON = true

const alerts = createPreference(ALERTS_KEY, boolCodec(ON))
const sound = createPreference(ALERT_SOUND_KEY, boolCodec(ON))

/** Whether this browser is told at all when the agent starts waiting. With it
 *  off, nothing rings, nothing is banner-ed and no icon is marked. */
export const alertsOn: Accessor<boolean> = alerts.value

export const setAlertsOn = (value: boolean): void => alerts.set(value)

/** Whether being told makes a sound. Read only where {@link alertsOn} is
 *  already true — a chime under alerts that are off would be the one half of
 *  the feature nobody could see to switch off. */
export const alertSoundOn: Accessor<boolean> = sound.value

export const setAlertSoundOn = (value: boolean): void => sound.set(value)

/** Follow both for as long as this document lives — the same shape as
 *  `followDonePages`, started once from `main.tsx`, because a preference
 *  belongs to the browser and a browser is more than one tab. */
export const followAlerts = (): void => {
  alerts.follow()
  sound.follow()
}
