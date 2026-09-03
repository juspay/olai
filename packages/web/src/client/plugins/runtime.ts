/**
 * THE TAB'S PLUGIN RUNTIME — one runtime, booted once, and the plugins on it
 * are exactly the ones this serve is running.
 *
 * ## What this replaced, and the four modules that went with it
 *
 * A compiled-in registry of manifests and four walks over it — the dressing
 * table, the chrome cluster, the mount fold and the mark lookup — each carrying
 * a LICENCE argument beside it, because a manifest is present whether or not
 * the serve composed the plugin. There were two licences and they pointed
 * opposite ways: a face drawn early and taken away is a flicker, so the draw
 * licence was generous before the roster; a subscription opened early LATCHES a
 * `degraded` readout for the life of the page, so the subscribe licence was
 * nothing until the roster spoke. That asymmetry was correct and it took a
 * module to argue.
 *
 * None of it survives, and none of it is missed, because the thing being
 * licensed is gone: a plugin the roster does not name is never MOUNTED here, so it
 * registered nothing, so there is no face to draw and no subscription to open.
 * *No plugin, no surface, no handler* on the server; *no plugin, no slot entry*
 * in the tab. One sentence, both processes.
 *
 * ## What is on this runtime
 *
 * The four services a browser half may name in its `needs` — `Slots`, where
 * every face hangs; `Clocks`, the app's duration ladder; `Bar`, the chrome's
 * geometry and the panel that hangs off it; `Links`, the door onto a served
 * file — plus `Wired`, which hands a plugin its own sibling client minted from
 * its own word so it cannot be asked for under another plugin's name.
 *
 * They are provided BEFORE any plugin, which is what makes a `waiting` plugin
 * unreachable in this phase and is the same order `/server`'s `serve.ts`
 * keeps. A plugin that named a service nobody provides would simply never
 * start, and the preferences row would say `waiting`.
 *
 * ## THE RE-READ IS SOLID'S AND THE TABLE IS THE RUNTIME'S
 *
 * `openApp` holds the table and says when it moved; this module owns the signal
 * the app re-reads it through. That split is the server's `changed` exactly: a
 * service that re-rendered would be a service that had heard of Solid, and the
 * one below has not.
 *
 * ## The client is a HOLDER, and the reason is a cycle
 *
 * `Wired` needs the live connection's sibling clients, and the connection
 * is `../wire.ts`'s, which imports this module to compose. So the direction
 * runs one way and the value arrives as an argument to {@link composeTo} —
 * which is also what stops it being a second call somebody can forget.
 */

import type { BrowserHalf } from "@olai/bundle"
import {
  type App,
  type Hung,
  type KindSlot,
  mountPlugin,
  openApp,
  type PluginSlot,
  type SlotFaces,
} from "@olai/plugin-api"
import { Effect, Scope } from "effect"
import { createSignal } from "solid-js"

/** WHEN A FACE ARRIVED OR LEFT — the one signal every slot read is tracked
 *  through. A counter rather than a store, because the reads below hand back a
 *  fresh array or map either way and what a consumer needs is to be told to
 *  re-read. */
const [moved, setMoved] = createSignal(0)

/** THE SIBLING CLIENTS, as a holder — see the header on why they are not an
 *  import. `null` before the wire has spoken, which is every read before the
 *  first roster lands and is a state no plugin fiber can see: a fiber is
 *  mounted only after the redial that carries its client. */
let clients: ((plugin: string) => unknown) | null = null

/** ...told by {@link composeTo}, which is the only thing that may set it —
 *  see that function on why the two are one act. */

/** THE PAGE'S SCOPE, and the one place an Effect is run from a module that is
 *  not one. A tab has no shutdown short of the page going away, so the scope is
 *  never closed — what it is FOR is that every registration a plugin makes hangs
 *  off it and unwinds when that plugin is dropped. */
const scope = Scope.makeUnsafe()
const run = <A>(work: Effect.Effect<A, never, Scope.Scope>): Promise<A> =>
  Effect.runPromise(Effect.provideService(work, Scope.Scope, scope))

/**
 * THE RUNTIME ITSELF, exported so `./furniture.tsx` can hang the app's three
 * chrome services on it — see the header on why this module may not import them
 * itself.
 *
 * `slots` and `wired` are provided HERE, by `openApp`: the table carries no
 * drawing and the client lookup is a read over the holder above, so neither
 * reaches a component — which is what keeps this module a `.ts` on a graph with
 * no JSX on it.
 */
export const app: App = await run(
  openApp({
    changed: () => setMoved((at) => at + 1),
    clientFor: (plugin) => clients?.(plugin) ?? null,
  }),
)

/** WHAT IS MOUNTED RIGHT NOW, by name — so a re-compose can drop exactly the
 *  ones that left and start exactly the ones that arrived rather than tearing
 *  the whole runtime down and rebuilding it. A survivor keeping its plugin is
 *  the browser's half of the rule the server's re-compose keeps: a plugin that
 *  has been drawing since boot must not be restarted because a different plugin
 *  arrived. */
const mounted = new Map<string, { readonly dispose: Effect.Effect<void> }>()

