/**
 * WHAT A BROWSER HALF IS WRITTEN AGAINST — the SLOTS a face is hung in and the
 * four services the app hands over, as Effect tags.
 *
 * ## What this replaces, and why the manifest could not survive
 *
 * A plugin's browser half was a VALUE: an `OlaiPlugin` object with `dressings`,
 * `chrome`, `mount` and `mark` on it, listed in a compiled-in registry, walked
 * by four different modules in `@olai/web`. It worked while a browser half was
 * a thing the tab HAD. It stopped working the day the roster could move.
 *
 * A manifest is a static value, so it is present whether or not this serve
 * composed the plugin — which is why every one of those four walks had to carry
 * a LICENCE argument beside it, and why the two licences pointed opposite ways
 * (a face drawn early and taken away is a flicker; a subscription opened early
 * LATCHES a `degraded` readout for the life of the page). Four walks, two
 * licences, one `undefined`-means-wait, and a whole module arguing the
 * asymmetry — all of it because the tab held things it had no licence to use.
 *
 * A FIBER is the shape that does not have that problem, and it is the shape the
 * server half already is. A plugin the roster does not name is never mounted,
 * so it registers nothing, so there is nothing to license: *no fiber, no
 * surface, no handler* has an exact browser twin, which is *no fiber, no slot
 * entry*. Every registration below is a finalizer on the plugin's own scope, so
 * a plugin the roster stops naming unwinds its own faces on the way out and the
 * app re-reads what is left.
 *
 * ## THE SIX SLOTS, and why the table is data
 *
 * A slot is a place in this app where a plugin's face may hang. There are six
 * and they are DECLARED ({@link SLOTS}) rather than implied by four hooks on an
 * interface, because a registration has to be checkable against something: a
 * plugin hanging a chip in the header is a mistake somebody should be told
 * about at the moment they make it, and an interface with an optional field per
 * hook can only be wrong silently.
 *
 * THERE WERE SEVEN. `app.drawer` — the panel a header readout's press opens —
 * was declared and READ BY NOBODY: the chrome walk draws `app.header` and the
 * one plugin with a panel hangs it on {@link Bar}'s `popover()`, which is the app's
 * whole portalled panel rather than a slot. A slot nobody reads is a face
 * registered into silence, which is the failure `live/dressings.ts` names about
 * this very table — so it is gone until something wants it, and it comes back
 * as a walk beside `PluginHeaders` on the day one does.
 *
 * Each slot declares WHAT KEYS IT — and there are exactly two rules, which is
 * why there are two register doors rather than six:
 *
 *   - **`plugin`** — one face per plugin, keyed by the fiber's own name. The
 *     header readout, the tab half wrapped around the page, and the mark a
 *     delivered sentence wears. The key is the plugin's own word, minted into
 *     the service before the plugin ran, for the reason {@link ./services.ts}'s
 *     doors are minted that way: a key a caller supplies is a key one plugin can
 *     sign another's registration with.
 *   - **`kind`** — one face per property KIND, keyed by the word this plugin's
 *     bare kind composes to. The chip beside a value, the pane its press opens,
 *     and the block that owns a row. The composition is `kindWordOf`, the same
 *     function {@link ./services.ts}'s `Kinds` uses on the server, so the
 *     word a face is looked up by and the word a vault declares cannot be two
 *     spellings.
 *
 * ## The four services, and why they are four rather than one blob
 *
 * They were one — `AppFurniture`, handed to every face as a prop — and the blob
 * was right while a plugin's faces were values the app called: there was
 * nothing to inject them INTO. A fiber has an `inject`, so a browser half now
 * NAMES what it needs and the runtime holds it `waiting` until it exists, which
 * is the same guarantee its server half already has. Four rather than five because
 * the blob's `desktop` is the bar's own fact and travels with the bar's
 * geometry.
 *
 * A face no longer takes the furniture as a prop at all: it closes over the
 * services its own `apply` was handed. That is what makes {@link SlotFaces}'
 * signatures as small as they are — a header readout is `() => JSX.Element`,
 * because everything it used to be handed is on the context that registered it.
 *
 * ## THE TWO DOORS DO NOT SHARE A CONTEXT TYPE ANY MORE, and that is the tags
 *
 * There used to be a `declare module "cordis"` on each door, merging globally, so
 * a file that imported either one saw `ctx.slots` beside `ctx.vault`. A tag is a
 * VALUE: this door's tags are the ones a browser half yields and the server's are
 * the ones a server half yields, and a half that names the wrong one does not
 * typecheck rather than reading `undefined` at its first access. What the fence
 * holds is still the GRAPH, and the graph is what `@olai/bundle`'s
 * `fence.test.ts` walks.
 */


