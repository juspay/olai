/**
 * WHAT A PLUGIN DRAWS, as types — the shapes on both sides of the browser
 * seam, and the whole of what core knows about kolu, odu and xyne-spaces.
 *
 * ## THE MANIFEST IS GONE, and this file is what is left of it
 *
 * `OlaiPlugin` was a VALUE: an object with `dressings`, `chrome`, `mount` and
 * `mark` on it, listed in a compiled-in registry and walked by four modules in
 * `@olai/web`. A browser half is a Cordis FIBER now — `name`, `inject`,
 * `apply(ctx)`, exactly its server half — and what it used to declare it now
 * REGISTERS, into the seven slots `./browser.ts` declares. So the hooks retired
 * with the object that carried them and what stayed here is the DRAWING
 * contract: what a face is handed, what it may answer with, and the three
 * paragraphs about a mark that are the whole of what makes one column of them
 * legible.
 *
 * Why the object could not survive is one sentence: a manifest is present
 * whether or not this serve composed the plugin, so every walk over it had to
 * carry a LICENCE beside it — and the two licences pointed opposite ways, which
 * took a module of its own to argue. A fiber the roster never named registers
 * nothing, so there is nothing to license.
 *
 * ## Why there is an interface at all, which reverses a ruling
 *
 * `@olai/kolu-client`'s wire header says, in as many words: *"A generic
 * extension mechanism was considered and killed 3-0. The framework already
 * owns that axis, and there is no second foreign slice anywhere in git or the
 * roadmap — a plug-in system with a population of one is speculative
 * generality."* That was true when it was written and it is not true now. The
 * population is three — odu arrived (#433) and grew a cell, a dressing, a vault
 * walk and a probe of its own, every one of them the kolu block with the nouns
 * changed; xyne-spaces arrived as the outbound mirror, with no appliance-client
 * package one floor down. A second tenant is not speculation; it is the
 * evidence the first ruling asked for, and a third is the same evidence spent
 * again.
 *
 * What the reversal costs is named here rather than left for a reader to find:
 * the named spread was LEGIBLE — `...koluMembers.cells` beside
 * `...oduMembers.cells` is two lines that say exactly what is in the spec — and
 * a registry is one line that does not. The trade is bought back by the
 * framework's own composition, which was here the whole time
 * ({@link ./composition.test.ts}): a plugin declares a WHOLE SURFACE in its own package
 * and core composes it as a SIBLING under the plugin's name, so what reaches
 * the wire is `surface/kolu/fleet/get` — computed by
 * `composeSurfaceContracts` and by nothing olai wrote. The composed group
 * still reads as a list of who contributed what, and no general package holds
 * a plugin's member name at all.
 *
 * A first attempt did rebuild it: a mount of core's own devising that put a
 * separator inside MEMBER NAMES. That is recorded rather than deleted, because
 * the way it was wrong is worth knowing — a member name is not a namespace,
 * and `@kolu/surface` mints channel names, MCP resource paths and tool names
 * out of one. A punctuated member name aliases another member's channel, has
 * to be percent-encoded to be read as a resource, and produces a tool name
 * outside the character set a strict MCP host accepts. The framework refuses
 * `/` in a member name for the first of those reasons and offers sibling
 * composition for the rest; taking the offer is the whole of this design.
 *
 * ## The plugin MAY import this file now, and that reverses a second ruling
 *
 * It could not, for one reason: this package held the REGISTRY as well as the
 * interface, so a plugin that imported it would be a cycle the manifests could
 * not express. A manifest was therefore a plain `as const` object that never
 * wrote `: OlaiPlugin`, and the agreement was proved at the registry's
 * `satisfies` instead — the same move `@olai/ops` makes with the surface's
 * `Status`, and the same one `olai-plugin-kolu`'s `appliance/props/block.ts`
 * makes with the drawer's entry.
 *
 * The registry moved to `@olai/bundle` and the premise went with it. This
 * package names no plugin at all now, so the arrow is one-way and a plugin
 * annotating its own manifest is an ordinary import. The structural proof stays
 * where it is regardless — `@olai/bundle`'s `registry.ts` still `satisfies` the
 * list, which is what catches a plugin that was never annotated — so what the
 * reversal buys is that a typo in a member name can be named at the PLUGIN,
 * with that plugin's name on the file, rather than only at the registry.
 *
 * It is what the SERVER half already does, and there the import is not
 * optional: a server half is a Cordis plugin now, and `inject` names the
 * services in `./services.ts`.
 *
 * ## Everything is optional but the name, the surface and its faces
 *
 * A plugin that contributes one cell is a whole plugin — odu is. Nothing else
 * here is required for a plugin to be enabled, disabled, drawn in preferences
 * or documented, because the ABSENT arm of every hook is the state a machine
 * without the tool already shows, and that state already had to work.
 */

