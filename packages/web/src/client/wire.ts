/**
 * The one connection — olai's own surface as the ROOT, and every plugin the
 * SERVE IS RUNNING beside it as a SIBLING, over ONE wire.
 *
 * TOP-LEVEL AWAIT, deliberately: the dial is an Effect and building the
 * protocol's fibers cannot be run synchronously. Awaiting it here, once, keeps
 * every consumer's import synchronous-looking. It does NOT block on the socket
 * opening — the link constructs the socket and retries on its own fiber — and
 * it does NOT block on the roster either, which is the property the next
 * section is entirely about.
 *
 * This is the only file in the client that knows a websocket exists.
 *
 * ## THE TAB FOLLOWS THE ROSTER, and that is the change
 *
 * It used to dial every plugin the BUILD has, and the paragraph arguing that
 * was honest about why: the enabled set is a fact about the SERVE, this module
 * runs at import time with no answer from that process yet, and each of the
 * three ways to get one cost either a member that could only be read after the
 * wire it would have shaped was built, or a round trip before the app could
 * mount anything.
 *
 * The way out is neither of those. **Dial the ROOT first, with no siblings at
 * all** — which the framework has allowed since a rooted bundle grew a `core`
 * slot, because a wire that carries only its root is an ordinary wire. Read the
 * `plugins` cell off it like any other member. Then bring in the siblings it
 * names through `conn.redial(surfaces)`, which is `@kolu/surface-app`'s own
 * door for exactly this (juspay/kolu#2223) and owns the ORDER: the replacement
 * is dialled first and this connection released only once that has resolved, so
 * a dial that throws leaves the working wire alone.
 *
 * THE FIRST PAINT WAITS FOR THE FIRST ROSTER, bounded — see {@link firstRoster}.
 * It did not, and every ordinary boot therefore drew the page twice: render with
 * no siblings, roster arrives, redial, rebuild. That is the rare-case cost of a
 * redial paid on every load on every machine, and the deadline is what keeps a
 * roster that never answers from turning the wait into a white screen.
 *
 * ## WHAT A REDIAL COSTS, said out loud
 *
 * Everything the superseded connection handed out is dead: `clients`, `core`,
 * `transport`, `readout`, `health`. So every standing subscription in the app
 * has to be reopened, which means the page's tree is rebuilt — `./main.tsx`
 * keys the app on {@link wireGeneration} for that reason, and local UI state
 * (an open pane, a scroll position, a half-typed editor) does not survive it.
 *
 * That is not a cost this file chose; it is what a new wire IS. What it buys is
 * the thing the old arrangement could not have at any price: a plugin turned
 * off on the server leaves the tab without a reload, and one turned on arrives
 * the same way. The cost is bounded by the roster's own `equals` — a serve
 * republishing an identical roster (a reconnect does) moves nothing — and by
 * the first render WAITING for the first roster, so the ordinary boot redials
 * before it has drawn anything at all.
 *
 * ## ...AND A REDIAL IS NOT A RETIREMENT
 *
 * A superseded connection's `readout` reads `retired`, which is right for the
 * case the framework added it for (an indicator still bound to the old
 * accessor would otherwise paint green over a closed wire) and would be a LIE
 * here: `retired` carries `needsReload`, and the reload screen rides it. So
 * {@link connectionReadout} reports `reconnecting` for as long as a redial is
 * in flight, which is what the page is actually doing — between wires, on its
 * way to another one, with nothing for a reader to do about it.
 *
 * ## WHAT IS LEFT HERE, and why each line is a decision rather than a mechanic
 *
 *   - **`retired`** — what happens to this tab when the server replaces itself.
 *     Required by the seam with no default, so a wire that compiles has been
 *     asked.
 *   - **the word `"olai"`** — what a degraded readout calls this app's own
 *     floor. The framework has no name for an app's floor and does not invent
 *     one.
 *   - **the ROSTER LOOP** — which plugins this page dials, and when it changes
 *     its mind.
 *   - **`olai`'s indirection** — one live view onto whichever wire is current,
 *     argued where it is spelled.
 *
 * The stale-tab handshake is not wired here at all: the socket probes the
 * reserved `system/identity` member on every open and echoes the server's
 * process id back as `?pid` on the next dial. That the ROOT is what those
 * reserved round-trips address is the whole reason a sibling set that varies
 * per serve is safe: core is on every serve this page can reach, which is what
 * makes it the root.
 */

