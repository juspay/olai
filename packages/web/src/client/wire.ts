/**
 * The one connection — olai's own surface as the ROOT, and every plugin's
 * beside it as a SIBLING, over ONE wire.
 *
 * TOP-LEVEL AWAIT, deliberately: the dial is an Effect and building the
 * protocol's fibers cannot be run synchronously. Awaiting it here, once, keeps
 * every consumer's import synchronous-looking. It does NOT block on the socket
 * opening — the link constructs the socket and retries on its own fiber — so
 * this is a microtask, not a network wait.
 *
 * This is the only file in the client that knows a websocket exists.
 *
 * FOUR things come off the seam and ALL FOUR are read here, which is the whole
 * point: this module used to keep the client and drop the rest, and a page that
 * cannot say whether it is connected is a page that lies when it is not
 * (juspay/kolu#2133 made the terminal state a required option because of it).
 * `core` is olai's own client, `clients` is one per sibling, `readout` is the
 * five states an indicator needs — `connecting`, `live`, `degraded`,
 * `reconnecting`, `retired` — and `retired` is the handler the seam requires,
 * which cannot be left out and is answered below.
 *
 * `live` there is a claim about what reaches THIS PAGE rather than about a
 * socket: the seam folds the wire's own status with every enrolled
 * subscription's health, the root's included, so a dead `manifest` cell under a
 * green light is not a state this readout can be in.
 *
 * The stale-tab handshake is not wired here at all: the socket probes the
 * reserved `system/identity` member on every open and echoes the server's
 * process id back as `?pid` on the next dial, so the server can recognise a tab
 * that outlived it. That used to be an app's job — an `echo` to feed through a
 * lifecycle's `onProcessId` — and dropping it was exactly how this page came to
 * sit on a dead server looking healthy.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ## THIS FILE USED TO BE THE SEAM. It is now a CALL to one.
 *
 * For one PR window olai assembled its own wire — `createSurfaceSocket` →
 * `createLiveSignal` → `surfaceClients` → `surfaceClientsHealth` →
 * `createSurfaceReadout`, and the WATCHDOG the turnkey seams exist to stop an
 * app forgetting — because neither seam could express what this page dials.
 * `connectSurface` takes ONE surface. `connectSurfaces` took the sibling map
 * and derived everything from it, including which reserved member the half-open
 * watchdog probes and which one the `pid` handshake reads: both addressed
 * `Object.keys(surfaces)[0]`, the FIRST SIBLING. Core could not go in that map
 * — its tags are `surface/<member>/<verb>` and must stay that way (an MCP
 * client writes them, the suite asserts them, and `@olai/plugin-api`'s
 * `composition.test.ts` pins it) — so the probe target was a PLUGIN, and a
 * serve that did not run that plugin answered its `system/identity` with
 * "Unknown request tag", emptying the `pid` echo. An empty echo is precisely
 * the dead stale-tab handshake olai#61 is about, and `--plugins=odu` would have
 * quietly reintroduced it.
 *
 * That hand-assembly was the acceptance test carried with an upstream ask, and
 * the ask landed: juspay/kolu#2222 grew a ROOT SLOT on the same seam — a `core`
 * beside `surfaces`, THREADED rather than minted, so a wire without one behaves
 * exactly as it did. With a root the framework derives the two reserved
 * round-trips from the ROOT's bare tags (the path `createSurfaceSocket` and
 * `createLiveSignal` already implemented by omitting `siblingKey`), folds the
 * root into the health fact under the caller's own word, and stops refusing an
 * empty sibling map — because a wire that carries only its root is an ordinary
 * wire. Every reason this file gave for assembling by hand is now a line of the
 * framework, so the assembly is gone and what is left below is DECISIONS.
 *
 * ## What is left here, and why each line is a decision rather than a mechanic
 *
 *   - **`retired`** — what happens to this tab when the server replaces itself.
 *     Required by the seam with no default, so a wire that compiles has been
 *     asked.
 *   - **the word `"olai"`** — what a degraded readout calls this app's own
 *     floor. The framework has no name for an app's floor and does not invent
 *     one.
 *   - **the SIBLING MAP**, read off the registry — which plugins this page
 *     dials, argued below.
 *   - **`clientFor`'s widening** — the one place a literal-keyed bundle is
 *     addressed by a name that is data.
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
 * ## WHAT A SUBSCRIPTION TO AN ABSENT SIBLING WOULD DO — and why nothing makes
 * one
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
 * `onFailure`, which latches `error()` and clears `pending` — TERMINAL by
 * design, because a failure is the fiber's exit and no frame can follow one.
 *
 * That latch is why dialling the built set is not the whole story, and this
 * file used to stop one paragraph too early. It read the consequence as an
 * honest DEGRADATION — amber, naming the sibling that went quiet — which it is,
 * and which is the right answer for a build and a serve that genuinely
 * disagree. It is the WRONG answer for `--plugins=odu`, where nothing
 * disagrees: an operator turned a tool off and the page complained about its
 * absence for the rest of its life. Grok's review named it; the ruling is that a
 * disabled plugin is the ordinary machine-without-the-tool state.
 *
 * So the dial and the SUBSCRIPTION are two decisions, and only the first is
 * made here. This page dials the built set, which costs a map entry per tag
 * nobody sends. What SENDS one is a plugin's tab half, and that is mounted only
 * for the plugins the roster says this serve composed — after the roster has
 * spoken, never on a guess (`./plugins/Mounted.tsx`, `./plugins/running.ts`,
 * which argue why the generous default is right for a face and wrong for a
 * subscription). The amber arm is still reachable and still honest: a tab
 * genuinely newer than its server, or a roster that could not be read at all,
 * falls back to the build and says so.
 * ## ...WHICH IS ALSO WHY THERE IS NO EMPTY-MAP BRANCH
 *
 * `--plugins=` with no plugins is a real, supported state (`@olai/server`'s
 * `pluginPolicy.ts`). It used to be the case this file could not hand to the
 * turnkey seam at all — `connectSurfaces` refused an empty `surfaces` map,
 * because there was then no sibling whose reserved `system/live` the watchdog
 * could probe. With a root on the wire that refusal shrank to "nothing at all
 * was passed", which this call can never be: core is always here. ONE path, no
 * branch, and the degenerate case is the same code as every other.
 */

