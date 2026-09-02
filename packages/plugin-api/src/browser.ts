/**
 * WHAT A BROWSER HALF IS WRITTEN AGAINST — the SLOTS a face is hung in and the
 * four services the app hands over, as Cordis services.
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
 * entry*. Every registration below is an `ctx.effect`, so a plugin the roster
 * stops naming unwinds its own faces on the way out and the app re-reads what
 * is left.
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
 * one plugin with a panel hangs it on `ctx.bar.popover()`, which is the app's
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
 *     delivered sentence wears. The key is read INSIDE the
 *     service off `this.ctx.fiber.name`, never off an argument, for the reason
 *     {@link ./services.ts}'s doors read it there: a key a caller supplies is a
 *     key one plugin can sign another's registration with.
 *   - **`kind`** — one face per property KIND, keyed by the word this plugin's
 *     bare kind composes to. The chip beside a value, the pane its press opens,
 *     and the block that owns a row. The composition is `kindWordOf`, the same
 *     function `ctx.kinds` uses on the server, so the word a face is looked up
 *     by and the word a vault declares cannot be two spellings.
 *
 * ## The four services, and why they are four rather than one blob
 *
 * They were one — `AppFurniture`, handed to every face as a prop — and the blob
 * was right while a plugin's faces were values the app called: there was
 * nothing to inject them INTO. A fiber has an `inject`, so a browser half now
 * NAMES what it needs and Cordis holds it `PENDING` until it exists, which is
 * the same guarantee its server half already has. Four rather than five because
 * the blob's `desktop` is the bar's own fact and travels with the bar's
 * geometry.
 *
 * A face no longer takes the furniture as a prop at all: it closes over the
 * services its own `apply` was handed. That is what makes {@link SlotFaces}'
 * signatures as small as they are — a header readout is `() => JSX.Element`,
 * because everything it used to be handed is on the context that registered it.
 *
 * ## THE AUGMENTATION IS SHARED WITH THE SERVER'S, and that is not a leak
 *
 * `declare module "cordis"` merges globally, so a file that imports either door
 * sees `ctx.slots` beside `ctx.vault`. It is TYPE-ONLY — no runtime graph edge
 * either way — and the alternative (a branded context type per process) buys a
 * compile error for a mistake neither process can make: a server context never
 * has `slots` provided, so `ctx.slots` there is `undefined` at the first read,
 * and a browser context never has `vault`. What the fence actually holds is the
 * GRAPH, and the graph is what `@olai/bundle`'s `fence.test.ts` walks.
 */

import { Service } from "cordis"
import type { Context } from "cordis"

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
 * EVERY FACE THIS TAB HAS RIGHT NOW — the browser's twin of `ctx.surfaces`, and
 * the one service whose registrations move the page.
 *
 * ## The re-read is the APP's and not this service's
 *
 * This holds the table and says when it moved; what re-reads it is `@olai/web`,
 * through the `changed` callback below. That is exactly the split `Surfaces`
 * keeps on the server and for the same reason: a service that re-rendered would
 * be a service that knew what a render is, and this one has never heard of
 * Solid. The app wires `changed` to a signal, and every walk over a slot is a
 * read of it.
 *
 * ## A DUPLICATE IS REFUSED, unconditionally
 *
 * Two plugins hanging a chip on one composed kind word cannot happen — the
 * prefix is the row's id and the loader will not mount two rows under one — so
 * the reachable case is a plugin registering the same slot twice, which is a
 * mistake in that plugin and is worth a throw at the moment it is made. The
 * throw happens inside `ctx.effect`'s body, which lands the fiber in `FAILED`
 * having installed nothing: one plugin's faces are absent, and every other
 * plugin's are untouched.
 */
export class Slots extends Service {
  /** Slot → key → face. Two levels rather than one composite key, because the
   *  walks read a whole slot and never a single composite. */
  private readonly table = new Map<SlotName, Map<string, unknown>>()

  constructor(ctx: Context, public config: Slots.Config = {}) {
    super(ctx, "slots")
  }