import { definePlugin, type Host, mountPlugin, openHost, provide, serviceTag } from "@olai/effect-cordis"
import { Effect, Scope } from "effect"

import { kindWordOf } from "./contract.ts"
import type {
  AppClocks,
  AppPopover,
  FileLink,
  JSX,
  PillLook,
  PropBlock,
  PropChip,
  PropPane,
} from "./plugin.ts"

/** WHAT A BROWSER HALF IS WRITTEN WITH, re-exported so it opens ONE door — the
 *  same argument `./services.ts` makes for the server's. */
export { definePlugin, mountPlugin }
export type { Host }

/**
 * WHERE A FACE CAN HANG — the six, and what keys each.
 *
 * DATA rather than a union alone, because the key rule is the thing a reader
 * and the service both need and a union could only carry the names. The gloss
 * is on the row for the same reason a `PropKind`'s is: this is the list
 * somebody writing a plugin reads to find out what this app has room for.
 */
export const SLOTS = {
  /** A face beside the value, in the property run — drawn only while the
   *  plugin has something to say about it. */
  "outline.row.chip": { keyedBy: "kind" },
  /** ...and what that chip's press opens, under the run. */
  "outline.row.pane": { keyedBy: "kind" },
  /** A face that OWNS the property's row, whether or not anything is
   *  happening. A block wins where a plugin registers both. */
  "outline.row.block": { keyedBy: "kind" },
  /** A readout in the app's bar. WHERE it sits in the cluster is the app's
   *  decision and always was; what a plugin gets is a seat. */
  "app.header": { keyedBy: "plugin" },
  /** The tab's own half of this plugin, wrapped ONCE around the page — one
   *  subscription however many leaves draw. These NEST; the app folds them. */
  "app.mount": { keyedBy: "plugin" },
  /** The shapes drawn over a sentence this plugin delivered into somebody's
   *  conversation — a `<g>` in a sixteen-unit box, never a whole `<svg>`. */
  "chat.speaker.mark": { keyedBy: "plugin" },
} as const satisfies Readonly<Record<string, { readonly keyedBy: "plugin" | "kind" }>>

/** One of the six. */
export type SlotName = keyof typeof SLOTS

/** ...the three a PLUGIN keys, one face each. */
export type PluginSlot = {
  [S in SlotName]: (typeof SLOTS)[S]["keyedBy"] extends "plugin" ? S : never
}[SlotName]

/** ...and the three a property KIND keys. */
export type KindSlot = {
  [S in SlotName]: (typeof SLOTS)[S]["keyedBy"] extends "kind" ? S : never
}[SlotName]

/**
 * WHAT GOES IN EACH SLOT.
 *
 * The three `outline.row.*` faces take the drawer's context, which is the one
 * thing they cannot close over: a chip is drawn per value and has to be told
 * WHICH value ({@link ./plugin.ts}'s `BlockContext`). Everything else takes
 * nothing at all, and that is the change the services made — a header readout
 * used to be handed the whole furniture as a prop, and now closes over the
 * services its own `apply` injected.
 *
 * `app.mount` is the one exception and it is structural rather than a contract
 * the app owes: a mount WRAPS, so it must be handed what it wraps.
 */
export interface SlotFaces {
  "outline.row.chip": PropChip
  "outline.row.pane": PropPane
  "outline.row.block": PropBlock
  "app.header": () => JSX.Element
  "app.mount": (props: { readonly children: JSX.Element }) => JSX.Element
  "chat.speaker.mark": () => JSX.Element
}

