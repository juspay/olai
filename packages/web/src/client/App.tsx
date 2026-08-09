/**
 * The whole app: a sidebar of the outlines found, and one of them open.
 *
 * The page is decided by ONE subscription. The outline stream carries three
 * answers — no frame yet, a `null` frame, a snapshot — and they are exactly
 * the three things a reader can be looking at: waiting, never-loaded, or
 * reading. The error cell is a DETAIL of what is on screen and never the
 * decision, because two subscriptions arriving independently would otherwise
 * disagree for a frame and the page would flash the wrong story.
 *
 * Which is why a live store shows what is wrong in three different places, and
 * they are three because the reader is in three different situations:
 *
 *   - nothing ever loaded → the report IS the page (errors/Page.tsx);
 *   - it loaded and the files have since stopped validating → the last good
 *     tree stays, under a banner (errors/Banner.tsx);
 *   - one file will not parse and the rest are fine → that outline's own pane
 *     carries its errors, and every other outline stays live
 *     (errors/Broken.tsx).
 *
 * Which outline is open is a route, so a link to one is a link someone can
 * send. Which places are folded is a signal, because it belongs to this tab's
 * reading and not to the file.
 */

import { type BrokenFile, derive, type Row, rowsOf } from "@olai/format"
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js"
import { createStore, reconcile } from "solid-js/store"

import { Banner } from "./errors/Banner.tsx"
import { Broken } from "./errors/Broken.tsx"
import { Page as ErrorPage } from "./errors/Page.tsx"
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
  /** What is wrong with the set as a WHOLE right now. Empty is the normal
   *  state, including when one file is unreadable — that one lands in the set
   *  itself, as `broken` below. */
  const problems = () => errors.value() ?? []
  const current = () => {
    const file = route()
    return file === null ? files()[0] : files().includes(file) ? file : undefined
  }

  /** The files that did not parse, by path — the sidebar marks them and the
   *  main pane draws one of them instead of a tree. */
  const broken = createMemo(
    () => new Map((set()?.broken ?? []).map((file) => [file.file, file] as const)),
  )
  const brokenHere = (): BrokenFile | undefined => {
    const file = current()
    return file === undefined ? undefined : broken().get(file)
  }

  // One derivation for the whole set — the same call the validator makes. The
  // rows are per-file; the indexes are not, because a mirror may point into
  // any file and resolving it needs every node.
  const derived = createMemo(() => {
    const loaded = set()
    return loaded === undefined ? undefined : derive(loaded.nodes)
  })

  // RECONCILED into a store rather than handed over as a fresh array, and the
  // live store is why. `rowsOf` mints new objects every time it runs, and a
  // `<For>` compares by reference — so without this, one character changing in
  // one title on disk would tear down and rebuild every row of the open
  // outline: its DOM, its collapse memo, its rendered note. Keyed on `row.key`,
  // which the format already mints per PLACE, the diff touches the rows that
  // actually changed and leaves the rest of the tree standing.
  const [rows, setRows] = createStore<Array<Row>>([])
  createEffect(() => {
    const indexes = derived()
    const file = current()
    const next = indexes === undefined || file === undefined ? [] : rowsOf(indexes, file)
    setRows(reconcile([...next], { key: "key" }))
  })

  return (
    <Switch fallback={<p class="p-8 text-muted">Reading…</p>}>
      <Match when={frame() === null}>
        <ErrorPage errors={problems()} />
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
                      data-broken={broken().has(file) ? "true" : undefined}
                      aria-current={current() === file ? "page" : undefined}
                      onClick={open(file)}
                    >
                      {file}
                      <Show when={broken().has(file)}>
                        <span class="ml-1 text-alarm" title="this file could not be read">
                          ⚠
                        </span>
                      </Show>
                    </a>
                  </li>
                )}
              </For>
            </ul>
          </nav>

          <main class="overflow-x-auto px-8 py-6">
            <Show when={problems().length > 0}>
              <Banner errors={problems()} />
            </Show>
            <Switch fallback={<Empty route={route()} files={files()} />}>
              <Match when={brokenHere()}>{(file) => <Broken file={file()} />}</Match>
              <Match when={current() !== undefined}>
                <Tree rows={rows} collapsed={collapsed()} onToggle={toggle} />
              </Match>
            </Switch>
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
