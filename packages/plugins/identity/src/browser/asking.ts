/**
 * Who this tab is, as the server read it off the upgrade.
 *
 * ONE ASK PER CONNECTION, and the connection is the whole of the key.
 * `null` is the honest absence — a local `just run`, a proxy that injects
 * nothing — and it is distinct from "we have not been told yet", which is
 * the resource still pending, and from an ask that failed, which is the
 * resource in error. Nothing here invents a person while it waits, and a
 * failed door is not treated as nobody.
 *
 * A PROCEDURE rather than `GET /olai/who`: the value is per CONNECTION,
 * and a cell would be one value for the process. The HTTP door stays for
 * a share sheet and a script, which have no websocket. Header names never
 * appear here — the server already walked the ladder.
 *
 * ## Why the resource is KEYED ON THE WIRE, and what it used to be
 *
 * It was asked ONCE, for the life of the page, under a sentence that was
 * true when it was written: *the login does not move for the life of the
 * socket*. It still does not — but the SOCKET does, and this row is what
 * made that reachable. Who is looking is a plugin's reading now, so a
 * person switching the row off at the plugins panel changes the roster,
 * which redials the wire, which is a new upgrade and a new answer: nobody.
 * A resource asked once would have gone on handing the person's name and
 * picture to the transcript that draws them (`../person.ts`, the chat
 * row's speaker) while the server had stopped naming anybody at all.
 *
 * So the ask follows `wireGeneration`, which is the app's own word for
 * "this is a different connection" — the same signal the whole tree is
 * keyed on. That is one `who.get` per wire rather than one per page,
 * which is the number the value's own definition asks for.
 */

import type { Who } from "@olai/surface"
import { type Accessor, createResource } from "solid-js"

import { runAsync } from "@olai/web/client/run.ts"
import { olai, wireGeneration } from "@olai/web/client/wire.ts"
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
  const [who] = createResource(wireGeneration, async (): Promise<Who | null> =>
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
