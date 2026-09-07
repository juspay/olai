/** The browser's generic plugin host. The bundle supplies module loaders and
 * ordering; the live roster decides which scoped activations exist. Renderer,
 * layout, navigation and content services are ordinary offers from those rows.
 * This host owns no application slots, geometry, notebook state or observer.
 *
 * Host capabilities and the sibling-client resolver are installed before any
 * plugin starts. Owner identities remain distinct from component names, so
 * every component spends only its row's client and offer namespace. A missing
 * dependency is waiting, not an empty implementation supplied by the host.
 *
 * Cordis owns services and their cleanup. Solid observes host changes through
 * signals: slot consumers reread the renderer, optional service consumers
 * resolve the current offer. Neither observer caches a plugin implementation.
 * Registry withdrawal reaches readers while cleanup drains; replacement
 * creates a new scope without restarting unrelated providers or editors.
 *
 * The client resolver arrives through composeTo to avoid a wire/runtime import
 * cycle. Failed activation fibers are released, while their diagnostic remains
 * available for inspection and retry. No failed or departed scope can rejoin
 * the current roster through a retained callback.
 */

import type { BrowserHalf } from "@olai/bundle"
import {
  type App,
  type Mounted,
  type RowReport,
  mountPlugin,
  openApp,
  standing,
} from "@olai/plugin-api"
import { Effect, Stream } from "effect"
import { createSignal } from "solid-js"

/** WHEN A FACE ARRIVED OR LEFT — the one signal every slot read is tracked
 *  through. A counter rather than a store, because the reads below hand back a
 *  fresh array or map either way and what a consumer needs is to be told to
 *  re-read. */
const [moved, setMoved] = createSignal(0)

/**
 * HOW MANY COMPOSES ARE IN FLIGHT, and whether one of them moved the table.
 *
 * ## A PLUGIN'S FACES ARRIVE AND LEAVE TOGETHER, or the page is drawn from a
 * plugin that is half here
 *
 * Every registration is a finalizer on the plugin's own scope, so mounting one
 * runs N claims and disposing it runs N releases — and each of them told this
 * signal, one at a time, synchronously. Every one of those was a re-render of
 * the page from a table holding SOME of a plugin's faces.
 *
 * That was survivable while a plugin only ever arrived: the intermediate draws
 * were of a page missing faces that were about to appear, and the last
 * registration put them there. It stopped being survivable the moment a plugin
 * could LEAVE a running serve, because the finalizers run LIFO — so the LAST
 * thing a plugin registers is the FIRST thing it withdraws.
 *
 * THE INCIDENT IS HISTORY AND THE CLASS IS NOT, so it is written in the past
 * tense. Chat used to register its `AgentsProvider` into the `app.mount` slot
 * last, precisely because it wrapped everything else. The page then drew like
 * this: that provider left the slot, `PluginsMounted`'s keyed `Show` saw a new
 * list and rebuilt the whole page, and the rebuild re-created chat's sidebar
 * section — still in the table, four finalizers from being removed — outside
 * the provider it had just been deprived of. Its body threw `an agents lookup
 * outside <AgentsProvider>`, the fault boundary swallowed the app, and turning
 * chat off replaced the product with a card. Chat wraps each of its own faces
 * now and registers nothing into `app.mount`; no plugin in this build does.
 *
 * ## Why the fix is here and not in the consumer
 *
 * Because it is a CLASS. Every plugin in this build can leave a running serve
 * now; chat is only the first with enough faces to catch it, and the same shape
 * is available to any plugin that registers a provider alongside things that
 * read it — which is the ordinary way to write one. Teaching each consumer to
 * tolerate its own provider's absence would be N fixes for one defect, each of
 * them a face that draws a wrong-but-quiet arm at a moment nobody meant it to
 * be drawn at.
 *
 * A COMPOSE IS ONE MOVEMENT OF THE TABLE, and the page is told when it has
 * finished moving. That is the same sentence the server keeps about the roster
 * — a flip settles the bundle before the cell moves — and it is worth having on
 * both sides of the wire for the same reason: an intermediate state that no
 * consumer can be shown is an intermediate state no consumer has to handle.
 *
 * A COUNTER rather than a boolean, because `../wire.ts` can have a second
 * roster frame in flight behind the first, and the inner one finishing must not
 * un-suppress the outer one.
 */
