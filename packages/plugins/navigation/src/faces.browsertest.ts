/**
 * A PLUGIN'S URL SURVIVES THE PALETTE LEAVING — the product consequence of
 * `./faces.ts`'s two holders, asked of this row's own modules.
 *
 * ## What this is about
 *
 * The renderer settles `app.route` into the claim table (`./pages.ts`); the
 * palette draws `app.command` and `app.palette`. Both are components of this
 * row, and both are handed the SAME `Faces` object — a slot table is one thing
 * ui-renderer gives everybody. They held into ONE holder, and they do not stop
 * together: the palette additionally names `layout.shell` and the clock, so
 * switching the layout row off stops the palette and leaves the renderer
 * standing.
 *
 * What a reader saw was a URL changing meaning under them. With the holder
 * cleared by the departing palette, `app.route` answered `[]`, the claims
 * settled to `NO_PAGES`, and `/d/2026-09-07` stopped being the journal's page
 * and became a path into the vault — with the row that claims it still mounted
 * and still drawing.
 *
 * ## Why it is asked HERE and not of the holder
 *
 * `@olai/plugin-api`'s `held-faces.browsertest.ts` pins the primitive: a hold
 * clears by its own token, and one holder is one slot whatever the token. That
 * second rule is the reason a better identity check could not have saved this
 * — so the claim worth keeping is the one a reader would notice, made out of
 * the modules that actually decide it: this row's two holders, its settling of
 * the claim table, and its own grammar reading a URL.
 *
 * Under the browser condition because the claim table is a memo over the slot
 * reading, and a server-resolved Solid never recomputes one.
 */
import { expect, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"
import { createMemo, createRoot, createSignal } from "solid-js"

import type { Faces } from "@olai/plugin-api"

import { holdPaletteFaces, holdRouteFaces, routeFaces } from "./faces.ts"
import { holdRoutePages, routing } from "./pages.ts"
import { defineAppPage, defineAppRoute, settleRoutePages } from "./routes.ts"

/** The journal's day page, near enough: one prefix claim and a parse, which is
 *  all the grammar reads to decide whose page a URL is. */
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

/**
 * ONE SLOT TABLE, handed to both components the way ui-renderer hands it —
 * including the part that makes a reading RE-READ.
 *
 * `Faces` reads through the renderer's own revision (`AppConfig.reading`), so a
 * memo over `hung` recomputes when the slot store moves. A table without that
 * tick would let every case below pass on a memo that ran once, which is the
 * failure the browser condition exists to prevent — so the revision is here and
 * a withdrawal ticks it, exactly as a component's registrations leaving does.
 */
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
    // The renderer's half, spelled as `./browser.tsx` spells it.
    yield* Scope.provide(holdRouteFaces(rendererTable), renderer)
    const settling = createRoot((dispose) => {
      const stop = holdRoutePages(createMemo(() => settleRoutePages(routeFaces("app.route"))))
      return () => { dispose(); stop() }
    })
    // ...and the palette's, over the same table and a scope of its own.
    yield* Scope.provide(holdPaletteFaces(rendererTable), palette)

    expect(routing.routeIn("/d/2026-09-07")?.kind).toBe("plugin")

    // THE WITHDRAWAL THIS IS ABOUT: layout leaves, so the palette stops. The
    // renderer has not moved and the journal has not moved.
    yield* Scope.close(palette, Exit.void)
    expect(routeFaces("app.route")).toHaveLength(1)
    // ...and the same after the slot store moves under it, which is what the
    // palette's own registrations leaving does: the memo re-reads, and what it
    // re-reads is the renderer's hold, still standing.
    moved((at) => at + 1)
    expect(routing.routeIn("/d/2026-09-07")?.kind).toBe("plugin")

    // ...and when the renderer does stop, the claim goes with it, which is the
    // empty reading this row has always had before its renderer settled.
    yield* Scope.close(renderer, Exit.void)
    moved((at) => at + 1)
    expect(routeFaces("app.route")).toHaveLength(0)
    expect(routing.routeIn("/d/2026-09-07")?.kind).not.toBe("plugin")
    settling()
  })))
