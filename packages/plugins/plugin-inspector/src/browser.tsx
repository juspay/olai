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
import { Effect } from "effect"
import { name, type ConfigurationPanel } from "./index.ts"
import { createInspectorState, type InspectorState } from "./state.ts"
import { Plugins } from "./Plugins.tsx"
import { approvals as sourceApprovals } from "olai-plugin-vault-plugins/contract"
import { holdApprovals } from "./approvals.ts"
import { holdRowFaces, rowFaces } from "./faces.ts"
import { pluginsRow } from "./slots.ts"

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
      headerOrder: 10, closetOrder: 20,
    }, {
      // THE ROWS ARE SEATS OF THEIR OWN, declared by the entry that draws them:
      // a plugin hangs its row's face here, and a registration into a location
      // nobody declared would sit waiting instead of drawing (`./slots.ts`).
      children: [pluginsRow],
    })
  }) }),
}
