/** Browser capabilities and notebook compatibility contracts.
 *
 * The renderer owns the sole location registry. Slots and Faces retain the
 * notebook extension vocabulary as a typed adapter; openApp supplies no slot
 * tables. Child locations belong to consuming entries, and contributions wait
 * until those entries activate. The host binds contributor identity and batches
 * notifications across roster changes to preserve provider/editor lifetimes.
 *
 * Clocks and Bar are compatibility names for renderer/layout-owned services.
 * Links remains a transitional host service pending navigation extraction.
 */

import {
  type Host,
  type ServiceKey,
  hostChanges,
  openHost,
  offer,
  OfferConflict,
  provide,
  offered,
  settled,
  location,
  type Locations,
  type Location,
  type LocationOwner,
  serviceTag,
} from "@olai/effect-cordis"
import { Effect, Scope, type Stream } from "effect"

import { BrowserMount } from "./mount.ts"
import { ownService, type OwnServices } from "./owned.ts"
import { kindWordOf, type NotHere } from "./contract.ts"
import { SLOTS, type SlotKey } from "./slots.ts"
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

/** WHAT A BROWSER HALF IS WRITTEN WITH, re-exported so it opens ONE door —
 *  {@link ./runtime.ts}, which is the same list `./services.ts` hands the server
 *  half. This module's own bench opens it here; a plugin opens `./index.ts`. */
export * from "./runtime.ts"

/** THE CATALOG IS `./slots.ts`'S and is re-exported here, because a browser half
 *  opens one door and this is it. It moved when a SERVE had to be able to name
 *  the slots too — `plugins.inspect` answers what an agent-written face may
 *  register into — and a serve may not open this door at all. That module's
 *  header carries the argument. */
export { SLOTS, type SlotKey } from "./slots.ts"

/** Browser providers publish only their own namespace. Core browser services
 * remain host-owned. This tag resolves independently of server Offers. */
export interface Offers extends OwnServices {}
export const Offers = serviceTag<Offers>("offers")

/** One of the seventeen. */
export type SlotName = keyof typeof SLOTS

/** The rows of {@link SLOTS} one key rule holds — the four names below are this
 *  applied four times, and they are four names rather than one generic because
 *  the register doors and the reads are written against them by name. */
type SlotsKeyedBy<K extends SlotKey> = {
  [S in SlotName]: (typeof SLOTS)[S]["keyedBy"] extends K ? S : never
}[SlotName]

/** ...the four a PLUGIN keys, one face each. */
export type PluginSlot = SlotsKeyedBy<"plugin">

/** ...the three a property KIND keys. */
export type KindSlot = SlotsKeyedBy<"kind">

/** ...the eight nothing keys, which is what makes them lists. */
export type ListSlot = SlotsKeyedBy<"nothing">

/** ...and the one the APP keys, which is what makes it the only one. */
export type SingleSlot = SlotsKeyedBy<"app">

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
 *
 * ## ONE OF THEM IS NOT A FACE, and the asymmetry is the rule working
 *
 * `engine.install` holds a {@link NotHere} — a name, a place and a whole
 * sentence — where every other row holds a function that draws. The split the
 * whole table is under is *core keeps the SHAPE, the plugin brings the words*,
 * and for the no-agent row the shape is entirely core's: the list, the mark
 * beside it, and whether the name is an `<a href>` or a plain `<span>`. A face
 * there put core's own Tailwind vocabulary inside three tenant packages, in
 * three byte-identical files that would drift from `@olai/web` the first time
 * core restyled a link — and it made every future engine copy the markup to say
 * one sentence.
 *
 * A mark stays a face because a `<g>` is genuinely the plugin's drawing. This is
 * the difference between the two, made in the type.
 *
 * FOUR OF THEM ARE NOT FACES NOW, and the count is the split working rather than
 * eroding: a menu verb is words and a press, a chord is a key and a press, a
 * sidebar section is a heading and a body. In each of the three the box is core's
 * — the menu's row and where in the list it sits, the shortcut list's spelling of
 * the chord, the sidebar's region and its height budget — and what core cannot
 * write is the words and what the press does.
 */