let composing = 0
/** ...and whether anything was suppressed while it was, so a compose that
 *  changed nothing does not cost a re-render of the page for nothing. */
let missed = false

/** Tell the page the table moved — unless a compose is holding it, in which
 *  case it is told once when the compose is done. */
const told = (): void => {
  if (composing > 0) {
    missed = true
    return
  }
  setMoved((at) => at + 1)
  void refreshReports()
}

/** THE SIBLING CLIENTS, as a holder — see the header on why they are not an
 *  import. `null` before the wire has spoken, which is every read before the
 *  first roster lands and is a state no plugin fiber can see: a fiber is
 *  mounted only after the redial that carries its client. */
let clients: ((plugin: string) => unknown) | null = null

/** ...told by {@link composeTo}, which is the only thing that may set it —
 *  see that function on why the two are one act. */

/** THE PAGE'S RUNTIME, and the one place an Effect is run from a module that
 *  is not one. A tab has no shutdown short of the page going away, so the scope
 *  behind this is never closed — what it is FOR is that every registration a
 *  plugin makes hangs off ITS OWN scope, inside this one, and unwinds when that
 *  plugin is dropped (`@olai/effect-cordis`'s `standing`). */
const run = standing()

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
/** Activation names identify independent fibers; owners identify plugin
 * capabilities. Keep that binding explicit instead of teaching every service
 * how to split a component's display name. */
const owners = new Map<string, string>()

export const app: App = await run(
  openApp({
    changed: told,
    ownerFor: (fiber) => owners.get(fiber) ?? fiber,
    // ...AND HOW A READ IS TRACKED, which is the same signal from the other
    // side. The walks below read it themselves, and could go on doing so alone
    // — what could not is a PLUGIN's read: `Faces` hands the chat panel the
    // marks six other plugins hung, and that panel cannot reach a module-scoped
    // signal in `@olai/web` (a plugin may not import this package at all). So the
    // tracking is told to the runtime once, here, and every read through that
    // door — a plugin's and this module's alike — is inside the same reactive
    // graph the app already re-renders from.
    reading: () => void moved(),
    clientFor: (plugin) => clients?.(plugin) ?? null,
  }),
)

/** WHAT IS MOUNTED RIGHT NOW, by name — so a re-compose can drop exactly the
 *  ones that left and start exactly the ones that arrived rather than tearing
 *  the whole runtime down and rebuilding it. A survivor keeping its plugin is
 *  the browser's half of the rule the server's re-compose keeps: a plugin that
 *  has been drawing since boot must not be restarted because a different plugin
 *  arrived.
 *
 *  `Mounted` is the runtime's own word for what `mountPlugin` hands back. It was
 *  written out here as the one field this module reads, which is a shape that
 *  agrees with the real one until the day it does not. */
const mounted = new Map<string, Mounted>()

/**
 * A FAULT'S DISPLAY LIFETIME IS LONGER THAN ITS FIBER'S.
 *
 * Retaining a failed fiber would retain a registry entry and make the next
 * composition mistake it for a survivor. Dropping both fiber and report would
 * leave a running server row with absent browser faces and no explanation.
 * Keep only the fault data after disposal: it owns no scope, subscription or
 * client. A successful retry replaces it; removing the row forgets it. This is
 * the current activation's explanation, not persistent error history.
 *
 * The separate report snapshot also includes live waiting components, even
 * when they registered no slots. Host transitions, not face rendering, drive
 * that reading. The panel's wording is in rows.ts so changing a sentence cannot
 * change when a fiber is mounted, retried or released.
 */
const failures = new Map<string, Extract<RowReport, { readonly state: "failed" }>>()
let loadFailures: ReadonlyMap<string, string> = new Map()
let reloadRequired: ReadonlySet<string> = new Set()
export const browserRequiresReload = (name: string): boolean => {
  browserReports()
  return reloadRequired.has(name)
}
const [browserReports, setReports] = createSignal<ReadonlyMap<string, RowReport>>(new Map())
/** Reading a fault can await the runtime's error promise. A later host change
 * may finish its snapshot first; the generation keeps an older read from
 * overwriting it. Composition publishes its own final snapshot after the
 * movement, so the panel is not asked to interpret a half-reconciled roster. */
