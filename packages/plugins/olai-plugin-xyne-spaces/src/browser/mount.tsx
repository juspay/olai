/**
 * THE TAB'S SPACES HALF, mounted once around the page.
 *
 * The app mounts a plugin by its NAME. What is behind the name is read here:
 * this plugin's `link` cell, narrowed once at this edge.
 */

import type { Accessor, JSX } from "solid-js"

import type { SpacesLink } from "../wire.ts"

import type { SpacesApp } from "./app.ts"
import { LinkProvider } from "./link.tsx"

export interface SpacesClient {
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
  const client = props.client as SpacesClient
  return (
    <LinkProvider link={client.cells.link.use().value}>
      {props.children}
    </LinkProvider>
  )
}
