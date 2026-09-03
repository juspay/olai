/**
 * THE ONE DOOR ONTO THE BRIDGE — every runtime export anything in this tree
 * reaches, named once here and re-exported verbatim by both of this package's
 * doors.
 *
 * ## Why a plugin never names the bridge
 *
 * A plugin that had to import `@olai/effect-cordis` for `definePlugin` and this
 * package for its tags would be a plugin that knows there is a bridge — which is
 * the one thing the bridge exists to stop being true. What a half imports is
 * olai's interface; that the interface is built on a translation of Cordis is
 * this package's business and nobody else's.
 *
 * ## ...and why a COMPOSITION ROOT comes through here too
 *
 * The list was the plugin author's alone for a round, and `@olai/bundle` — which
 * is not a plugin and never will be — imported `rowReport` and the `Plugin` and
 * `Host` types off the bridge directly. That is two spellings of one arrow, and
 * the second one is what a reader copies: a package that wants a row's state
 * has a door for it already, and reaching past the door to the same function
 * teaches every later package that the door is optional.
 *
 * So there is ONE arrow onto the bridge's runtime and it lands here. What that
 * costs is nothing, because what a composition root spends and what a plugin
 * spends differ by exactly two functions:
 *
 * `openHost` and `provide` are NOT here, and they are the only two that could
 * not be. They are the capability rather than the vocabulary — a plugin that
 * could open a host could provide itself the services it is meant to NAME, and
 * `provide` is how a service gets behind a key at all. This package spends both
 * on the caller's behalf, in `openPlugins` and `openApp`, and hands back a host
 * with olai's own services already on it. Everything else the bridge exports is
 * either what a plugin writes with or what a root reads afterwards, and neither
 * is a capability: `rowReport` needs a host to say anything, and a type is a
 * type.
 *
 * ## The one thing reached PAST this door, and why it has to be
 *
 * `@olai/effect-cordis/loader`'s `mountRows`, by `@olai/bundle` and nobody else.
 * The loader reads a file off a disk and resolves module specifiers, so it
 * carries `node:url`, `node:fs` and a YAML parser; re-exporting it from here
 * would put all of that on the graph of the door a TAB opens, and it does not
 * fail at a boundary claim — it fails at `bun build`. A second door on this
 * package would be the same graph with a longer name.
 */

export {
  definePlugin,
  type Detach,
  detached,
  type Host,
  type Mounted,
  mountPlugin,
  type Plugin,
  type RowReport,
  rowReport,
  type RowState,
  serviceTag,
  standing,
} from "@olai/effect-cordis"
