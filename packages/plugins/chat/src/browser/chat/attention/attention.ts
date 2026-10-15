/** Scoped attention for the conversations this activation can observe: the
 * channels that raise a question, and the acknowledgement of what has been read.
 * Cross-tab readership and node standings decide whether a question needs a
 * notification; THIS document's own readership decides what it may write down
 * as read. Withdrawal releases the claims and listeners together. */

import type { Router } from "olai-plugin-navigation/routing"
import { grumble } from "@olai/web/client/grumble.ts"
import { run } from "@olai/web/client/run.ts"
import { createEffect, createMemo, mapArray, onCleanup } from "solid-js"
import { agentReadings } from "../../agents/reading.ts"
import { useChannel } from "../../channel.ts"
import { chatWire } from "../../wire.ts"
import { createReveal } from "./reveal.ts"
import { noticeOf } from "./notice.ts"
import { createWatchings } from "./watching.ts"
import { alarmFor, type Awaiting } from "./alarm.ts"
import type { Row } from "../../agents/roster.ts"

/** One circuit per node, all owned by the attention activation. */
export const createAttention = (router: Router): void => {
  const createWatching = createWatchings()
  const alerts = useChannel()
  const reveal = createReveal(router)
  onCleanup(alerts.onPress("ask", reveal))
  const badges = new Map<string, number>()
  const wear = () => alerts.wear([...badges.values()].reduce((a, b) => a + b, 0))
  onCleanup(() => alerts.wear(0))
  const circuits = mapArray(() => agentReadings()?.agents.rows().map(row => row.id) ?? [], id => {
        onCleanup(() => { badges.delete(id); wear() })
        const reading = () => agentReadings()?.agents.at(id)
        const currentChat = () => agentReadings()?.shownChat(id)
        /** SOMEBODY is looking (the alerts' question) and THIS document is (the
         *  acknowledgement's) — `watching.ts` argues why those are two. */
        const watching = createWatching(() => currentChat() !== undefined, id)
        createEffect<Awaiting | undefined>(before => {
          const now: Row | undefined = reading()
          const next = { count: now?.waiting ?? 0, watched: watching.watched() }
          const alarm = alarmFor(before, next)
          badges.set(id, alarm.badge)
          wear()
          if (alarm.alert && now !== undefined) {
            alerts.chime()
            const chat = currentChat()
            void alerts.notify({ ...noticeOf({ session: null, asking: now.waiting }, chat?.ui.question.value(), now.title),
              tag: `olai:awaiting:${now.id}`, title: now.title })
          }
          return next
        })
        /**
         * ONE LINE TO ACKNOWLEDGE, AND NOTHING ELSE: which conversation, and the
         * exact instant of the line this tab was looking at.
         *
         * A MEMO AND NOT THE ROW, which is a claim about what re-runs this. The
         * row is a fresh object on every roster frame, so an effect reading it
         * re-sent the same acknowledgement on every frame a directory with four
         * agents produced — a standing moving, a sleep forecast arriving — and
         * every one of those was a round trip for a line already written down.
         * The tuple is the whole of what the call carries, so the tuple is what
         * is tracked: the effect below runs when the answer to *is there
         * something here I have not read* moves, or when this document starts
         * or stops being the one looking at it.
         */
        const unreadLine = createMemo(() => {
          const now = reading()
          const said = now?.said ?? null
          return now === undefined || said === null || now.session === null || !now.unread
            ? null
            : { agent: now.engine, session: now.session, at: said.at }
        }, null, {
          equals: (was, now) => was?.agent === now?.agent && was?.session === now?.session && was?.at === now?.at,
        })
        /**
         * ...AND WRITING IT DOWN IS THE OTHER THING A LOOKING DOCUMENT OWES.
         *
         * THIS DOCUMENT IS THE ONE LOOKING, asked of `watching.here` rather than
         * of `watched`: the second includes a beat from another window, which is
         * a good reason not to chime and no reason at all to say that a line has
         * been read. So a conversation folded away, a window behind an editor, a
         * tab behind another tab and a sibling document that has just looked
         * away all leave the mark up — which is what every line of prose about
         * this feature says it does.
         *
         * THE INSTANT TRAVELS, NEVER A CLOCK: what goes out is `said.at`, the
         * line that was on screen, so a line that lands between the frame and
         * the write is not swallowed by a `now`. The server checks the pair it
         * was asked about (`conversation.seen`), and the record keeps the LATER
         * of two acknowledgements, so two tabs a frame apart cannot un-read a
         * line between them.
         *
         * A FAILURE IS GRUMBLED AND CARRIED ON, which is the only thing that can
         * be done here: the write is bookkeeping about somebody's attention,
         * nobody made a gesture, and the cost of losing one is a mark that stays
         * up until the mark or the readership moves and this tries again. It
         * goes through the client's own once-per-key word for a browser that
         * would not do something — an app that silently failed to remember what
         * you read would go on doing it with nothing anywhere saying why.
         */
        createEffect(() => {
          const line = unreadLine()
          if (line === null || !watching.here()) return
          run(
            chatWire().procedures.conversation.seen(line),
            failure => grumble(`chat.seen:${id}`, "olai: this conversation could not be marked as read", failure),
          )
        })
  })
  createEffect(() => { circuits() })
}