let reporting = 0
const refreshReports = async (): Promise<void> => {
  const generation = ++reporting
  const snapshot = await Promise.all([...mounted].map(async ([name, row]) => [name, await run(row.report)] as const))
  if (generation === reporting) setReports(new Map([
    ...snapshot,
    ...app.integrations().flatMap((entry, index): Array<readonly [string, RowReport]> => {
      if (entry.state === "active" || entry.state === "off") return []
      return [[`${entry.owner}/location-${index}`, entry.state === "failed"
        ? { state: "failed", fault: `${entry.name}: ${entry.fault}` }
        : { state: "waiting", missing: [entry.waitingFor ?? entry.name] }]]
    }),
    ...failures,
    ...[...loadFailures].map(([name, fault]) => [name, { state: "failed" as const, fault: `Module load failed: ${fault}` }] as const),
  ]))
}

/**
 * THE GENERIC SERVICE LOOKUP IS GONE, and its absence is the phase.
 *
 * A signal stood here and a `holdServices` beside it, so that
 * `@olai/web/client/services.ts` could answer `readService(key)` for ANY key,
 * to any module that could spell the path. One consumer ever walked through it
 * — `olai-plugin-search`'s `createSearch` — and four packages drew a shortlist
 * through that consumer without declaring a dependency on the matcher: the
 * runtime saw no consumer of `search.readings`, the plugins panel had nothing
 * to report, and the value crossed two package boundaries as a module variable
 * (the audit's §5 and §12).
 *
 * Each of those packages declares the matcher on a component of its own now and
 * holds it for that activation, so what is left here is the report refresh —
 * which is this module's own reading of the host and not a door onto it.
 */
await run(Effect.forkScoped(Stream.runForEach(app.changes, () =>
  Effect.promise(async () => { if (composing === 0) await refreshReports() }),
)))

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
  failedLoads: ReadonlyMap<string, string> = new Map(),
  reloads: ReadonlySet<string> = new Set(),
): Promise<void> => {
  clients = clientFor
  loadFailures = failedLoads
  reloadRequired = reloads
  // NOTHING IS DRAWN FROM A HALF-COMPOSED TABLE. Every claim and every release
  // below tells the runtime, and each of those told the page; a plugin's faces
  // therefore arrived one at a time and — far worse — LEFT one at a time, in
  // reverse, so the provider a plugin registers last was withdrawn first and
  // the page was rebuilt from a table where its consumers still stood. See
  // {@link composing}, which carries the whole argument and the defect.
  //
  // NOT `batch()`, and it could not be: the disposes and mounts below are
  // awaited, and Solid's batch spans a synchronous call. What this suppresses
  // is the notification rather than the write, which is the same guarantee held
  // across an `await`.
  composing += 1
  try {
    await recompose(halves)
    await run(app.settlePlugins([...mounted.keys()]))
    await run(app.retryIntegrations)
    await run(app.settled)
  } finally {
    composing -= 1
    await refreshReports()
    // ONE NOTIFICATION for the whole movement, and only if there was one: a
    // redial whose roster named exactly what was already mounted moved no
    // table, and a page rebuilt for that would be this module inventing work
    // out of a reconnect.
    if (composing === 0 && missed) {
      missed = false
      setMoved((at) => at + 1)
    }
  }
}

/**
 * COMPONENTS ARE INDEPENDENT FIBERS OWNED BY ONE ROW.
 *
 * A row is the unit the server enables; a component is a smaller dependency
 * lifetime inside its browser half. Flattening both into this wanted set makes
 * row withdrawal remove every component, while each needs list still controls
 * only its own resources. A missing optional enrichment cannot withdraw its
 * parent's useful faces. No plugin receives a host or a mount capability.
 *
 * The record key supplies the component's local identity. Its exported
 * Plugin.name cannot select another row's authority: the root stamps both the
 * parent/component activation name and the owning row. Those are distinct
 * facts. The first keys reports and independent disposal; the second selects
 * Wired's sibling, Slots' owner and Offers' namespace. Parsing the activation
 * name inside those services would braid that policy into three capabilities.
 */
