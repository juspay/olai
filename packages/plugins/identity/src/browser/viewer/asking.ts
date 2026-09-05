/**
 * Who this tab is, refreshed whenever Kolu establishes a usable connection.
 * The identity comes from the WebSocket upgrade headers, so reconnects and
 * roster replacements can change it even while the app stays mounted.
 * A missing identity is null; a pending or failed ask is kept distinct.
 */

import type { Who } from "@olai/surface"
import { type Accessor, createResource } from "solid-js"

import { runAsync } from "@olai/web/client/run.ts"
import { olai, connectionEpoch } from "@olai/web/client/wire.ts"
import { fromAsk } from "./fromAsk.ts"

export type { Who }
export { fromAsk }

export interface Asking {
  /** `undefined` until the server has answered; `null` when nobody is on
   *  this connection; the login, the display name and the picture the
   *  server resolved when somebody is. */
  readonly who: Accessor<Who | null | undefined>
  /** Whether that answer has arrived. Its own bit so a chip can wait on
   *  "none" as a fact rather than as a missing element. */
  readonly heard: Accessor<boolean>
  /** The door failed — a transport error, or a procedure the face refused.
   *  Distinct from nobody: a `null` is absence, a failure is not. */
  readonly failed: Accessor<boolean>
}

export const createWho = (): Asking => {
  const [who] = createResource(() => connectionEpoch() || false, async (): Promise<Who | null> =>
    fromAsk(await runAsync(olai.procedures.who.get())),
  )
  return {
    // `createResource()` rethrows on error; the chip must not. A failed
    // door is `failed`, not a thrown render (which is a fault card).
    who: () => (who.error != null ? undefined : who()),
    heard: () => connectionEpoch() > 0 && !who.loading,
    failed: () => who.error != null,
  }
}
