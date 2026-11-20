import { fileAccess } from "olai-plugin-vault/contract"
import { Wake as WakeFace } from "./browser/Wake.tsx"
import { createRoot } from "solid-js"
import type {} from "olai-plugin-chat/slots"
import type {} from "olai-plugin-layout/slots"
import type {} from "olai-plugin-outlines/slots"
import { Bar, Clocks, definePlugin, Slots, Wired } from "@olai/plugin-api"
import { Effect } from "effect"
import type { Accessor } from "solid-js"

import type { CiRuns, OduLink } from "olai-plugin-odu/appliance/wire"
import { ODU_UNDIALED } from "olai-plugin-odu/appliance/wire"

import { CiChip } from "./browser/CiChip.tsx"
import { ClocksProvider } from "./browser/clocks.tsx"
import { OduMark } from "./browser/Mark.tsx"
import { RunsProvider, createRuns } from "./browser/runs.tsx"
import { RunMatrix } from "./browser/RunMatrix.tsx"
import { OduReadout } from "./browser/Odu.tsx"
import { oduSaid } from "./browser/said.ts"
import { RUN_KIND } from "./kinds.ts"

import { name, surface } from "./wire.ts"

export { name, surface }

interface CiClient {
  readonly cells: {
    readonly ci: {
      use: () => { readonly value: Accessor<CiRuns | undefined> }
    }
    readonly service: {
      use: () => { readonly value: Accessor<OduLink | undefined> }
    }
  }
}

export default definePlugin({
  name,
  needs: [Slots, Bar, Clocks, Wired],
  apply: Effect.gen(function*() {
    const bar = yield* Bar
    const clocks = yield* Clocks
    const slots = yield* Slots
    const wired = yield* Wired
    const client = wired.client() as CiClient
    const owned = yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
      const value = client.cells.service.use().value
      return ({
      dispose,
      runs: createRuns(client.cells.ci.use().value),
      link: () => value() ?? ODU_UNDIALED,
    })})), owned => Effect.sync(owned.dispose))

    yield* slots.register("outline.row.chip", RUN_KIND, props => <ClocksProvider clocks={clocks}><RunsProvider value={owned.runs}><CiChip {...props} /></RunsProvider></ClocksProvider>)
    yield* slots.register("outline.row.pane", RUN_KIND, props => <ClocksProvider clocks={clocks}><RunsProvider value={owned.runs}><RunMatrix {...props} /></RunsProvider></ClocksProvider>)
    yield* slots.register("app.header", { place: "cluster", body: () => <OduReadout app={bar} link={owned.link} />, status: () => oduSaid(owned.link()) })
    yield* slots.register("delivery.mark", OduMark)

  }),
})

export const components = {
  wake: definePlugin({ name: "wake", needs: [Slots, fileAccess], apply: Effect.gen(function*() {
    const directory = yield* fileAccess
    yield* (yield* Slots).register("conversation.wake", context => <WakeFace context={context} directory={directory} />)
  }) }),}
