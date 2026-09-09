/**
 * THE ROW'S OWN MOUNTING ARITHMETIC: how many of each face one mount holds,
 * which provider each stands on, what the provider's arrest drains, and
 * what a fresh supply re-holds.
 *
 * ## Why here and not in the e2e suite
 *
 * The features say WHICH faces exist; this bench says exactly how many of
 * each ONE mount holds, and whose lifetime each follows. A component's
 * needs decide which of the map's tables a provider's withdrawal drains;
 * any drift between a declared need and a spent service pulls a table out
 * from under a page still saying it has one, and no `tsc --noEmit` will
 * ever see it — the vocabularies match. A mounted row has no such leeway:
 * the mounting IS the table. (The review's B5; the design's §9.1.)
 *
 * ## The registry is the bench's own
 *
 * `@olai/plugin-api`'s shared fixture (`installTestRenderer`) holds a
 * catalogue at `any` width, which collides with the concrete slot
 * declarations the graph's own components import — a plugin-api fixture
 * cannot grow narrower than its own door. The bench owns its registry
 * instead: the five slots this row touches and the sidebar's seat, no
 * shared testbed needed.
 *
 * THE CLAIMS:
 *
 *   - one mount holds exactly ONE each of `app.route`, `app.palette`,
 *     `outline.row.action` and `outline.row.door`, and ONE entry in the
 *     sidebar's vault;
 *   - arresting the router drains the four tables whose components name
 *     `navigation.state` while the palette — its needs are `Slots`
 *     and `Wired` — stands;
 *   - a fresh supply revives each face WITH THE NEW VALUE: the hold the
 *     row's faces read (`./browser/held.ts`) is this activation's router,
 *     never its arrested ancestor's.
 */

import { expect, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"

import type { App, Locations } from "@olai/plugin-api"
import { definePlugin, location, locations, mountPlugin, Offers, openApp, slotFacade, standing } from "@olai/plugin-api"
import { slotContract } from "@olai/plugin-api/slots"
import { sidebar } from "olai-plugin-layout/contract"
import { navigation, type Navigation } from "olai-plugin-navigation/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { railEntries, regions, vaultEntries } from "olai-plugin-sidebar/contract"

import browserRow, { components } from "./browser.tsx"
import { navigationHeld } from "./browser/held.ts"

/** THE RENDER'S OWN REGISTRY SHELL — no DOM, no window: just the locations
 *  the row contributes into, held under the bench's own owner so nothing
 *  here borrows a real renderer's name. */
const installRenderer = (app: App) => Effect.gen(function*() {
  let store!: Locations
  yield* mountPlugin(app.host, definePlugin({
    name: "ui-renderer",
    needs: [Offers],
    apply: Effect.gen(function*() {
      store = yield* locations({})
      const facade = slotFacade(store)
      const offers = yield* Offers
      yield* offers.own("legacy-slots", facade.forOwner)
      yield* offers.own("faces", () => facade.faces)
      yield* offers.own("integrations", () => facade.management)
    }),
  }))
  yield* store.forOwner("test-render").contribute(location("root", "one"), null, {
    children: [
      slotContract("app.route", "nothing"),
      slotContract("app.palette", "nothing"),
      slotContract("outline.row.action", "nothing"),
      slotContract("outline.row.door", "nothing"),
      // The sidebar's SEAT, without its fruit yet: the vault's registration
      // under it holds the OWN contract, labelled below.
      sidebar,
    ],
  })
  yield* store.forOwner("test-render").contribute(
    sidebar,
    { Sidebar: () => null, Rail: () => null } as never,
    { children: [regions, vaultEntries, railEntries] },
  )
  yield* store.settled
  return store
})

test("each mount holds one of each; the router's arrest drains them; the next supply revives on hold", async () => {
  const run = standing()
  const app: App = await run(openApp({ clientFor: () => ({}) }))
  const store = await run(installRenderer(app))

  // THE RENDER'S SIDE OF THE TABLE — the same facade the window's sidebar
  // row would spend from: the bench's own registry's forOwner.
  await run(app.supply(rendererSlots, {
    ...store.forOwner("test-render"),
    read: store.read,
    inspect: store.inspect,
  }))

  /** A service only the needs' lists hold: the row never calls into a
   *  router — the door verbs press it — so the double's whole body is the
   *  identity the hold is checked against. The supply sits under an
   *  explicitly made scope because its close IS the arrest the bench
   *  studies. */

  /** The supply of a router under a scoped lifetime: the scope's close is
   *  the arrest, which is why the double is made per provision — the bench's
   *  identity arithmetic wants the fresh value to be FRESH. */
  const provide = (id: string): Promise<{ readonly value: Navigation; readonly arrest: () => Promise<void> }> => {
    const scope = Scope.makeUnsafe()
    const value = { id, go: () => {} } as unknown as Navigation
    return run(Scope.provide(scope)(app.supply(navigation, value))).then(() => ({
      value,
      arrest: () => Effect.runPromise(Scope.close(scope, Exit.void)),
    }))
  }

  /** THE ROW'S OWN MOUNTS: the row itself plus every component, each its
   * own named supply so one disposal is not another's — `name/<local>` is
   * the runtime's per-component form. */
  const hang = async () => {
    await run(mountPlugin(app.host, { ...browserRow, name: "graph" }))
    for (const [local, component] of Object.entries(components)) {
      await run(mountPlugin(app.host, { ...component, name: `graph/${local}` }))
    }
  }
  const faces = () => ({
    palette: app.hung("app.palette").length,
    route: app.hung("app.route").length,
    verb: app.hung("outline.row.action").length,
    door: app.hung("outline.row.door").length,
    vault: store.read(vaultEntries).length,
  })

  let supply = await provide("v1")
  const arrested = supply.value
  await hang()
  await run(app.settled)

  expect(faces()).toEqual({ palette: 1, route: 1, verb: 1, door: 1, vault: 1 })
  expect(navigationHeld.read()).toBe(arrested)

  // THE ARREST: every component that named the router drains, and with it
  // its face — while the palette, which spend only Slots and Wired, stands.
  await supply.arrest()
  await run(app.settled)

  expect(faces()).toEqual({ palette: 1, route: 0, verb: 0, door: 0, vault: 0 })
  expect(navigationHeld.read()).toBeUndefined()

  // THE REVIVAL: the tables land again — but the hold reads THIS supply's
  // own router, not its arrested ancestor's.
  supply = await provide("v2")
  await run(app.settled)

  expect(faces()).toEqual({ palette: 1, route: 1, verb: 1, door: 1, vault: 1 })
  expect(navigationHeld.read()).toBe(supply.value)
  expect(navigationHeld.read()).not.toBe(arrested)
})
