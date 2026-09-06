import { TESTID as IDS_NAVIGATION } from "olai-plugin-navigation/testids"
import { TESTID as IDS_UI_PRIMITIVES } from "@olai/ui-primitives/testids.ts"
/** A document route reads only document metadata/body. Outline absence does not
 * create an outline page subscription, editor context, filter or drag register. */
import { createMemo, Match, Show, Switch } from "solid-js"
import { nameOf } from "olai-plugin-navigation/address/address.ts"
import { Empty } from "@olai/web/client/Empty.tsx"
import { NAMED } from "olai-plugin-files/kinds"
import { desktop } from "olai-plugin-layout/media"
import { panelOpen } from "olai-plugin-layout/preferences"
import { samePageRequest } from "@olai/format"
import type { DocumentPageRequest } from "@olai/surface"
import { useHistory } from "./history.ts"
import type { Navigation } from "olai-plugin-navigation/contract"
import { useRouter, useHere, useFollow } from "olai-plugin-navigation/routing"
import { hrefOf } from "olai-plugin-navigation/routes"
import { panesOf } from "olai-plugin-navigation/workspace"
import { client } from "olai-plugin-markdown/client"

import { CLEARANCE } from "olai-plugin-layout/clearance"
import { only } from "@olai/web/client/narrow.ts"
import { DocumentPage } from "./document/DocumentPage.tsx"
import { DocumentReading } from "./reading.tsx"
import { documentFile, documentRequest } from "./document-route.ts"

export function MarkdownPageView() {
  const router = useRouter() as Navigation
  const here = useHere()
  const follow = useFollow()
  const route = () => panesOf(router.workspace())[here()]!.route
  const file = () => documentFile(route())
  const request = createMemo<DocumentPageRequest | null>(() => documentRequest(route()), null, {
    equals: (a,b) => a === null || b === null ? a === b : samePageRequest(a,b),
  })
  const reading = client().streams.documentPage.use(request)
  const page = createMemo<import("@olai/format").PageReading | undefined>(was => reading() ?? was)
  const history = useHistory()
  router.report(here, () => ({ history, file: file(), title: nameOf(route(),undefined) }))
  return <main class={`flex min-w-0 flex-1 flex-col overflow-x-clip px-5 pt-6 ${CLEARANCE} md:px-10 md:py-10 ${!desktop() && !panelOpen() ? "pb-16" : ""}`}
    data-testid={IDS_NAVIGATION.pane} data-pane={String(here())}
    data-pane-focused={here() === router.workspace().focus ? "true" : undefined}
    data-href={hrefOf(route())} onPointerDown={() => router.focus(here())} onClick={follow}>
    <DocumentReading value={page}>
      <Show when={page()?.shows} fallback={<p class="m-0 py-8 text-muted">Reading…</p>}>
        {shows => <Switch fallback={<p data-testid={IDS_UI_PRIMITIVES.nothing}>No such document here.</p>}>
          <Match when={only(shows(), "nothing")}>{missing => <Empty testid={IDS_UI_PRIMITIVES.nothing} line={`No ${NAMED[missing().sought].noun} named ${missing().requested} under the served directory.`} />}</Match>
          <Match when={only(shows(), "document")}>{doc => <DocumentPage file={doc().file} custom={doc().props} />}</Match>
        </Switch>}
      </Show>
    </DocumentReading>
  </main>
}
