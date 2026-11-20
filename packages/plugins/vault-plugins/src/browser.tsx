import { definePlugin, Offers, Slots, Wired } from "@olai/plugin-api"
import { browserManagement } from "@olai/surface/management"
import { defineSelfDrawnPage } from "olai-plugin-navigation/routes"
import { alertsChannel as noticeChannel } from "olai-plugin-alerts/contract"
import { engines as engineRoster } from "olai-plugin-chat/browser-engines"
import { chatBeside as besideDoor } from "olai-plugin-chat/beside"
import { navigation as appRouter, paletteAdapters, paletteControl } from "olai-plugin-navigation/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { Effect } from "effect"
import { createRoot } from "solid-js"

import { type Approvals, name, type NewPlugin } from "./index.ts"
import { client, holdClient, type Client } from "./client.ts"
import { createPluginAlerts } from "./browser/alerts.ts"
import { holdBeside, holdEngines, holdPalette, holdRouter } from "./browser/doors.ts"
import { NEW_PLUGIN_ROW, newPluginRow } from "./browser/new-plugin.ts"
import { PluginPage } from "./browser/Page.tsx"
import { pluginPage } from "./browser/route.ts"
import { Section } from "./browser/Section.tsx"

import type {} from "olai-plugin-navigation/slots"
import type {} from "olai-plugin-sidebar/slots"

export { surface } from "./surface.ts"

const SECTION = "Plugins"

export default definePlugin({ name, needs: [Wired, Offers], apply: Effect.gen(function*() {
  const wired = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => wired.client() as Client)), stop => Effect.sync(stop))
  yield* (yield* Offers).own("approval", (): Approvals => ({
    approve: (request) => client().procedures.plugins.approve(request),
  }))
}) })

export const components = {
  section: definePlugin({ name: "section", needs: [browserManagement, Slots], apply: Effect.gen(function*() {
    const management = yield* browserManagement
    yield* (yield* Slots).register("sidebar.section", { said: SECTION, body: () => <Section management={management} /> })
  }) }),

  page: definePlugin({ name: "page", needs: [browserManagement, Slots], apply: Effect.gen(function*() {
    const management = yield* browserManagement
    yield* (yield* Slots).register(
      "app.route",
      defineSelfDrawnPage(pluginPage, (props) => <PluginPage word={props.value.word} file={props.value.file} management={management} />),
    )
  }) }),

  palette: definePlugin({ name: "palette", needs: [paletteControl, appRouter, browserManagement, rendererSlots], apply: Effect.gen(function*() {
    const control = yield* paletteControl
    const lane = yield* appRouter
    const management = yield* browserManagement
    yield* Effect.acquireRelease(Effect.sync(() => holdPalette(control)), stop => Effect.sync(stop))
    yield* Effect.acquireRelease(Effect.sync(() => holdRouter(lane)), stop => Effect.sync(stop))
    const taken = yield* Effect.acquireRelease(
      Effect.sync(() => createRoot((dispose) => ({ dispose, read: management.roster() }))),
      (owner) => Effect.sync(owner.dispose),
    )
    yield* (yield* rendererSlots).contribute(paletteAdapters, {
      items: () => [newPluginRow({
        taken: () => taken.read()?.built.map((plugin) => plugin.name) ?? [],
        go: (word) => lane.go(pluginPage.to({ word })),
      })],
    })
  }) }),

  "new-plugin": definePlugin({ name: "new-plugin", needs: [paletteControl, Offers], apply: Effect.gen(function*() {
    const control = yield* paletteControl
    yield* (yield* Offers).own("new-plugin", (): NewPlugin => ({ open: () => control.showAt([NEW_PLUGIN_ROW]) }))
  }) }),

  beside: definePlugin({ name: "beside", needs: [besideDoor], apply: Effect.gen(function*() {
    const door = yield* besideDoor
    yield* Effect.acquireRelease(Effect.sync(() => holdBeside(door)), stop => Effect.sync(stop))
  }) }),

  engines: definePlugin({ name: "engines", needs: [engineRoster], apply: Effect.gen(function*() {
    const roster = yield* engineRoster
    yield* Effect.acquireRelease(Effect.sync(() => holdEngines(roster)), stop => Effect.sync(stop))
  }) }),

  notices: definePlugin({ name: "notices", needs: [noticeChannel, browserManagement, appRouter], apply: Effect.gen(function*() {
    const channel = yield* noticeChannel
    const management = yield* browserManagement
    const lane = yield* appRouter
    yield* Effect.acquireRelease(
      Effect.sync(() => createRoot((dispose) => { createPluginAlerts(channel, management, (word) => lane.go(pluginPage.to({ word }))); return dispose })),
      (dispose) => Effect.sync(dispose),
    )
  }) }),
}
