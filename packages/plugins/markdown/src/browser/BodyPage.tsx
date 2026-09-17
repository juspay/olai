/** Shared read-only page chrome. Every live value is handed in by the page
 * component that declared it; this module owns no client or directory holder. */
import { createMemo, Show, Switch, Match, type JSX } from "solid-js"
import type { Directory } from "olai-plugin-vault/file-state"
import type { Navigation } from "olai-plugin-navigation/contract"
import { useHere, useFollow } from "olai-plugin-navigation/routing"
import { panesOf } from "olai-plugin-navigation/workspace"
import { samePageRequest, type DocumentPageRequest, type PageReading } from "@olai/format"
import { TESTID as NAV } from "olai-plugin-navigation/testids"
import { TESTID as UI } from "@olai/ui-primitives/testids.ts"
import { TESTID } from "../testids.ts"
import { Empty } from "@olai/web/client/Empty.tsx"
import { only } from "@olai/web/client/narrow.ts"
import { CLEARANCE } from "olai-plugin-layout/clearance"
import { documentRequest } from "olai-plugin-markdown/document-route"
import { Referrers } from "olai-plugin-markdown/referrers"

export function BodyPage(props: {
  readonly directory: Directory
  readonly navigation: Navigation
  readonly Body: (props: { readonly file: string }) => JSX.Element
}) {
  const here = useHere(), follow = useFollow()
  const route = () => panesOf(props.navigation.workspace())[here()]!.route
  const request = createMemo<DocumentPageRequest | null>(() => documentRequest(props.directory.claims(), route()), null, {
    equals: (a, b) => a === null || b === null ? a === b : samePageRequest(a, b),
  })
  const reading = props.directory.bodyPage(request)
  const page = createMemo<PageReading | undefined>(previous => reading() ?? previous)
  const file = () => request()?.address.path
  props.navigation.report(here, () => ({ file: file(), title: file() }))
  return <main class={`flex min-w-0 flex-1 flex-col overflow-x-clip px-5 pt-6 pb-16 ${CLEARANCE} md:px-10 md:py-10`}
    data-testid={NAV.pane} data-pane={String(here())}
    data-pane-focused={here() === props.navigation.workspace().focus ? "true" : undefined}
    data-href={props.navigation.routes.href(route())} onPointerDown={() => props.navigation.focus(here())} onClick={follow}>
    <Show when={page()?.shows} fallback={<p class="m-0 py-8 text-muted">Reading…</p>}>
      {shows => <Switch>
        <Match when={only(shows(), "nothing")}>{missing => <Empty testid={UI.nothing} line={`No ${props.directory.claims().byKind.get(missing().sought)?.noun ?? "file"} named ${missing().requested} under the served directory.`} />}</Match>
        <Match when={only(shows(), "document")}>{doc => <Show when={doc().file} keyed>{path =>
          <section data-testid={TESTID.documentPage} data-file={path}>
            <header class="mb-8"><h1 class="m-0 max-w-full break-all font-mono text-sm tracking-tight text-muted">{path}</h1></header>
            <props.Body file={path} />
            <Referrers file={path} reading={page} claims={props.directory.claims()} href={props.navigation.routes.href} />
          </section>
        }</Show>}</Match>
      </Switch>}
    </Show>
  </main>
}