/** One face, with the plugin that hung it — what a walk over a plugin-keyed
 *  slot reads. The name is on the row because the app has occasion to use it
 *  (a testid, a mark looked up by the word core stamped on a chat row) and
 *  never to compose an address out of it. */
export interface Hung<F> {
  readonly plugin: string
  readonly face: F
}

/**
 * EVERY FACE THIS TAB HAS RIGHT NOW — the browser's twin of `Surfaces`, and the
 * one service whose registrations move the page.
 *
 * ## The re-read is the APP's and not this service's
 *
 * The runtime holds the table and says when it moved; what re-reads it is
 * `@olai/web`, through {@link AppConfig.changed}. That is exactly the split
 * `Surfaces` keeps on the server and for the same reason: a service that
 * re-rendered would be a service that knew what a render is, and this one has
 * never heard of Solid. The app wires `changed` to a signal, and every walk over
 * a slot is a read of it.
 *
 * ## A DUPLICATE IS REFUSED, unconditionally
 *
 * Two plugins hanging a chip on one composed kind word cannot happen — the
 * prefix is the row's id and the loader will not mount two rows under one — so
 * the reachable case is a plugin registering the same slot twice, which is a
 * mistake in that plugin and is worth refusing at the moment it is made. The
 * refusal DIES inside `acquire`, which lands the plugin in `failed` having
 * installed nothing: one plugin's faces are absent, and every other plugin's are
 * untouched.
 *
 * ## THE KEY IS NEVER AN ARGUMENT
 *
 * A plugin-keyed slot takes no key at all and a kind-keyed one takes the BARE
 * word, which is composed here with the plugin's own name — the same
 * `kindWordOf` the server's `Kinds` uses, so the word a face is looked up by and
 * the word a vault declares cannot be two spellings. The name comes off the
 * registry binding, which is what makes "a plugin cannot sign another's
 * registration" a shape rather than a rule.
 */
export interface Slots {
  /** Hang this plugin's one face in a plugin-keyed slot, for as long as it is
   *  loaded. */
  readonly register: {
    <S extends PluginSlot>(slot: S, face: SlotFaces[S]): Effect.Effect<void, never, Scope.Scope>
    /** ...or dress one of this plugin's KINDS, by its bare word. */
    <S extends KindSlot>(
      slot: S,
      kind: string,
      face: SlotFaces[S],
    ): Effect.Effect<void, never, Scope.Scope>
  }
}
export const Slots = serviceTag<Slots>("slots")

/**
 * THE APP'S CLOCK, and the register it ticks in.
 *
 * Every field is the app's own arithmetic ({@link AppClocks}), handed over
 * rather than restated, because each of them fails the same silent way: a chip
 * whose duration ladder drifted reads plausibly and is wrong, and nothing
 * anywhere goes red.
 *
 * ## THE FACADE IS GONE, and with it a whole class of bug
 *
 * This was a CLASS that restated every member of the record it wrapped, and a
 * class's prototype method is not a value: `clocks.tickingOf`, detached from its
 * receiver, read `this.config` off `undefined` and threw deep inside a render,
 * on a page that happened to draw a live CI chip. Every function had to be
 * re-declared as a bound `=` property to get back what the record already was.
 *
 * A tag's shape IS the record. There is nothing to restate, nothing to bind, and
 * no line for a new field to fail to appear on.
 */
export type Clocks = AppClocks
export const Clocks = serviceTag<Clocks>("clocks")

/**
 * THE BAR — its geometry, its breakpoint and the popover that shares its one
 * focus cycle.
 *
 * Three facts about one place, which is why they are one service and the clock
 * is another: a readout that wants the pill's classes wants the breakpoint and
 * the panel too, and a plugin that draws no chrome at all wants none of the
 * three and says so by leaving this out of its `needs`.
 *
 * `desktop` is here rather than on its own because it is the BAR's fact: the
 * pills are desktop-only, and a plugin answering that out of its own media query
 * would be a second answer to the app's breakpoint.
 */
