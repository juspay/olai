import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import { NO_CLAIMS, TEST_CLAIMS } from "@olai/format/testlib"
import type { Home } from "olai-plugin-outlines/references"
import { createPaneState } from "./pane/state.ts"
import { createReveal } from "./reveal.ts"
import { nodeTargets } from "./nodes.ts"
import { holdFiles } from "./pages.ts"
import { atFile, atNode, type Route } from "./routes.ts"
import { routingIn } from "./routes.testlib.ts"
import { navigateIn, workspaceOf } from "./workspace.ts"

/** A provider whose answers the test sets; each `home` call is one reading. */
const provider = () => {
  const asked: string[] = []
  const [answer, setAnswer] = createSignal<Home>()
  return { asked, setAnswer, value: { reveal: () => false, home: (id: string) => { asked.push(id); return answer } } }
}

const lane = (address: string) => {
  const routes = routingIn()
  const arrived: string[] = []
  let dispose = () => {}
  const state = createRoot(stop => {
    dispose = stop
    const panes = createPaneState(workspaceOf(routes, address), routes)
    const reveal = createReveal(panes.panes, (_, route: Route | undefined, how) => { if (route) arrived.push(`${how} ${routes.href(route)}`) })
    return { ...panes, reveal }
  })
  return { state, arrived, dispose }
}

test("an answer, missing included, is read once per route and provider", () => {
  const files = holdFiles({ claims: () => TEST_CLAIMS, paths: () => [], standing: () => "loaded" })
  const first = provider()
  let release = nodeTargets.hold(first.value)
  const { state, dispose } = lane("/s/%23missing/house.olai")
  try {
    expect(first.asked).toEqual(["missing"])
    state.setWorkspace(navigateIn(state.workspace(), 1, atFile("garden.olai")))
    first.setAnswer(null)
    expect(state.reveal.status(0)).toBe("missing")
    state.setWorkspace(navigateIn(state.workspace(), 1, atFile("other.olai")))
    expect(first.asked).toEqual(["missing"])
    release()
    const second = provider()
    release = nodeTargets.hold(second.value)
    expect(second.asked).toEqual(["missing"])
    second.setAnswer(new Error("no wire"))
    expect(state.reveal.status(0)).toBe("unavailable")
  } finally { dispose(); release(); files() }
})

test("a home lands once the claim table names its file", () => {
  const [table, setTable] = createSignal(NO_CLAIMS)
  const files = holdFiles({ claims: table, paths: () => [], standing: () => "loaded" })
  const reader = provider()
  const release = nodeTargets.hold(reader.value)
  const { state, arrived, dispose } = lane("/#order")
  try {
    reader.setAnswer("house.olai")
    expect(arrived).toEqual([])
    expect(state.reveal.status(0)).toBe("finding")
    setTable(TEST_CLAIMS)
    expect(arrived).toEqual(["replace /house.olai#order"])
  } finally { dispose(); release(); files() }
})

test("a followed link keeps its page until the node lands, then pushes", () => {
  const files = holdFiles({ claims: () => TEST_CLAIMS, paths: () => [], standing: () => "loaded" })
  const reader = provider()
  const release = nodeTargets.hold(reader.value)
  const { state, arrived, dispose } = lane("/garden.olai")
  try {
    expect(state.reveal.follow(0, atNode("order"))).toBe(true)
    expect(reader.asked).toEqual(["order"])
    expect(state.reveal.status(0)).toBeUndefined()
    reader.setAnswer("house.olai")
    expect(arrived).toEqual(["push /house.olai#order"])
  } finally { dispose(); release(); files() }
})