export interface SlotFaces {
  "outline.row.chip": PropChip
  "outline.row.pane": PropPane
  "outline.row.block": PropBlock
  "outline.row.door": (props: { readonly node: string }) => JSX.Element
  "outline.row.action": RowActions
  "app.route": AppPage
  "sidebar.entry": SidebarEntry
  "sidebar.section": SidebarSection
  "app.panel": () => JSX.Element
  "app.header": BarSeat
  "app.banner": () => JSX.Element
  "app.viewer": () => JSX.Element
  "app.keys": AppChord
  "app.command": AppCommand
  "app.palette": AppPalette
  "app.mount": (props: { readonly children: JSX.Element }) => JSX.Element
  "delivery.mark": () => JSX.Element
  "engine.install": NotHere
}

/** The transport-shaped part of a standing page reading. Kept structural so
 * the plugin API does not import either Solid or the vault's format. */
export interface AppPageAnswer {
  (): unknown | undefined
  readonly changed?: (handler: () => void) => () => void
}

export interface AppPageStream {
  readonly use: (input: () => unknown | null) => AppPageAnswer
}

/** One declarative claim on the app's URL namespace. Exact words and prefixes
 * are enough for the address grammars plugins can own, and unlike an arbitrary
 * parser they can be checked against every other mounted claim. */
export type AppRouteClaim =
  | { readonly kind: "exact"; readonly path: `/${string}` }
  | { readonly kind: "prefix"; readonly path: `/${string}` }

/** One plugin-owned URL grammar and standing reading. The heterogeneous value
 * positions are deliberately erased at this floor; `@olai/web`'s
 * `defineAppRoute` is the typed adapter that may construct one. */
export interface AppRoute {
  readonly claims: ReadonlyArray<AppRouteClaim>
  readonly parse: (pathname: string) => unknown | null
  readonly href: (page: unknown) => string
  readonly breadcrumb: (page: unknown) => string
  readonly narrowable: boolean
  readonly request: (page: unknown, today: string) => unknown
  readonly stream: AppPageStream
}

/** The complete page registration: one route source and the drawing of its
 * answer, acquired and released in the same plugin scope. */
export interface AppPage {
  readonly route: AppRoute
  readonly face: (props: {
    readonly page: unknown
    readonly drawn: unknown
    readonly today: string
  }) => JSX.Element
}

/** A plugin's one seat in the app's bar, and which of the two the shell should
 * put it in. `cluster` is the standing row of pills — desktop only, after the
 * connection state; `lead` is the seat ahead of them that may shrink to nothing
 * and that a phone still draws. The shell decides what either costs when the
 * width runs out; a plugin cannot spell an ordering of its own. */
export interface BarSeat {
  readonly place: "lead" | "cluster"
  readonly body: () => JSX.Element
}

/** A plugin-owned directory entry. The shell decides where the two supported
 * placements sit; the optional rail face travels with the same entry. */
export interface SidebarEntry {
  readonly place: "top" | "bottom"
  readonly body: () => JSX.Element
  readonly rail?: () => JSX.Element
}

/** An ordinary palette navigation row. A URL is the shared navigation currency;
 * the shell resolves it against the same exclusive claims as the address bar. */
export interface AppPalette {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly search: string
  readonly href: `/${string}`
}

