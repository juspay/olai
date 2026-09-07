/** The inspector's reading history must survive changes in what it displays.
 * Its provider owns visibility and acknowledged source versions independently
 * of the shell. The tools component consumes that state, host management and
 * the renderer; only this integration waits for layout. A shell remount must
 * not silently acknowledge a changed source version, while disabling this
 * plugin deliberately closes the history and re-enabling creates a fresh one.
 * Host management remains available without either component. Its capability
 * supplies operations and scoped readings, never the notebook client or bundle.
 * Recovery presentation follows the host's retry/reload diagnosis. */
import { definePlugin, Offers, serviceTag } from "@olai/plugin-api"
import { browserManagement } from "@olai/surface/management"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { tools } from "olai-plugin-layout/contract"
import { Effect } from "effect"
import { name } from "./index.ts"
import { createInspectorState, type InspectorState } from "./state.ts"
import { Plugins } from "./Plugins.tsx"
import { approvals as sourceApprovals } from "olai-plugin-vault-plugins/contract"
import { holdApprovals } from "./approvals.ts"

const inspectorState = serviceTag<InspectorState>("plugin-inspector.state")
export default definePlugin({ name, needs: [Offers], apply: Effect.gen(function*() {
  const state = yield* Effect.acquireRelease(Effect.sync(createInspectorState), (state) => Effect.sync(state.close))
  yield* (yield* Offers).own("state", () => state)
}) })
export const components = {
  /** Saying yes to code, DECLARED — a component of its own so the panel keeps
   *  showing what a serve is running when there is no approval provider
   *  (`./approvals.ts`). */
  approval: definePlugin({ name: "approval", needs: [sourceApprovals], apply: Effect.gen(function*() {
    const value = yield* sourceApprovals
    yield* Effect.acquireRelease(Effect.sync(() => holdApprovals(value)), stop => Effect.sync(stop))
  }) }),
  tools: definePlugin({ name: "tools", needs: [inspectorState, browserManagement, rendererSlots], apply: Effect.gen(function*() {
    const state = yield* inspectorState
    const management = yield* browserManagement
    yield* (yield* rendererSlots).contribute(tools, {
      body: (props) => <Plugins where={props.where} state={state} management={management} />,
      headerOrder: 10, closetOrder: 20,
    })
  }) }),
}
