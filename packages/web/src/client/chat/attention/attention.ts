/**
 * The circuit: the chat cell on one side, a chime, a banner and a badge on the
 * other, and {@link ./alarm.ts}'s two-line rule in between.
 *
 * THE TRIGGER IS THE CELL, and that is the roadmap item's scope note read
 * literally: `ChatState.asking` is how many of the agent's questions are still
 * waiting on a person, and the SERVER counts it off the very rows the panel
 * draws as forms (`../../../../chat/src/chat.ts`) — the pending question, the
 * permission prompt, the plan approval, all of them, and nothing that is not
 * one. There is no new wire signal here and nothing derived in the browser:
 * the fact was already on the cell, drawn as the header toggle's
 * `data-asking`, and this is a second reader of it.
 *
 * It is the CELL and not the transcript because of where this has to run. A
 * shut panel keeps no transcript subscription (`../last.ts` argues it), and a
 * question arriving behind a shut panel is the case the whole feature is
 * about — so a circuit that needed the rows would go quiet exactly when it was
 * wanted. The cell is the one small subscription every page already has.
 *
 * The ROW is still where the question's words come from, when there are any:
 * the open panel writes them to a snapshot ({@link ./asked.ts}) and the banner
 * quotes it. The two cannot race the wrong way round — the server publishes
 * the ask ROW and only then moves the cell — and when the panel is shut there
 * is no snapshot at all, which the banner says rather than guesses.
 *
 * MOUNTED FROM `../Panel.tsx`, which is drawn open or minimized and never
 * absent, so this lives as long as the app does. Deliberately not in
 * `main.tsx` beside the document-lifetime followers: it is a reader of a
 * SUBSCRIPTION, and the panel is what owns the panel's subscriptions.
 *
 * THREE DEVICES, THREE INDEPENDENCES, which is why they are three modules with
 * one `if` each rather than one "notify" call: the chime needs only that the
 * page has been touched at some point ({@link ./chime.ts}), the badge needs
 * nothing at all ({@link ./badge.ts}), and only the banner needs the OS's
 * consent (`../../notify.ts`, the origin's one seam) — which the ruling says
 * must not take the other two down with it when it is refused.
 *
 * WHAT IS NOT HERE is a turn ending. Turn-complete is deliberately silent
 * (ruled): an agent that finished will still be finished in five minutes, and
 * a chime for every turn is a chime people switch off — taking the one that
 * matters with it.
 */

import { type Accessor, createEffect, onCleanup, untrack } from "solid-js"

import type { ChatState } from "@olai/surface"

import { alertsOn, alertSoundOn } from "../../settings/alerts.ts"
import { type Awaiting, alarmFor } from "./alarm.ts"
import { askPending } from "./asked.ts"
import { wear } from "./badge.ts"
import { notify, onNotifyPress } from "../../notify.ts"
import { armChime, chime } from "./chime.ts"
import { noticeOf } from "./notice.ts"
import { reveal } from "./reveal.ts"
import { createWatching } from "./watching.ts"

/**
 * Watch the conversation for as long as this app is up, and say so when it
 * stops on a person who is not looking.
 */
export const createAttention = (state: Accessor<ChatState>): void => {
  const watching = createWatching()

  // The first gesture this page gets opens the audio context — the platform's
  // rule, not ours ({@link ./chime.ts}).
  armChime()

  // A press of a banner is not a render, so it is routed here rather than in a
  // component: `reveal` opens the panel and leaves the question for the
  // transcript to take up when it mounts ({@link ./reveal.ts}). It covers the
  // cold start too — a press that had to OPEN this window carries its payload
  // in the URL, and the seam hands it over at startup.
  onCleanup(onNotifyPress(() => reveal()))

  // A FOLD over the readings, which is what this is: the effect is handed the
  // last one it took and answers with this one, so "did something ARRIVE" can
  // be told from "is something waiting" without a mutable cell of our own to
  // keep in step with the frames. `undefined` is the first reading, which
  // never alerts ({@link alarmFor}).
  createEffect<Awaiting | undefined>((was) => {
    const now = state()
    const here: Awaiting = { count: now.asking, watched: watching() }
    const alarm = alarmFor(was, here)
    // Alerts off is off for all three devices, and the icon is put BACK rather
    // than left wearing the last count: a preference switched off has to be
    // able to clear what it was doing.
    const on = alertsOn()
    wear(on ? alarm.badge : 0)
    if (on && alarm.alert) {
      if (alertSoundOn()) chime()
      // UNTRACKED, and both halves of that matter. The words are taken NOW
      // rather than on the far side of the permission round trip, because what
      // a notification is ABOUT must not be re-read after it was raised. And
      // they are taken WITHOUT subscribing: the conversation's title and the
      // open panel's snapshot are things this fold has no business waking for
      // — a session being retitled would otherwise re-run the whole reading.
      const notice = untrack(() => noticeOf(now, askPending()))
      void notify(notice)
    }
    return here
  }, undefined)
}
