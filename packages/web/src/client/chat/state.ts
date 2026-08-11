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
 * **`rows` is KEYS, and each row reads its own value.** `<For>` diffs its list
 * by identity, so what is IN that list decides whether a change patches a row
 * or replaces it — and a row replaced is every piece of state it owns thrown
 * away while the reader is looking at it: an unfolded tool call, a text
 * selection, a scroll position. Strings, compared with `===`, cannot be
 * anything but the same list; the value comes from `entry(key)` inside the row,
 * where a change is a read that re-ran rather than a list that moved. It is the
 * framework's own idiom (`@kolu/surface`'s fleet-top example does exactly this
 * with pids).
 *
 * Handing `<For>` the entry OBJECTS happens to survive today — the collection
 * is served with batched `deltas`, which the client folds into a
 * reconcile-backed store, and reconcile mutates each key's object in place, so
 * the identities never move. That is a property of one delivery path rather
 * than of this panel: the per-key path yields a fresh object per frame, and a
 * collection switched onto it would start rebuilding every row several times a
 * second with nothing here changed. Keys do not have that in them to go wrong,
 * and `features/the_agent.feature` asserts the property directly — the same
 * DOM element, before and after an update.
 *
 * This module is also the ONE place in the client where an Effect is run
 * ({@link ./run.ts} is the edge itself). A procedure returns an `Effect`, a
 * click is a DOM event, and the boundary between them belongs somewhere named.
 */

import {
  type AskAnswer,
  CHAT_OFF,
  type ChatEntry,
  type ChatState,
  type OpFailure,
  type SessionInfo,
} from "@olai/surface"
import { type Accessor, createMemo, createSignal } from "solid-js"

import { olai } from "../wire.ts"
import { type Call, run } from "./run.ts"

export interface Chat {
  /** Where the conversation stands: session, model, commands, whether a turn
   *  is running. */
  readonly state: Accessor<ChatState>
  /** The row KEYS, in conversation order. Keys rather than values so a
   *  `<For>` over them diffs stable strings — see the header. */
  readonly rows: Accessor<ReadonlyArray<string>>
  /** One row's current value, read lazily inside that row. `undefined` while a
   *  key is in the list and its value has not arrived (or has just left). */
  readonly entry: (key: string) => Accessor<ChatEntry | undefined>
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
  /** Answer a question the agent asked — `id` is the ask row's own id. */
  readonly answer: (id: string, answers: ReadonlyArray<AskAnswer>) => void
  /** ... or decline it, which the agent is told about as such. */
  readonly decline: (id: string) => void
}

/**
 * Where the conversation stands, and NOTHING else.
 *
 * For a reader that has to know whether a turn is running without drawing the
 * conversation — the header toggle and the minimized pill. It subscribes the
 * cell (small) and deliberately not the transcript. The minimized face's last
 * message is a module snapshot in `last.ts`, written only while the open panel
 * is mounted — never a second transcript subscription.
 */
export const createChatState = (): Accessor<ChatState> => {
  const cell = olai.cells.chat.use()
  // The cell always has a value: the spec declares a default, and the framework
  // seeds the subscription with it — so `off` is what a page reads before the
  // first frame, which is exactly what it should read.
  return () => cell.value() ?? CHAT_OFF
}

export const createChat = (): Chat => {
  const state = createChatState()
  const transcript = olai.collections.transcript.use()
  const [refused, setRefused] = createSignal<OpFailure | null>(null)

  const entry = (key: string): Accessor<ChatEntry | undefined> => () =>
    transcript.byKey(key)?.()

  // Reading `seq` to sort means this memo re-runs on every frame — which is
  // fine and is what the framework's own example does. What matters is that
  // what comes OUT is strings: `<For>` compares them with `===`, finds the
  // same list, and leaves every row's DOM alone.
  const rows = createMemo<ReadonlyArray<string>>(() =>
    transcript
      .keys()
      .filter((key) => transcript.byKey(key)?.() !== undefined)
      .sort((a, b) => (entry(a)()?.seq ?? 0) - (entry(b)()?.seq ?? 0))
  )

  /** Every verb the same way: clear the last refusal, run, and keep whatever
   *  this one refuses with. A verb that SUCCEEDS says nothing — the transcript
   *  is where its consequences show up. */
  const verb = (effect: Call<unknown>) => {
    setRefused(null)
    run(effect, (failure) => setRefused(failure))
  }

  return {
    state,
    rows,
    entry,
    refused,
    send: (text) => verb(olai.procedures.chat.send({ text })),
    cancel: () => verb(olai.procedures.chat.cancel()),
    newSession: () => verb(olai.procedures.chat.newSession()),
    loadSession: (id) => verb(olai.procedures.chat.loadSession({ id })),
    answer: (id, answers) => verb(olai.procedures.chat.answer({ id, answers })),
    decline: (id) => verb(olai.procedures.chat.decline({ id })),
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
