/**
 * The one connection — olai's own surface, and every plugin's beside it, over
 * ONE wire.
 *
 * TOP-LEVEL AWAIT, deliberately: the dial is an Effect and building the
 * protocol's fibers cannot be run synchronously. Awaiting it here, once, keeps
 * every consumer's import synchronous-looking. It does NOT block on the socket
 * opening — the link constructs the socket and retries on its own fiber — so
 * this is a microtask, not a network wait.
 *
 * This is the only file in the client that knows a websocket exists.
 *
 * THREE things come off it and ALL THREE are read here, which is the whole
 * point: this module used to keep `.client` and drop the rest, and a page that
 * cannot say whether it is connected is a page that lies when it is not
 * (juspay/kolu#2133 made the terminal state a required option because of it).
 *
 *   - `readout` is the five states an indicator needs — `connecting`, `live`,
 *     `degraded`, `reconnecting`, `retired` — the wire's own four folded with
 *     the subscription-health fact, so `live` is a claim about what reaches
 *     this page rather than about a socket. It is exported, rendered, and
 *     asserted on.
 *   - `retired` is the handler the seam requires. It cannot be left out, and it
 *     is answered below.
 *   - and now the PLUGIN CLIENTS, one per sibling, handed to each plugin's own
 *     mount and never opened here.
 *
 * The stale-tab handshake itself is not wired here at all: the socket probes
 * the reserved `system/identity` member on every open and echoes the server's
 * process id back as `?pid` on the next dial, so the server can recognise a tab
 * that outlived it. That used to be an app's job — an `echo` to feed through a
 * lifecycle's `onProcessId` — and dropping it was exactly how this page came to
 * sit on a dead server looking healthy.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ## WHY THIS ASSEMBLES THE WIRE RATHER THAN CALLING A TURNKEY SEAM
 *
 * The framework has two turnkey seams and olai used one of them (`connectSurface`)
 * until the plugins grew surfaces of their own. Neither fits what this page now
 * dials, and the reasons are worth stating because "we hand-rolled it" is
 * normally the wrong answer:
 *
 *   - **`connectSurface` takes ONE surface and builds the wire over its group
 *     alone**, so a sibling's tag would not be dispatchable at all — Effect RPC
 *     looks a call's tag up in the group the client was built over.
 *   - **`connectSurfaces` takes the sibling map and derives everything from
 *     it**, including which reserved member the half-open watchdog probes and
 *     which one the `pid` handshake reads: both address `Object.keys(surfaces)[0]`,
 *     the FIRST SIBLING. Core cannot go in that map — its tags are
 *     `surface/<member>/<verb>` and must stay that way (an MCP client writes
 *     them, the suite asserts them, `@olai/plugins`' `compose.ts` argues the
 *     whole fusion on it) — so the first sibling is a PLUGIN, and a serve that
 *     did not run that plugin answers its `system/identity` with "Unknown
 *     request tag". The wire survives (the framework logs a warning) and the
 *     watchdog survives (its settle treats a rejection as a completed
 *     round-trip, which is the correct reading), but the `pid` echo goes
 *     EMPTY — and an empty echo is precisely the dead stale-tab handshake
 *     olai#61 is about. `--plugins=odu` would have quietly reintroduced it.
 *
 * So the wire is built the way the framework documents a consumer building one
 * — `createSurfaceSocket` → `createLiveSignal` → `surfaceClient` — which is
 * sanctioned rather than smuggled: `@kolu/surface/solid` names "a hand-built
 * `createLiveSignal` + `surfaceClient`" as the third caller of
 * `createSurfaceReadout`, and `createLiveSignal` stays the SINGLE minter of the
 * branded handle a client requires, so there is no green-over-dead lie to
 * forge. What this file must not skip is the WATCHDOG, which is the step the
 * turnkey seams exist to stop an app forgetting — it is wired below, and it
 * probes CORE's reserved member, which every serve carries whatever `--plugins`
 * says.
 *
 * ## THE GROUP IS FUSED, by the same function the server fuses with
 *
 * `fuseGroups` is `@olai/plugins`' own, and the server's composition root calls
 * it on the other side of this socket. One function, two ends: the browser
 * cannot come to disagree with the server about what "core plus the siblings"
 * means, and the disjointness proof (a core tag has three segments, a sibling's
 * has four, and the merge underneath is a silent last-writer-wins `Map.set`)
 * is COUNTED rather than argued, once, in that module.
 *
 * ## WHICH PLUGINS THIS PAGE DIALS: every one the BUILD has
 *
 * `WIRES` is the built-in list and this dials all of it. The alternative — dial
 * the ENABLED set — is not available, and it is worth being exact about why
 * rather than leaving it as a shrug: **the enabled set is a fact about the
 * SERVE**, decided by `--plugins` on the command line that started the process,
 * and this module runs at import time with no answer from that process yet. The
 * three ways to get one were each rejected:
 *
 *   - **read it off a core member.** There is none — no cell or procedure
 *     carries the roster — and adding one would still not help, because a member
 *     can only be read AFTER the wire it rides is built, and the roster is what
 *     the wire is supposed to be built from.
 *   - **probe each sibling's reserved `system/live`.** It answers the question
 *     exactly (an unserved sibling refuses the tag) and it costs a round-trip
 *     per plugin before the app may mount anything — turning this module's
 *     microtask into a network wait, which is the property the paragraph at the
 *     top of this file exists to protect.
 *   - **ask over HTTP before dialling.** Same wait, plus a second door onto the
 *     server for a fact the wire already implies.
 *
 * Dialling the built set costs nothing by itself: the client's group carries
 * tags this serve may not answer, and a tag nobody dispatches is a map entry.
 * What it costs when a face DOES dispatch one is the next section, read off the
 * framework rather than assumed.
 *
 * ## WHAT A SUBSCRIPTION TO AN ABSENT SIBLING DOES, exactly
 *
 * The server's RPC router looks a call's tag up in the group it was built over
 * and, finding nothing, answers THAT ONE REQUEST with a defect —
 * `Exit.die("Unknown request tag: surface/<name>/<member>/<verb>")`
 * (`effect`'s `RpcServer.ts`). The wire is untouched, nothing closes, and every
 * other member goes on working.
 *
 * On this side the per-subscription retry fence declines to retry it: the fence
 * retries TRANSPORT failures only (`@kolu/surface`'s `shouldRetryStreamError`),
 * so there is no request storm. The failure reaches `createSubscription`'s
 * `onFailure`, which latches `error()` and clears `pending` — terminal by
 * design, because a failure is the fiber's exit and no frame can follow one.
 *
 * The consequence is the one that matters, and it is a DEGRADATION rather than
 * a lie: the subscription is enrolled, so `health()` carries its standing error
 * and the readout below folds to **`degraded`**, naming the member that stopped
 * (`kolu/link`, `odu/ci`). A serve running fewer plugins than its browser was
 * built with therefore shows amber saying exactly which sibling went quiet — it
 * does not freeze (`./connection/reaching.ts` rules `degraded` reachable, on
 * purpose), and it does not go green over a hole. That is the honest state of a
 * build and a serve that disagree, and it is visible instead of silent.
 *
 * ## ...WHICH IS ALSO WHY THERE IS NO EMPTY-MAP BRANCH
 *
 * `--plugins=` with no plugins is a real, supported state (`@olai/server`'s
 * `pluginPolicy.ts`), and `connectSurfaces` refuses an empty `surfaces` map
 * outright — "there is no sibling whose reserved `system/live` member the
 * half-open watchdog can probe". That refusal is correct for THAT seam and does
 * not reach this one: the watchdog here probes core, so a build with no plugins
 * composes an empty sibling group, fuses to core's own, and mints an empty
 * client record. ONE path, no branch, and the degenerate case is the same code
 * as every other.
 */

