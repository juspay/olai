import { definePlugin, Offers, Slots, Wired } from "@olai/plugin-api"
import { CONTROL } from "@olai/ui-primitives/touch.ts"
import { Effect } from "effect"
import { type Accessor, createRoot, Show } from "solid-js"

import { ENTRY_SHAPE, ROW_GAP } from "olai-plugin-layout/entry"
import { navigation } from "olai-plugin-navigation/contract"
import { defineAppPage } from "olai-plugin-navigation/routes"
import { Link, useRouter } from "olai-plugin-navigation/routing"
import type { RowActions } from "olai-plugin-outlines/slots"
import { vaultEntries } from "olai-plugin-sidebar/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"

import { REFERENCE_GRAPH } from "./browser/door.ts"
import { createGraphed } from "./browser/graphed.ts"
import { navigationHeld } from "./browser/held.ts"
import { GraphFace } from "./browser/graph/GraphFace.tsx"
import { graph, wholeGraph } from "./browser/routes.ts"
import { graphWire, holdGraphWire, type GraphClient } from "./browser/wire.ts"
import { name, surface } from "./wire.ts"

export { name, surface } from "./wire.ts"

/**
 * THE DIRECTORY'S DOOR, drawn beside Trash at the foot of the file list —
 *  current when the pane's own page is this one. A graph belongs to no file,
 *  so nothing in the tree spells it and the column's one free seat holds it.
 */
function GraphEntry() {
  const router = useRouter()
  const current = () => {
    const route = router.route()
    return route === undefined ? false : graph.value(route) !== null
  }
  return (
    <li class="mb-0.5">
      <Link
        route={wholeGraph()}
        class={`${ENTRY_SHAPE} ${ROW_GAP} text-paper/65`}
        testid={TESTID.graphLink}
        current={current()}
      >
        {/* The fold control's box, empty — the same seat a Trash entry leaves
            bare, so the door lands where a file's name would. */}
        <span class={CONTROL} aria-hidden="true" />
        <span class="min-w-0 truncate">Graph</span>
      </Link>
    </li>
  )
}

/** The quiet door under a row's property run — a LINK rather than a verb:
 * nothing is armed, and a link middle-clicks the way any other does. It
 * ANSWERS NOTHING where the map has nothing to say to this row (chat's door
 * drawing on every row and mattering on nearly none): a door that every row
 * got is every row carrying a line for the map it is not on. */
function GraphDoor(props: { readonly node: string; readonly members: Accessor<ReadonlySet<string>> }) {
  return (
    <Show when={props.members().has(props.node)}>
      <Link
        route={graphAroundNode(props.node)}
        class="text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
        testid={TESTID.nodeGraphDoor}
        label={REFERENCE_GRAPH}
      >
        {REFERENCE_GRAPH}
      </Link>
    </Show>
  )
}

import { graphAroundNode } from "./browser/door.ts"
import { TESTID } from "./testids.ts"

/**
 * THE BROWSER ROW. `Wired` for the tab's client factory, `Offers` so the row
 * publishes its readiness as a service (`graph.state`); the components name
 * only what they spend, so an absent provider takes one integration away and
 * never the row.
 */
export default definePlugin({
  name,
  needs: [Slots, Wired, Offers],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    const wired = yield* Wired
    yield* holdGraphWire(() => wired.client() as GraphClient)
    yield* (yield* Offers).own("state", () => ({ wire: () => graphWire() }))
    yield* slots.register("app.route", defineAppPage(graph, GraphFace))
    yield* slots.register("app.palette", {
      id: "nav-graph",
      label: "Go to the graph",
      hint: "every reference, drawn",
      search: "go to graph reference references map shape links mentions plot",
      href: "/graph",
    })
  }),
})

export const components = {
  /** The footer row of the directory column. */
  sidebar: definePlugin({
    name: "graph.sidebar",
    needs: [rendererSlots],
    apply: Effect.gen(function*() {
      yield* (yield* rendererSlots).contribute(vaultEntries, GraphEntry)
    }),
  }),
  /** Under a row's property run, where the map has anything to say to it.
   * The roster the faces read is ONE root and ONE subscription for the tab
   * (`./browser/graphed.ts`), disposed with the row; the wires this row
   * already holds are what the subscribe closes over. */
  "node-door": definePlugin({
    name: "graph.node-door",
    needs: [Slots, Wired],
    apply: Effect.gen(function*() {
      const slots = yield* Slots
      // The need, declared: what the subscribe closes over is the wire this
      // row holds, and the row must not promise the door without it.
      yield* Wired
      const held = yield* Effect.acquireRelease(
        Effect.sync(() => createRoot((dispose) => ({ members: createGraphed(), dispose }))),
        ({ dispose }) => Effect.sync(dispose),
      )
      yield* slots.register("outline.row.door", (props) => (
        <GraphDoor node={props.node} members={held.members} />
      ))
    }),
  }),
  /** A row's `•••`. With no router held its press does nothing — a drawer
   * with no router is a drawer on a page that cannot move anyway. */
  "row-verb": definePlugin({
    name: "graph.row-verb",
    needs: [Slots, navigation],
    apply: Effect.gen(function*() {
      const slots = yield* Slots
      const nav = yield* navigation
      yield* slots.register("outline.row.action", ((node: string) => [{
        id: "graph",
        label: REFERENCE_GRAPH,
        writes: false,
        run: () => {
          nav.go(graphAroundNode(node))
        },
      }]) satisfies RowActions)
    }),
  }),
  /** The face holds the router the activation knows it has: a per-activation
   * hold (`@olai/ui-primitives/held.ts`), cleared by identity. */
  nav: definePlugin({
    name: "graph.nav",
    needs: [navigation],
    apply: Effect.gen(function*() {
      const nav = yield* navigation
      yield* Effect.acquireRelease(
        Effect.sync(() => navigationHeld.hold(nav)),
        (stop) => Effect.sync(stop),
      )
    }),
  }),
}