/**
 * MOUNT EXACTLY THESE, and drop everything else.
 *
 * Called by `../wire.ts` after a redial, with the halves it has already loaded
 * and dialled — so a fiber is only ever started over a wire that carries its
 * sibling, and a fiber whose sibling has left is disposed before the wire
 * stops answering for it.
 *
 * A HALF WHOSE `apply` FAILS DOES NOT TAKE THE PAGE DOWN. The runtime lands it
 * in `failed` having installed nothing — every registration is a finalizer, and
 * the ones it had made are unwound — with its siblings running. So a plugin
 * whose browser half is broken is one absent set of faces rather than a white
 * tab, which is the same bargain its server half already makes.
 *
 * ## THE CLIENTS ARRIVE HERE, and that is one act rather than two
 *
 * `Wired` needs the live connection's sibling clients, and the connection
 * is `../wire.ts`'s, which imports this module — so the value cannot be an
 * import and arrives through the holder above.
 *
 * It arrives as an ARGUMENT TO THIS CALL, and briefly did not: there was a
 * `readClientsFrom` beside this, and the caller had to invoke the two in order.
 * That turned the invariant the whole redial sequence exists for — *a fiber is
 * only ever started over a wire that carries its sibling* — into "call these
 * two exports in this order", enforced by nothing but the adjacency of two
 * lines in another module. One parameter makes it unspellable instead: there is
 * no way to mount a fiber without having said which wire it mounts over.
 */
export const composeTo = async (
  halves: ReadonlyArray<BrowserHalf>,
  clientFor: (plugin: string) => unknown,
): Promise<void> => {
  clients = clientFor
  const wanted = new Map(halves.map((half) => [half.default.name, half] as const))
  // OUT FIRST, so a plugin that left has unwound its registrations before a
  // plugin that arrived can claim a key it was holding. The two orders differ
  // only for a kind word two plugins could both claim, which the loader already
  // forbids — but the order that cannot be wrong costs nothing to pick.
  for (const [name, plugin] of [...mounted]) {
    if (wanted.has(name)) continue
    mounted.delete(name)
    await run(plugin.dispose)
  }
  for (const [name, half] of wanted) {
    if (mounted.has(name)) continue
    // `mountPlugin` RETURNS once the plugin has settled, whichever way — a half
    // that failed has already been contained by the runtime, so what is awaited
    // here is only "it has finished trying" and the page can draw whatever did
    // start.
    const plugin = await run(mountPlugin(app.host, half.default))
    mounted.set(name, plugin)
    const report = await run(plugin.report)
    if (report.state === "failed") {
      // A FAILED HALF DOES NOT STAY MOUNTED. `mounted` is what the guard four
      // lines up reads to skip a plugin that is already up, so an entry left
      // here after its `apply` failed is a plugin this tab will never try again
      // — not on the next roster frame, not after a redial that rebuilt
      // everything else. Nothing about the failure says it is permanent: a half
      // whose `apply` reached for a member the wire had not settled, or died on
      // a value one frame of the roster carried, deserves the next frame. The
      // runtime has already unwound whatever it had registered, so dropping the
      // entry leaves no residue behind it.
      mounted.delete(name)
      // ...AND IT SAYS SO. The containment is right and the SILENCE was not: a
      // half whose `apply` threw registers no faces, so the plugin is simply
      // absent from the page — while the panel two chips over reads the SERVER's
      // answer and says `running`, because on the server it is. Two ends, two
      // truths, and nothing on screen or in the console reconciling them.
      //
      // This is the one place that knows, so this is where it is said, with the
      // plugin's NAME on it. An `error` rather than a `warn`: a plugin the
      // roster asked for and that did not start is a fault, which is the same
      // reading `rows.ts` gives the server-side `failed`.
      //
      // WHAT IS STILL OWED is the panel's half — a tab-side failure drawn
      // beside the server-side state, since they are genuinely two facts and a
      // reader with the console shut has only one of them. That wants a field
      // on the roster row's browser reading rather than a console line, and it
      // is not this phase's.
      console.error(
        `olai: the plugin "${name}" is running on the server, but its browser half failed to start — its faces are absent from this page`,
        report.fault,
      )
    }
  }
}

/** WHAT IS HUNG IN A PLUGIN-KEYED SLOT, in mount order — tracked, so a caller
 *  reading it inside a memo or a component re-reads when a plugin arrives or
 *  leaves. */
export const hung = <S extends PluginSlot>(slot: S): ReadonlyArray<Hung<SlotFaces[S]>> => {
  moved()
  return app.hung(slot)
}

/** ...and what dresses each composed KIND WORD, the same way. */
export const dressed = <S extends KindSlot>(slot: S): ReadonlyMap<string, SlotFaces[S]> => {
  moved()
  return app.dressed(slot)
}

/**
 * THE APP'S OWN THREE, PROVIDED — `./furniture.tsx`'s one call.
 *
 * A second entry rather than a field on {@link composeTo}, and the reason is a
 * GRAPH rather than taste: the clock, the bar and the file door are assembled in
 * a `.tsx` (a link is a component and a popover portals one), and this module is
 * a `.ts` reached by `./marks.ts`, which is reached by the chat panel, which is
 * imported by suites that run under a process with no Solid transform. A static
 * import of that module from here would put a JSX factory on the graph of a test
 * that only wanted a lookup.
 */
export const furnish = (furniture: Parameters<App["furnish"]>[0]): Promise<void> =>
  run(app.furnish(furniture))
