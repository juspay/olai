/**
 * WHAT A HALF IS WRITTEN WITH — the bridge's exports a plugin is allowed to see,
 * named once and re-exported verbatim by both of this package's doors.
 *
 * ## Why a plugin never names the bridge
 *
 * A plugin that had to import `@olai/effect-cordis` for `definePlugin` and this
 * package for its tags would be a plugin that knows there is a bridge — which is
 * the one thing the bridge exists to stop being true. What a half imports is
 * olai's interface; that the interface is built on a translation of Cordis is
 * this package's business and nobody else's.
 *
 * ## ...and why the list is HERE rather than at each door
 *
 * There are two doors, because there are two halves — `./index.ts` is what a
 * browser half opens and `./services.ts` is what a server half does — and the
 * rule about the bridge is one rule. It was written at three sites instead, and
 * they had already drifted: `detached` and `serviceTag` reached the server only,
 * `mountPlugin` was spelled at both, `Host` at both again further down the same
 * files, and nothing anywhere recorded whether a difference was a decision or an
 * omission. One list, and a new bridge export reaches both halves or neither by
 * one edit.
 *
 * The four that are NOT here are not oversights. `openHost`, `provide`,
 * `rowReport` and `mountRows` are what a COMPOSITION ROOT spends — `@olai/server`
 * and `@olai/bundle` — and this package hands those out as `openPlugins` and
 * `openApp` instead, with olai's own services already provided on them. A plugin
 * that could open a host could provide itself the services it is meant to name.
 */

export {
  definePlugin,
  type Detach,
  detached,
  type Host,
  type Mounted,
  mountPlugin,
  type Plugin,
  serviceTag,
  standing,
} from "@olai/effect-cordis"