import { connectSurfaces } from "@kolu/surface-app/solid"
import type { Surface, SurfaceSpec } from "@kolu/surface/define"
import { BROWSER_ROWS, type BrowserHalf } from "@olai/bundle"
import { surface } from "@olai/surface"
import { createEffect, createRoot, createSignal } from "solid-js"

import { BETWEEN_WIRES, type SurfaceReadout } from "./connection/status.ts"

import { composeTo } from "./plugins/runtime.ts"

/**
 * The word a degraded readout calls olai's own floor.
 *
 * It is a LABEL and never a tag segment — the root's members keep their bare
 * `surface/<member>/<verb>`, which is the whole difference between a root and a
 * sibling — so it reaches a reader and nothing else. `surfaceClientsHealth`
 * prefixes every stopped subscription with it (`olai/manifest`), which is what
 * makes a degraded readout say WHICH HALF went quiet rather than only that
 * something did. The framework has no name for an app's own floor and declines
 * to invent one, so it crosses as an argument; it must not be a plugin's name,
 * and the seam refuses at construction if it is.
 */
const CORE = "olai"

/**
 * THE FIRST DIAL — the root, and no siblings.
 *
 * NO `url`. It defaults to `surfaceWsUrl(location.origin)` — the ONE
 * scheme-swap and path both legs share (juspay/kolu#2165) — and a browser app
 * dialling the origin that served it is not a choice.
 *
 * `surfaces: {}` is the honest opening position and not a placeholder: this
 * page has not been told which plugins are running, and an empty sibling map is
 * exactly what "none, so far as I know" means. It is legal because the wire
 * carries a ROOT — the empty-map refusal shrank to "nothing at all was passed"
 * when the `core` slot landed, and core is always here.
 */
let live = await connectSurfaces({
  // OLAI'S OWN SURFACE AS THE ROOT — unprefixed, so its tags are unchanged and
  // the two reserved round-trips address them. That is what makes them
  // trustworthy on a wire whose SIBLING set varies per serve, and now varies
  // WITHIN one serve.
  core: { surface, name: CORE },
  surfaces: {} as Record<string, Surface<SurfaceSpec>>,
  // What happens when the server retires this wire. Required by the seam, with
  // no default, so a wire that compiles has been asked what happens when it
  // dies.
  //
  // What a READER sees is not wired from here: the indicator and the reload
  // screen ride `readout()`, so the retirement has ONE source and the dot and
  // the screen cannot disagree about it. This is the RECORD — one line naming
  // the moment, for whoever is looking at the console of a tab that stopped.
  // A `warn`, not an `error`: nothing is broken, the server was replaced.
  retired: () =>
    console.warn(
      "olai: the server retired this tab — it was replaced by a newer process, so this page will not update again until it is reloaded",
    ),
})

/** WHICH WIRE THIS IS — bumped once per redial, and the one thing the app's
 *  tree is keyed on. See the header: everything the superseded connection
 *  handed out is dead, so the subtree that was reading it has to be built
 *  again.
 *
 *  IT STARTS AT ONE and not at zero, which is not a detail: `./main.tsx` keys
 *  the app on it through a `Show`, and `0` is falsy — a tab whose first wire
 *  had never been replaced would draw the fallback, which is no app at all. */
const [generation, setGeneration] = createSignal(1)

/** ...and whether a replacement is in flight, which is the difference between
 *  a wire that is being swapped and one that has been retired. */
const [redialing, setRedialing] = createSignal(false)

