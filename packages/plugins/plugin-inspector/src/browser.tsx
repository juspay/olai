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
import { Cause, Effect, Queue, Stream } from "effect"
import { name, type ConfigurationPanel } from "./index.ts"
import { createInspectorState, type InspectorState } from "./state.ts"
import { Plugins } from "./Plugins.tsx"
import { approvals as sourceApprovals } from "olai-plugin-vault-plugins/contract"
import { holdApprovals } from "./approvals.ts"
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
   *  queue; the Effect side keeps one heading per plugin in a scope of its own
   *  (`./promoted.ts`), so a plugin switched off has its heading RELEASED and
   *  one switched back on claims the key again. Disabling the inspector closes
   *  every remaining heading from one finalizer, without touching inspector
   *  state or the settings reader. */
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
          // EVERY FRAME REACHES THE RECONCILER, with no signature to dedupe it
          // away: a claim that FAILED is not in `held`, and a frame the roster
          // did not change is the only other one that could try it again —
          // `reconcile` is idempotent, so a frame that changed nothing costs a
          // scan of the map and nothing else. (Dedupe by names here would have
          // made a failed claim permanent until a plugin was switched.)
          Queue.offerUnsafe(found, promotingPlugins(roster() ?? NO_ROSTER))
        })
        return dispose
      })),
      (dispose) => Effect.sync(dispose),
    )
    // THE LABEL IS A READER, not a snapshot: the words are the build's
    // (`PluginLook.label`, read off the roster), so a rebuilt roster's words
    // reach the heading without re-registering it.
    yield* Effect.forkScoped(Stream.runForEach(Stream.fromQueue(found), (names) =>
      headings.reconcile(names, {
        heading: (plugin) => ({ plugin, label: () => management.look(plugin).label ?? plugin }),
        body: (plugin) => () => <PromotedRows plugin={plugin} management={management} />,
      }).pipe(
        // A FRAME THAT DIES IS REPORTED AND THE NEXT FRAME STILL RUNS. The
        // stream is this component's whole life, so ending it on one bad frame
        // would leave every later roster change unread: headings that stopped
        // appearing and — worse — stopped being withdrawn. A claim's own
        // failure is handled inside (`./promoted.ts`); this is the last resort,
        // and an INTERRUPT is not a failure — it is this component closing.
        Effect.catchCauseIf(
          (cause) => !Cause.hasInterruptsOnly(cause),
          (cause) => Effect.logError("olai: one preference heading frame could not be reconciled", cause),
        ),
      )))
  }) }),
}
