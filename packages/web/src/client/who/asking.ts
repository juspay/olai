/**
 * Who this tab is, as the server read it off this request.
 *
 * One fetch, asked once: the login does not move for the life of the
 * page. `null` is the honest absence — a local `just run`, a proxy that
 * injects nothing — and it is distinct from "we have not been told yet",
 * which is the resource still pending, and from a fetch that failed,
 * which is the resource in error. Nothing here invents a person while
 * it waits, and a failed door is not treated as nobody.
 *
 * HTTP rather than a surface member: the value is per REQUEST
 * (`WHO_PATH`), and a cell would be one value for the process. The path
 * is `@olai/surface`'s, the way `/media/…` is.
 */

import { WHO_PATH, type Who } from "@olai/surface"
import { type Accessor, createResource } from "solid-js"

export type { Who }

export interface Asking {
  /** `undefined` until the server has answered; `null` when nobody is on
   *  this connection; the login, the display name and the picture the
   *  server resolved when somebody is. */
  readonly who: Accessor<Who | null | undefined>
  /** Whether that answer has arrived. Its own bit so a chip can wait on
   *  "none" as a fact rather than as a missing element. */
  readonly heard: Accessor<boolean>
  /** The door failed — a network error, or anything but 200/204. Distinct
   *  from nobody: a 204 is absence, a 500 is not. */
  readonly failed: Accessor<boolean>
}

export const createWho = (): Asking => {
  const [who] = createResource(async (): Promise<Who | null> => {
    const answer = await fetch(WHO_PATH)
    if (answer.status === 204) return null
    if (!answer.ok) {
      throw new Error(`${WHO_PATH} answered ${answer.status}`)
    }
    return (await answer.json()) as Who
  })
  return {
    // `createResource()` rethrows on error; the chip must not. A failed
    // door is `failed`, not a thrown render (which is a fault card).
    who: () => (who.error != null ? undefined : who()),
    heard: () => !who.loading,
    failed: () => who.error != null,
  }
}