/**
 * A PLUGIN'S VERBS ON A ROW'S ••• MENU — `outline.row.action`.
 *
 * A FUNCTION OF NOTHING THAT ANSWERS A LIST, rather than one verb per
 * registration, and the shape is the whole of what this slot learned from its
 * first tenant. The chat panel offers *Ask agent* always and *Start an agent
 * session* ONCE PER INSTALLED ENGINE — a count that is not knowable when the
 * plugin's `apply` runs, because the roster arrives over a wire the tab dials
 * after it. A plugin registering N faces would have had to know N at
 * registration; a plugin registering one face that ANSWERS N reads its own live
 * state at the walk, where the app is already re-reading this table inside a
 * tracked memo.
 *
 * It also makes the empty answer expressible, which the old shape could not: a
 * machine with no agent installed offers no *start* row at all, and an entry
 * whose only outcome is "there is nothing to start" teaches nobody anything.
 *
 * ## AND IT TAKES THE NODE, because the count depends on the row as well
 *
 * A node already talking through a conversation is offered no *start* at all,
 * and one that names an engine is offered THAT engine rather than a choice —
 * three different lists on three rows of one outline. The reading answered
 * nothing for one revision and could not express any of it; what it costs to
 * take the node is nothing, because the walk is per row already.
 *
 * THE NODE THE ROW SHOWS, which is the same id a press is handed and is core’s
 * arithmetic over mirrors and folds, spent once before either call.
 *
 * The plugin-facing subset of what `@olai/web`'s own catalog builds. There is no
 * `divider` and no `confirm`: a rule is core's statement about which half of its
 * own list a reader is in, and the question a verb asks before it runs is drawn
 * in core's words, which a plugin's verb is not core's to compose.
 *
 * ## WHICH HALF, THOUGH — and that one the plugin has to say
 *
 * The row menu puts every READ above a rule and every WRITE below it, and the
 * rule is a safety property rather than a habit: everything above it changes
 * what this tab is looking at, everything below it changes the directory, and a
 * person reaching for *Collapse all* and hitting *Move to Trash* is a mistake
 * the ORDER prevents. Appending a plugin's verbs after both halves was the first
 * shape here and it broke exactly that: *Ask agent* — which arms a composer and
 * writes nothing — landed under *Move to Trash*.
 *
 * Core cannot tell which a verb is, and a plugin cannot be trusted with the
 * POSITION. So {@link writes} is the one fact that crosses: the plugin says what
 * kind of act its verb is, and core places it. That is this table's own split
 * said once more — core keeps the shape, the plugin brings the fact.
 *
 * ## What a press is handed, and what it is not
 *
 * THE NODE'S OWN ID, and only that. Not the record: `@olai/format`'s `Row` is
 * core's shape, and a slot that handed it over would put core's whole reading
 * vocabulary — the fold, the mirror rule, the licence — inside every tenant that
 * wanted one verb. And not the row's own id either but the node the row SHOWS,
 * which is core's arithmetic over mirrors and folds and is spent before the
 * press is called, so a plugin cannot get that distinction wrong by not knowing
 * it exists.
 *
 * A plugin that needs the node's FILE asks its own server half, which is where a
 * node's file is a fact it already holds.
 *
 * `run` may return a refusal sentence for the menu to display beside the row.
 * The plugin owns its wording; core supplies the alarm presentation. Successful
 * actions return nothing and let their visible effect speak for itself.
 */
export type RowActions = (node: string) => ReadonlyArray<RowAction>

/** One of them. */
export interface RowAction {
  /** This plugin's own word for the verb — a testid and a list key, never an
   *  address. Two plugins may spell it the same: what a reader keys the list by
   *  is this beside the plugin's own name, which {@link Hung} carries and this
   *  row deliberately does not repeat. */
  readonly id: string
  /** The words on the row. */
  readonly label: string
  /**
   * Does it change the DIRECTORY? A verb that arms a composer, opens a panel or
   * moves this tab says `false` and sits with core's reads; one that writes a
   * property, a record or a file says `true` and sits with core's writes, under
   * the same rule.
   *
   * REQUIRED, with no default, because both answers are ordinary and the wrong
   * one is silent: a default of `false` would put a destructive verb among the
   * reads and a default of `true` would put a harmless one under Trash, and
   * neither would say anything at the moment it was written.
   */
  readonly writes: boolean
  /** Act on the node shown; return a sentence when the action is refused. */
  readonly run: (node: string) => string | void | Promise<string | void>
}

/**
 * A SECTION IN THE SIDEBAR — `sidebar.section`.
 *
 * A heading and a body rather than one face, which is the `engine.install`
 * shape and is here for that shape's reason: the region's box, the heading's
 * type and the column's height budget are core's, and a face would have to carry
 * core's classes into every tenant to sit right in it — three byte-identical
 * copies drifting from `@olai/web` the first time the sidebar is restyled.
 *
 * The cost, said plainly: a section that wants a control IN its heading (a count,
 * a toggle) cannot have one yet. The day one does, the heading grows a face
 * beside `said` and the argument above is what that change has to answer.
 */
export interface SidebarSection {
  /** The heading, in the plugin's words. */
  readonly said: string
  /** ...and what sits under it. */
  readonly body: () => JSX.Element
}

