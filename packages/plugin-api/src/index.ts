/**
 * WHAT A PLUGIN IS WRITTEN AGAINST — the interface, and nothing that names a
 * plugin.
 *
 * ## What this package is for
 *
 * olai integrates with two things that are not olai: kolu, which runs coding
 * agents in terminals and serves them over MCP, and odu, which runs CI. Both
 * were extracted into packages of their own once and both left a residue behind
 * — a `kolu.ts` in `@olai/chat`, a `koluConfig.ts` in `@olai/server`, a named
 * `wiring.kolu` slot and a `koluHalf(…)` call beside it, four `...koluMembers`
 * spreads in the middle of core's wire spec, a row per plugin member in the
 * server's expose map, a `padi/` folder in `@olai/web`, and one property key
 * spelled at seven sites across four packages. Every one of those is a general
 * package knowing an appliance's name.
 *
 * The residue is not sloppiness; it is the part that genuinely was olai's own
 * JUDGEMENT about an appliance — what an absent padi means, which vault file is
 * kolu's, which property wears which face. What was missing is a place to put a
 * judgement about an appliance that is neither the appliance nor the core. This
 * is that place.
 *
 * ## It used to be the registry too, and that half has left
 *
 * `PLUGINS`, `WIRES` and `SERVERS` — the three lists that named every plugin
 * this build has — are `@olai/bundle`'s now, beside the `.yml` the server's
 * loader mounts them from. What made the split necessary is that a plugin
 * IMPORTS this package: its server half is an Effect whose `needs` names the
 * service tags in {@link ./services.ts}, and a package that both named every
 * plugin and was named by every plugin is a cycle the manifests decline to
 * express. So the interface stayed and the registry moved, and the arrow
 * between them runs one way.
 *
 * ## The shape, in one breath
 *
 * A plugin is a NAME and a whole SURFACE of its own. Core composes that surface
 * as a SIBLING under the name — the framework's own `composeSurfaceContracts` —
 * so a member declared `fleet` in `olai-plugin-kolu` reaches the wire as
 * `surface/kolu/fleet/get` with no name arithmetic in any general package.
 *
 * Beside those, a plugin contributes property KINDS the format takes as data
 * and never imports, FACES it hangs in the app's six declared slots
 * ({@link ./browser.ts}) — dressing a kind it contributed, or keyed by its own
 * name — a SERVER HALF that installs itself into the services here, and a PROBE
 * — one reading that answers with the MCP server a chat session is handed AND
 * the WHOLE SENTENCE about the one it did not get.
 *
 * A plugin also carries a USER PAGE, and it is deliberately NOT a field here:
 * the page is `packages/plugins/<name>/docs.md`, served under
 * `docs/` through a symlink at `docs/plugins/<name>.md`, and its address is the
 * plugin's NAME — the one word in {@link ./contract.ts}'s {@link PluginWire},
 * which is also the word the loader binds the fiber under, so the docs slug,
 * the wire prefix and the fiber's own key cannot drift apart
 * (`packages/tests/plugin_docs.test.ts` holds the page to it).
 *
 * ## THE TWO DOORS
 *
 * This one is what a BROWSER half is written against: the SLOTS its faces hang
 * in and the service tags it names in its `needs` ({@link ./browser.ts}), the face
 * types that say what each of those faces is handed ({@link ./plugin.ts}, whose
 * fields return `JSX.Element`), and the shapes both halves share
 * ({@link ./contract.ts}). {@link ./services.ts} is what a SERVER half is
 * written against, and it names `effect` and no browser face where this one
 * names `solid-js` as well: a server that reached a browser face would evaluate
 * a `.tsx` and die on `react/jsx-dev-runtime` before it served anything. Neither
 * names `cordis`: the plugin runtime is `@olai/effect-cordis`'s alone.
 */

export type {
  ConversationSeen,
  Deliveries,
  NotHere,
  PluginHeld,
  PluginWire,
  Probed,
  PropKind,
  StdioServer,
  Wake,
} from "./contract.ts"
export { exposeMapsOf, KIND_SEPARATOR, kindWordOf, surfacesOf } from "./contract.ts"
export type {
  AppClocks,
  AppPopover,
  BlockChrome,
  BlockContext,
  ChipContext,
  FileLink,
  JSX,
  PillLook,
  PluginMark,
  PropBlock,
  PropChip,
  PropEntry,
  PropPane,
} from "./plugin.ts"
/** THE RUNTIME A BROWSER HALF INSTALLS ITSELF INTO — the six slots and the
 *  four services, beside the shapes above that say what a face drawn into one
 *  is handed. Both come through this door because both are what a browser half
 *  is written against, and neither is reachable from `./services.ts`. */
export type {
  App,
  AppConfig,
  Host,
  Hung,
  KindSlot,
  PluginSlot,
  SlotFaces,
  SlotName,
} from "./browser.ts"
export {
  Bar,
  Clocks,
  definePlugin,
  Links,
  mountPlugin,
  openApp,
  SLOTS,
  Slots,
  Wired,
} from "./browser.ts"
