import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { TEST_CLAIMS } from "@olai/format/testlib"
import { createPaneState } from "./pane/state.ts"
import { createReveal } from "./reveal.ts"
import { nodeTargets } from "./nodes.ts"
import { holdFiles } from "./pages.ts"
import { atFile, atNode } from "./routes.ts"
import { routingIn } from "./routes.testlib.ts"
import { navigateIn, workspaceOf } from "./workspace.ts"

test("a pane retains in-flight and missing outcomes across unrelated changes; provider replacement retries", async () => {
  let calls = 0, answer!: (file: string | null) => void, dispose = () => {}
  const files = holdFiles({ claims: () => TEST_CLAIMS, paths: () => [], standing: () => "loaded" })
  let release = nodeTargets.hold({ reveal: () => false, home: () => { calls++; return new Promise(resolve => { answer = resolve }) } })
  const routes = routingIn()
  const state = createRoot(stop => {
    dispose = stop
    const panes = createPaneState(workspaceOf(routes, "/s/%23missing/house.olai"), routes)
    const resolving = createReveal(panes.panes, () => {})
    return { ...panes, resolving }
  })
  try {
    await Promise.resolve()
    expect(calls).toBe(1)
    state.setWorkspace(navigateIn(state.workspace(), 1, atFile("garden.olai")))
    expect(calls).toBe(1)
    answer(null); await Promise.resolve()
    expect(state.resolving.status(0)).toBe("missing")
    state.setWorkspace(navigateIn(state.workspace(), 1, atFile("other.olai")))
    expect(calls).toBe(1)
    release()
    release = nodeTargets.hold({ reveal: () => false, home: async () => { calls++; return null } })
    await Promise.resolve()
    expect(calls).toBe(2)
    state.setWorkspace(navigateIn(state.workspace(), 0, atNode("another")))
    await Promise.resolve()
    expect(calls).toBe(3)
  } finally { dispose(); release(); files() }
})
