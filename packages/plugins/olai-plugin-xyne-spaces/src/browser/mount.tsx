/**
 * THE TAB'S SPACES HALF, mounted once around the page.
 *
 * The app mounts a plugin by its NAME. What is behind the name is read here:
 * this plugin's `link` cell, narrowed once at this edge.
 *
 * ## The client arrives opaque and is narrowed ONCE, at this edge
 *
 * `@olai/plugin-api` types the mount's `client` as `unknown`, for the reason it
 * types a server half's `dial` that way: core cannot type a plugin's own client
 * without learning its members. So the narrowing happens here, against
 * {@link LinkClient} — a structural declaration of exactly the one member this
 * plugin's browser half reads. That is `olai-plugin-odu`'s `CiClient` pin one
 * appliance over: a member renamed in `../wire.ts` is a type error in this
 * package rather than a pill that quietly never fills.
 */

import type { Accessor, JSX } from "solid-js"

import type { SpacesLink } from "../wire.ts"

import type { SpacesApp } from "./app.ts"
import { LinkProvider } from "./link.tsx"

/**
 * THE MEMBER this plugin's browser half reads, structurally.
 *
 * One cell, which is a whole surface. Spelled at the depth the sibling client
 * presents it (`cells.link`), so the app can hand this plugin's client across
 * with no adapter at the call site.
 */
export interface LinkClient {
  readonly cells: {
    readonly link: {
      use: () => { readonly value: Accessor<SpacesLink | undefined> }
    }
  }
}

export function SpacesMount(props: {
  readonly client: unknown
  readonly app: SpacesApp
  readonly children: JSX.Element
}): JSX.Element {
  // The one narrowing, at the one edge — see the header. A cast rather than a
  // guard because there is nothing to check: the value came from the framework's
  // own `surfaceClients` under this plugin's key, so the only thing a runtime
  // test could catch is the composition having been built wrong, which is a
  // boot-time throw upstream rather than a branch to draw a face for.
  const client = props.client as LinkClient
  return (
    <LinkProvider link={client.cells.link.use().value}>
      {props.children}
    </LinkProvider>
  )
}