/**
 * A SET OF PLUGIN NAMES AS ONE VALUE — what {@link composed} holds and what the
 * loop below compares against it.
 *
 * Unsorted, because the roster's order is the bundle's and is stable, so the
 * joined list moves exactly when the answer does. `""` is a wire with no
 * sibling on it, which is what the first dial is and what a serve running no
 * plugins stays.
 *
 * A FUNCTION rather than a `.join` at each of the two sites, and the two sites
 * are the whole reason: one writes the signature and one compares against it,
 * so a separator changed in one place and not the other leaves the loop either
 * spinning (never equal) or wedged (always equal). Neither fails loudly.
 */
const signatureOf = (names: ReadonlyArray<string>): string => names.join("\n")

/** THE PLUGINS THIS WIRE CARRIES, as that signature. */
let composed = ""

/**
 * BRING THE WIRE INTO LINE WITH THE ROSTER — load, dial, then mount.
 *
 * The ORDER is the whole of it and none of it is arbitrary:
 *
 *   1. **load** the chunks the roster names. Nothing is fetched for a plugin
 *      this serve is not running, which is the browser's form of *no fiber, no
 *      surface, no handler* (`@olai/bundle`'s `rows.ts`).
 *   2. **redial** with their surfaces. A fiber must never be started over a
 *      wire that does not carry its sibling — that is the subscribe licence the
 *      old arrangement spent a module arguing, and here it is a line of
 *      sequencing instead.
 *   3. **compose** the fibers, which is where a plugin's faces are registered
 *      and its own client is first reachable.
 *
 * ## A FAILURE COSTS THE PAGE NOTHING
 *
 * A chunk that will not load and a dial that throws are the same case, and
 * `redial` owns it: the replacement is dialled first and this connection
 * released only once that has resolved, so a throw leaves the working wire
 * exactly as it was. What this function does about it is say so on the console
 * and leave `composed` where it was — so the next roster frame tries again
 * rather than the page being stuck holding a wire it thinks is newer than it
 * is.
 */
const rerost = async (want: ReadonlyArray<string>): Promise<void> => {
  const signature = signatureOf(want)
  // ONE AT A TIME, and it is the roster's own shape that makes this reachable
  // rather than theoretical. `composed` is only written on SUCCESS — which is
  // right, because a failed redial must leave the next frame free to try again
  // — so between the first frame and its redial resolving, the guard the loop
  // reads still says the old signature. A second frame in that window (a
  // reconnect republishing, a plugin failing while another is being brought in)
  // passes the guard and starts a SECOND `live.redial` on the same connection,
  // which the seam refuses outright: it would dial a third wire while the
  // caller still believes it holds one.
  //
  // Queued rather than dropped. Dropping would be simpler and would lose the
  // last frame's answer if it arrived mid-flight, leaving the tab following a
  // roster the server has already moved off — silently, since nothing would
  // republish to correct it. Chaining costs one more redial in a window that
  // is one round trip wide.
  const mine = inFlight.then(() => rerostNow(want, signature), () => rerostNow(want, signature))
  inFlight = mine.then(() => {}, () => {})
  return mine
}

/** The tail of {@link rerost}, entered only when no other redial is running. */
let inFlight: Promise<void> = Promise.resolve()

const rerostNow = async (want: ReadonlyArray<string>, signature: string): Promise<void> => {
  // ...and once it is our turn, the answer may already be the one on the wire:
  // the frame ahead of us in the queue may have been for the same roster.
  if (signature === composed) return
  setRedialing(true)
  try {
    const halves = await Promise.all(
      BROWSER_ROWS.filter((row) => want.includes(row.id)).map((row) => row.load()),
    )
    // The cast is what a tab that follows the roster costs at the type level,
    // and it is worth naming rather than hiding. The old arrangement recovered
    // a per-key surface type from a compiled-in tuple, which typed each
    // sibling's client by its own spec; a chunk loaded by a name that is DATA
    // cannot carry that, because the names are not literals until runtime.
    // Nothing downstream wanted it: `ctx.wired.client()` is `unknown` by design
    // — core cannot type a plugin's client without learning its members — and
    // every plugin narrows it once, at its own edge, against a shape it
    // declares itself.
    live = await live.redial(surfaceMapOf(halves))
    await composeTo(halves, (plugin) => (live.clients as Record<string, unknown>)[plugin])
    composed = signature
  } catch (refused) {
    console.error(
      "olai: this tab could not follow the server's plugin roster, so it is still serving the previous one",
      refused,
    )
    return
  } finally {
    setRedialing(false)
  }
  setGeneration((at) => at + 1)
}

