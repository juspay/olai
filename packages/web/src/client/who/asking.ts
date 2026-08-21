/**
 * Who this tab is, as the server read it off this request.
 *
 * One fetch, asked once: the login does not move for the life of the
 * page. `null` is the honest absence — a local `just run`, a proxy that
 * injects nothing — and it is distinct from "we have not been told yet",
 * which is the resource still pending. Nothing here invents a person
 * while it waits.
 *
 * HTTP rather than a surface member: the value is per REQUEST (`GET
 * /olai/who`), and a cell would be one value for the process. The path
 * is spelled here and in `@olai/server`'s `identity.ts`; a rename is a
 * 404 on one end and a chip that never appears on the other.
 */

import { type Accessor, createResource } from "solid-js"

export interface Who {
  readonly login: string
  readonly gravatar: string
}

export interface Asking {
  /** `undefined` until the server has answered; `null` when nobody is on
   *  this connection; the login and its gravatar when somebody is. */
  readonly who: Accessor<Who | null | undefined>
  /** Whether that answer has arrived. Its own bit so a chip can wait on
   *  "none" as a fact rather than as a missing element. */
  readonly heard: Accessor<boolean>
}

/** Named with the server's `WHO_PATH`. A second copy because this package
 *  does not import the server. */
const WHO_PATH = "/olai/who"

export const createWho = (): Asking => {
  const [who] = createResource(async (): Promise<Who | null> => {
    const answer = await fetch(WHO_PATH)
    if (answer.status === 204 || !answer.ok) return null
    return (await answer.json()) as Who
  })
  return {
    who,
    heard: () => !who.loading,
  }
}
