import { createRoot } from "solid-js"
import type {} from "olai-plugin-chat/slots"
import type {} from "olai-plugin-layout/slots"
import { Bar, definePlugin, Slots, Wired } from "@olai/plugin-api"
import { Effect } from "effect"
import type { Accessor } from "solid-js"

import type { SpacesApp } from "./browser/app.ts"
import { SPACES_UNDIALED, type SpacesLink } from "./wire.ts"
import { spacesSaid } from "./browser/said.ts"
import { LinkProvider } from "./browser/link.tsx"
import { SpacesMark } from "./browser/Mark.tsx"
import { Spaces } from "./browser/Spaces.tsx"

export { name, surface } from "./wire.ts"
import { name } from "./wire.ts"

interface LinkClient {
  readonly cells: {
    readonly link: {
      use: () => { readonly value: Accessor<SpacesLink | undefined> }
    }
  }
}

export default definePlugin({
  name,
  needs: [Slots, Bar, Wired],
  apply: Effect.gen(function*() {
    const bar = yield* Bar
    const slots = yield* Slots
    const wired = yield* Wired
    const owned = yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => ({dispose, link:(wired.client() as LinkClient).cells.link.use().value}))), owned => Effect.sync(owned.dispose))

    const app: SpacesApp = { desktop: bar.desktop, pill: bar.pill }
    yield* slots.register("app.header", {
      place: "cluster",
      body: () => <LinkProvider link={owned.link}><Spaces app={app} /></LinkProvider>,
      status: () => spacesSaid(owned.link() ?? SPACES_UNDIALED),
    })
    yield* slots.register("delivery.mark", SpacesMark)
  }),
})
