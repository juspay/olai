/** Dispatch file pages by the current claim, then ordinary content routes. */

import { unclaimedFileMessage } from "@olai/format"
import { type Address, fileKind } from "@olai/format"
import { content, pages } from "./index.ts"
import { useHere, useRouter } from "./routing.tsx"
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
  const missing = () => {
    const path = address()?.path ?? ""
    const kind = claim()
    if (kind === undefined) return unclaimedFileMessage(path)
    return directory()?.paths().includes(path)
      ? `The browser page for files claimed by the ${kind.kind} row is unavailable.`
      : `No ${kind.noun} named ${path} under the served directory.`
  }
  return <Show when={draw()} keyed fallback={
    <main class="min-w-0 flex-1 p-8" data-testid={TESTID.pane} data-pane={String(here())} data-href={router.routes.href(route())}>
      <Empty testid={UI.nothing} line={address() === undefined ? "No enabled content provider handles this address." : directory()?.standing() === "reading" ? "Reading…" : missing()} />
    </main>
  }>{Page => <Page {...address()!} route={route()} index={here()} />}</Show>
}
