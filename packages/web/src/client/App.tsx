/**
 * The whole app: a sidebar of the outlines found, and one page open.
 *
 * The page is decided by ONE subscription. The outline stream carries three
 * answers — no frame yet, a `null` frame, a snapshot — and they are exactly
 * the three things a reader can be looking at: waiting, broken, or reading.
 * The error cell is the detail of the middle one, never the decision, because
 * two subscriptions arriving independently would otherwise disagree for a
 * frame and the page would flash the wrong story.
 *
 * What is open is a ROUTE — a whole outline (`/o/<file>`) or one node zoomed
 * (`/n/<id>`) — so every page is a link someone can send. Which places are
 * folded, and whether done nodes are drawn, are signals: they belong to this
 * tab's reading and not to the file.
 *
 * This file is the composition and nothing else — the subscription, the route,
 * the one derivation of the set, and which page that adds up to. Every screen
 * it can show is its own component.
 */

import { derive } from "@olai/format"
import { createMemo, Match, Switch } from "solid-js"

import { Errors } from "./Errors.tsx"
import { NodePage } from "./NodePage.tsx"
import { Nothing } from "./Nothing.tsx"
import { arm, outlineOf, pageOf } from "./page.ts"
import { OutlinePage } from "./OutlinePage.tsx"
import { createRouter, RouterProvider } from "./router.tsx"
import { Sidebar } from "./Sidebar.tsx"
import { createView } from "./view.ts"
import { olai } from "./wire.ts"

export default function App() {
  const frame = olai.streams.outlines.use(() => ({}))
  const errors = olai.cells.errors.use()

  const router = createRouter()
  const view = createView(router.route)

  const set = () => frame()?.set
  const files = () => set()?.files ?? []

  // One derivation for the whole set — the same call the validator makes. The
  // rows are per-file; the indexes are not, because a mirror may point into
  // any file and resolving it needs every node.
  const derived = createMemo(() => {
    const loaded = set()
    return loaded === undefined ? undefined : derive(loaded.nodes)
  })

  const page = createMemo(() => {
    const indexes = derived()
    return indexes === undefined ? undefined : pageOf(indexes, files(), router.route())
  })

  return (
    <Switch fallback={<p class="p-8 text-muted">Reading…</p>}>
      <Match when={frame() === null}>
        <Errors errors={errors.value() ?? []} />
      </Match>
      <Match when={derived()}>
        {(indexes) => (
          <RouterProvider router={router}>
            <div class="grid min-h-screen grid-cols-[16rem_1fr]">
              <Sidebar files={files()} active={outlineOf(page())} />
              <main class="overflow-x-auto px-8 py-6">
                <Switch>
                  <Match when={arm(page(), "node")}>
                    {(open) => <NodePage zoomed={open().zoomed} view={view} />}
                  </Match>
                  <Match when={arm(page(), "outline")}>
                    {(open) => (
                      <OutlinePage derived={indexes()} file={open().file} view={view} />
                    )}
                  </Match>
                  <Match when={arm(page(), "nothing")}>
                    {(open) => <Nothing requested={open().requested} />}
                  </Match>
                </Switch>
              </main>
            </div>
          </RouterProvider>
        )}
      </Match>
    </Switch>
  )
}