const recompose = async (halves: ReadonlyArray<BrowserHalf>): Promise<void> => {
  const wanted = new Map(halves.flatMap((half) => [
    [half.default.name, { plugin: half.default, owner: half.default.name }] as const,
    ...Object.entries(half.components ?? {}).map(([local, component]) => {
      if (!/^[a-z][a-z0-9-]*$/.test(local)) throw new Error(`Invalid browser component name: ${local}`)
      const name = `${half.default.name}/${local}`
      return [name, { plugin: { ...component, name }, owner: half.default.name }] as const
    }),
  ]))
  for (const name of failures.keys()) if (!wanted.has(name)) {
    failures.delete(name)
    owners.delete(name)
  }
  // OUT FIRST, so a plugin that left has unwound its registrations before a
  // plugin that arrived can claim a key it was holding. The two orders differ
  // only for a kind word two plugins could both claim, which the loader already
  // forbids — but the order that cannot be wrong costs nothing to pick.
  for (const [name, plugin] of [...mounted]) {
    if (wanted.has(name)) continue
    mounted.delete(name)
    await run(plugin.dispose)
    owners.delete(name)
  }
  for (const [name, { plugin: half, owner }] of wanted) {
    const existing = mounted.get(name)
    if (existing !== undefined) {
      // A consumer can fail later, when its missing provider first arrives.
      // Give that activation the same next-composition retry as a boot failure.
      const report = await run(existing.report)
      if (report.state !== "failed") continue
      await run(existing.dispose)
      mounted.delete(name)
      failures.set(name, report)
    }
    // `mountPlugin` RETURNS once the plugin has settled, whichever way — a half
    // that failed has already been contained by the runtime, so what is awaited
    // here is only "it has finished trying" and the page can draw whatever did
    // start.
    owners.set(name, owner)
    const plugin = await run(mountPlugin(app.host, half))
    mounted.set(name, plugin)
    failures.delete(name)
    const report = await run(plugin.report)
    if (report.state === "failed") {
      // A FAILED HALF DOES NOT STAY MOUNTED. `mounted` is what the guard four
      // lines up reads to skip a plugin that is already up, so an entry left
      // here after its `apply` failed is a plugin this tab will never try again
      // — not on the next roster frame, not after a redial that rebuilt
      // everything else. Nothing about the failure says it is permanent: a half
      // whose `apply` reached for a member the wire had not settled, or died on
      // a value one frame of the roster carried, deserves the next frame.
      //
      // DISPOSED BEFORE IT IS DROPPED, and the line above used to say the
      // disposal was unnecessary: *the runtime has already unwound whatever it
      // had registered, so dropping the entry leaves no residue.* That is true
      // of the plugin's own SCOPE — its finalizers ran — and false of the fiber
      // the registry is holding, which stays with its error retained. Every
      // redial that re-tried a permanently broken half appended another, for the
      // life of the tab, and `rowReport`'s "a row has exactly one fiber" stopped
      // being true of that name.
      await run(plugin.dispose)
      mounted.delete(name)
      failures.set(name, report)
      // The panel retains this fault after disposal, and the console carries
      // it for diagnostics too. The next composition retries the activation.
      console.error(
        `olai: the plugin "${name}" is running on the server, but its browser half failed to start — its faces are absent from this page`,
        report.fault,
      )
    }
  }
}

/**
 * THE THREE SLOT READS ARE GONE FROM THIS MODULE, and their absence is the
 * phase.
 *
 * `hung`, `dressed` and `only` lived here, and nine call sites in five plugins
 * imported them — which meant a plugin reached the module that ASSEMBLES the
 * browser application to find out what other plugins had hung, past the service
 * (`Faces`) that exists to answer exactly that. Everything else on this page
 * travelled with them: the mount table, the failure reports, the redial's
 * client holder, the compose counter. A plugin naming one export of this module
 * had all of them in scope.
 *
 * What a plugin reads now is {@link @olai/plugin-api}'s `Faces`, named in its
 * own `needs` and held for its own activation — the arrangement
 * `olai-plugin-chat` already used for the two slots its panel draws. The ORDER
 * those reads come back in was this module's one addition to them, and it moved
 * with them: `BrowserMount.rank` is supplied at {@link attachRenderer} and the
 * renderer's facade sorts, so the tab and a plugin get one answer rather than
 * two.
 *
 * This module is no longer on the `./client/*` door at all — it lives under
 * `src/host/`, which nothing outside this package can spell.
 */

export { browserReports }

/** Mount the renderer, in the build's own row order. ONE call rather than a
 *  `useBundleOrder` beside it: the rank is a fact about the composition, and a
 *  second export somebody has to remember to call first is the invariant
 *  {@link composeTo}'s own header argues against one seam over. */
export const attachRenderer = (
  element: Element,
  rank?: (plugin: string) => number,
): Promise<void> => run(app.attach(element, rank))
