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
 * ## `openHost` and `provide` are NOT here, and the reason is NAME FORGERY
 *
 * They are the only two exports that could not be on this list, and the argument
 * used to be the mild one — *a plugin that could open a host could provide itself
 * the services it is meant to NAME*. That is true and it is not the sharp half.
 *
 * The sharp half is that `mountPlugin` IS on this list, and its first argument is
 * a `Host`. The per-plugin STAMP — the thing every keyed service in
 * {@link ./services.ts} is built on — is `ctx.fiber.name`, read once by the
 * facade with no parameter anywhere for a caller to spell (`@olai/effect-cordis`'s
 * `plugin.ts`). So a plugin holding a host does not merely provide itself a
 * service: it calls `mountPlugin(host, { name: "kolu", inject: [], apply })` and
 * every registration that fiber makes — kolu's kinds, kolu's sibling surface,
 * kolu's hold file, kolu's doorbell — is stamped `kolu`. The fence the whole
 * keying design exists to be is one export away, and it is unreachable today
 * only because no plugin can obtain a host to hand it.
 *
 * A plugin that genuinely has to stand behind a service does not get either one.
 * It gets {@link ./services.ts}'s `Offers`, which is the VOCABULARY form of the
 * same capability and narrower in every direction that matters: the key set is
 * CLOSED, so core's own services can never be shadowed; the offer is REFUSABLE,
 * with a sentence naming both authors; it is DECLARED, because `Offers` is a tag
 * a plugin names in its `needs` like any other; and it never holds a host — the
 * host is closed over inside `openPlugins`, in the one package that is allowed to
 * spend the capability at all.
 *
 * Everything else the bridge exports is either what a plugin writes with or what
 * a root reads afterwards, and neither is a capability: `rowReport` needs a host
 * to say anything, and a type is a type.
 *
 * ## ...and why the three TABLES joined the list
 *
 * `broadcast`, `registry` and `roster` are on it now, and they are the same kind
 * of thing as `detached` rather than the same kind of thing as `provide`. A table
 * of scope-held entries reaches no host, provides nothing and names nobody: it is
 * a `Map` whose deletes are finalizers on whoever wrote them, and what it can do
 * is exactly what its holder could do with a `Map` and an `addFinalizer` written
 * by hand.
 *
 * Which is the argument for handing it over rather than against. `openPlugins`
 * already says it of itself — *THE THREE BUSES, and they are one primitive rather
 * than three hand-rolled copies of it* — and a plugin that stands behind a door
 * holds exactly those tables on the other side of the same seam. Hand-rolling one
 * is how a registration stops unwinding with its writer, how a collision starts
 * resolving silently in favour of whoever registered last, and how a handler that
 * dies takes the dispatch down with it. Each of those is a defect this tree has
 * had, and each of them is a paragraph in `@olai/effect-cordis`'s own headers.
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
  broadcast,
  type Bus,
  definePlugin,
  type Detach,
  detached,
  type Host,
  type Listen,
  type Mounted,
  mountPlugin,
  type Plugin,
  registry,
  type Registry,
  roster,
  type Roster,
  type RowReport,
  rowReport,
  type RowState,
  serviceTag,
  standing,
} from "@olai/effect-cordis"
