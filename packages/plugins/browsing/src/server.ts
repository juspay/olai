import type { ImplementSurfaceDeps, SurfaceCtx } from "@kolu/surface/server"
import { Clock, definePlugin, Env, LocalState, SessionStart, Surfaces } from "@olai/plugin-api/services"
import { Effect } from "effect"
import { join } from "node:path"
import { name } from "./index.ts"
import { launchChromium, LaunchFailure, SANDBOX_KNOB, sandboxFlags } from "./chromium.ts"
import { openLive } from "./live.ts"
import { probing } from "./probe.ts"
import { ownProbe } from "./owned.ts"
import { openScratch } from "./scratch.ts"
import { faces, surface, type Tab } from "./wire.ts"
export { name } from "./index.ts"
export { faces, surface } from "./wire.ts"

type Ctx = SurfaceCtx<typeof surface.spec>

/** What the pane says when this serve has no Chromium to show. */
export const ABSENT_WHY =
  "No browser is configured for olai: OLAI_BROWSER_CHROMIUM is empty, so each conversation's browser tools launch an isolated browser of their own that olai cannot show."

/**
 * THE BROWSING ROW, which now OWNS the browser its agents use.
 *
 * Teardown runs in the reverse of the order below, and that order is the
 * point: the session-start registration goes first so no new conversation
 * asks; the probe gate then refuses late callers and joins running probes
 * (one may be waiting on a launch); the surface member goes; the browser is
 * stopped and reaped; and only then is the scratch the handed-over MCPs wrote
 * into removed.
 */
export default definePlugin({
  name,
  environment: [
    {"key": "OLAI_BROWSER_MCP", "secret": false, "says": "the absolute Playwright MCP executable; empty disables browser tools"},
    {"key": "OLAI_BROWSER_CHROMIUM", "secret": false, "says": "the absolute Chromium executable olai runs for its agents and shows at /browser; empty gives each conversation an isolated browser instead"},
    {"key": "OLAI_BROWSER_CHROMIUM_SANDBOX", "secret": false, "says": "on (the default) runs that Chromium inside its own sandbox; off drops it, for a container that is already the boundary"},
  ],
  needs: [Clock, Env, LocalState, SessionStart, Surfaces],
  apply: Effect.gen(function*() {
    const clock = yield* Clock
    const env = yield* Env
    const local = yield* LocalState
    const opening = yield* SessionStart
    const surfaces = yield* Surfaces
    const output = yield* openScratch(env.vars["XDG_RUNTIME_DIR"])
    const chromium = env.vars["OLAI_BROWSER_CHROMIUM"]?.trim() || null
    // Read as the person set it, never inferred from the host.
    const sandbox = sandboxFlags(env.vars[SANDBOX_KNOB])

    // Filled the moment core mints this sibling's write face. Until then the
    // members answer from the owner's own state, which is what they read.
    let mine: Ctx | undefined
    const live = yield* openLive({
      chromium,
      absentWhy: ABSENT_WHY,
      profile: Effect.map(local.directory, (directory) => join(directory, "profile")),
      now: clock.now,
      launch: (executable, profile) => "why" in sandbox
        ? Effect.fail(new LaunchFailure({ why: sandbox.why }))
        : launchChromium(executable, profile, { extraFlags: sandbox }),
      publish: {
        standing: (standing) => mine?.cells.standing.set(standing),
        tab: (tab) => mine?.collections.tabs.upsert(tab.id, tab),
        untab: (id) => mine?.collections.tabs.remove(id),
      },
    })
    yield* surfaces.register({
      surface,
      faces,
      deps: {
        cells: {
          standing: { store: { get: live.standing, set: () => {} } },
        },
        collections: {
          tabs: { readAll: () => new Map<string, Tab>(live.tabs()), upsert: () => {}, remove: () => {} },
        },
        streams: {
          screencast: { source: live.screencast },
        },
        procedures: {
          tab: {
            input: ({ input }) => live.input(input.targetId, input.event),
            navigate: ({ input }) => live.navigate(input.targetId, input.url),
            open: () => live.open,
            close: ({ input }) => live.close(input.targetId),
          },
          browser: {
            start: () => live.start,
            forgetSignIns: () => live.forget,
          },
        },
      } satisfies ImplementSurfaceDeps<typeof surface.spec>,
      published: (bound) => {
        mine = bound as Ctx
      },
    })
    // Env supplies runtime placement, as it does for mail; it is not a row knob.
    const ask = yield* ownProbe(Effect.scoped(probing(env.vars, output, 5_000, chromium === null ? null : live.attach)))
    yield* opening.ask(ask)
  }),
})
