/** Dispatch file pages by the current claim, then ordinary content routes. */

import { type Address, fileKind } from "@olai/format"
import { content, pages } from "./index.ts"
import { useHere, useRouter } from "./routing.tsx"
import { HOME_ROUTE } from "./routes.ts"
import { panesOf } from "./workspace.ts"
import { readLocation } from "./locations.ts"
import { directory } from "./pages.ts"
import { forFileClaim } from "@olai/plugin-api/file-kinds"
import { createMemo, Show, type JSX } from "solid-js"
import { TESTID } from "./testids.ts"
import { TESTID as UI } from "@olai/ui-primitives/testids.ts"
import { Empty } from "@olai/web/client/Empty.tsx"

export function PageView() {
  const router = useRouter(), here = useHere()
  const route = createMemo(() => panesOf(router.workspace())[here()]!.route)
  const address = createMemo(() => {
    const at = route()
    return at.kind === "at" && at.address !== null && at.address.kind !== "node" ? at.address : undefined
  })
  const claim = createMemo(() => {
    const path = address()?.path, files = directory()
    return path === undefined ? undefined : files?.claims().byKind.get(fileKind(files.claims(), path) ?? "")
  })
  const contributions = createMemo(() => readLocation(pages).map(entry => entry.value))
  const page = createMemo(() => forFileClaim(claim(), contributions()))
  const handler = createMemo(() => readLocation(content).find(({ value }) => value.matches(route()))?.value)
  // Both locations dispatch through one component identity. A file-to-node
  // zoom owned by the same renderer must keep that renderer's undo scope.
  type Props = Address & { readonly route: ReturnType<typeof route>; readonly index: number }
  const draw = createMemo<((props: Props) => JSX.Element) | undefined>(() => address() ? page()?.page : handler()?.Page)
  /** What went wrong, as a heading and one plain line under it. */
  const said = (): { readonly line: string; readonly detail?: string } => {
    if (address() === undefined) {
      return { line: "This page can't be opened", detail: "The plugin that shows it is turned off." }
    }
    if (directory()?.standing() === "reading") return { line: "Loading…" }
    const path = address()?.path ?? ""
    const kind = claim()
    if (kind === undefined) {
      const suffix = /\.[^./]+$/.exec(path)?.[0]
      return {
        line: "Page not found",
        detail: suffix === undefined ? `There is nothing named ${path}.` : `olai can't open ${suffix} files.`,
      }
    }
    return directory()?.paths().includes(path)
      ? { line: "This page can't be opened", detail: `The plugin that opens ${kind.noun}s is turned off.` }
      : { line: "Page not found", detail: `There is no ${kind.noun} named ${path}.` }
  }
  return <Show when={draw()} keyed fallback={
    <main class="min-w-0 flex-1 p-8" data-testid={TESTID.pane} data-pane={String(here())} data-href={router.routes.href(route())}>
      <Empty
        testid={UI.nothing}
        line={said().line}
        detail={said().detail}
        action={said().line === "Loading…" ? undefined : { label: "Go home", run: () => router.go(HOME_ROUTE), testid: TESTID.pageGoHome }}
      />
    </main>
  }>{Page => <Page {...address()!} route={route()} index={here()} />}</Show>
}
