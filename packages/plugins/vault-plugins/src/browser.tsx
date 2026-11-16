/**
 * THE BROWSER HALF OF `vault-plugins` — the whole person-facing surface of a
 * plugin somebody asked for, as SEVEN components that start and stop
 * independently.
 *
 * ## Why so many components, and why that is the design rather than the cost
 *
 * This row's faces hang in five different plugins' houses: the sidebar's
 * section, navigation's route and palette, chat's agent panel and engine
 * roster, and the alerts channel. Every one of those is a plugin a serve may
 * not compose, or a person may switch off, and NONE of them is a reason for
 * the rest of this surface to stop. A row that declared all five would be
 * `waiting` on a serve with no chat — which means the plugin page, the one
 * screen where a person says yes to code, would not exist on a serve that
 * simply has no agent in it.
 *
 * So each dependency is its own component, and each answers absence in its own
 * words:
 *
 * | component | declares | what its absence costs |
 * | --- | --- | --- |
 * | (the row) | `Wired`, `Offers` | nothing works; this is the client and the one verb the plugins panel consumes |
 * | `section` | management, `Slots` | no Plugins heading in the sidebar; the page and the palette are untouched |
 * | `page` | management, `Slots` | no `/plugins/<word>` page; the sidebar's rows still draw, and still link |
 * | `palette` | palette control, navigation, management, renderer | no *New plugin* row and no `+` on the heading; everything already in the vault still works |
 * | `dock` | chat's panel door | the page does not dock the builder and offers no verb that would |
 * | `engines` | chat's engine roster | *New plugin* offers no engine and mints a folder anyway, saying so |
 * | `alerts` | the alerts channel, management, navigation | nothing pings; the sidebar's mark and the page still say everything |
 *
 * ## The holds, and who owns which
 *
 * Three of those components exist mostly to HOLD a service for a face that
 * must survive without it (`./browser/doors.ts` argues the shape and the
 * one-holder-per-holder rule). The rest pass what they declared down as props,
 * which is the cheaper answer wherever the value is in scope at registration:
 * the sidebar's body closure and the page's face are built inside the `apply`
 * that received management, so neither needs a holder at all.
 *
 * ## What this module itself holds
 *
 * Nothing live. This file is a door (`olai-plugin-vault-plugins/browser`), so
 * the static fence's `live-state` claim applies to it: the client's holder is
 * `./client.ts`, which is private to this package, and every other value here
 * is created inside an activation and released with it.
 */

import { definePlugin, Offers, Slots, Wired } from "@olai/plugin-api"
import { browserManagement } from "@olai/surface/management"
import { defineSelfDrawnPage } from "olai-plugin-navigation/routes"
import { alertsChannel as noticeChannel } from "olai-plugin-alerts/contract"
import { engines as engineRoster } from "olai-plugin-chat/browser-engines"
import { chatDock as panelDoor } from "olai-plugin-chat/dock"
import { navigation as appRouter, paletteAdapters, paletteControl } from "olai-plugin-navigation/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { Effect } from "effect"
import { createRoot } from "solid-js"

import { type Approvals, name } from "./index.ts"
import { client, holdClient, type Client } from "./client.ts"
import { createPluginAlerts } from "./browser/alerts.ts"
import { holdDock, holdEngines, holdPalette, holdRouter } from "./browser/doors.ts"
import { newPluginRow } from "./browser/new-plugin.ts"
import { PluginPage } from "./browser/Page.tsx"
import { pluginPage } from "./browser/route.ts"
import { Section } from "./browser/Section.tsx"

/** The slots this row hangs faces in are declared by their owners; naming the
 *  contracts here is what types the registrations against them. */
import type {} from "olai-plugin-navigation/slots"
import type {} from "olai-plugin-sidebar/slots"

export { surface } from "./surface.ts"

/** THE SIDEBAR'S HEADING, in this plugin's words. Core keeps the region, the
 *  heading's type and the column's height budget; what a plugin brings is what
 *  it is called and what is under it. */
const SECTION = "Plugins"

/** Source approval is a vault capability, not permanent host management.
 *  The inspector consumes ONE VERB of it through a declared service; this row's
 *  own client stays behind this package's wall (`./index.ts`'s `Approvals`). */
export default definePlugin({ name, needs: [Wired, Offers], apply: Effect.gen(function*() {
  const wired = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => wired.client() as Client)), stop => Effect.sync(stop))
  yield* (yield* Offers).own("approval", (): Approvals => ({
    approve: (request) => client().procedures.plugins.approve(request),
  }))
}) })

