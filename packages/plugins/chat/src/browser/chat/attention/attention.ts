/** Scoped attention for the conversations this activation can observe: the
 * channels that raise a question, and the acknowledgement of what has been read.
 * Cross-tab readership and node standings decide whether a question needs a
 * notification; the same readership decides what a person has now seen.
 * Withdrawal releases the claims and listeners together. */

import type { Router } from "olai-plugin-navigation/routing"
import { run } from "@olai/web/client/run.ts"
import { createEffect, mapArray, onCleanup } from "solid-js"
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
        const watched = createWatching(() => currentChat() !== undefined, id)
        createEffect<Awaiting | undefined>(before => {
          const now: Row | undefined = reading()
          const next = { count: now?.waiting ?? 0, watched: watched() }
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
         * ...AND THE OTHER THING A LOOKING TAB OWES: writing down what it has
         * just read.
         *
         * This is the whole of `seen` on this end, and the two halves of the
         * condition are the whole of the rule. WATCHED is
         * {@link createWatchings}' answer — this tab is showing this node's
         * conversation and this document is in front — which is why a
         * conversation folded away, a window behind an editor and a tab in the
         * background all leave a reply unread, and why the tab that IS looking
         * acknowledges it whether or not it is the tab that drew the mark. UNREAD
         * is the row's own fact (`../../agents/roster.ts`), so a conversation
         * whose line has already been acknowledged writes nothing at all: the
         * effect runs again on every roster frame and every one of those is a
         * no-op both here and on the server, where `seen` compares before it
         * saves.
         *
         * THE INSTANT TRAVELS, NEVER A CLOCK. What goes out is `said.at` — the
         * exact line this tab was looking at — so a line that lands between the
         * frame and the write is not swallowed by a `now`. A stale tab's pair is
         * refused by the server rather than marking another conversation (`chat`'s
         * `conversation.seen`).
         *
         * A FAILURE IS SAID AND CARRIED ON, which is the only thing that can be
         * done here: the write is bookkeeping about somebody's attention, nobody
         * made a gesture, and the cost of losing one is a mark that stays up
         * until something moves the roster and this tries again. It reports
         * through the client's one edge rather than being dropped — an app that
         * silently failed to remember what you read would go on doing it with
         * nothing anywhere saying why.
         */
        createEffect(() => {
          const now = reading()
          const said = now?.said ?? null
          if (now === undefined || said === null || now.session === null || !now.unread) return
          if (!watched()) return
          run(
            chatWire().procedures.conversation.seen({ agent: now.engine, session: now.session, at: said.at }),
            failure => console.warn("olai: a conversation could not be marked as read", failure),
          )
        })
  })
  createEffect(() => { circuits() })
}