/**
 * A KEYBOARD CHORD — `app.keys`.
 *
 * The modifier is not here and is not an omission: every chord this app answers
 * is ⌘ on an Apple platform and Ctrl everywhere else, which is one decision
 * `client/keys.ts` makes once for all of them. A plugin naming its own modifier
 * would be a plugin that can be wrong about a platform it cannot see.
 *
 * `said` is the words for the shortcut list, and the app spells the CHORD beside
 * them (`⌘J / Ctrl+J`) out of `key` and `shift` — core keeps the shape, the
 * plugin brings the words, one more time.
 */
export interface AppChord {
  /** The letter, lowercase — `j`. */
  readonly key: string
  /** ...with Shift, for a chord whose bare form the browser has taken. */
  readonly shift?: boolean
  /** Whether it may fire while the caret is in a text field. A chord that means
   *  something about the PAGE rather than about the caret says `true`; one that
   *  claims a letter a draft means says `false`. */
  readonly whileEditing: boolean
  /** What it does, for the shortcut list — "show or hide the agent". */
  readonly said: string
  /** ...and what a press does. */
  readonly press: () => void
}

/**
 * A VERB BEHIND A PALETTE PREFIX — `app.command`.
 *
 * `prefix` is the character the palette dispatches on and is the plugin’s to
 * choose; a collision with one core already answers is refused by the palette,
 * in its own words, for {@link AppChord}’s reason.
 *
 * `run` answers the REFUSAL or nothing, which is the one place this differs
 * from a row verb: the palette is a box a person is looking at with a line they
 * just typed in it, so a send that was turned down has to be able to say so
 * there rather than only in a panel that may be shut.
 */
export interface AppCommand {
  /** The character that selects it — `>`. */
  readonly prefix: string
  /** The words for the prefix strip. */
  readonly said: string
  /** ...and the placeholder in the box once the prefix is typed. */
  readonly placeholder: string
  /** What a press does with the line. `null` is "it landed"; a string is the
   *  refusal, in the plugin’s own words, drawn where the palette draws one. */
  readonly run: (line: string) => Promise<string | null>
}

/** One face, with the plugin that hung it — what a walk over a plugin-keyed slot
 *  or a LIST slot reads. The name is on the row because the app has occasion to
 *  use it (a testid, a mark looked up by the word core stamped on a chat row, the
 *  rank a bundle order is imposed by) and never to compose an address out of it.
 *
 *  In a list it is the only word there is: the table has no key, so a reader that
 *  wants to say WHOSE section this is, or to put two plugins' sections in the
 *  file's order, has this row and nothing else. */
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
 * ## A DUPLICATE IS REFUSED WHERE THERE IS A KEY TO DUPLICATE
 *
 * Two plugins hanging a chip on one composed kind word cannot happen — the
 * prefix is the row's id and the loader will not mount two rows under one — so
 * the reachable case is a plugin registering the same slot twice, which is a
 * mistake in that plugin and is worth refusing at the moment it is made. The
 * refusal DIES inside `acquire`, which lands the plugin in `failed` having
 * installed nothing: one plugin's faces are absent, and every other plugin's are
 * untouched.
 *
 * THE SINGLE SLOT IS THE ONE WHERE TWO PLUGINS REALLY DO COLLIDE, because its
 * key is the slot itself and every plugin claims the same one. So it is the one
 * refusal that names BOTH — the plugin being turned away and the plugin already
 * in the seat — since neither is in the key and a sentence naming only the
 * loser tells a reader nothing about what to take out.
 *
 * A LIST REFUSES NOTHING. There is no key, so there is no collision, and a
 * plugin hanging four verbs is four verbs. Where a collision in a list matters
 * (two plugins claiming one chord) it is a collision in something the READER
 * holds, not in this table, and this table refusing on its behalf would be this
 * table pretending to know what a keyboard is.
 *
 * ## THE KEY IS NEVER AN ARGUMENT
 *
 * Three of the four rules take no key from the caller at all — the fiber's own
 * name, the slot's own name, or nothing — and the fourth takes the BARE kind
 * word, which is composed here with the plugin's own name: the same `kindWordOf`
 * the server's `Kinds` uses, so the word a face is looked up by and the word a
 * vault declares cannot be two spellings. The name comes off the registry
 * binding, which is what makes "a plugin cannot sign another's registration" a
 * shape rather than a rule — and it is why there are still exactly two doors
 * below for four cardinalities.
 */