import type { JSX } from "solid-js"


/**
 * WHAT THE APP HANDS A PLUGIN'S BROWSER HALF — the furniture, and the whole of
 * why a plugin is given it rather than reaching for it.
 *
 * ## The precedent, and why it is the RULE here rather than a courtesy
 *
 * `@olai/web`'s live seam already hands one piece of furniture across a package
 * wall — {@link BlockChrome}, the fact line every property in the drawer's run
 * wears — and its argument is exactly the one that governs everything below: *a
 * face that spelled `"prop"` itself would be a second spelling of the drawer's
 * contract, free to drift the day the drawer changed it, with the drawer's own
 * suite still green because the face it broke is somewhere else.* A dressing's
 * testid was one string. A plugin's browser half is a chip that TICKS, a pill in
 * the app's bar, a panel that hangs off it and a link into the served set — four
 * more contracts of exactly that kind, and every one of them fails the same
 * silent way.
 *
 * So the wall is drawn in the same place: the plugin owns what it DRAWS, the app
 * owns the CONTRACT it is drawn against, and the contract crosses as a value.
 * The rejected alternative was for each plugin to import `@olai/web` for the
 * dozen names it wants — the clock, the pill's classes, the popover, the layer
 * table, the anchor arithmetic, the router's `Link`. That is not merely a cycle
 * (it is one: `@olai/web` mounts every plugin); it is the app's whole chrome
 * contract re-spelled once per tenant, and a second tenant is where two
 * spellings start disagreeing.
 *
 * ## STRUCTURAL on the plugin's side, and each declares only its own half
 *
 * A plugin MAY import this file (the registry moved to `@olai/bundle`, so the
 * arrow is one-way), and several still re-declare what they read instead
 * — so a plugin re-declares the parts of the furniture it reads, exactly as
 * `olai-plugin-kolu`'s `appliance/props/block.ts` already does with the drawer's entry. That is a
 * STRONGER agreement than a shared import rather than a weaker one: a plugin's
 * own declaration names exactly what it touches, function parameters are
 * contravariant, and so a plugin asking for something the app does not hand over
 * is a type error at the registry's `satisfies` with that plugin's name on the
 * line — while the app's richer furniture satisfies every narrower reading and
 * no plugin can see a field it did not ask for.
 */
export interface AppClocks {
  /** The ladders' units, read rather than re-typed: a readout spelling `1000`
   *  would be a second answer to what a second is. */
  readonly SECOND: number
  readonly MINUTE: number
  /** A clock that re-reads itself every `every` ms for as long as `when` says
   *  there is anything to time. The GATE is the half a bare `setInterval`
   *  cannot have and the DISPOSAL is the half a hand-rolled one forgets, which
   *  is the whole reason this crosses instead of being written a third time. */
  readonly createTicking: (every: number, when?: () => boolean) => () => number
  /** ...and the TWO-SPEED one a live duration wears: by the second while the
   *  second digit is the register, by the minute once it is not. It takes the
   *  stamp in EITHER encoding — ISO text or milliseconds — because the app's
   *  own `instantOf` is where those stop being two questions. */
  readonly createNow: (
    started: () => string | number | null | undefined,
  ) => () => number
  /** A SETTLED span in the app's own words (`2h 34m`). */
  readonly wordsOf: (seconds: number) => string
  /** ...the same span exactly, for a hover (`2h 34m 44s`). */
  readonly exactOf: (seconds: number) => string
  /** ...and a RUNNING one in the ticking register (`2:10`). */
  readonly tickingOf: (elapsedMs: number) => string
}

/** THE CHROME PILL'S LOOK — the geometry the app's bar is a fixed height for,
 *  and the amber register it paints an infrastructure warning in.
 *
 *  CLASSES rather than a component, because what a readout draws INSIDE the
 *  pill is the plugin's (a dot, a word, a second word in the warning ink) and
 *  only the box is the bar's. A component would have had to grow a slot per
 *  tenant; a shape that is only ever `class={app.pill.PILL}` cannot. */