import { composeSurfaceContracts } from "@kolu/surface/define"
import {
  createLiveSignal,
  createSurfaceReadout,
  surfaceClient,
  type SurfaceClients,
  surfaceClients,
  surfaceClientsHealth,
} from "@kolu/surface/solid"
import { surfaceWsUrl } from "@kolu/surface-app"
import { createSurfaceSocket } from "@kolu/surface-app/connect"
import { fuseGroups, surfacesOf, WIRES } from "@olai/plugins/wire"
import { surface } from "@olai/surface"

/**
 * THE SIBLING MAP, typed off the registry's own tuple.
 *
 * `surfacesOf` answers a `Record<string, …>` because `@olai/plugins` declines to
 * depend on `@kolu/surface` — its `PluginWire` says a surface is `{ spec }` and
 * no more. That erasure is right there and wrong here: the framework's client
 * bundle is typed PER KEY off each sibling's own spec, and a widened record
 * would hand every plugin's mount an `unknown` that no `satisfies` could ever
 * catch drifting.
 *
 * So the shape is recovered from `WIRES` — a tuple (`as const`) whose entries
 * carry a literal `name` and a concrete surface — by a mapped type over that
 * tuple. NOTHING HERE SPELLS A PLUGIN'S NAME: the keys are read off the
 * registry's own values, which is the same word `--plugins` takes and the same
 * word the wire prefixes with.
 */
