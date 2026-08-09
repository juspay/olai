/**
 * The whole app: a sidebar of the outlines found, and one of them open.
 *
 * The page is decided by ONE subscription. The outline stream carries three
 * answers — no frame yet, a `null` frame, a snapshot — and they are exactly
 * the three things a reader can be looking at: waiting, broken, or reading.
 * The error cell is the detail of the middle one, never the decision, because
 * two subscriptions arriving independently would otherwise disagree for a
 * frame and the page would flash the wrong story.
 *
 * Which outline is open is a route, so a link to one is a link someone can
 * send. Which places are folded is a signal, because it belongs to this tab's
 * reading and not to the file.
 */

import { derive, rowsOf } from "@olai/format"
import { createMemo, createSignal, For, Match, onCleanup, Show, Switch } from "solid-js"

import { Errors } from "./Errors.tsx"
import { TESTID } from "./testids.ts"
import { Tree } from "./Tree.tsx"
import { olai } from "./wire.ts"

/** `/o/<path>` opens that outline; `/` opens the first one found. Encoded per
 *  segment so a path with a directory in it stays readable in the URL bar. */
const ROUTE_PREFIX = "/o/"

const fileFromLocation = (): string | null =>
  location.pathname.startsWith(ROUTE_PREFIX)
    ? decodeURIComponent(location.pathname.slice(ROUTE_PREFIX.length))
    : null

const href = (file: string): string =>
  ROUTE_PREFIX + file.split("/").map(encodeURIComponent).join("/")

export default function App() {
  const frame = olai.streams.outlines.use(() => ({}))
  const errors = olai.cells.errors.use()

  const [route, setRoute] = createSignal(fileFromLocation())
  const [collapsed, setCollapsed] = createSignal<ReadonlySet<string>>(new Set<string>())

  const onPopState = () => setRoute(fileFromLocation())
  addEventListener("popstate", onPopState)
  onCleanup(() => removeEventListener("popstate", onPopState))

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

  const set = () => frame()?.set
  const files = () => set()?.files ?? []
  const current = () => {
    const file = route()
    return file === null ? files()[0] : files().includes(file) ? file : undefined
  }

  // One derivation for the whole set — the same call the validator makes. The
  // rows are per-file; the indexes are not, because a mirror may point into
  // any file and resolving it needs every node.
  const derived = createMemo(() => {
    const loaded = set()
    return loaded === undefined ? undefined : derive(loaded.nodes)
  })
  const rows = createMemo(() => {
    const indexes = derived()
    const file = current()
    return indexes === undefined || file === undefined ? [] : rowsOf(indexes, file)
  })

  return (
    <Switch fallback={<p class="p-8 text-muted">Reading…</p>}>
      <Match when={frame() === null}>
        <Errors errors={errors.value() ?? []} />
      </Match>
      <Match when={set() !== undefined}>
        <div class="grid min-h-screen grid-cols-[16rem_1fr]">
          <nav class="overflow-y-auto border-r border-rule p-4">
            <h1 class="m-0 mb-4 text-base uppercase tracking-widest text-muted">
              olai
            </h1>
            <ul class="m-0 list-none p-0" data-testid={TESTID.outlineList}>
              <For each={files()}>
                {(file) => (
                  <li class="mb-1">
                    <a
                      href={href(file)}
                      class="block break-all rounded px-2 py-1 text-sm no-underline text-inherit hover:bg-rule aria-[current=page]:bg-accent aria-[current=page]:text-paper"
                      data-testid={TESTID.outlineLink}
                      data-file={file}
                      aria-current={current() === file ? "page" : undefined}
                      onClick={open(file)}
                    >
                      {file}
                    </a>
                  </li>
                )}
              </For>
            </ul>
          </nav>

          <main class="overflow-x-auto px-8 py-6">
            <Show when={current()} fallback={<Empty route={route()} files={files()} />}>
              <Tree rows={rows()} collapsed={collapsed()} onToggle={toggle} />
            </Show>
          </main>
        </div>
      </Match>
    </Switch>
  )
}

/** Two different nothings, said differently: the directory holds no outlines,
 *  or it holds outlines and none of them is the one this URL names. */
function Empty(props: {
  readonly route: string | null
  readonly files: ReadonlyArray<string>
}) {
  return (
    <p class="text-muted">
      {props.route !== null && props.files.length > 0
        ? `No outline named ${props.route} under the served directory.`
        : "No .jsonl outlines under the served directory."}
    </p>
  )
}
