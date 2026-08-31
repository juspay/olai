/**
 * THE PLUGIN SYSTEM — the interface, the composition, and the only place core
 * meets an appliance.
 *
 * ## What this package is for
 *
 * olai integrates with two things that are not olai: kolu, which runs coding
 * agents in terminals and serves them over MCP, and odu, which runs CI. Both
 * were extracted into packages of their own once (`@olai/kolu-client`,
 * `@olai/kolu-ui`, `@olai/odu-client`) and both left a residue behind: a
 * `kolu.ts` in `@olai/chat`, a `koluConfig.ts` in `@olai/server`, a named
 * `wiring.kolu` slot and a `koluHalf(…)` call beside it, four
 * `...koluMembers` spreads in the middle of core's wire spec, a row per plugin
 * member in the server's expose map, a `padi/` folder in `@olai/web`, and one
 * property key spelled at seven sites across four packages. Every one of those
 * is a general package knowing an appliance's name.
 *
 * The residue is not sloppiness; it is the part that genuinely was olai's own
 * JUDGEMENT about an appliance — what an absent padi means, which vault file
 * is kolu's, which property wears which face. What was missing is a place to
 * put a judgement about an appliance that is neither the appliance nor the
 * core. This is that place, and it is the only one.
 *
 * ## The shape, in one breath
 *
 * A plugin is a value ({@link ./plugin.ts}) whose first field is a NAME and
 * whose second is a whole SURFACE of its own. Core composes that surface as a
 * SIBLING under the name — the framework's own `composeSurfaceContracts` —
 * so a member declared `fleet` in `@olai/plugin-kolu` reaches the wire as
 * `surface/kolu/fleet/get` with no name arithmetic in any general package.
 * Core's own surface is untouched and its tags are unchanged: it rides the same
 * wire as its ROOT, which is a shape the framework carries end to end —
 * `mergeDisjointGroups` on the serve side, `exposeRootedFaces` at the gate,
 * `connectSurfaces`' `core` slot in the browser (juspay/kolu#2222). Nothing in
 * this package composes anything; it says WHAT there is to compose.
 *
 * Beside those, a plugin contributes property KINDS the format takes as data
 * and never imports, DRESSINGS licensed by declared kind, a CHROME slot or
 * two, a RUNTIME HALF it assembles itself, a PROBE
 * — which answers with the MCP server a chat session is handed AND the WHOLE
 * SENTENCE about the one it did not get, both off one reading, core displaying
 * and never composing either.
 *
 * A plugin also carries a USER PAGE, and it is deliberately NOT a field here:
 * the page is `packages/plugin-<name>/docs.md`, served under `docs/` through a
 * symlink at `docs/plugins/<name>.md`, and its address is the plugin's NAME.
 * {@link ./plugin.ts}'s `OlaiPlugin.name` argues that against the ruling it
 * looks like a breach of, and `packages/tests/plugin_docs.test.ts` is what
 * holds it — a manifest cannot, because the door that carries one cannot be
 * reached from a general sweep without putting a terminal emulator on its graph.
 *
 * ## What a DISABLED plugin is
 *
 * Absent from the record. Every one of the framework's composition doors takes
 * a plain keyed object of surfaces, so `--plugins` is a filter over it and
 * nothing else — no sibling, no tag, no handler, no expose row, no
 * `surface/<name>/` on the wire at all. `--plugins` is CLI/nix-only, the
 * git-policy shape, with no settings file and no browser toggle; preferences
 * draws the rows read-only, naming where to change them.
 *
 * ## What does NOT cross
 *
 * No core package imports a plugin — `./fence.test.ts` holds that as an
 * EQUALITY per package rather than as a filtered list that could rot to empty
 * and pass. No plugin imports this package, which is what keeps the direction
 * a DAG the manifests express rather than a rule a reviewer remembers. And no
 * general package spells a plugin's MEMBER: core knows a sibling key, and the
 * framework computes every address behind it.
 */

export type {
  AppClocks,
  AppFurniture,
  AppPopover,
  BlockChrome,
  BlockContext,
  ChipContext,
  Chrome,
  ChromeFace,
  Dressing,
  FileLink,
  JSX,
  NotHere,
  OlaiPlugin,
  PillLook,
  PluginMount,
  PluginServer,
  PluginServices,
  Probed,
  PropBlock,
  PropChip,
  PropEntry,
  PropKind,
  PropPane,
  StdioServer,
} from "./plugin.ts"

export {
  enabled,
  exposeMapsOf,
  isEnabled,
  PLUGIN_NAMES,
  type PluginWire,
  surfacesOf,
  WIRES,
} from "./surfaces.ts"
export { PLUGINS } from "./registry.ts"