  /** Hang this plugin's one face in a plugin-keyed slot, for as long as the
   *  calling fiber is loaded. */
  register<S extends PluginSlot>(slot: S, face: SlotFaces[S]): () => void
  /** ...or dress one of this plugin's KINDS, by its bare word — composed here
   *  with the fiber's name, the way `ctx.kinds` composes it on the server. */
  register<S extends KindSlot>(slot: S, kind: string, face: SlotFaces[S]): () => void
  register(slot: SlotName, second: unknown, third?: unknown): () => void {
    const plugin = this.ctx.fiber.name
    const keyed = SLOTS[slot].keyedBy === "kind"
    const key = keyed ? kindWordOf(plugin, second as string) : plugin
    const face = keyed ? third : second
    return this.ctx.effect(() => {
      // THE TABLE AND THE TEST ARE BOTH READ HERE, and the second half of that
      // was wrong for a round: `held` and `already` were computed OUTSIDE the
      // effect, which made them a snapshot of the moment `register` was called
      // rather than of the moment the registration takes.
      //
      // A fiber's effect body RE-EXECUTES — on a reload, on an `update`, when a
      // service it injects leaves and returns — and its disposer runs first,
      // taking the key back out. A captured `already` would still say `true` on
      // the second pass and refuse a plugin re-registering the face it had just
      // unwound; a captured `held` would write into a `Map` this table had
      // already dropped when the slot emptied, so the entry would exist for the
      // fiber and be invisible to every reader. Neither is theoretical: the
      // server's `Surfaces` had the same shape and the review that found it
      // there is the reason this one is written this way.
      const held = this.table.get(slot) ?? new Map<string, unknown>()
      // The refusal is INSIDE the body so it is the fiber's own failure — a
      // throw at the call site would land after registrations the runtime would
      // then have to unwind by hand.
      if (held.has(key)) {
        throw new Error(
          `plugins: "${plugin}" hangs two faces in "${slot}" under "${key}" — `
            + `the second would replace the first with nothing said.`,
        )
      }
      held.set(key, face)
      this.table.set(slot, held)
      this.config.changed?.()
      return () => {
        held.delete(key)
        if (held.size === 0) this.table.delete(slot)
        this.config.changed?.()
      }
    })
  }

  /**
   * WHAT IS HUNG IN A PLUGIN-KEYED SLOT, in mount order.
   *
   * Mount order is BUNDLE order, because that is the order the rows are mounted
   * in — so the bar's cluster and the mount fold read top-down as the file
   * reads, and a plugin whose half must sit inside another's is expressed by
   * moving a row. Nothing needs to today, and the ordering is stated rather
   * than left to a `Map`'s insertion order being noticed later.
   */
  hung<S extends PluginSlot>(slot: S): ReadonlyArray<Hung<SlotFaces[S]>> {
    const held = this.table.get(slot)
    if (held === undefined) return []
    return [...held].map(([plugin, face]) => ({ plugin, face: face as SlotFaces[S] }))
  }

  /** ...and what dresses each COMPOSED KIND WORD in a kind-keyed slot. Keyed
   *  rather than ordered: a value wears at most one of these and the lookup is
   *  by the word the page's licence carries. */
  dressed<S extends KindSlot>(slot: S): ReadonlyMap<string, SlotFaces[S]> {
    return new Map(this.table.get(slot) ?? []) as ReadonlyMap<string, SlotFaces[S]>
  }
}

export namespace Slots {
  export interface Config {
    /** TOLD WHEN A FACE ARRIVES OR LEAVES. The app wires it to a signal; this
     *  service has never heard of Solid, which is the same split `Surfaces`
     *  keeps one door over. */
    readonly changed?: () => void
  }
}

