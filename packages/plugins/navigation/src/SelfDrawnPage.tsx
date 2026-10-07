/**
 * ONE PANE'S SELF-DRAWN PLUGIN PAGE — the host of the `self-drawn` kind of
 * `app.route` (`./routes.ts`'s `defineSelfDrawnPage`).
 *
 * A self-drawn page is a component over its route's own value, so hosting it
 * is navigation's: the pane chrome (`data-href`, focus on press, the title it
 * reports) is the same every pane wears, and nothing about it needs a page
 * reading. Outlines hosts the other kind, the node page, and never sees this
 * one.
 *
 * It is the `Page` of the content handler `./browser.tsx`'s `renderer`
 * component contributes — the same component that settles `app.route` — so the
 * claim table and the host of what it claims share one lifetime.
 *
 * A route whose tenant has left draws `Page not found`, as a node page's does.
 */
import { createMemo, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { Empty } from "@olai/web/client/Empty.tsx"
import { TESTID as UI } from "@olai/ui-primitives/testids.ts"
import { useHere, useRouter } from "./routing.tsx"
import { HOME_ROUTE, type Route } from "./routes.ts"
import { TESTID } from "./testids.ts"

/** Whether a route is one this host draws. */
export const selfDrawn = (route: Route): boolean =>
  route.kind === "plugin" && route.source.kind === "self-drawn"

export function SelfDrawnPage() {
  const router = useRouter(), here = useHere()
  const route = createMemo(() => router.panes()[here()]!.route())
  // The same PAGE across a `?q=` keystroke, so the face is not handed a fresh
  // value for a change that was only the filter.
  const opened = createMemo(route, undefined, { equals: router.routes.samePage })
  const face = createMemo(() => {
    const mounted = router.routes.face(opened())
    return mounted?.kind === "self-drawn" ? mounted : null
  })
  const value = (): unknown => { const at = opened(); return at.kind === "plugin" ? at.value : undefined }
  router.report(here, () => ({ pending: false, title: router.routes.label(route()) }))
  return (
    <main
      class="relative flex min-w-0 flex-1 flex-col"
      data-testid={TESTID.pane}
      data-pane={String(here())}
      data-pane-focused={here() === router.focusIndex() ? "true" : undefined}
      data-href={router.routes.href(route())}
      onPointerDown={() => router.focus(here())}
    >
      <Show when={face()} keyed fallback={
        <div class="p-8">
          <Empty
            testid={UI.nothing}
            line="Page not found"
            action={{ label: "Go home", href: router.routes.href(HOME_ROUTE), testid: TESTID.pageGoHome }}
          />
        </div>
      }>
        {(mounted) => <Dynamic component={mounted.face} value={value()} filter={router.routes.filterOf(route())} />}
      </Show>
    </main>
  )
}