export interface PillLook {
  readonly PILL: string
  readonly DOT: string
  readonly PILL_WARN_COAT: string
  readonly DOT_HOLLOW_WARN: string
  readonly TEXT_WARN: string
  readonly PILL_ALARM_COAT: string
  readonly DOT_HOLLOW_ALARM: string
  readonly TEXT_ALARM: string
}

/**
 * A PANEL THAT HANGS OFF A CHROME PILL — whether it is up, where it sits, and
 * the one focus cycle the trigger and the panel make between them.
 *
 * The app hands the WHOLE thing rather than its parts. A plugin given the
 * popover primitive alone would still have had to spell the portal, the layer
 * number, the anchor's five style keys and the `tabindex="-1"` the focus cycle
 * requires — four of the app's contracts, restated per tenant, each silent when
 * wrong: a panel at the wrong layer paints under the bar, and a panel whose
 * `top`/`bottom` came out of a computed key sits just below the fold.
 */
export interface AppPopover {
  readonly open: () => boolean
  readonly toggle: () => void
  /** Put it away WITHOUT the caret walking back to the trigger — for a link
   *  inside the panel that is about to navigate. */
  readonly close: () => void
  /** `ref` on the control that opens it. */
  readonly setTrigger: (el: HTMLElement | undefined) => void
  /** The panel itself: portalled, placed against the trigger, layered, and
   *  drawn only while open. What goes IN it is the plugin's; the box is the
   *  bar's. */
  readonly Panel: (props: {
    readonly testid: string
    readonly label: string
    readonly children: JSX.Element
  }) => JSX.Element
}

/** A DOOR ONTO A SERVED FILE — the app's router and its address grammar, as the
 *  one thing a plugin actually wants out of them.
 *
 *  A plugin handed the router's `Link` and the address builder separately would
 *  hold two of the app's names to make one link; handed this, it holds none.
 *  The split-pane press, the modifier rules and what a route spells in the URL
 *  stay entirely the app's. */
export type FileLink = (props: {
  /** The served path, as the vault spells it. */
  readonly file: string
  readonly class?: string
  readonly testid?: string
  readonly label: string
  readonly title?: string
  readonly children: JSX.Element
}) => JSX.Element

/* THE BLOB IS GONE, and the four services took its place.
 *
 * `AppFurniture` was one record with five fields, handed to every face as a
 * prop, and the argument for one blob was the argument `PluginServices` made
 * on the other side of the wire: a field per appliance is a general package
 * naming one. That argument is intact and is not what retired it. What retired
 * it is that a browser half is a FIBER now, so there is something to inject
 * INTO — a plugin NAMES what it needs in its `inject` and Cordis holds it
 * `PENDING` until it exists, which is the same guarantee its server half has
 * had since the bundle became rows. `./browser.ts` declares the four; the
 * shapes above are what each of them carries, unchanged. */

/** ONE PROPERTY, as the drawer hands it to a face — the four fields a dressing
 *  may read and no more. A face that needed the node, the page or the wire would
 *  be a face the drawer has to know something about, and the point of the seam
 *  is that it does not. */
export interface PropEntry {
  readonly key: string
  /** What it says, as ONE string — a list joined by commas, exactly as the
   *  drawer has always drawn it. */
  readonly value: string
  /** ...and its MEMBERS, which is one element for a value that is text. */
  readonly values: ReadonlyArray<string>
  /** A fact the record carries in a field of its own: drawn, never edited. */
  readonly system: boolean
}

/** What a face is handed to wear the RUN'S OWN CONTRACT — `@olai/web`'s
 *  `BlockChrome`, unchanged, and the precedent {@link AppClocks}' header
 *  extends. */
export interface BlockChrome {
  /** The key half of the fact line, with the drawer's editor gesture on it. */
  readonly Handle: (props: {
    readonly label: string
    readonly onOpen?: () => void
  }) => JSX.Element
  /** `data-testid` for the fact line — the drawer's contract, spelled once. */
  readonly factId: string
  /** `data-testid` for the value half. */
  readonly valueId: string
}

/** What a BLOCK or a PANE face is handed. */
export interface BlockContext {
  readonly entry: PropEntry
  /** Open this property's editor — `undefined` where the run is read-only, and
   *  then no half of the face is a button. */
  readonly onOpen?: () => void
  readonly chrome: BlockChrome
}

/** What a CHIP face is handed — {@link BlockContext} plus the one thing a chip
 *  has that a block does not: whether its pane is open, and the verb that
 *  toggles it. The state is the DRAWER'S, so opening a second pane closes the
 *  first — a chip holding its own `open` could not know that. */