/** The halves' surfaces, keyed by name — the shape every composition door
 *  takes. Built here rather than through `@olai/plugin-api`'s `surfacesOf`
 *  because a browser half carries no `faces`: which face may see which member
 *  is a SERVE's question, and there is one face in a tab.
 *
 *  A HALF WITH NO SURFACE IS LEFT OUT rather than entered as `undefined`, and it
 *  is a whole kind of plugin: an ENGINE composes no sibling, because what it
 *  contributes to the tab already travels on the chat cell (`@olai/bundle`'s
 *  `BrowserHalf`). Such a half is mounted and never dialled, and an entry
 *  holding `undefined` would be a sibling key the framework was asked to
 *  compose nothing under. */
const surfaceMapOf = (
  halves: ReadonlyArray<BrowserHalf>,
): Record<string, Surface<SurfaceSpec>> =>
  Object.fromEntries(
    halves.flatMap((half) =>
      half.surface === undefined
        ? []
        : [[half.default.name, half.surface as Surface<SurfaceSpec>] as const]
    ),
  )

/**
 * THE LOOP — read the roster off whichever wire is current, and follow it.
 *
 * `createRoot` because this is module scope and a subscription needs an owner;
 * it is never disposed, which is correct — it lives exactly as long as the
 * document does, like the listeners `./main.tsx` starts beside it.
 *
 * The OUTER effect reads {@link generation}, which is what re-subscribes after
 * a redial: the old connection's members are dead, so the standing read has to
 * be reopened on the new one. That re-read answers the same roster and the
 * signature comparison makes it a no-op, which is what stops the loop from
 * chasing its own tail.
 */
/**
 * THE FIRST PAINT WAITS FOR THE FIRST ROSTER — bounded, and only the first.
 *
 * ## What it costs not to
 *
 * The boot sequence is: dial the root with no siblings, render, the roster
 * arrives, redial, and the tree rebuilds keyed on {@link wireGeneration}. So
 * EVERY ORDINARY PAGE LOAD drew the outline twice and opened core's
 * subscriptions twice — not the rare case the rebuild was argued for (somebody
 * turning a plugin on or off), but every load on every machine.
 *
 * The header used to argue that away: the first paint lands on the same frame
 * as `heads` and `page`, so a reader sees one paint. That is true of what a
 * READER sees and not of what the page DOES, and the second half is the one
 * that costs — a second full render and a second set of subscriptions, thrown
 * away, on the critical path of every boot.
 *
 * ## Why it is bounded, and what the deadline is FOR
 *
 * A page that waits on a cell waits forever when the cell never answers — a
 * server too old to declare the member, a roster that fails to decode, a socket
 * that never opens. Blanking the app for any of those would trade a double
 * paint for a white screen, which is much worse: the freeze overlay and the
 * connection readout are INSIDE the tree, so a tab that cannot reach its server
 * would have no way to say so.
 *
 * So the deadline is not a guess at how long a roster takes; it is the promise
 * that a broken roster costs a flicker rather than the product. On the ordinary
 * path it never fires — the roster rides the first frame off the same socket as
 * `heads` — and when it does fire the page renders exactly as it did before
 * this existed, with the redial arriving later as an ordinary generation bump.
 */
const FIRST_ROSTER_MS = 1500

