/**
 * The conversation, as this tab sees it.
 *
 * Two subscriptions and five verbs, and every one of them is a surface member —
 * there is no chat state in the browser that the server does not own. What was
 * typed, what the agent said, which tool ran, which session this is: all of it
 * arrives as frames, so two tabs cannot disagree and a reload is a fresh read
 * rather than a replay protocol.
 *
 * The transcript is a COLLECTION served with batched deltas, which is why a tab
 * opened halfway through a turn shows the whole conversation: its first frame is
 * the snapshot. Rows are sorted by their own `seq` rather than by the order the
 * keys arrived, because arrival order is a delivery detail and the conversation
 * has an order of its own.
 *
 * This module is also the ONE place in the client where an Effect is run
 * ({@link ./run.ts} is the edge itself). A procedure returns an `Effect`, a
 * click is a DOM event, and the boundary between them belongs somewhere named.
 */

import {
  CHAT_OFF,
  type ChatEntry,
  type ChatState,
  type OpFailure,
  type SessionInfo,
} from "@olai/surface"
import { type Accessor, createMemo, createSignal } from "solid-js"

import { olai } from "../wire.ts"
import { run } from "./run.ts"

export interface Chat {
  /** Where the conversation stands: session, model, commands, whether a turn
   *  is running. */
  readonly state: Accessor<ChatState>
  /** The rows, in conversation order. */
  readonly rows: Accessor<ReadonlyArray<ChatEntry>>
  /** The last thing a VERB refused — an empty message, a turn already running.
   *  Separate from `state().trouble`, which is what went wrong where nobody was
   *  waiting: this one belongs to the click that caused it. */
  readonly refused: Accessor<OpFailure | null>
  readonly send: (text: string) => void
  readonly cancel: () => void
  readonly newSession: () => void
  readonly loadSession: (id: string) => void
  /** Asked of the server every time the picker opens: the agent's list is the
   *  only one that is right. */
  readonly sessions: () => Promise<ReadonlyArray<SessionInfo>>
}

export const createChat = (): Chat => {
  const cell = olai.cells.chat.use()
  const transcript = olai.collections.transcript.use()
  const [refused, setRefused] = createSignal<OpFailure | null>(null)

  const rows = createMemo(() => {
    const entries = transcript
      .keys()
      .flatMap((key) => {
        const entry = transcript.byKey(key)?.()
        return entry === undefined ? [] : [entry]
      })
    return entries.slice().sort((a, b) => a.seq - b.seq)
  })

  /** Every verb the same way: clear the last refusal, run, and keep whatever
   *  this one refuses with. A verb that SUCCEEDS says nothing — the transcript
   *  is where its consequences show up. */
  const verb = (effect: Parameters<typeof run>[0]) => {
    setRefused(null)
    run(effect, (failure) => setRefused(failure))
  }

  return {
    // The cell always has a value: the spec declares a default, and the
    // framework seeds the subscription with it — so `off` is what a page reads
    // before the first frame, which is exactly what it should read.
    state: () => cell.value() ?? CHAT_OFF,
    rows,
    refused,
    send: (text) => verb(olai.procedures.chat.send({ text })),
    cancel: () => verb(olai.procedures.chat.cancel()),
    newSession: () => verb(olai.procedures.chat.newSession()),
    loadSession: (id) => verb(olai.procedures.chat.loadSession({ id })),
    sessions: () =>
      new Promise((resolve) => {
        run(
          olai.procedures.chat.sessions(),
          (failure) => {
            setRefused(failure)
            resolve([])
          },
          resolve,
        )
      }),
  }
}
