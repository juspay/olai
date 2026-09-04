/**
 * CORDIS, IN EFFECT'S WORDS — the one package in this tree that names the
 * plugin runtime, and the whole of what anybody else needs from it.
 *
 * ## Why there is a package here at all
 *
 * olai is written in Effect. Its plugin runtime is Cordis, because the reactive
 * half of a plugin system — a fiber held `PENDING` until the services it names
 * exist, unloaded when one leaves, re-applied when it comes back, mounted from a
 * config row a loader reads — is a large, proved thing that is not worth writing
 * again over `Scope`.
 *
 * What that left, for one phase, was two runtimes meeting in the open: the
 * composition root wrapped Cordis calls in `Effect.promise`, Cordis-side
 * services called back into Effect through captured emitters, and plugin bodies
 * were plain TypeScript that reached into Effect by hand. Every one of those is
 * an escape hatch, and every new plugin copies the ones it can see.
 *
 * So the meeting happens once, here. A plugin is an Effect; its revertible
 * effects are finalizers on a `Scope`; the services it names are `Context` tags;
 * `inject` and the requirement channel are one list. Nothing outside this
 * package imports `cordis`, and `packages/bundle/src/fence.test.ts` holds that
 * as an equality rather than as this paragraph.
 *
 * ## What is deliberately NOT here
 *
 * An opinion about what a plugin IS. This package knows about scopes, keys,
 * rows and a waterfall; it has never heard of a vault, a surface or a doorbell.
 * The moment something here grows an olai noun it belongs in
 * `@olai/plugin-api`, which is the package on the other side of exactly that
 * line.
 *
 * ## What Cordis is still doing under it
 *
 * The reactive coeffect and the loader, which is the part worth not rewriting.
 * The Effect-native alternative — reimplementing epochs, PENDING, provider
 * replacement and a declarative entry tree over `Scope` — stays named as the
 * other consistent answer and is not taken.
 */

/** `failed` is deliberately NOT here. It is the sentence a contained plugin
 *  failure is said with, shared by this package's three fire-and-forget edges so
 *  that what a reader is told cannot drift between them — and a rule one package
 *  owns stops being owned the moment a fourth caller outside it can spell it. */
export { type Bus, broadcast, type Listen } from "./broadcast.ts"
export { registry, type Registry, roster, type Roster } from "./registry.ts"
export {
  type Host,
  type Mounted,
  mountPlugin,
  namedBy,
  offered,
  openHost,
  closeHost,
  hostChanges,
  provide,
  type RowReport,
  type RowState,
  rowReport,
  settled,
} from "./host.ts"
export { standing } from "./standing.ts"
export { type Detach, definePlugin, detached, type Plugin } from "./plugin.ts"
export { type AnyKey, type Provision, serviceTag, type ServiceKey } from "./service.ts"
export { type Chain, type Dispatch, type Middleware, waterfall, type Waterfall } from "./waterfall.ts"

export { offer, OfferConflict } from "./lifecycle.ts"