export const components = {
  /** THE COLUMN'S SECTION — present only while the vault defines a plugin,
   *  which is the section's own question and not this component's: the
   *  component is up whenever management is, and draws nothing until there is
   *  something to draw (`./browser/Section.tsx`). */
  section: definePlugin({ name: "section", needs: [browserManagement, Slots], apply: Effect.gen(function*() {
    const management = yield* browserManagement
    yield* (yield* Slots).register("sidebar.section", { said: SECTION, body: () => <Section management={management} /> })
  }) }),

  /** THE PLUGIN'S OWN PAGE, as a self-drawn route. Navigation mounts the face
   *  over the route's own value; nothing here names a document kind, a page
   *  reading or an outline, because a plugin's page needs none of them. */
  page: definePlugin({ name: "page", needs: [browserManagement, Slots], apply: Effect.gen(function*() {
    const management = yield* browserManagement
    yield* (yield* Slots).register(
      "app.route",
      defineSelfDrawnPage(pluginPage, (props) => <PluginPage word={props.value.word} file={props.value.file} management={management} />),
    )
  }) }),

  /** ⌘K → **New plugin**, and the `+` on the sidebar's heading. Both are this
   *  component's: the row is contributed to the palette's adapters and
   *  withdrawn with it, and the control the heading presses is held here for
   *  the section to read. */
  palette: definePlugin({ name: "palette", needs: [paletteControl, appRouter, browserManagement, rendererSlots], apply: Effect.gen(function*() {
    const control = yield* paletteControl
    const lane = yield* appRouter
    const management = yield* browserManagement
    yield* Effect.acquireRelease(Effect.sync(() => holdPalette(control)), stop => Effect.sync(stop))
    yield* Effect.acquireRelease(Effect.sync(() => holdRouter(lane)), stop => Effect.sync(stop))
    // The roster read is this activation's: one Solid root, disposed with the
    // component, so the cell subscription the words are judged against is not
    // the palette's and not a page's.
    const taken = yield* Effect.acquireRelease(
      Effect.sync(() => createRoot((dispose) => ({ dispose, read: management.roster() }))),
      (owner) => Effect.sync(owner.dispose),
    )
    yield* (yield* rendererSlots).contribute(paletteAdapters, {
      items: () => [newPluginRow({
        // EVERY WORD THIS SERVE HAS, built rows and vault folders alike: a
        // plugin may take neither, and a name that would collide is refused
        // while it is still being typed rather than after a round trip.
        taken: () => taken.read()?.built.map((plugin) => plugin.name) ?? [],
        go: (word) => lane.go(pluginPage.to({ word })),
      })],
    })
  }) }),

  /** THE BUILDER, BESIDE THE PAGE — the agent panel's own door, held for the
   *  page to read. Its absence is a serve with no conversations, a layout with
   *  no seat, or a phone, and in all three the page simply does not dock. */
  dock: definePlugin({ name: "dock", needs: [panelDoor], apply: Effect.gen(function*() {
    const door = yield* panelDoor
    yield* Effect.acquireRelease(Effect.sync(() => holdDock(door)), stop => Effect.sync(stop))
  }) }),

  /** WHICH AGENTS COULD BUILD ONE — the engine roster, held for the palette's
   *  first level. */
  engines: definePlugin({ name: "engines", needs: [engineRoster], apply: Effect.gen(function*() {
    const roster = yield* engineRoster
    yield* Effect.acquireRelease(Effect.sync(() => holdEngines(roster)), stop => Effect.sync(stop))
  }) }),

  /** THE PING — a plugin reaching *Ready for you* or *Couldn't start* while
   *  nobody is looking at it (`./browser/alerts.ts`). Its own component so
   *  everything else keeps working with the channel switched off, and so the
   *  watch and the press subscription live exactly as long as it does. */
  notices: definePlugin({ name: "notices", needs: [noticeChannel, browserManagement, appRouter], apply: Effect.gen(function*() {
    const channel = yield* noticeChannel
    const management = yield* browserManagement
    const lane = yield* appRouter
    yield* Effect.acquireRelease(
      Effect.sync(() => createRoot((dispose) => { createPluginAlerts(channel, management, lane); return dispose })),
      (dispose) => Effect.sync(dispose),
    )
  }) }),
}