export type SlotOptions = Omit<NonNullable<Parameters<LocationOwner["contribute"]>[2]>, "key">
export interface Slots {
  /** Hang a face where the caller names no key: this plugin's one face in a
   *  plugin-keyed slot, its one claim on the app's single slot, or one more
   *  entry in a list — for as long as it is loaded. */
  readonly register: {
    <S extends PluginSlot | ListSlot | SingleSlot>(
      slot: S,
      face: SlotFaces[S],
      options?: SlotOptions,
    ): Effect.Effect<void, never, Scope.Scope>
    /** ...or dress one of this plugin's KINDS, by its bare word. */
    <S extends KindSlot>(
      slot: S,
      kind: string,
      face: SlotFaces[S],
      options?: SlotOptions,
    ): Effect.Effect<void, never, Scope.Scope>
  }
}
export const Slots = serviceTag<Slots>("ui-renderer.legacy-slots")

/**
 * ...AND THE READ SIDE OF THE SAME TABLE — the door a plugin that DRAWS what
 * other plugins hung is written against.
 *
 * ## Why this exists at all, which is a thing that changed under the table
 *
 * Every slot used to be read by `@olai/web` and written by a plugin, and the
 * two shapes said so: `Slots` had a `register` and no `hung`, {@link App} had
 * `hung` and no `register`, and the asymmetry was the whole design. It survives
 * — neither of those two shapes has grown the other half — but the CLAIM under
 * it does not: `delivery.mark` and `engine.install` are read by the chat
 * panel, and the chat panel is becoming a plugin. Six plugins register a mark
 * and the reader of all six is about to be a seventh, which no shape in this
 * file could spell.
 *
 * A THIRD TAG rather than three fields on {@link Slots}, and the reason is what a
 * `needs` list is for. Reading a slot somebody else fills is a real dependency on
 * a real table, and a plugin that has it should have said so in the one list this
 * runtime holds it `waiting` against — the same list a reader of the plugins
 * panel, the fence and `docs/plugins/<name>.md` read to find out what a plugin
 * touches. Folded into `Slots`, every plugin that hangs one chip would silently
 * carry the right to walk every slot in the app.
 *
 * ## THE FENCE: what reading a slot may and may not teach a plugin
 *
 * It may learn WHO IS IN THE SLOT IT NAMED and what they hung there: the faces,
 * in the bundle's order, each with the plugin's own word beside it. That is the
 * whole point — a panel cannot draw six engines' marks without the six marks.
 *
 * It may NOT learn the roster. A slot is not a census: a plugin absent from
 * `delivery.mark` may be mounted, running and drawing everywhere else, and a
 * plugin that read an empty slot as "kolu is not here" would be wrong on the
 * first serve where kolu simply has no mark. What is mounted is the plugins
 * panel's fact, off the server's own report, and it is not on this door.
 *
 * It may NOT reach a sibling through what it read. The word on a {@link Hung}
 * row is for a testid, a lookup and a sort — never an address. `Wired` mints a
 * client from the ASKING fiber's name, so a plugin holding another's word still
 * cannot ask for that plugin's members, and this door does not weaken that.
 *
 * It may NOT write. There is no `register` here, and `Slots.register` stamps the
 * registering fiber's own name, so a reader cannot hang, replace or remove
 * anybody's face — including by mutating what it read, since both tables
 * underneath hand back a copy.
 *
 * And the cost, stated rather than hidden: a plugin that reads a slot is coupled
 * to that slot's FACE TYPE, which is why every face type in this app is declared
 * HERE and not by whichever plugin happens to own the slot's tenant today. The
 * chat panel reading `delivery.mark` reads `SlotFaces["delivery.mark"]`
 * — core's declaration — and takes no dependency on the six plugins filling it.
 */
