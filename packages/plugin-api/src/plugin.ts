/**
 * WHAT A PLUGIN IS, as a type — the whole of what core knows about kolu, odu,
 * and whatever the third one turns out to be.
 *
 * ## Why there is an interface at all, which reverses a ruling
 *
 * `@olai/kolu-client`'s wire header says, in as many words: *"A generic
 * extension mechanism was considered and killed 3-0. The framework already
 * owns that axis, and there is no second foreign slice anywhere in git or the
 * roadmap — a plug-in system with a population of one is speculative
 * generality."* That was true when it was written and it is not true now. The
 * population is two — odu arrived (#433) and grew a cell, a dressing, a vault
 * walk and a probe of its own, every one of them the kolu block with the nouns
 * changed, which `@olai/server`'s runtime says about itself. A second tenant is
 * not speculation; it is the evidence the first ruling asked for.
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
import type { PluginWire } from "./contract.ts"


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
 * No plugin imports this file — {@link OlaiPlugin}'s header argues the direction
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

/** THE WHOLE OF WHAT A PLUGIN'S BROWSER HALF IS HANDED — see {@link AppClocks}'
 *  header for why it is handed at all.
 *
 *  ONE BLOB rather than a slot per tenant, for the reason {@link PluginServices}
 *  is one blob on the other side of the wire: a field per appliance is a general
 *  package naming one. */