type PluginSurfaces = {
  [P in (typeof WIRES)[number] as P["name"]]: P["surface"]
}

const SIBLINGS = surfacesOf(WIRES) as PluginSurfaces

/** Every plugin's tags at `surface/<name>/<member>/<verb>`, computed by the
 *  framework and by nothing olai wrote. */
const composed = composeSurfaceContracts(SIBLINGS)

const socket = await createSurfaceSocket({
  // No `url` derivation of our own: `surfaceWsUrl(location.origin)` is the ONE
  // scheme-swap and path both legs share (juspay/kolu#2165). This file used to
  // hand-roll both halves; a derivation that is never a choice is no longer a
  // question this wire is asked. It is spelled here rather than defaulted
  // because only the turnkey seam defaults it, and this wire is assembled.
  url: surfaceWsUrl(location.origin),
  // Core's own group, unprefixed, with every sibling's fused onto it — see the
  // header on why the fusion is `@olai/plugins`' function and not a merge.
  group: fuseGroups(surface.group, composed.group),
  // NO `siblingKey`, which is the load-bearing omission: the reserved
  // `system/identity` the `pid` echo reads then sits at the bare
  // `surface/system/identity` — CORE's, which every serve carries. Naming a
  // sibling here would tie the stale-tab handshake to a plugin that may not be
  // running. The header argues it in full.
  //
  // What happens when the server retires this wire. Required by the seam, with
  // no default, so a wire that compiles has been asked what happens when it dies.
  //
  // What a READER sees is not wired from here: the indicator and the reload
  // screen ride `readout()`, so the retirement has ONE source and the dot and
  // the screen cannot disagree about it. This is the RECORD — one line naming
  // the moment, for whoever is looking at the console of a tab that stopped.
  // (Kolu itself passes a leaf recorder here, for the same reason.) A `warn`,
  // not an `error`: nothing is broken, the server was replaced.
  retired: () =>
    console.warn(
      "olai: the server retired this tab — it was replaced by a newer process, so this page will not update again until it is reloaded",
    ),
})

