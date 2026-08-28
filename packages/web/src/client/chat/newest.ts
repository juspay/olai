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
 * `https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/reactivity-after-the-flip.md` §4.4 recorded and
 * `./last.browsertest.ts` was written to hold. The key list is `chat.rows()`,
 * which is the fold's own and hands back THE SAME ARRAY for a frame that added
 * no row (`./order.ts`), so nothing but membership wakes this.
 *
 * **Except where the caller says otherwise.** {@link pick} is handed the row
 * AND its accessor, so a caller whose answer depends on something that MOVES
 * under a key that does not — an ask row settling from `null` to answered — can
 * take the tracked read itself, for its own rows and no others. That is the one
 * difference between this file's two callers, and it is now a line in one of
 * them rather than a second copy of everything around it.
 *
 * A key whose value has not landed yet is the one thing membership cannot say,
 * so THAT read is always tracked: it is what wakes the scan when the row
 * arrives.
 */

import { type Accessor, createMemo, untrack } from "solid-js"

import type { Chat } from "./state.ts"
import type { ChatEntry } from "@olai/surface"

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
export const createNewest = <T>(chat: Chat, pick: Pick<T>): Accessor<T | undefined> =>
  createMemo<T | undefined>(() => {
    let best: T | undefined
    let bestSeq = -1
    for (const key of chat.rows()) {
      const at = chat.entry(key)
      const row = untrack(at)
      if (row === undefined) {
        at()
        continue
      }
      const taken = pick(row, at)
      if (taken === undefined) continue
      if (row.seq >= bestSeq) {
        bestSeq = row.seq
        best = taken
      }
    }
    return best
  })
