import { definePlugin, Slots, Wired } from "@olai/plugin-api"
import { CONTROL } from "@olai/ui-primitives/touch.ts"
import { Effect } from "effect"
import { Show } from "solid-js"

import { ENTRY_SHAPE, ROW_GAP } from "olai-plugin-layout/entry"
import { navigation } from "olai-plugin-navigation/contract"
import { defineAppPage } from "olai-plugin-navigation/routes"
import { Link, useRouter } from "olai-plugin-navigation/routing"
import type { RowActions } from "olai-plugin-outlines/slots"
import { vaultEntries } from "olai-plugin-sidebar/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"

import { graphAroundNode, REFERENCE_GRAPH } from "./browser/door.ts"
import { navigationHeld } from "./browser/held.ts"
import { GraphFace } from "./browser/graph/GraphFace.tsx"
import { graph, wholeGraph } from "./browser/routes.ts"
import { holdGraphWire, type GraphClient } from "./browser/wire.ts"
import { TESTID } from "./testids.ts"
import { name, surface } from "./wire.ts"

export { name, surface } from "./wire.ts"

/**
 * THE DIRECTORY'S DOOR, drawn beside Trash at the foot of the file list —
 *  current only when the pane's page IS the whole reading (a neighbourhood
 *  is a page of its own, not the map's home). A graph belongs to no file, so
 *  nothing in the tree spells it and the column's one free seat holds it.
 */
function GraphEntry() {
  const router = useRouter()
  const current = () => {
    const route = router.route()
    if (route === undefined) return false
    const page = graph.value(route)
    return page !== null && page.around === null
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

/** The quiet door under a node's property run — a LINK rather than a verb:
 *  nothing is armed, and a link middle-clicks the way any other does.
 *
 * The slot says which surface it drew on (`{ node, where }`): the door
 * answers on the node's OWN page only — in the tree the ••• row verb is the
 * way to the same place, and a LINE under a tree row is a price the tree's
 * own geometry pays (the row below sits lower for it, which the suite's
 * sweeps name a failure). The page asks nothing of the map to draw this:
 * a node nothing refers to is its own sentence, and the door onto that is
 * the honest way there.
 */
function GraphDoor(props: { readonly node: string; readonly where: "row" | "page" }) {
  return (
    <Show when={props.where === "page"}>
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

/**
 * THE BROWSER ROW. `Wired` for the tab's client factory; the components name
 * only what they spend, so an absent provider takes one integration away and
 * never the row.
 */
export default definePlugin({
  name,
  needs: [Slots, Wired],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    const wired = yield* Wired
    yield* holdGraphWire(() => wired.client() as GraphClient)
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
  /** The footer row of the directory column: it draws a router Link, so it
   *  names the provider it spends from. */
  sidebar: definePlugin({
    name: "graph.sidebar",
    needs: [rendererSlots, navigation],
    apply: Effect.gen(function*() {
      yield* navigation
      yield* (yield* rendererSlots).contribute(vaultEntries, GraphEntry)
    }),
  }),
  /** The page itself, its own component: while the router stands the route
   *  does, and when the router goes nothing here carries on stating which
   *  address it believes in. */
  page: definePlugin({
    name: "graph.page",
    needs: [Slots, navigation],
    apply: Effect.gen(function*() {
      yield* navigation
      yield* (yield* Slots).register("app.route", defineAppPage(graph, GraphFace))
    }),
  }),
  /** Under the node's run on its own page: the door draws a router Link, so
   *  it names the provider of the thing it draws. */
  "node-door": definePlugin({
    name: "graph.node-door",
    needs: [Slots, navigation],
    apply: Effect.gen(function*() {
      yield* navigation
      yield* (yield* Slots).register("outline.row.door", GraphDoor)
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
