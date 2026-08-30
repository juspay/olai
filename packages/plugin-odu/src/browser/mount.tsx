/**
 * THE TAB'S CI HALF, mounted once around the page.
 *
 * It used to be two lines in `@olai/web`'s composition root — a `RunsProvider`
 * with `olai.cells.ci.use().value` inside it — and the second of those is the
 * whole reason this file exists: `cells.ci` is a MEMBER NAME, spelled in the
 * app's own App.tsx, in a general package that has no business knowing odu has a
 * cell or what it is called. The app mounts a plugin by its NAME, which is the
 * one word it is allowed, and what is behind the name is read here.
 *
 * ## The client arrives opaque and is narrowed ONCE, at this edge
 *
 * `@olai/plugins` types the mount's `client` as `unknown`, for the reason it
 * types a server half's `dial` that way: core cannot type a plugin's own client
 * without learning its members, which is the one thing the whole arrangement
 * exists to prevent. So the narrowing happens here, against {@link CiClient} —
 * a structural declaration of exactly the one member this plugin's browser half
 * reads, at the depth this plugin's OWN sibling client presents it. That is
 * `@olai/kolu-ui`'s `KoluClient` pin one appliance over, and it means a member
 * renamed in `../wire.ts` is a type error in this package rather than a chip
 * that quietly never fills.
 *
 * ## Why the subscription is here and not in the chip
 *
 * `./runs.tsx` argues the economy in full: an outline can carry a `worktree`
 * property on a dozen rows and every one of them wants to know whether its
 * checkout is mid-run. One subscription per TAB, one probe per SERVER, and a
 * chip that reads a context instead.
 */

import type { JSX } from "solid-js"
import type { Accessor } from "solid-js"

import type { CiRuns } from "@olai/odu-client/wire"

import type { OduApp } from "./app.ts"
import { ClocksProvider } from "./clocks.tsx"
import { RunsProvider } from "./runs.tsx"

/**
 * THE MEMBER this plugin's browser half reads, structurally.
 *
 * One cell, which is a whole surface — `../wire.ts` argues why a run is a
 * reading of somebody else's work and there is nothing a browser can write
 * back. Spelled at the depth the sibling client presents it (`cells.ci`, not
 * `cells.odu.ci`: the key is consumed by the scope), so the app can hand this
 * plugin's client across with no adapter at the call site.
 */
export interface CiClient {
  readonly cells: {
    readonly ci: {
      use: () => { readonly value: Accessor<CiRuns | undefined> }
    }
  }
}

export function OduMount(props: {
  readonly client: unknown
  readonly app: OduApp
  readonly children: JSX.Element
}): JSX.Element {
  // The one narrowing, at the one edge — see the header. A cast rather than a
  // guard because there is nothing to check: the value came from the framework's
  // own `surfaceClients` under this plugin's key, so the only thing a runtime
  // test could catch is the composition having been rebuilt wrong, which is a
  // boot-time throw upstream (`implementSurfaces`' missing-deps refusal) rather
  // than a branch to draw a face for.
  const client = props.client as CiClient
  return (
    <ClocksProvider clocks={props.app.clocks}>
      <RunsProvider runs={client.cells.ci.use().value}>
        {props.children}
      </RunsProvider>
    </ClocksProvider>
  )
}