export interface AppFurniture {
  /** Whether this is a desktop bar. The pills are desktop-only — on a phone the
   *  bar is the wordmark, the burger and search — and a plugin deciding that
   *  for itself would be a second answer to the app's own breakpoint. */
  readonly desktop: () => boolean
  readonly clocks: AppClocks
  readonly pill: PillLook
  readonly createPopover: () => AppPopover
  readonly FileLink: FileLink
}

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
 * A LIVE PROPERTY'S CLOTHES, and the word the seam looks them up by.
 *
 * The three faces are `@olai/web`'s seam's, unchanged, and their argument lives
 * there: a CHIP draws in the run beside the property's own chip, a PANE draws
 * below the run when the chip's press opens it, and a BLOCK owns a row always.
 * Every field is optional and a dressing with none of them is a property that
 * draws exactly as it always did.
 *
 * ## The word is the KIND, at both ends
 *
 * It is {@link PropKind}'s word — the same one the vault walks and the value
 * gate follow, and the same one a declaration writes. One spelling, one
 * authority, so a plugin's face and its probe cannot come apart.
 *
 * IT WAS THE PROPERTY KEY for one PR window, and the reason is worth keeping
 * because it was a good reason that produced a bad shape. A vault's
 * declarations deliberately do not travel to a tab (`@olai/format`'s
 * `meaning.ts` argues why the question is settled where the set is), so the
 * browser had nothing but the key to look a face up by — and the two halves
 * therefore agreed only while a vault happened to name its key after the kind.
 * A vault declaring `terminal` on a key called `pty` was walked, probed and
 * gated, and drew nothing.
 *
 * What closed it is neither a declaration on the wire nor a member on a
 * plugin's surface: the page's own consult mints an ANSWER PER DRAWN VALUE —
 * `from`, `prop`, `value` → the word, when a running plugin's kind claims it —
 * beside the doors table it is a twin of (`@olai/format`'s `Licence`). The tab
 * still receives answers and still cannot re-derive a rule; what changed is
 * only which question the answer is to.
 */
export interface Dressing {
  /** The BARE KIND this dressing is looked up by — this plugin's own constant,
   *  the same one its {@link PropKind} contributes, and never a literal at the
   *  call site.
   *
   *  BARE, like the kind: the app composes it with the plugin's name when it
   *  registers (`@olai/web`'s `live/dressings.ts`, through the registry's own
   *  `kindWordOf`), so the table is keyed by the word a declaration writes and
   *  the page's licence carries. A manifest spelling its own prefix would be a
   *  second copy of the one rule that makes plugin-owned names unable to
   *  collide or capture. */
  readonly kind: string
  readonly Chip?: PropChip
  readonly Pane?: PropPane
  readonly Block?: PropBlock
}

/**
 * THE APP'S CHROME, and what a plugin hangs in it.
 *
 * Two slots and no more: a HEADER readout (kolu's padi pill) and the DRAWER
 * its press opens (the events feed). A plugin that hangs neither is not a
 * lesser plugin — odu has neither.
 *
 * ONE ARGUMENT, and it is the furniture ({@link AppFurniture}). A slot that took
 * the plugin's own data as props would be the app reading a plugin's members to
 * fill them, which is the one thing no general package may do; a slot that took
 * nothing at all could not wear the bar's geometry. So what crosses is the app's
 * contract, and what the readout is ABOUT the plugin reads from its own half —
 * mounted once per tab by {@link PluginMount}.
 */
export interface Chrome {
  readonly Header?: ChromeFace
  readonly Drawer?: ChromeFace
}

/** One thing hung in the app's chrome — see {@link Chrome} for why the furniture
 *  is its only argument. */
export type ChromeFace = (props: { readonly app: AppFurniture }) => JSX.Element

/**
 * THE PLUGIN'S OWN FACE — the mark drawn beside a sentence this plugin put into
 * somebody's conversation.
 *
 * A plugin may write into a person's chat lane ({@link Deliveries}), and the
 * panel draws such a row as a THIRD speaker beside the human and the agent.
 * Every speaker in that transcript is named by a mark, and this is where a
 * plugin's comes from: the plugin, and nowhere else.
 *
 * ## Why the manifest rather than a table in core
 *
 * `./fence.test.ts` holds it as an equality per package — no general package
 * spells a plugin's name in code — so a `MARKS = { … }` in the panel is not a
 * shortcut somebody tidies later, it is red the day it is written. That fence
 * is not pedantry here: what a tenant looks like is a drawing decision about
 * that tenant, made where somebody knows what it IS, and a core table of them
 * is a core file edited every time a plugin core has never heard of ships.
 *
 * ## Why it is not a wire member
 *
 * The wire door ({@link ./surfaces.ts}) carries a plugin's NAME and its schema
 * so a process that renders nothing can read them; a mark is SolidJS and could
 * not cross it if anybody wanted it to. It does not need to. The browser holds
 * the manifests directly (`@olai/web`'s `plugins/roster.ts` widens the
 * registry) and looks the mark up by the name core already stamped on the row
 * — one walk over one registry, which is what every other browser hook here
 * already is.
 *
 * ## Why no argument at all, where {@link ChromeFace} takes the furniture
 *
 * A chrome slot wears the bar's geometry and therefore has to be handed it. A
 * mark is a glyph at the size of the line it sits on: it takes that line's
 * colour through `currentColor` and its box from the element the panel draws it
 * inside, so there is nothing for the app to hand over. A parameter offered
 * against a future need would be a contract core then has to keep — and the
 * alternative costs nothing, since a plugin that later needs data reads its own
 * half through the mount it already has ({@link PluginMount}).
 *
 * ## What it answers with: the SHAPES, inside a `0 0 16 16` box
 *
 * Not a whole `<svg>`, and this is the one part of the contract worth spelling.
 * The marks in a transcript are read as a COLUMN — the person, the agent, the
 * plugin, one under another — so they must be one size and one stroke weight,
 * and a plugin that answered with its own `<svg>` would own the two attributes
 * that decide both. So the app draws the element and the plugin fills it: a
 * `<g>` of paths in a sixteen-unit square, `currentColor` throughout, which is
 * exactly the shape `@olai/web`'s own `chat/AgentMark.tsx` gives every agent's.
 * A plugin wanting a different size is asking for its row to look unlike the
 * rows around it, which is a request the panel should refuse. Both halves of
 * that sentence are the DEFAULT rather than the whole rule, and the three
 * paragraphs below say exactly where each bends and what it costs — the size
 * and the weight are the two things that never do.
 *
 * A plugin that contributes none is drawn with a plain generic, which is the
 * same bargain an agent olai has no shape for already gets — and never another
 * plugin's mark, which would teach a reader something false the first time a
 * third tenant arrived.
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
 * artwork without distorting it. The `<g>` stays, because that is what this type
 * returns and what `<Dynamic>` renders: a plugin still does not get to be the
 * outer `<svg>`, and still cannot touch the two attributes that decide the
 * column's size and weight.
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
 * plugin's name is precisely what `./fence.test.ts` exists to refuse, in the
 * very file whose reason for existing is that core learns nothing about a
 * tenant. So the uniqueness is the plugin's, held by the plugin's own build and
 * minted at its own render (`createUniqueId`).
 */
export type PluginMark = () => JSX.Element

/**
 * THE TAB'S OWN HALF OF THIS PLUGIN, mounted once around the page.
 *
 * A plugin's faces are LEAVES — a chip drawn per row, a pill in a bar — and a
 * subscription per leaf is what a shell mount exists to refuse: an outline can
 * carry a `worktree` on a dozen rows and a `terminal` on forty. So the plugin
 * subscribes ONCE, here, and hands every leaf an accessor over the answer, which
 * is the arrangement `olai-plugin-kolu`'s `appliance/props/fleet.tsx` and `@olai/web`'s `served.tsx`
 * both already are.
 *
 * `client` is this plugin's OWN sibling client, typed by its OWN spec — the
 * browser twin of {@link PluginServer.published}, and `unknown` HERE for that
 * field's reason: core cannot type a plugin's client without learning its
 * members, which is the one thing this arrangement exists to prevent. It travels
 * opaque and is narrowed by the plugin at its own edge, once.
 */
export type PluginMount = (props: {
  readonly client: unknown
  readonly app: AppFurniture
  readonly children: JSX.Element
}) => JSX.Element

/**
 * ONE PLUGIN, as the BROWSER and the registry see it.
 *
 * Read top to bottom this is the whole surface between core and an appliance's
 * FACES: a name, what it puts on the wire, which face may see which of its
 * members, what its kinds wear, what it hangs in the chrome, and what it mounts
 * around the page. Nothing else crosses this door, and the fence proves it
 * (`packages/bundle/src/fence.test.ts`).
 *
 * ## It extends {@link PluginWire}, because a plugin is ONE identity
 *
 * The same three fields the wire door reads, declared once and inherited here
 * exactly as {@link PluginServerHalf} inherits them one file over. That is the
 * type catching up with the graphs: there are three doors onto a plugin because
 * there are three GRAPHS (`./wire.ts`, `./server.ts`, and this one), and a
 * reader could be forgiven for taking three doors for three plugins. They are
 * one, keyed by one word, and the interfaces now say so.
 *
 * ## WHAT IS NOT HERE, and where it went
 *
 * A server half, a probe and a kind table used to be declared here as `unknown`
 * — hooks the manifest NAMED while their values lived on `./server.ts`. That
 * was a ghost of a field: it could not be read (its type says nothing), it
 * could not be written (nothing type-checks against `unknown`), and it invited
 * a reader to look for a value the door does not carry. They are declared once
 * now, on {@link PluginServerHalf}, where their graph is.
 *
 * Two more are simply GONE. `ownedFile` was a shape with no consumer: which
 * basename a plugin claims by convention turned out to be the plugin's own
 * business, and the carry runs inside the plugin that owns it (`@olai/server`'s
 * `runtime.ts` records the move). `testDrivers` had a population of zero — a
 * field designed for a caller that never arrived, which is the one thing an
 * interface may not carry on the strength of an argument.
 *
 * ## The room that IS deliberate
 *
 * Every field below but the two inherited ones is optional, and that is not a
 * staging convenience: the ABSENT arm of every hook is the state a machine
 * without the tool already shows, and that state already had to work. The
 * interface is also roomier than its two tenants need, and the room is not
 * speculation either — a chat AGENT (today a second hardcoded roster in
 * `@olai/chat`'s `agents/`) is a probe whose answer carries its own failure
 * sentence plus a per-conversation attach, which is this shape with most of the
 * fields empty. Ruled: design for it, migrate later. The roster is untouched
 * here.
 *
 * ## THE USER PAGE is the NAME, and is deliberately not a field
 *
 * A plugin's user docs live at `packages/plugins/olai-plugin-<name>/docs.md`, which LOOKS
 * like the shape `@olai/server`'s `main.ts` ruled against — *"a page beside a
 * binary is a page that goes stale, and the one thing a person always has to
 * hand is `--help`"* (ruled, human 2026-08-23) — so the counter-case is argued
 * here rather than left implied.
 *
 * What that ruling refuses is a SECOND ACCOUNT. The CLI already accounts for
 * itself: `--help` is composed from the tool list and cannot describe a verb the
 * binary does not have, so a prose page standing beside it is a second telling
 * with nothing holding the two together. A plugin has no `--help`. `docs.md` is
 * its ONLY account, and the ruling's premise is absent rather than overridden.
 *
 * What the premise DOES apply to is DISTANCE, and that is what puts the page in
 * the plugin's package instead of in `docs/`: the terminal block, the sentences
 * an absent padi is owed and the words a run matrix prints are that package's,
 * changed in that package's diffs, and a page two directories away is one nobody
 * editing them has open.
 *
 * It is still SERVED, because `just serve` serves `docs/` as a vault and a path
 * outside it is not served at all — a link to one draws as text rather than as a
 * door. So `docs/plugins/<name>.md` is a SYMLINK onto the plugin's own
 * `docs.md`: one file with two names, the served page and the page beside the
 * code the same bytes, and drift not a thing that can happen. A COPY under
 * `docs/` was the alternative and loses on the ruling's own argument — two
 * files, and the one nobody has open is the one that is read; a GENERATOR that
 * wrote the copy loses too, since there is none in this tree and a checked-in
 * artefact of one is stale for as long as nobody runs it.
 *
 * And there is no `docs` FIELD, which replaces an earlier reading. A
 * `{slug, title, gloss}` on the manifest was the first shape and it was wrong
 * twice over. The slug was a second spelling of the NAME. And the other two
 * could not be read by anything that would spend them: the index is a general
 * page and the sweep that keeps it honest is a general sweep, and BOTH sit
 * where a manifest cannot be reached — this door carries SolidJS components and
 * a terminal emulator, and importing it from a process that renders nothing does
 * not merely cost bytes, it kills the boot (`@olai/server`'s `pluginPolicy.ts`
 * carries that hazard on the import that looked innocent; a `bun test` at the
 * root dies the same way, on `react/jsx-dev-runtime`). What a general reader CAN
 * have is {@link ./surfaces.ts}' `PLUGIN_NAMES`, on the browser-safe door —
 * which is the name, and which is the whole address. So the page's existence and
 * its reachability are held by a sweep over the tree rather than by a field:
 * `packages/tests/plugin_docs.test.ts`, which is the stronger claim anyway — a
 * field can be filled in beside a page that was never written.
 */
export interface OlaiPlugin extends PluginWire {
  /** What its kinds wear in the browser. TYPED, where the server door's hooks
   *  are opaque, and that is the difference between a value core CARRIES and
   *  one core DRAWS: the app mounts these faces, so the shape it mounts them
   *  against is a contract rather than a blob ({@link Dressing}). */
  readonly dressings?: ReadonlyArray<Dressing>
  /** What it hangs in the app's chrome. Typed for {@link Dressing}'s reason. */
  readonly chrome?: Chrome
  /** THE TAB'S OWN HALF, around the page — one subscription however many
   *  leaves draw ({@link PluginMount}). Absent on a plugin with nothing to
   *  hold, which is a plugin whose faces are all pure. */
  readonly mount?: PluginMount
  /** WHAT IT LOOKS LIKE WHEN IT SPEAKS — the mark over a sentence this plugin
   *  delivered into a conversation ({@link PluginMark}). Typed for
   *  {@link Dressing}'s reason: the app draws it. Absent on a plugin that
   *  delivers nothing, and on one content to wear the generic. The nested
   *  viewport and the pressable-id spelling are `@olai/plugin-kit`'s, so a
   *  tenant that fills this field is not inventing a second face grammar. */
  readonly mark?: PluginMark
}

/** Solid's element type, re-exported so a plugin's component fields have a
 *  return type without every reader of this file importing `solid-js` for the
 *  one word. */
export type { JSX }
