/**
 * THE TAB'S PLUGIN RUNTIME — one Cordis context, booted once, and the fibers on
 * it are exactly the plugins this serve is running.
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
 * licensed is gone: a plugin the roster does not name has no FIBER here, so it
 * registered nothing, so there is no face to draw and no subscription to open.
 * *No fiber, no surface, no handler* on the server; *no fiber, no slot entry*
 * in the tab. One sentence, both processes.
 *
 * ## What is on this context
 *
 * The four services a browser half may name in its `inject` — `slots`, where
 * every face hangs; `clocks`, the app's duration ladder; `bar`, the chrome's
 * geometry and the panel that hangs off it; `links`, the door onto a served
 * file — plus `wired`, which hands a plugin its own sibling client keyed by the
 * fiber so it cannot be asked for under another plugin's name.
 *
 * They are mounted BEFORE any plugin, which is what makes a `PENDING` fiber
 * unreachable in this phase and is the same order `@olai/server`'s `serve.ts`
 * keeps. A plugin that named a service nobody provides would simply never
 * start, and the preferences row would say `waiting`.
 *
 * ## THE RE-READ IS SOLID'S AND THE TABLE IS CORDIS'S
 *
 * `Slots` holds the table and says when it moved; this module owns the signal
 * the app re-reads it through. That split is `Surfaces.changed`'s on the server
 * exactly: a service that re-rendered would be a service that had heard of
 * Solid, and the one below has not.
 *
 * ## The client is a HOLDER, and the reason is a cycle
 *
 * `ctx.wired` needs the live connection's sibling clients, and the connection
 * is `../wire.ts`'s, which imports this module to compose. So the direction
 * runs one way and the value arrives as an argument to {@link composeTo} —
 * which is also what stops it being a second call somebody can forget.
 */

import type { BrowserHalf } from "@olai/bundle"
import {
  type Hung,
  type KindSlot,
  type PluginSlot,
  type SlotFaces,
  Slots,
  Wired,
} from "@olai/plugin-api"
import { Context } from "cordis"
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

/**
 * THE CONTEXT ITSELF, exported so `./furniture.tsx` can hang the app's three
 * chrome services on it — see the header on why this module may not import
 * them itself.
 */
export const ctx = new Context()

// THE TWO THAT CARRY NO DRAWING, mounted here. `Slots` is the table and
// `Wired` is a lookup over a holder; neither reaches a component, which is
// what keeps this module a `.ts` on a graph with no JSX on it.
await ctx.plugin(Slots, { changed: () => setMoved((at) => at + 1) })
await ctx.plugin(Wired, { clientFor: (plugin) => clients?.(plugin) ?? null })

/** WHAT IS MOUNTED RIGHT NOW, by name — the fibers, so a re-compose can drop
 *  exactly the ones that left and start exactly the ones that arrived rather
 *  than tearing the whole context down and rebuilding it. A survivor keeping
 *  its fiber is the browser's half of the rule the server's re-compose keeps:
 *  a plugin that has been drawing since boot must not be restarted because a
 *  different plugin arrived. */
const mounted = new Map<string, { readonly dispose: () => Promise<void> }>()

/**
 * MOUNT EXACTLY THESE, and drop everything else.
 *
 * Called by `../wire.ts` after a redial, with the halves it has already loaded
 * and dialled — so a fiber is only ever started over a wire that carries its
 * sibling, and a fiber whose sibling has left is disposed before the wire
 * stops answering for it.
 *
 * A HALF WHOSE `apply` THROWS DOES NOT TAKE THE PAGE DOWN. Cordis lands its
 * fiber in `FAILED` having installed nothing — every registration is an effect,
 * and the ones it had made are unwound — with its siblings ACTIVE. So a plugin
 * whose browser half is broken is one absent set of faces rather than a white
 * tab, which is the same bargain its server half already makes.
 *
 * ## THE CLIENTS ARRIVE HERE, and that is one act rather than two
 *
 * `ctx.wired` needs the live connection's sibling clients, and the connection
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
  const wanted = new Map(halves.map((half) => [half.name, half] as const))
  // OUT FIRST, so a plugin that left has unwound its registrations before a
  // plugin that arrived can claim a key it was holding. The two orders differ
  // only for a kind word two plugins could both claim, which the loader already
  // forbids — but the order that cannot be wrong costs nothing to pick.
  for (const [name, fiber] of [...mounted]) {
    if (wanted.has(name)) continue
    mounted.delete(name)
    await fiber.dispose()
  }
  for (const [name, half] of wanted) {
    if (mounted.has(name)) continue
    // `.then(…, …)` rather than a `try`: `ctx.plugin` hands back a THENABLE
    // over the fiber, not a promise, and a half that threw has already been
    // contained by the runtime — what is awaited here is only "it has finished
    // trying", so the page can draw whatever did start.
    const fiber = ctx.plugin(half)
    mounted.set(name, fiber)
    await Promise.resolve(fiber).then(() => {}, (refused: unknown) => {
      // A FAILED HALF DOES NOT STAY MOUNTED. `mounted` is what the guard four
      // lines up reads to skip a plugin that is already up, so a fiber left
      // here after its `apply` threw is a plugin this tab will never try again
      // — not on the next roster frame, not after a redial that rebuilt
      // everything else. Nothing about the throw says it is permanent: a half
      // whose `apply` reached for a member the wire had not settled, or threw
      // on a value one frame of the roster carried, deserves the next frame.
      // Cordis has already unwound whatever it had registered, so dropping the
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
        refused,
      )
    })
  }
}

/** WHAT IS HUNG IN A PLUGIN-KEYED SLOT, in mount order — tracked, so a caller
 *  reading it inside a memo or a component re-reads when a plugin arrives or
 *  leaves. */
export const hung = <S extends PluginSlot>(slot: S): ReadonlyArray<Hung<SlotFaces[S]>> => {
  moved()
  return ctx.slots.hung(slot)
}

/** ...and what dresses each composed KIND WORD, the same way. */
export const dressed = <S extends KindSlot>(slot: S): ReadonlyMap<string, SlotFaces[S]> => {
  moved()
  return ctx.slots.dressed(slot)
}