/** Resolved by whichever comes first: the roster settling, or the deadline. */
let settle: () => void = () => {}
export const firstRoster: Promise<void> = new Promise<void>((resolve) => {
  settle = resolve
  setTimeout(resolve, FIRST_ROSTER_MS)
})

createRoot(() => {
  createEffect(() => {
    generation()
    const roster = live.core.cells.plugins.use()
    createEffect(() => {
      const value = roster.value()
      // PENDING is not the empty roster. A cell that has not answered says
      // nothing about which plugins are running, and dialling none of them
      // because of it would be this page inventing a policy.
      if (value === undefined) return
      const want = value.built.filter((row) => row.running).map((row) => row.name)
      if (signatureOf(want) === composed) {
        settle()
        return
      }
      void rerost(want).then(settle)
    })
  })
})


/**
 * OLAI'S OWN CLIENT, unprefixed — the members every page reads.
 *
 * ## A live view, and why it is not simply the value
 *
 * `wire.core` was a constant for as long as there was one wire. A redial builds
 * a new one and kills the old, so a module-scope constant would be a handle
 * onto a dead connection from the first roster frame onwards — and thirty
 * modules import this name at module scope.
 *
 * So it is a VIEW: every read resolves against whichever connection is current.
 * That is not a way of keeping stale subscriptions alive and does not pretend
 * to be — `cells.x.use()` still binds to the client it was called on, and a
 * subscription opened on a superseded wire is dead however it was reached. What
 * the view buys is that the NEXT call lands on the live wire, which is all it
 * has to do: the tree is rebuilt on {@link wireGeneration}, so every `use()` in
 * the app is called again, and each of them reads through here at that moment.
 *
 * The alternative was a context — the connection carried down the tree and read
 * by a hook — and it is the better shape in the abstract. It is also thirty
 * files of churn for a property this one object already has, and a context read
 * is only available inside a component, where several of these readers are
 * module-scope by design (`./named.ts` is asked from `./main.tsx`, outside any
 * tree). Recorded as the shape to take if a second wire ever exists.
 *
 * Functions are bound to the client they came off, so a method that reads
 * `this` cannot be handed a proxy for a receiver.
 */
export const olai: typeof live.core = new Proxy({} as typeof live.core, {
  get: (_target, key) => {
    const value = Reflect.get(live.core as object, key) as unknown
    return typeof value === "function" ? value.bind(live.core) : value
  },
  has: (_target, key) => Reflect.has(live.core as object, key),
})

/** WHICH WIRE THIS IS. `./main.tsx` keys the whole app on it, because a redial
 *  killed every standing subscription the previous tree was holding — see the
 *  header on what that costs and what it buys. */
export const wireGeneration = generation

/**
 * What the connection is doing — `connecting` / `live` / `degraded` /
 * `reconnecting` / `retired`, with `needsReload` and, when degraded, the names
 * of the subscriptions that stopped. Read it: an indicator nobody renders is
 * the bug this module had. `./connection/status.ts` says what each of the five
 * looks like, and nothing else about them.
 *
 * The fold is the seam's, over the wire's status and every client's
 * subscriptions — the SIBLINGS and the root, the latter under {@link CORE}.
 * Core being in it is the point: a fold over the plugins alone would leave
 * every one of olai's own subscriptions outside the fact, and a dead `manifest`
 * cell under a green light is the precise lie this readout was introduced to
 * prevent.
 *
 * TWO things are read here that the framework's own accessor cannot know. The
 * GENERATION, so a reader re-subscribes to the current wire's memo rather than
 * to a disposed one; and whether a REDIAL is in flight, because a superseded
 * connection reads `retired` — correct for a wire that is gone, and a lie about
 * a page that is on its way to another one. `needsReload` rides `retired`, and
 * the reload screen rides `needsReload`.
 */
export const connectionReadout = (): SurfaceReadout => {
  generation()
  return redialing() ? BETWEEN_WIRES : live.readout()
}

