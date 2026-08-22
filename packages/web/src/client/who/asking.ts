/**
 * Who this tab is, as the server read it off the upgrade.
 *
 * One ask, asked once: the login does not move for the life of the
 * socket. `null` is the honest absence — a local `just run`, a proxy that
 * injects nothing — and it is distinct from "we have not been told yet",
 * which is the resource still pending, and from an ask that failed,
 * which is the resource in error. Nothing here invents a person while
 * it waits, and a failed door is not treated as nobody.
 *
 * A PROCEDURE rather than `GET /olai/who`: the value is per CONNECTION,
 * and a cell would be one value for the process. The HTTP door stays for
 * a share sheet and a script, which have no websocket. Header names never
 * appear here — the server already walked the ladder.
 */

import type { Who } from "@olai/surface"
import { type Accessor, createResource } from "solid-js"

import { runAsync } from "../run.ts"
import { olai } from "../wire.ts"
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
  const [who] = createResource(async (): Promise<Who | null> =>
    fromAsk(await runAsync(olai.procedures.who.get())),
  )
  return {
    // `createResource()` rethrows on error; the chip must not. A failed
    // door is `failed`, not a thrown render (which is a fault card).
    who: () => (who.error != null ? undefined : who()),
    heard: () => !who.loading,
    failed: () => who.error != null,
  }
}