/**
 * THE APP'S CLOCK, and the register it ticks in.
 *
 * Every field is the app's own arithmetic ({@link AppClocks}), handed over
 * rather than restated, because each of them fails the same silent way: a chip
 * whose duration ladder drifted reads plausibly and is wrong, and nothing
 * anywhere goes red.
 *
 * ## ITS FUNCTIONS ARE BOUND, and that is a bug this shape caused once
 *
 * These three services replaced a plain RECORD the app handed every face
 * (`AppFurniture`), and a record's fields are values: `clocks.tickingOf` was a
 * function you could hold, pass to a helper, or hand to a component. A class's
 * prototype METHOD is not — detached from its receiver it reads `this.config`
 * off `undefined` — so the same expression that had been correct for the life
 * of the feature started throwing the moment the record became a service, deep
 * inside a render, on a page that happened to draw a live CI chip:
 *
 *     TypeError: Cannot read properties of undefined (reading 'config')
 *
 * The call site was not wrong; the seam changed underneath it. So the fix is
 * here rather than at the one caller that happened to be found: every function
 * a plugin may hold is an `=` property, bound at construction, and holding one
 * is exactly as safe as it was when this was a record.
 *
 * ## WHY `Wired` IS NOT LIKE THIS
 *
 * Because binding it would replace a loud failure with a quiet wrong answer.
 * `Wired.client()` reads `this.ctx.fiber.name` — the CALLING fiber, through
 * Cordis's tracker proxy — so a bound copy would capture the service's own
 * context and hand every plugin whichever client the service was constructed
 * under. A method that throws when it is passed around is the right shape for
 * something whose answer depends on who is asking; a value is the right shape
 * for arithmetic. `./browser.test.ts` holds both halves.
 */
/*
 * `implements AppClocks` IS THE FACADE'S ONLY GUARD, and it costs two words.
 *
 * This class restates every member of the record it wraps, and the rule "each
 * one reaches the service" was held by nobody: a field added to `AppClocks` in
 * `./plugin.ts` would silently fail to appear on `ctx.clocks`, and the first
 * thing to notice would be a plugin package's typecheck — the wrong file, in
 * the wrong repository half, naming the wrong side of the seam. The keyword
 * emits nothing and moves the failure here, onto the line that forgot.
 *
 * `Bar` deliberately does NOT carry one: its config field is `createPopover`
 * and its member is `popover`, and that rename is argued where it is spelled.
 * `implements Bar.Config` would be a different claim wearing this one's clothes.
 * `Slots` and `Wired` are not facades at all — their configs are callbacks the
 * service consumes rather than members it re-publishes.
 */
export class Clocks extends Service implements AppClocks {
  constructor(ctx: Context, public config: AppClocks) {
    super(ctx, "clocks")
  }

  get SECOND(): number {
    return this.config.SECOND
  }

  get MINUTE(): number {
    return this.config.MINUTE
  }

  // BOUND, and every one of them — see {@link Clocks}' header. These are `=`
  // properties rather than prototype methods so that `clocks.tickingOf` is a
  // value a caller may hold, which is what the record they replaced already was.
  readonly createTicking = (every: number, when?: () => boolean): (() => number) =>
    this.config.createTicking(every, when)

  readonly createNow = (started: () => string | number | null | undefined): (() => number) =>
    this.config.createNow(started)

  readonly wordsOf = (seconds: number): string => this.config.wordsOf(seconds)

  readonly exactOf = (seconds: number): string => this.config.exactOf(seconds)

  readonly tickingOf = (elapsedMs: number): string => this.config.tickingOf(elapsedMs)
}

/**
 * THE BAR — its geometry, its breakpoint and the popover that shares its one
 * focus cycle.
 *
 * Three facts about one place, which is why they are one service and the clock
 * is another: a readout that wants the pill's classes wants the breakpoint and
 * the panel too, and a plugin that draws no chrome at all wants none of the
 * three and says so by leaving this out of its `inject`.
 *
 * `desktop` is here rather than on its own because it is the BAR's fact: the
 * pills are desktop-only, and a plugin answering that out of its own media
 * query would be a second answer to the app's breakpoint.
 */
export class Bar extends Service {
  constructor(ctx: Context, public config: Bar.Config) {
    super(ctx, "bar")
  }

