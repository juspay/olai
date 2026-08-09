/**
 * The whole app: a sidebar of the outlines found, and one of them open.
 *
 * Two subscriptions, read in one order that never changes: if the server has
 * errors, they are the page. An invalid set has no tree to draw — not a
 * partial one, not the last one — so showing anything else would be inventing
 * a state the server never reported.
 *
 * Which outline is open is a route, so a link to one is a link someone can
 * send. Which nodes are folded is a signal, because it belongs to this tab's
 * reading of the file and not to the file.
 */

import type { Outline } from "@olai/format"
import { createMemo, createSignal, For, Show } from "solid-js"

import { Errors } from "./Errors.tsx"
import { Tree } from "./Tree.tsx"
import { olai } from "./wire.ts"

/** `/o/<path>` opens that outline; `/` opens the first one found. Encoded
 *  per segment so a path with a directory in it stays readable in the URL bar. */
const ROUTE_PREFIX = "/o/"

const fileFromLocation = (): string | null =>
  location.pathname.startsWith(ROUTE_PREFIX)
    ? decodeURIComponent(location.pathname.slice(ROUTE_PREFIX.length))
    : null

export default function App() {
  const frame = olai.streams.outlines.use(() => ({}))
  const errors = olai.cells.errors.use()

  const [route, setRoute] = createSignal(fileFromLocation())
  const [collapsed, setCollapsed] = createSignal<ReadonlySet<string>>(new Set<string>())

  addEventListener("popstate", () => setRoute(fileFromLocation()))

  const open = (file: string) => (event: MouseEvent) => {
    // Let a modified click do what the browser does with any link.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    history.pushState(null, "", href(file))
    setRoute(file)
    setCollapsed(new Set<string>())
  }

  const toggle = (key: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (!next.delete(key)) next.add(key)
      return next
    })

  const outlines = createMemo<ReadonlyArray<Outline>>(() => {
    const current = frame()
    return current?.kind === "outlines" ? current.set.outlines : []
  })

  /** The whole set, flat. A mirror may point into any file, so the tree's
   *  lookups need every node even though its roots come from one outline. */
  const allNodes = createMemo(() => outlines().flatMap((outline) => outline.nodes))

  const current = createMemo<Outline | undefined>(() => {
    const file = route()
    return file === null
      ? outlines()[0]
      : outlines().find((outline) => outline.file === file)
  })

  return (
    <Show
      when={(errors.value() ?? []).length === 0}
      fallback={<Errors errors={errors.value() ?? []} />}
    >
      <div class="app">
        <nav class="sidebar">
          <h1 class="brand">olai</h1>
          <ul data-testid="outline-list">
            <For each={outlines()}>
              {(outline) => (
                <li>
                  <a
                    href={href(outline.file)}
                    data-testid="outline-link"
                    data-file={outline.file}
                    aria-current={current()?.file === outline.file ? "page" : undefined}
                    onClick={open(outline.file)}
                  >
                    {outline.file}
                  </a>
                </li>
              )}
            </For>
          </ul>
        </nav>

        <main class="pane">
          <Show when={current()} fallback={<Empty loaded={frame() !== undefined} />}>
            {(outline) => (
              <Tree
                nodes={allNodes()}
                file={outline().file}
                collapsed={collapsed()}
                onToggle={toggle}
              />
            )}
          </Show>
        </main>
      </div>
    </Show>
  )
}

const href = (file: string): string =>
  ROUTE_PREFIX + file.split("/").map(encodeURIComponent).join("/")

/** Two different nothings, said differently: we have not heard from the server
 *  yet, or we have and it found no outlines. */
function Empty(props: { readonly loaded: boolean }) {
  return (
    <p class="empty">
      {props.loaded
        ? "No .jsonl outlines under the served directory."
        : "Reading…"}
    </p>
  )
}