export interface Faces {
  /**
   * WHAT IS HUNG IN A PLUGIN-KEYED OR LIST SLOT, in REGISTRATION order — which
   * is arrival order, and is deliberately not a promise to anybody. A caller
   * that needs the bundle's order imposes it on the RESULT, against the list
   * that is written down (`@olai/web`'s own `hung` does).
   */
  readonly hung: <S extends PluginSlot | ListSlot>(slot: S) => ReadonlyArray<Hung<SlotFaces[S]>>
  /** ...and what dresses each COMPOSED KIND WORD in a kind-keyed slot. Keyed
   *  rather than ordered: a value wears at most one of these and the lookup is
   *  by the word the page's licence carries. */
  readonly dressed: <S extends KindSlot>(slot: S) => ReadonlyMap<string, SlotFaces[S]>
  /** ...and the one face in a single slot, or `null` where nobody has taken the
   *  seat. `null` rather than an empty array, because "there is at most one" is
   *  the thing the slot exists to say and a one-element array says it again in a
   *  shape every reader has to re-check. */
  readonly only: <S extends SingleSlot>(slot: S) => Hung<SlotFaces[S]> | null
}
export const Faces = serviceTag<Faces>("ui-renderer.faces")

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
export const Clocks = serviceTag<Clocks>("ui-renderer.clocks")

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
export const Bar = serviceTag<Bar>("layout.bar")

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
 * and this has `hung` and no `register`. That asymmetry stands; what stopped
 * being true is that the reader was always the TAB, which is why the three reads
 * are {@link Faces} now and this extends it. The tab and a plugin ask the same
 * table the same three questions — the tab is not a privileged reader, it is
 * merely the one that also holds the host and hands over the furniture.
 *
 * It said "mount order is BUNDLE order, because that is the order the rows are
 * mounted in". The first clause is true of a first load and false of every frame
 * after one: a re-compose skips the plugins already up, so a plugin that arrives
 * later is appended after them whatever the file says. That argument now lives on
 * {@link Faces.hung}, with the read it is about.
 */
export interface App extends Faces {
  readonly settlePlugins: (ids: ReadonlyArray<string>) => Effect.Effect<void>
  readonly settled: Effect.Effect<void>
  readonly integrations: Locations["inspect"]
  readonly retryIntegrations: Effect.Effect<void>
  readonly attach: (element: Element) => Effect.Effect<void, never, Scope.Scope>
  /** State changes even when a waiting component registered no faces. */
  readonly changes: Stream.Stream<void>
  /** Where the plugins hang — handed to `mountPlugin` and opaque to everybody. */
  readonly host: Host
  /** Install an explicitly supplied host capability in the caller's scope. */
  readonly supply: <T>(key: ServiceKey<T>, value: T) => Effect.Effect<void, never, Scope.Scope>

}

/** WHAT THE TAB SUPPLIES — everything a plugin must not reach for itself. */
export interface AppConfig {
  /** A component has its own activation name, but spends its owning row's
   * namespace, sibling client and slot keys. Only the composition root supplies
   * this binding; plugins cannot choose an owner through a service argument. */
  readonly ownerFor?: (fiber: string) => string
  /** TOLD WHEN A FACE ARRIVES OR LEAVES. The app wires it to a signal; this
   *  runtime has never heard of Solid, which is the same split `Surfaces` keeps
   *  one door over. */
  readonly changed?: () => void
  /**
   * ...AND TOLD THAT SOMEBODY IS READING, which is the other half of the same
   * split and arrived with {@link Faces}.
   *
   * `@olai/web` tracks its own walks by reading its signal on the way in
   * (`hung()` calls `moved()` before it reads). A PLUGIN reading the same table
   * cannot: that signal is a module-scoped value in `@olai/web`, which a plugin
   * may not import, so a panel drawing six plugins' marks would draw them once
   * and never again — the exact failure the whole "no plugin, no slot entry"
   * arrangement is meant to make unspellable, arriving from the other side.
   *
   * So the app says how a read is tracked, the same way it says how a change is
   * published, and this runtime still has never heard of Solid. It is called on
   * every read through this door INCLUDING the tab's own, because "somebody is
   * reading" is true either way and one implementation with no caller-dependent
   * branch is one fewer thing to get wrong.
   */
  readonly reading?: () => void
  /** One plugin's own sibling client, by name — `null` where this wire does not
   *  carry it. */
  readonly clientFor?: (plugin: string) => unknown
}