import { connectSurfaces } from "@kolu/surface-app/solid"
import { surfacesOf, WIRES } from "@olai/bundle/wire"
import { surface } from "@olai/surface"

/**
 * THE SIBLING MAP, typed off the registry's own tuple.
 *
 * `surfacesOf` answers a `Record<string, …>` because `@olai/plugin-api` declines to
 * depend on `@kolu/surface` — its `PluginWire` says a surface is `{ spec }` and
 * no more. That erasure is right there and wrong here: the seam's client bundle
 * is typed PER KEY off each sibling's own spec, and a widened record would hand
 * every plugin's mount an `unknown` that no `satisfies` could ever catch
 * drifting.
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
 * THE DIAL — one call, the whole wire.
 *
 * The watchdog, the `pid` echo, the counted group merge over the root and every
 * sibling, the per-sibling clients, the health fold and the readout are all the
 * seam's, wired by construction. What crosses is the four decisions the header
 * lists and nothing else.
 */
const wire = await connectSurfaces({
  // NO `url`. It defaults to `surfaceWsUrl(location.origin)` — the ONE
  // scheme-swap and path both legs share (juspay/kolu#2165) — and a browser app
  // dialling the origin that served it is not a choice. This line WAS spelled
  // here, as the last residue of the collapse: the seam required it where its
  // single-surface twin defaulted it, for a reason neither could name. It was
  // reported upstream rather than lived with, and kolu took the amendment, so
  // the residue is gone rather than argued for.
  //
  // OLAI'S OWN SURFACE AS THE ROOT — unprefixed, so its tags are unchanged and
  // the two reserved round-trips address them. That is what makes them
  // trustworthy on a wire whose SIBLING set varies per serve: core is on every
  // serve this page can reach, which is what makes it the root.
  core: { surface, name: CORE },
  surfaces: SIBLINGS,
  // What happens when the server retires this wire. Required by the seam, with
  // no default, so a wire that compiles has been asked what happens when it
  // dies.
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

/** OLAI'S OWN CLIENT, unprefixed — the members every page reads. */
export const olai = wire.core

/**
 * ...and ONE CLIENT PER SIBLING, each typed by that plugin's own spec.
 *
 * Handed straight to that plugin's mount and never opened here: what is behind
 * a sibling key is the plugin's business, and this module knows the key because
 * the key is the one word core has ({@link PluginSurfaces}).
 *
 * Do NOT fold this record for a health fact — it is the SIBLINGS ONLY, and a
 * fold over it would be green over a dead root. {@link connectionReadout} is
 * the fold, and the root is in it.
 */
export const pluginClients = wire.clients

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
 * honest return and not a loss: `@olai/plugin-api` types a mount's client
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
 */
export const connectionReadout = wire.readout
