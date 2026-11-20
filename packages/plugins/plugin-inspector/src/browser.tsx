import { definePlugin, Faces, Offers, serviceTag, Links } from "@olai/plugin-api"
import { browserManagement } from "@olai/surface/management"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { tools } from "olai-plugin-layout/contract"
import { sections, preferencesPanel } from "olai-plugin-preferences/contract"
import { NO_ROSTER } from "@olai/surface"
import { createEffect, createRoot } from "solid-js"
import { Cause, Effect, Queue, Stream } from "effect"
import { name, type ConfigurationPanel } from "./index.ts"
import { createInspectorState, type InspectorState } from "./state.ts"
import { Plugins } from "./Plugins.tsx"
import { approvals as sourceApprovals, newPlugin as sourceNewPlugin } from "olai-plugin-vault-plugins/contract"
import { holdApprovals } from "./approvals.ts"
import { holdAsking } from "./asking.ts"
import { holdRowFaces, rowFaces } from "./faces.ts"
import { heldHeadings } from "./promoted.ts"
import { holdPreferencesPanel } from "./preferences-door.ts"
import { PromotedRows } from "./PromotedRows.tsx"
import { pluginsRow } from "./slots.ts"
import { promotingPlugins } from "./rows.ts"

const inspectorState = serviceTag<InspectorState>("plugin-inspector.state")
export default definePlugin({ name, needs: [Offers], apply: Effect.gen(function*() {
  const state = yield* Effect.acquireRelease(Effect.sync(createInspectorState), (state) => Effect.sync(state.close))
  yield* (yield* Offers).own("state", () => state)
  yield* (yield* Offers).own("configuration", (): ConfigurationPanel => ({ open: state.reveal }))
}) })
export const components = {
  links: definePlugin({ name: "links", needs: [inspectorState, Links], apply: Effect.gen(function*() {
    const state = yield* inspectorState
    const links = yield* Links
    yield* Effect.acquireRelease(Effect.sync(() => state.link(links.File)), release => Effect.sync(release))
  }) }),
  approval: definePlugin({ name: "approval", needs: [sourceApprovals], apply: Effect.gen(function*() {
    const value = yield* sourceApprovals
    yield* Effect.acquireRelease(Effect.sync(() => holdApprovals(value)), stop => Effect.sync(stop))
  }) }),
  "new-plugin": definePlugin({ name: "new-plugin", needs: [sourceNewPlugin], apply: Effect.gen(function*() {
    const value = yield* sourceNewPlugin
    yield* Effect.acquireRelease(Effect.sync(() => holdAsking(value)), stop => Effect.sync(stop))
  }) }),
  tools: definePlugin({ name: "tools", needs: [inspectorState, browserManagement, rendererSlots, Faces], apply: Effect.gen(function*() {
    const state = yield* inspectorState
    const management = yield* browserManagement
    yield* holdRowFaces(yield* Faces)
    yield* (yield* rendererSlots).contribute(tools, {
      body: (props) => <Plugins where={props.where} state={state} management={management} rows={rowFaces} />,
      headerOrder: 10, closetOrder: 20, desktop: "health",
    }, {
      children: [pluginsRow],
    })
  }) }),
  "preferences-door": definePlugin({ name: "preferences-door", needs: [preferencesPanel], apply: Effect.gen(function*() {
    const panel = yield* preferencesPanel
    yield* Effect.acquireRelease(Effect.sync(() => holdPreferencesPanel(panel)), stop => Effect.sync(stop))
  }) }),
  preferences: definePlugin({ name: "preferences", needs: [browserManagement, rendererSlots], apply: Effect.gen(function*() {
    const management = yield* browserManagement
    const slots = yield* rendererSlots
    const headings = heldHeadings(slots, sections)
    yield* Effect.addFinalizer(() => headings.close)
    const found = yield* Queue.unbounded<ReadonlyArray<string>>()
    yield* Effect.acquireRelease(
      Effect.sync(() => createRoot((dispose) => {
        const roster = management.roster()
        createEffect(() => {
          Queue.offerUnsafe(found, promotingPlugins(roster() ?? NO_ROSTER))
        })
        return dispose
      })),
      (dispose) => Effect.sync(dispose),
    )
    yield* Effect.forkScoped(Stream.runForEach(Stream.fromQueue(found), (names) =>
      headings.reconcile(names, {
        heading: (plugin) => ({ plugin, label: () => management.look(plugin).label ?? plugin }),
        body: (plugin) => () => <PromotedRows plugin={plugin} management={management} />,
      }).pipe(
        Effect.catchCauseIf(
          (cause) => !Cause.hasInterruptsOnly(cause),
          (cause) => Effect.logError("olai: one preference heading frame could not be reconciled", cause),
        ),
      )))
  }) }),
}