/**
 * OPEN THE TAB'S PLUGIN RUNTIME — the host, the services on it, and the three
 * reads back.
 *
 * SCOPED, because every `provide` is; in a tab that scope is the page's, which
 * is the process.
 */
export const openApp = (config: AppConfig = {}): Effect.Effect<App, never, Scope.Scope> =>
  Effect.gen(function*() {
    const host = yield* openHost
    const forOwner = <Shape>(provision: (owner: string) => Shape) => (fiber: string): Shape =>
      provision(config.ownerFor?.(fiber) ?? fiber)
    yield* provide(host, Offers, forOwner((plugin) => ({
      own: ownService(plugin, (key, door) => offer(key, forOwner(door)).pipe(
        Effect.catchDefect((defect) => Effect.die(
          defect instanceof OfferConflict
            ? new Error(`plugins: "${defect.owner}" and "${plugin}" both offer "${key.cordis}"`)
            : defect,
        )),
      )),
    })))
    yield* provide(host, Wired, forOwner((plugin) => ({
      client: () => config.clientFor?.(plugin) ?? null,
    })))

    // Compatibility reads resolve the renderer's live facade. No slot storage
    // or slot provider exists on the permanent host.
    const faces: Faces = {
      hung: (slot) => { config.reading?.(); return offered(host, Faces)?.hung(slot) ?? [] },
      dressed: (slot) => { config.reading?.(); return offered(host, Faces)?.dressed(slot) ?? new Map() },
      only: (slot) => { config.reading?.(); return offered(host, Faces)?.only(slot) ?? null },
    }

    return {
      ...faces,
      settlePlugins: (ids) => settled(host, ids),
      settled: Effect.suspend(() => offered(host, SlotManagement)?.settled ?? Effect.void),
      integrations: () => offered(host, SlotManagement)?.inspect() ?? [],
      retryIntegrations: Effect.suspend(() => offered(host, SlotManagement)?.retry ?? Effect.void),
      attach: (element) => provide(host, BrowserMount, () => ({
        element, changed: config.changed, reading: config.reading,
      })),
      supply: (key, value) => provide(host, key, () => value),
      host,
      changes: hostChanges(host),

    }
  })

/** Typed compatibility contracts for existing notebook extensions. These are
 * locations in the renderer's sole registry, never independent tables. The
 * owning UI entry must declare them before registered faces become active. */
export const slotLocation = <S extends SlotName>(slot: S): Location<Hung<SlotFaces[S]>> =>
  location(slot, SLOTS[slot].keyedBy === "app" ? "one" : "many",
    SLOTS[slot].keyedBy === "plugin" ? "owner" : SLOTS[slot].keyedBy === "kind" ? "key" : undefined)

/** Adapter only: key rules and face types are notebook API policy. Reservation,
 * activation, cleanup, identity, and diagnostics all belong to Locations. */
const SlotManagement = serviceTag<Pick<Locations, "inspect" | "settled" | "retry">>("ui-renderer.integrations")
export const slotFacade = (store: Locations, reading?: () => void): {
  readonly forOwner: (owner: string) => Slots
  readonly faces: Faces
  readonly management: Pick<Locations, "inspect" | "settled" | "retry">
} => ({
  management: { inspect: store.inspect, settled: store.settled, retry: store.retry },
  forOwner: (plugin) => ({
    register: ((slot: SlotName, second: unknown, third?: unknown, fourth?: SlotOptions) => {
      const rule = SLOTS[slot].keyedBy
      const key = rule === "kind" ? kindWordOf(plugin, second as string)
        : rule === "plugin" ? plugin : undefined
      return store.forOwner(plugin).contribute(slotLocation(slot), {
        plugin, face: (rule === "kind" ? third : second) as SlotFaces[SlotName],
      }, { ...(rule === "kind" ? fourth : third as SlotOptions | undefined), key })
    }) as Slots["register"],
  }),
  faces: {
    hung: (slot) => { reading?.(); return store.read(slotLocation(slot)).map((entry) => entry.value) },
    dressed: (slot) => {
      reading?.()
      return new Map(store.read(slotLocation(slot)).map((entry) => [entry.key!, entry.value.face]))
    },
    only: (slot) => { reading?.(); return store.read(slotLocation(slot))[0]?.value ?? null },
  },
})
