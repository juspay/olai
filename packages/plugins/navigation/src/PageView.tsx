/** Dispatch file pages by the current claim, then ordinary content routes. */

import { type Address, fileKind } from "@olai/format"
import { content, pages } from "./index.ts"
import { useHere, useRouter } from "./routing.tsx"
import { HOME_ROUTE } from "./routes.ts"
import { readLocation } from "./locations.ts"
import { directory, pluginFilePages } from "./pages.ts"
import type { FilePageFace } from "./slots.ts"
import { forFileClaim } from "@olai/plugin-api/file-kinds"
import { createMemo, Show, type JSX } from "solid-js"
import { TESTID } from "./testids.ts"
import { TESTID as UI } from "@olai/ui-primitives/testids.ts"
import { Empty } from "@olai/web/client/Empty.tsx"

const REVEALING = {
  finding: { line: "Finding…" },
  missing: { line: "Page not found", detail: "There is no node at this address." },
  unavailable: { line: "This page can't be opened", detail: "The outline could not say where this node lives." },
} as const

export function PageView() {
  const router = useRouter(), here = useHere()
  const route = createMemo(() => router.panes()[here()]!.route())
  const revealing = createMemo(() => { const at = route(); return at.kind === "at" && at.reveal })
  const address = createMemo(() => {
    const at = route()
    return at.kind === "at" && at.address !== null && at.address.kind !== "node" ? at.address : undefined
  })
  const claim = createMemo(() => {
    const path = address()?.path, files = directory()
    return path === undefined ? undefined : files?.claims().byKind.get(fileKind(files.claims(), path) ?? "")
  })
  // The location's pages, then each plugin's `file.page` face as the page for
  // the kind that plugin claimed: settled and held by the `renderer`
  // component, one page per registration (`./file-pages.ts`), and read here
  // through that tracked holder.
  const contributions = createMemo(() => [
    ...readLocation(pages).map(entry => entry.value),
    ...pluginFilePages(),
  ])
  const page = createMemo(() => forFileClaim(claim(), contributions()))
  const handler = createMemo(() => readLocation(content).find(({ value }) => value.matches(route()))?.value)
  // Both locations dispatch through one component identity. A file-to-node
  // zoom owned by the same renderer must keep that renderer's undo scope.
  type Props = Address & { readonly route: ReturnType<typeof route>; readonly index: number }
  const draw = createMemo<((props: Props) => JSX.Element) | undefined>(() => revealing() ? undefined : address() ? page()?.page : handler()?.Page)
  /** What went wrong, as a heading and one plain line under it. */
  const said = (): { readonly line: string; readonly detail?: string } => {
    if (revealing()) return REVEALING[router.revealState(here()) ?? "finding"]
    if (address() === undefined) {
      return { line: "This page can't be opened", detail: "The plugin that shows it is turned off." }
    }
    /**
     * NOTHING IS MISSING UNTIL THE DIRECTORY HAS ANSWERED. Every sentence
     * below is a statement about the vault's CLAIMS — which kinds are known,
     * which paths are held — so a page that says one before the reading has
     * arrived is saying what it would say about an empty vault: that this
     * suffix is one olai cannot open. For the frames between the first paint
     * and the reading, `/money/nowhere.journal` therefore read "Page not
     * found / olai can't open .journal files." — a false line, under the
     * TRUE line's own heading, which is what made a step waiting for that
     * heading read a page that was about to be replaced (the CI failure
     * "the empty page reads []": the heading matched the guess, and the
     * guess was gone by the time its lines were read).
     *
     * THE THREE SILENCES ARE ONE WORD: the service not held yet (the row
     * composing, or the vault switched off), a head reading in flight, and
     * the KIND TABLE not arrived — which is a third channel and the one this
     * page turned out to be racing. `standing()` answers `loaded` the moment
     * the heads carry a path, deliberately (`olai-plugin-vault`'s
     * `directory.ts` on `manifest-fold-skew`), and the claims ride a cell of
     * their own: for the frames in between, the paths are known and NO
     * SUFFIX IS. A tab that knows no kind at all knows nothing about any
     * file, which is the first frame rather than an answer about this one.
     */
    const held = directory()
    if (held === undefined || held.standing() === "reading" || held.claims().byKind.size === 0) {
      return { line: "Loading…" }
    }
    const path = address()?.path ?? ""
    const kind = claim()
    if (kind === undefined) {
      const suffix = /\.[^./]+$/.exec(path)?.[0]
      return {
        line: "Page not found",
        detail: suffix === undefined ? `There is nothing named ${path}.` : `olai can't open ${suffix} files.`,
      }
    }
    return held.paths().includes(path)
      ? { line: "This page can't be opened", detail: `The plugin that opens ${kind.noun}s is turned off.` }
      : { line: "Page not found", detail: `There is no ${kind.noun} named ${path}.` }
  }
  return <Show when={draw()} keyed fallback={
    <main class="min-w-0 flex-1 p-8" data-testid={TESTID.pane} data-pane={String(here())} data-href={router.routes.href(route())}>
      <Empty
        testid={UI.nothing}
        line={said().line}
        detail={said().detail}
        action={said().line === "Loading…" ? undefined : { label: "Go home", href: router.routes.href(HOME_ROUTE), testid: TESTID.pageGoHome }}
      />
    </main>
  }>{Page => <Page {...address()!} route={route()} index={here()} />}</Show>
}

/** A plugin's face for one file, handed the file's revision so it can read the
 *  file again when it moves. */
export function PluginFilePage(props: { readonly face: FilePageFace; readonly file: string }) {
  // One head reading per held directory, not one per read of the revision.
  const head = createMemo(() => directory()?.head(() => props.file))
  const Face = props.face
  return <Face file={props.file} revision={head()?.()} />
}
