/**
 * THE NEWEST ROW OF A CONVERSATION THAT ANSWERS A QUESTION — and the one rule
 * about reading a transcript that this client keeps getting wrong.
 *
 * Two things want this: the minimized pill's last agent message (`./last.ts`)
 * and the pending question the attention banner quotes
 * (`./attention/asked.ts`). Written twice it was written twice with the rule in
 * it twice, and the rule is the whole reason either is careful:
 *
 * **Track MEMBERSHIP; do not track what a row SAYS.** A row's `kind` and `seq`
 * are fixed the moment it exists, so a scan that subscribed to every row's
 * value would re-run per streamed token — a thousand-row conversation paying a
 * thousand reads per token, which is exactly the defect
 * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/reactivity-after-the-flip.md` §4.4 recorded and
 * `./last.browsertest.ts` was written to hold. The key list is `chat.rows()`,
 * which is the fold's own and hands back THE SAME ARRAY for a frame that added
 * no row (`./order.ts`), so membership creates and releases per-row owners. Each owner updates an
 * indexed maximum heap; appending a row does not read earlier row values.
 *
 * **Except where the caller says otherwise.** {@link pick} is handed the row
 * AND its accessor, so a caller whose answer depends on something that MOVES
 * under a key that does not — an ask row settling from `null` to answered — can
 * take the tracked read itself, for its own rows and no others. That is the one
 * difference between this file's two callers, and it is now a line in one of
 * them rather than a second copy of everything around it.
 *
 * A key whose value has not landed yet is the one thing membership cannot say,
 * so THAT read is always tracked: it is what wakes its owner when the row
 * arrives.
 */

import { type Accessor, createComputed, createSignal, mapArray, onCleanup, untrack } from "solid-js"

import { createRanking } from "./ranking.ts"
import type { Chat } from "./state.ts"
import type { ChatEntry } from "olai-plugin-chat/wire"
/**
 * What a caller wants off one row, or `undefined` for a row it is not asking
 * about.
 *
 * `at` is that row's own accessor, UNREAD — reading it subscribes the scan to
 * that row's value, which is the deliberate escape hatch above. A caller that
 * never calls it pays nothing per row.
 */
export type Pick<T> = (row: ChatEntry, at: Accessor<ChatEntry | undefined>) => T | undefined

/**
 * The answer from the row with the highest `seq` that {@link Pick} answered
 * for, or `undefined` when no row did.
 *
 * `>=` rather than `>`: two rows can share a `seq` — the transcript's order is
 * the server's — and the later one in the list is the later one.
 */
export const createNewest = <T>(chat: Chat, pick: Pick<T>): Accessor<T | undefined> => {
  const ranked = createRanking<T>()
  const [newest, setNewest] = createSignal<T>()
  const publish = () => setNewest(() => ranked.top())
  const rows = mapArray(chat.rows, (key, position) => {
    const at = chat.entry(key)
    createComputed(() => {
      const row = untrack(at)
      // Only a missing row or an explicitly tracked pick subscribes to values.
      if (row === undefined) at()
      const value = row === undefined ? undefined : pick(row, at)
      if (value === undefined || row === undefined) ranked.drop(key)
      else ranked.put(key, row.seq, position(), value)
      publish()
    })
    onCleanup(() => { ranked.drop(key); publish() })
  })
  createComputed(rows)
  return newest
}