  /** Whether this is a desktop bar. BOUND, for {@link Clocks}' reason: a
   *  readout that hands `bar.desktop` to a `<Show when={…}>` is holding a
   *  value, which is what it was when this was a record. */
  readonly desktop = (): boolean => this.config.desktop()

  /** The pill's classes — the box is the bar's and what is drawn inside it is
   *  the plugin's, which is why this is classes rather than a component. */
  get pill(): PillLook {
    return this.config.pill
  }

  /** A panel that hangs off a chrome pill, whole: the portal, the layer, the
   *  anchor and the focus cycle already spent. BOUND, for {@link Clocks}'
   *  reason — a plugin composing its own furniture record out of these hands
   *  the factory on, and `createPopover: ctx.bar.popover` must keep working. */
  readonly popover = (): AppPopover => this.config.createPopover()
}

export namespace Bar {
  export interface Config {
    readonly desktop: () => boolean
    readonly pill: PillLook
    readonly createPopover: () => AppPopover
  }
}

/** A DOOR ONTO A SERVED FILE — the app's router and its address grammar as the
 *  one thing a plugin wants out of them. Its own service rather than a field on
 *  the bar because it has nothing to do with the bar: a chip deep in a property
 *  run links to a file, and it draws nowhere near the chrome. */
export class Links extends Service implements Links.Config {
  constructor(ctx: Context, public config: Links.Config) {
    super(ctx, "links")
  }

  get File(): FileLink {
    return this.config.File
  }
}

export namespace Links {
  export interface Config {
    readonly File: FileLink
  }
}

/**
 * THIS PLUGIN'S OWN SIBLING CLIENT — the browser twin of `ctx.surfaces`, read
 * the way `ctx.deliveries` is read.
 *
 * KEYED BY THE FIBER and not by an argument, for that door's reason exactly: a
 * client addressed by a name a caller supplies is a client one plugin can ask
 * for another's members through. The key is the sibling key the framework
 * composed this plugin's members under, which is the one word core has about
 * it.
 *
 * `unknown`, and the honesty of that is the point: core cannot type a plugin's
 * client without learning its members, which is the one thing this arrangement
 * exists to prevent. It travels opaque and is narrowed by the plugin, once, at
 * its own edge.
 *
 * `null` is a plugin whose sibling this wire does not carry, which after the
 * roster drives the mount is a state that should not be reachable — the tab
 * mounts a fiber only for a name the roster named, and it dials that name in
 * the same breath. It is `null` rather than a throw because the honest answer
 * to "your members are not on this wire" is a plugin that draws its
 * nothing-here arm, and a throw would take the whole fiber down for a state the
 * page can survive.
 *
 * ## CALL IT; NEVER PASS IT — the one service whose method is not bound
 *
 * `Clocks`, `Bar` and `Links` hand out BOUND functions, because a plugin used
 * to hold those as record fields and a prototype method detached from its
 * receiver throws (that header records the crash). This one is deliberately not
 * bound, and the difference is which failure you get for the same mistake.
 *
 * `client()` reads `this.ctx.fiber.name` — the CALLING fiber, through Cordis's
 * tracker proxy — so a bound copy would capture the service's OWN context and
 * hand every plugin whichever client the service was constructed under. That is
 * a quiet wrong answer: one plugin reading another's members, with nothing
 * anywhere going red. Unbound, `const c = ctx.wired.client; c()` throws at the
 * first call and names the line.
 *
 * A value is the right shape for arithmetic; a method is the right shape for
 * something whose answer depends on who is asking. `./browser.test.ts` holds
 * both halves, so neither can quietly become the other.
 */
export class Wired extends Service {
  constructor(ctx: Context, public config: Wired.Config) {
    super(ctx, "wired")
  }

  client(): unknown {
    return this.config.clientFor(this.ctx.fiber.name) ?? null
  }
}

export namespace Wired {
  export interface Config {
    readonly clientFor: (plugin: string) => unknown
  }
}

declare module "cordis" {
  interface Context {
    bar: Bar
    clocks: Clocks
    links: Links
    slots: Slots
    wired: Wired
  }
}