export interface Bar {
  readonly desktop: () => boolean
  /** The pill's classes — the box is the bar's and what is drawn inside it is
   *  the plugin's, which is why this is classes rather than a component. */
  readonly pill: PillLook
  /** A panel that hangs off a chrome pill, whole: the portal, the layer, the
   *  anchor and the focus cycle already spent. */
  readonly popover: () => AppPopover
}
export const Bar = serviceTag<Bar>("bar")

/** A DOOR ONTO A SERVED FILE — the app's router and its address grammar as the
 *  one thing a plugin wants out of them. Its own service rather than a field on
 *  the bar because it has nothing to do with the bar: a chip deep in a property
 *  run links to a file, and it draws nowhere near the chrome. */
export interface Links {
  readonly File: FileLink
}
export const Links = serviceTag<Links>("links")

/**
 * THIS PLUGIN'S OWN SIBLING CLIENT — the browser twin of `Surfaces`, read the
 * way `Deliveries` is read.
 *
 * KEYED BY THE PLUGIN and not by an argument, for that door's reason exactly: a
 * client addressed by a name a caller supplies is a client one plugin can ask
 * for another's members through. The key is the sibling key the framework
 * composed this plugin's members under, which is the one word core has about it.
 *
 * `unknown`, and the honesty of that is the point: core cannot type a plugin's
 * client without learning its members, which is the one thing this arrangement
 * exists to prevent. It travels opaque and is narrowed by the plugin, once, at
 * its own edge.
 *
 * `null` is a plugin whose sibling this wire does not carry, which after the
 * roster drives the mount is a state that should not be reachable — the tab
 * mounts a plugin only for a name the roster named, and it dials that name in
 * the same breath. It is `null` rather than a failure because the honest answer
 * to "your members are not on this wire" is a plugin that draws its
 * nothing-here arm.
 *
 * ## A FUNCTION, and holding one is safe now
 *
 * It was a prototype method deliberately left unbound, because it read the
 * CALLING fiber off a tracker proxy and a bound copy would have handed every
 * plugin whichever client the service was constructed under — a quiet wrong
 * answer where an unbound one at least threw. There is no proxy: this plugin's
 * client was resolved from this plugin's own word before the plugin ever ran, so
 * `const c = wired.client; c()` is exactly as correct as calling it in place.
 */
export interface Wired {
  readonly client: () => unknown
}
export const Wired = serviceTag<Wired>("wired")

/**
 * THE TAB'S SIDE OF THE TABLE — what `@olai/web` holds, and the other end of
 * every door above.
 *
 * The registries are READ here and WRITTEN by the plugins, which is why they are
 * two different shapes rather than one: `Slots` has a `register` and no `hung`,
 * and this has `hung` and no `register`.
 */
export interface App {
  /** Where the plugins hang — handed to `mountPlugin` and opaque to everybody. */
  readonly host: Host
  /**
   * WHAT IS HUNG IN A PLUGIN-KEYED SLOT, in mount order.
   *
   * Mount order is BUNDLE order, because that is the order the rows are mounted
   * in — so the bar's cluster and the mount fold read top-down as the file
   * reads, and a plugin whose half must sit inside another's is expressed by
   * moving a row.
   */
  readonly hung: <S extends PluginSlot>(slot: S) => ReadonlyArray<Hung<SlotFaces[S]>>
  /** ...and what dresses each COMPOSED KIND WORD in a kind-keyed slot. Keyed
   *  rather than ordered: a value wears at most one of these and the lookup is
   *  by the word the page's licence carries. */
  readonly dressed: <S extends KindSlot>(slot: S) => ReadonlyMap<string, SlotFaces[S]>
  /**
   * ...AND THE APP'S OWN FURNITURE, provided in a SECOND call.
   *
   * Two calls rather than one config, and the reason is a GRAPH rather than
   * taste: the clock, the bar and the file door are assembled in a `.tsx` (a
   * link is a component and a popover portals one), and the module that opens
   * this runtime is a `.ts` reached by the chat panel — so a static import from
   * there would put a JSX factory on the graph of a suite that only wanted a
   * lookup. A plugin that beats this call sits `waiting` on the service it named
   * and starts when it arrives, which is the runtime's own guarantee rather than
   * something an ordering has to be careful about.
   */
  readonly furnish: (
    furniture: { readonly clocks: Clocks; readonly bar: Bar; readonly links: Links },
  ) => Effect.Effect<void, never, Scope.Scope>
}

