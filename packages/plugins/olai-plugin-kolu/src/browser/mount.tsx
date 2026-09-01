/**
 * THE TAB'S KOLU HALF, mounted once around the page.
 *
 * It used to be a `<KoluUi client={olai} now={createRecencyNow()}>` in
 * `@olai/web`'s composition root, and the first of those props is the whole
 * reason this file exists: once kolu's members compose as a SIBLING, that line
 * has to read `olai.clients.kolu`, which is a general package spelling a
 * plugin's name in its own App. The app mounts a plugin BY its name — the one
 * word it is allowed — and what is behind the name is read here.
 *
 * ## What comes through, and what deliberately does not
 *
 * `../ui/`'s `KoluUi` is unchanged and does the work: it binds the three
 * cells, the two collections, the screen read and the pane's un-enrolled stream,
 * and its own header argues each. What this module adds is the two things that
 * are not the appliance's:
 *
 *   - the CLIENT, narrowed once at this edge. `@olai/plugin-api` types a mount's
 *     `client` as `unknown` for the reason it types a server half's `dial` that
 *     way — core cannot type a plugin's own client without learning its members
 *     — so the cast is here, against a shape `KoluUi` already declares
 *     structurally (`KoluClient`), which means a member renamed in `../wire.ts`
 *     is a type error in this package rather than a chip that never fills.
 *   - the CADENCE. The Dock's recency phrase ticks by the MINUTE in olai and by
 *     the SECOND in kolu's own dock, and that difference is an argument about
 *     olai's pages: an outline can carry forty lanes with a terminal each, and a
 *     per-second tick per row is a re-render storm bought for a digit nobody is
 *     watching in a document somebody is reading.
 *
 *     It used to be a `recency.ts` inside `@olai/web` and it is decided here
 *     now, which is a MOVE rather than a demotion: "how kolu's rows should tick
 *     inside an olai outline" is olai's judgement about kolu, and this package
 *     is where that judgement lives. What stays the app's is the LADDER and the
 *     LIFETIME — the units and a timer that disposes with its component arrive
 *     as furniture (`./app.ts`), because a plugin spelling `60_000` and its own
 *     `setInterval` would be a second answer to what a minute is and a timer
 *     nobody stops.
 */

import type { JSX } from "solid-js"

import { KoluUi } from "../ui/index.ts"
import type { KoluClient } from "../ui/index.ts"

import type { KoluApp } from "./app.ts"

export function KoluMount(props: {
  readonly client: unknown
  readonly app: KoluApp
  readonly children: JSX.Element
}): JSX.Element {
  // The one narrowing, at the one edge — see the header. A cast rather than a
  // guard because there is nothing to check: the value came from the framework's
  // own `surfaceClients` under this plugin's key, so the only thing a runtime
  // test could catch is the composition having been built wrong, which is a
  // boot-time throw upstream rather than a branch to draw a face for.
  const client = props.client as KoluClient
  return (
    <KoluUi
      client={client}
      now={props.app.clocks.createTicking(props.app.clocks.MINUTE)}
    >
      {props.children}
    </KoluUi>
  )
}
