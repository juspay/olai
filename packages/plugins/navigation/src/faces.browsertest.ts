import { expect, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"
import { createMemo, createRoot, createSignal } from "solid-js"

import type { Faces } from "@olai/plugin-api"

import { holdPaletteFaces, holdRouteFaces, routeFaces } from "./faces.ts"
import { holdRoutePages, routing } from "./pages.ts"
import { defineAppPage, defineAppRoute, settleRoutePages } from "./routes.ts"

const dayPage = defineAppPage(
  defineAppRoute<{ readonly date: string }, { readonly kind: "day"; readonly date: string }>({
    claims: [{ kind: "prefix", path: "/d/" }],
    parse: (pathname) => pathname.startsWith("/d/") ? { date: pathname.slice(3) } : null,
    href: (page) => `/d/${page.date}`,
    breadcrumb: (page) => page.date,
    narrowable: true,
    request: (page) => ({ kind: "day", date: page.date }),
    stream: { use: () => () => undefined },
  }),
  () => null,
)

const [revision, moved] = createSignal(0)
const rendererTable: Faces = {
  hung: ((slot: string) => {
    revision()
    return slot === "app.route" ? [{ plugin: "journal", face: dayPage }] : []
  }) as Faces["hung"],
  dressed: (() => { revision(); return new Map() }) as Faces["dressed"],
  only: (() => { revision(); return null }) as Faces["only"],
}

test("the journal's URL is still the journal's after the palette withdraws", () =>
  Effect.runPromise(Effect.gen(function*() {
    const renderer = yield* Scope.make()
    const palette = yield* Scope.make()
    yield* Scope.provide(holdRouteFaces(rendererTable), renderer)
    const settling = createRoot((dispose) => {
      const stop = holdRoutePages(createMemo(() => settleRoutePages(routeFaces("app.route"))))
      return () => { dispose(); stop() }
    })
    yield* Scope.provide(holdPaletteFaces(rendererTable), palette)

    expect(routing.routeIn("/d/2026-09-07")?.kind).toBe("plugin")

    yield* Scope.close(palette, Exit.void)
    expect(routeFaces("app.route")).toHaveLength(1)
    moved((at) => at + 1)
    expect(routing.routeIn("/d/2026-09-07")?.kind).toBe("plugin")

    const again = yield* Scope.make()
    yield* Scope.provide(holdPaletteFaces(rendererTable), again)
    moved((at) => at + 1)
    expect(routing.routeIn("/d/2026-09-07")?.kind).toBe("plugin")
    yield* Scope.close(again, Exit.void)
    moved((at) => at + 1)
    expect(routing.routeIn("/d/2026-09-07")?.kind).toBe("plugin")

    yield* Scope.close(renderer, Exit.void)
    moved((at) => at + 1)
    expect(routeFaces("app.route")).toHaveLength(0)
    expect(routing.routeIn("/d/2026-09-07")?.kind).not.toBe("plugin")
    settling()
  })))