/**
 * THE ONE WATCHDOG, over the one wire.
 *
 * It is the step the turnkey seams exist to stop an app forgetting, and this
 * file assembles its own wire, so it is spelled here rather than inherited: a
 * socket that is OPEN and silently half-open (laptop sleep, Wi-Fi roam, a NAT
 * evicting an idle connection) fires neither `close` nor `error`, and without a
 * probe the link sits open forever while every stream hangs.
 *
 * `createLiveSignal` is also the single, unforgeable minter of the branded
 * handle `surfaceClient` requires — hand it the WHOLE link and client and probe
 * share one dispatch by construction, which is what makes "green means the page
 * is reading" a fact rather than a hope.
 *
 * No `siblingKey`, for the socket's reason one call up: the probe addresses
 * `surface/system/live`, core's, which is served whatever `--plugins` says.
 */
const transport = createLiveSignal(socket.link, {})

/** OLAI'S OWN CLIENT, unprefixed — the members every page reads. */
export const olai = surfaceClient(surface, transport)

/**
 * ...and ONE CLIENT PER SIBLING, each typed by that plugin's own spec.
 *
 * Handed straight to that plugin's mount and never opened here: what is behind
 * a sibling key is the plugin's business, and this module knows the key because
 * the key is the one word core has ({@link PluginSurfaces}).
 */
export const pluginClients: SurfaceClients<PluginSurfaces> = surfaceClients(
  transport,
  SIBLINGS,
)

/**
 * ...and the same bundle addressed by a NAME READ OFF THE REGISTRY, which is
 * the only way a walk can address it.
 *
 * `pluginClients` is keyed by literal — that is the whole value of
 * {@link PluginSurfaces}, and it is why the type above is spelled out rather
 * than widened. A consumer walking `PLUGINS` holds a `string`, though: the name
 * is DATA there, which is exactly the property that keeps this package from
 * spelling one. TypeScript cannot index a literal-keyed record with a `string`,
 * and it is right not to.
 *
 * So the widening is a function with a name on it, spent at one call site
 * (`./plugins/Mounted.tsx`), rather than a cast at the walk. `unknown` is the
 * honest return and not a loss: `@olai/plugins` types a mount's client
 * `unknown` for the reason it types a server half's `dial` that way — core
 * cannot type a plugin's client without learning its members — and the plugin
 * narrows it once, at its own edge.
 *
 * A name that is not a sibling answers `undefined`, and there is no such name:
 * both this map and the walk are built from the same registry, and the day they
 * could disagree is the day the framework refuses the composition at boot.
 */
export const clientFor = (name: string): unknown =>
  (pluginClients as Readonly<Record<string, unknown>>)[name]

/**
 * EVERY CLIENT'S HEALTH, folded as one fact — and this fold is the reason the
 * readout is rebuilt here rather than taken off a seam.
 *
 * `surfaceClientsHealth` AND-reduces the shared wire's `live` with every
 * enrolled subscription's `pending`/`error`, prefixing each sub's name with the
 * client's key so a degraded readout says WHICH half went quiet. Core is in the
 * record under its own name for exactly that: a fold over the plugins alone
 * would leave every one of olai's own subscriptions outside the fact, and a
 * dead `manifest` cell under a green light is the precise lie this readout was
 * introduced to prevent — the page sitting on a dead server looking healthy that
 * the header of this file is about.
 *
 * The key is a WORD IN THE READOUT, not an address: it prefixes the names of
 * whatever stopped (`olai/manifest`), which is what makes "which half" legible
 * to a reader of the degraded detail.
 */
const CORE = "olai"

const health = () => surfaceClientsHealth({ ...pluginClients, [CORE]: olai })

/**
 * What the connection is doing — `connecting` / `live` / `degraded` /
 * `reconnecting` / `retired`, with `needsReload` and, when degraded, the names
 * of the subscriptions that stopped. Read it: an indicator nobody renders is
 * the bug this module had. `./connection/status.ts` says what each of the five
 * looks like, and nothing else about them.
 *
 * `createSurfaceReadout` is the framework's own fold and is memoized with its
 * own root, because this module runs outside any reactive owner — the same
 * function both turnkey seams call, over the two facts assembled above.
 */
export const connectionReadout = createSurfaceReadout(
  transport.status,
  health,
).readout