/** WHAT THE TAB SUPPLIES — everything a plugin must not reach for itself. */
export interface AppConfig {
  /** TOLD WHEN A FACE ARRIVES OR LEAVES. The app wires it to a signal; this
   *  runtime has never heard of Solid, which is the same split `Surfaces` keeps
   *  one door over. */
  readonly changed?: () => void
  /** One plugin's own sibling client, by name — `null` where this wire does not
   *  carry it. */
  readonly clientFor?: (plugin: string) => unknown
}

/**
 * OPEN THE TAB'S PLUGIN RUNTIME — the host, the services on it, and the two
 * reads back.
 *
 * SCOPED, because every `provide` is; in a tab that scope is the page's, which
 * is the process.
 */
export const openApp = (config: AppConfig = {}): Effect.Effect<App, never, Scope.Scope> =>
  Effect.gen(function*() {
    const host = yield* openHost
    /** Slot → key → face. Two levels rather than one composite key, because the
     *  walks read a whole slot and never a single composite. */
    const table = new Map<SlotName, Map<string, unknown>>()

    yield* provide(host, Slots, (plugin) => ({
      register: (slot: SlotName, second: unknown, third?: unknown) =>
        Effect.acquireRelease(
          Effect.suspend(() => {
            const keyed = SLOTS[slot].keyedBy === "kind"
            const key = keyed ? kindWordOf(plugin, second as string) : plugin
            const face = keyed ? third : second
            // THE TABLE AND THE TEST ARE BOTH READ HERE, inside `acquire`, and
            // the second half of that was wrong for a round: they were computed
            // where `register` was CALLED, which made them a snapshot of that
            // moment rather than of the moment the registration takes. A plugin
            // that unloads and comes back re-runs its `apply` after its
            // finalizers have taken the key back out; a captured `already` would
            // still say `true` and refuse the face it had just unwound, and a
            // captured `held` would write into a `Map` this table had already
            // dropped when the slot emptied — an entry that exists for the
            // plugin and is invisible to every reader.
            const held = table.get(slot) ?? new Map<string, unknown>()
            if (held.has(key)) {
              return Effect.die(
                new Error(
                  `plugins: "${plugin}" hangs two faces in "${slot}" under "${key}" — `
                    + "the second would replace the first with nothing said.",
                ),
              )
            }
            held.set(key, face)
            table.set(slot, held)
            config.changed?.()
            return Effect.succeed({ held, key })
          }),
          ({ held, key }) =>
            Effect.sync(() => {
              held.delete(key)
              if (held.size === 0) table.delete(slot)
              config.changed?.()
            }),
        ).pipe(Effect.asVoid),
    } as Slots))

    yield* provide(host, Wired, (plugin) => ({
      client: () => config.clientFor?.(plugin) ?? null,
    }))

    return {
      host,
      hung: <S extends PluginSlot>(slot: S): ReadonlyArray<Hung<SlotFaces[S]>> => {
        const held = table.get(slot)
        if (held === undefined) return []
        return [...held].map(([plugin, face]) => ({ plugin, face: face as SlotFaces[S] }))
      },
      dressed: <S extends KindSlot>(slot: S): ReadonlyMap<string, SlotFaces[S]> =>
        new Map(table.get(slot) ?? []) as ReadonlyMap<string, SlotFaces[S]>,
      furnish: (furniture) =>
        Effect.gen(function*() {
          yield* provide(host, Clocks, () => furniture.clocks)
          yield* provide(host, Bar, () => furniture.bar)
          yield* provide(host, Links, () => furniture.links)
        }),
    }
  })
