import { fileAccess } from "olai-plugin-vault/contract"
import { Wake as WakeFace } from "./browser/Wake.tsx"
import { createRoot } from "solid-js"
import type {} from "olai-plugin-chat/slots"
import type {} from "olai-plugin-layout/slots"
import type {} from "olai-plugin-outlines/slots"
import { Bar, Clocks, definePlugin, Slots, Wired } from "@olai/plugin-api"
import { configurationPanel } from "olai-plugin-plugin-inspector/contract"
import { holdConfigurationPanel } from "./browser/configuration.ts"
import { Effect } from "effect"

import { KoluUi, createKoluUi, TerminalBlock } from "./appliance/index.ts"
import type { KoluClient } from "./appliance/index.ts"
import type { KoluApp } from "./browser/app.ts"
import { KoluMark } from "./browser/Mark.tsx"
import { Padi } from "./browser/Padi.tsx"
import { padiStatus } from "./browser/status.ts"
import { TERMINAL_KIND } from "./kinds.ts"

export { name, surface } from "./wire.ts"
import { name } from "./wire.ts"

export default definePlugin({
  name,
  needs: [Slots, Bar, Clocks, Wired],
  apply: Effect.gen(function*() {
    const bar = yield* Bar
    const clocks = yield* Clocks
    const slots = yield* Slots
    const wired = yield* Wired

    const owned = yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => ({dispose, value: createKoluUi({client:wired.client() as KoluClient, now:clocks.createTicking(clocks.MINUTE)})}))), owned => Effect.sync(owned.dispose))
    const app: KoluApp = {
      desktop: bar.desktop,
      pill: bar.pill,
      popover: bar.popover,
    }
    yield* slots.register("outline.row.block", TERMINAL_KIND, props => <KoluUi value={owned.value}><TerminalBlock {...props} /></KoluUi>)
    yield* slots.register("app.header", {
      place: "cluster",
      body: () => <KoluUi value={owned.value}><Padi app={app} /></KoluUi>,
      status: () => padiStatus(owned.value),
    })
    yield* slots.register("delivery.mark", KoluMark)

  }),
})

export const components = {
  wake: definePlugin({ name: "wake", needs: [Slots, fileAccess], apply: Effect.gen(function*() {
    const directory = yield* fileAccess
    yield* (yield* Slots).register("conversation.wake", context => <WakeFace context={context} directory={directory} />)
  }) }),
  configuration: definePlugin({ name: "configuration", needs: [configurationPanel], apply: Effect.gen(function*() {
    const panel = yield* configurationPanel
    yield* Effect.acquireRelease(Effect.sync(() => holdConfigurationPanel(panel)), stop => Effect.sync(stop))
  }) }),
}
