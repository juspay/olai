import { createMemo, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { Empty } from "@olai/web/client/Empty.tsx"
import { TESTID as UI } from "@olai/ui-primitives/testids.ts"
import { useHere, useRouter } from "./routing.tsx"
import { HOME_ROUTE, type Route } from "./routes.ts"
import { TESTID } from "./testids.ts"

export const selfDrawn = (route: Route): boolean =>
  route.kind === "plugin" && route.source.kind === "self-drawn"

export function SelfDrawnPage() {
  const router = useRouter(), here = useHere()
  const route = createMemo(() => router.panes()[here()]!.route())
  const opened = createMemo(route, undefined, { equals: router.routes.samePage })
  const face = createMemo(() => {
    const mounted = router.routes.face(opened())
    return mounted?.kind === "self-drawn" ? mounted : null
  })
  const value = (): unknown => { const at = opened(); return at.kind === "plugin" ? at.value : undefined }
  router.report(here, () => ({ pending: false, title: router.routes.label(route()) }))
  const narrow = (filter: string): void => router.replaceIn(here(), router.routes.narrowedTo(route(), filter))
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
        {(mounted) => <Dynamic component={mounted.face} value={value()} filter={router.routes.filterOf(route())} narrow={narrow} />}
      </Show>
    </main>
  )
}