export interface ChipContext extends BlockContext {
  readonly opened: boolean
  readonly onToggle?: () => void
}

/** A face that draws IN the run, immediately after the property's own chip —
 *  and draws NOTHING whenever the thing it is about is not alive, which is most
 *  of the time and is not a special case. */
export type PropChip = (context: ChipContext) => JSX.Element
/** ...what its press opens, below the run. */
export type PropPane = (context: BlockContext) => JSX.Element
/** ...and a face that owns a row whether or not anything is happening. */
export type PropBlock = (context: BlockContext) => JSX.Element


/**
 * WHAT THE PLUGIN'S OWN FACE IS, and the three paragraphs that are the whole of
 * the contract — kept here rather than on a slot's value type because they are
 * about DRAWING, and `./browser.ts` is about where a drawing hangs.
 *
 * A plugin may write a sentence into a person's chat lane
 * ({@link ./contract.ts}'s `Deliveries`), and the panel draws such a row as a
 * THIRD speaker beside the human and the agent. Every speaker there wears a
 * mark, and this is where a plugin's comes from: the plugin, and nowhere else.
 * A plugin that hangs none is drawn with a plain generic, which is the same
 * bargain an agent olai has no shape for already gets — and never another
 * plugin's mark, which would teach a reader something false the first time a
 * third tenant arrived.
 *
 * ## What it answers with: the SHAPES, inside a `0 0 16 16` box
 *
 * Not a whole `<svg>`, and this is the part worth spelling. The marks in a
 * transcript are read as a COLUMN — the person, the agent, the plugin, one
 * under another — so they must be one size and one stroke weight, and a plugin
 * that answered with its own `<svg>` would own the two attributes that decide
 * both. So the app draws the element and the plugin fills it: a `<g>` of paths
 * in a sixteen-unit square, `currentColor` throughout. A plugin wanting a
 * different size is asking for its row to look unlike the rows around it, which
 * is a request the panel should refuse.
 *
 * ### The sixteen-unit square is CORE'S VIEWPORT, not the plugin's coordinates
 *
 * A mark whose shapes are an EXISTING ASSET rather than a drawing made for this
 * column will have a coordinate system of its own, and it is permitted one: the
 * `<g>` may open a nested viewport inside itself.
 *
 * ```tsx
 * <g>
 *   <svg x="0" y="0" width="100%" height="100%"
 *        viewBox={MARK_VIEWBOX} preserveAspectRatio="xMidYMid meet"
 *        innerHTML={…} />
 * </g>
 * ```
 *
 * That is a granted permission with its bound written into it rather than a
 * loophole the first real asset routed around. `width="100%"`/`height="100%"`
 * resolve against whatever viewport core established, so the plugin still never
 * spells `16`, and `preserveAspectRatio="xMidYMid meet"` centres and fits the
 * artwork without distorting it. The `<g>` stays: a plugin still does not get to
 * be the outer `<svg>`, and still cannot touch the two attributes that decide
 * the column's size and weight.
 *
 * ### `currentColor` is the DEFAULT, not the rule
 *
 * It stays the rule for a DRAWN mark — the generic and any hand-drawn glyph take
 * nothing and inherit the ink of the line they sit on, which is what makes them
 * legible in every theme with no palette of their own. A mark that IS a brand
 * asset carries its own palette, and the plugin is the only place that knows it
 * has one. The cost travels with the permission: such a mark will not dim with
 * a muted row, will not invert with the theme, and may carry a shadow tuned for
 * the background its own designer had in mind.
 *
 * ### A mark that declares an `id` owns its uniqueness, PER INSTANCE
 *
 * SVG ids are global to the DOM DOCUMENT and `url(#…)` resolves against the
 * document, so a plugin shipping `id="lift"` has claimed that word from every
 * other element on the page — and the mark is drawn once per rung row, so two
 * rows are two claims. Core cannot namespace it: computing an address out of a
 * plugin's name is precisely what `@olai/bundle`'s `fence.test.ts` exists to
 * refuse. So the uniqueness is the plugin's, held by the plugin's own build and
 * minted at its own render (`createUniqueId`).
 */
export type PluginMark = () => JSX.Element

/** Solid's element type, re-exported so a plugin's component fields have a
 *  return type without every reader of this file importing `solid-js` for the
 *  one word. */
export type { JSX }
