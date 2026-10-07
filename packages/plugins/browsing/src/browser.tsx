/**
 * THE BROWSING ROW'S BROWSER HALF — the `/browser` page, its row in the bar's
 * health popover, its door in the sidebar column and rail (the way there on a
 * phone), and a palette row that opens it.
 *
 * One reactive root per activation holds the row's readings — the standing
 * and the tab set, one subscription each however many panes draw them — and
 * is disposed with the activation, so a switched-off row leaves nothing
 * subscribed. Each pane opens its own screencast and closes it with itself.
 */
import { Bar, definePlugin, Slots, Wired } from "@olai/plugin-api"
import { Effect } from "effect"
import { defineSelfDrawnPage, defineSelfDrawnRoute } from "olai-plugin-navigation/routes"
import type {} from "olai-plugin-layout/slots"
import type {} from "olai-plugin-navigation/slots"
import type {} from "olai-plugin-sidebar/slots"
import { createRoot } from "solid-js"
import { type BrowsingClient, createBrowsing } from "./browser/client.ts"
import { BrowserEntry, BrowserRail, type Door } from "./browser/Entry.tsx"
import { BrowserHeader } from "./browser/Header.tsx"
import { BrowserPage, type Shown } from "./browser/Page.tsx"
import { lookOf } from "./browser/said.ts"
import { BROWSER_PATH, name } from "./wire.ts"

export { name, surface } from "./wire.ts"

const PREFIX = `${BROWSER_PATH}/`

export default definePlugin({
  name,
  needs: [Bar, Slots, Wired],
  apply: Effect.gen(function*() {
    const bar = yield* Bar
    const slots = yield* Slots
    const wired = yield* Wired
    const owned = yield* Effect.acquireRelease(
      Effect.sync(() => createRoot((dispose) => ({ dispose, browsing: createBrowsing(wired.client() as BrowsingClient) }))),
      (held) => Effect.sync(held.dispose),
    )
    const browsing = owned.browsing

    // `/browser` is the first tab (or the standing and its Start); a tab's
    // own address is `/browser/<target id>`. The breadcrumb is that tab's
    // title, read live, so a tab and its pane are named as the page is.
    const route = defineSelfDrawnRoute<Shown>({
      claims: [{ kind: "exact", path: BROWSER_PATH }, { kind: "prefix", path: PREFIX }],
      parse: (pathname) => {
        if (pathname === BROWSER_PATH) return { targetId: null }
        let id: string
        try { id = decodeURIComponent(pathname.slice(PREFIX.length)) } catch { return null }
        return /^[\w-]+$/.test(id) ? { targetId: id } : null
      },
      href: ({ targetId }) => targetId === null ? BROWSER_PATH : `${PREFIX}${encodeURIComponent(targetId)}`,
      breadcrumb: ({ targetId }) => {
        const shown = browsing.shown(targetId)
        return (shown === null ? undefined : browsing.tab(shown))?.title || "Browser"
      },
      narrowable: false,
    })
    const href = (targetId: string | null) => route.href({ targetId })
    yield* slots.register("app.route", defineSelfDrawnPage(route, (props) => (
      <BrowserPage value={props.value} browsing={browsing} href={href} route={(targetId) => route.to({ targetId })} />
    )))
    yield* slots.register("app.header", {
      place: "cluster",
      body: () => <BrowserHeader app={bar} standing={browsing.standing} href={BROWSER_PATH} />,
      status: () => {
        const look = lookOf(browsing.standing())
        return { tone: look.tone, label: look.label }
      },
    })
    const door: Door = {
      route: route.to({ targetId: null }),
      showing: (shown) => route.value(shown) !== null,
      standing: browsing.standing,
    }
    yield* slots.register("sidebar.entry", {
      place: "top",
      body: () => <BrowserEntry door={door} />,
      rail: () => <BrowserRail door={door} />,
    })
    yield* slots.register("app.palette", {
      id: "browsing-open",
      label: "Open browser",
      hint: "The browser your agents use, live",
      search: "open browser web tabs sign in agents playwright",
      href: BROWSER_PATH,
    })
  }),
})
