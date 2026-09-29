/** The inspector's reading history must survive changes in what it displays.
 * Its provider owns visibility and acknowledged source versions independently
 * of the shell. The tools component consumes that state, host management and
 * the renderer; only this integration waits for layout. It is also the one
 * holder of the row faces other plugins hang on the panel it draws, so a face
 * lives exactly as long as that surface does (`./faces.ts`). A shell remount must
 * not silently acknowledge a changed source version, while disabling this
 * plugin deliberately closes the history and re-enabling creates a fresh one.
 * Host management remains available without either component. Its capability
 * supplies operations and scoped readings, never the notebook client or bundle.
 * Recovery presentation follows the host's retry/reload diagnosis. */
import { definePlugin, Faces, Offers, serviceTag, Links } from "@olai/plugin-api"
import { browserManagement } from "@olai/surface/management"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { tools } from "olai-plugin-layout/contract"
import { sections, preferencesPanel } from "olai-plugin-preferences/contract"
import { NO_ROSTER } from "@olai/surface"
import { createEffect, createRoot } from "solid-js"
import { Effect, Fiber, Queue, Stream } from "effect"
import { name, type ConfigurationPanel } from "./index.ts"
import { createInspectorState, type InspectorState } from "./state.ts"
import { Plugins } from "./Plugins.tsx"
import { approvals as sourceApprovals } from "olai-plugin-vault-plugins/contract"
import { holdApprovals } from "./approvals.ts"
import { holdRowFaces, rowFaces } from "./faces.ts"
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
  /** Saying yes to code, DECLARED — a component of its own so the panel keeps
   *  showing what a serve is running when there is no approval provider
   *  (`./approvals.ts`). */
  approval: definePlugin({ name: "approval", needs: [sourceApprovals], apply: Effect.gen(function*() {
    const value = yield* sourceApprovals
    yield* Effect.acquireRelease(Effect.sync(() => holdApprovals(value)), stop => Effect.sync(stop))
  }) }),
  tools: definePlugin({ name: "tools", needs: [inspectorState, browserManagement, rendererSlots, Faces], apply: Effect.gen(function*() {
    const state = yield* inspectorState
    const management = yield* browserManagement
    // WHAT EVERY ROW'S OWN PLUGIN HUNG, held for this component's life — it is
    // the only thing that draws a row, so it is the only holder this reading
    // has (`./faces.ts`).
    yield* holdRowFaces(yield* Faces)
    yield* (yield* rendererSlots).contribute(tools, {
      body: (props) => <Plugins where={props.where} state={state} management={management} rows={rowFaces} />,
      // On a desktop the door is a row at the foot of the bar's health popover
      // rather than a chip of its own: which integrations a serve runs is read
      // occasionally, beside the readouts they draw, and a calm bar is the
      // wordmark, search, one dot, preferences and who is looking.
      // The door's open state is its own (`state.door`), and the door stands
      // beside the dot, so a rebuilt shell draws this panel again by itself.
      headerOrder: 10, closetOrder: 20, desktop: "health",
    }, {
      // THE ROWS ARE SEATS OF THEIR OWN, declared by the entry that draws them:
      // a plugin hangs its row's face here, and a registration into a location
      // nobody declared would sit waiting instead of drawing (`./slots.ts`).
      children: [pluginsRow],
    })
  }) }),
  /** THE ONE HOLD ON THE PREFERENCES PANEL'S DOOR — a component of its own so
   *  `tools` keeps drawing rows when Preferences is switched off. When the
   *  service is absent this component is `waiting`, nothing is held, and the
   *  plugins panel draws the control itself (`./preferences-door.ts`). */
  "preferences-door": definePlugin({ name: "preferences-door", needs: [preferencesPanel], apply: Effect.gen(function*() {
    const panel = yield* preferencesPanel
    yield* Effect.acquireRelease(Effect.sync(() => holdPreferencesPanel(panel)), stop => Effect.sync(stop))
  }) }),
  /** THE PROMOTED SETTINGS, contributed to the preferences panel under a
   *  heading named after each promoting plugin. The headings are discovered
   *  from the roster, so this component names no plugin and imports no plugin's
   *  package; the rows it draws are the same `./Control.tsx` the plugins panel
   *  uses (`./PromotedRows.tsx`).
   *
   *  A Solid effect watches the roster and reports the promoting plugins into a
   *  queue; the Effect side registers one section per plugin, each in a scope
   *  of its own under this component's, so disabling the inspector or
   *  Preferences withdraws every row without touching inspector state or the
   *  settings reader. */
  preferences: definePlugin({ name: "preferences", needs: [browserManagement, rendererSlots], apply: Effect.gen(function*() {
    const management = yield* browserManagement
    const slots = yield* rendererSlots
    const found = yield* Queue.unbounded<ReadonlyArray<string>>()
    /** ONE FIBER PER HEADING, so a plugin that stops can take its heading with
     *  it: interrupting the fiber closes the scope the registration lives in,
     *  which is the withdrawal, and a plugin switched back on is registered
     *  again under the same key. */
    const held = new Map<string, Fiber.Fiber<void, never>>()
    yield* Effect.acquireRelease(
      Effect.sync(() => createRoot((dispose) => {
        const roster = management.roster()
        let last: string | undefined
        createEffect(() => {
          const names = promotingPlugins(roster() ?? NO_ROSTER)
          const signature = names.join("\u0000")
          if (signature === last) return
          last = signature
          Queue.offerUnsafe(found, names)
        })
        return dispose
      })),
      (dispose) => Effect.sync(dispose),
    )
    yield* Effect.forkScoped(Stream.runForEach(Stream.fromQueue(found), (names) => Effect.gen(function*() {
      for (const [plugin, fiber] of [...held]) {
        if (names.includes(plugin)) continue
        held.delete(plugin)
        yield* Fiber.interrupt(fiber)
      }
      for (const plugin of names) {
        if (held.has(plugin)) continue
        const label = management.look(plugin).label ?? plugin
        held.set(plugin, yield* Effect.forkScoped(slots.contribute(sections, {
          heading: { plugin, label },
          order: 0,
          body: () => <PromotedRows plugin={plugin} management={management} />,
        }, { key: plugin })))
      }
    })))
  }) }),
}
