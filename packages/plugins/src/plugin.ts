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
 * ({@link ./compose.ts}): a plugin declares a WHOLE SURFACE in its own package
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
 * ## The plugin does NOT import this file
 *
 * A plugin package declares its manifest as a plain `as const` object and
 * never writes `: OlaiPlugin`, because `@olai/plugins` imports every plugin
 * and a plugin that imported back would be a cycle the manifests could not
 * express. The agreement is proved at the REGISTRY instead
 * ({@link ./registry.ts}'s `satisfies`), which is the same move `@olai/ops`
 * makes with the surface's `Status` — *"typed as the surface's own shape,
 * which `@olai/ops` declares structurally: the two drifting is a type error
 * here rather than a mapping to maintain"* — and the same one
 * `@olai/kolu-ui`'s `block.ts` already makes with the drawer's entry.
 *
 * A structural fit is a weaker guarantee than an annotation in exactly one
 * way: a typo in a member name is named at the registry rather than at the
 * plugin. It is a stronger one in the way that matters here, which is that the
 * direction of the dependency is physics rather than discipline — the wall the
 * sixth sitting ruled for, one floor up.
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
 * AN MCP SERVER TO SPAWN, in olai's terms — `@olai/chat` renders it into what
 * ACP wants, the same way it does olai's own.
 *
 * This shape was `Kolu.Server` and it never had anything kolu about it: a
 * name, an absolute path, an argv and an environment is what every stdio
 * server is. It is here because the second one to arrive would otherwise have
 * declared it again.
 *
 * `command` is ABSOLUTE, and that is load-bearing rather than tidy: it is the
 * file that answered the probe, not a word to resolve again. Handing the bare
 * word would leave the agent free to resolve it against a different PATH and
 * spawn a different build than the one that answered.
 */
export interface StdioServer {
  readonly name: string
  /** Absolute: the file that answered the probe, not a word to resolve again. */
  readonly command: string
  readonly args: ReadonlyArray<string>
  /** What to set when launching it, beyond what it inherits. */
  readonly env: Readonly<Record<string, string>>
}

/**
 * ...and the other half: a server that was expected here and is not usable.
 *
 * The two arms are not the same answer, which is why a probe answers with both
 * and not with a `StdioServer | null`. A host that never had the tool had
 * nothing go wrong and is owed no sentence; a tool that is HERE and would not
 * answer is the one worth telling somebody about.
 *
 * `why` is a WHOLE SENTENCE and it is the PLUGIN'S. Core displays it and never
 * composes it — there is no template here that a plugin fills a noun into,
 * because the four ways a padi fails and the four ways a coordinator does have
 * nothing in common but that they failed, and a sentence built out of that
 * shared nothing is the debug line on a screen.
 *
 * `where` is `null` for the ways of failing that never reached a file. A path
 * is what a reader most wants and is not always a thing that exists.
 *
 * The shape is `@olai/chat`'s `NotHere`, declared here for
 * {@link StdioServer}'s reason and re-exported there, so the roster still
 * spells one word.
 */
export interface NotHere {
  readonly name: string
  readonly where: string | null
  readonly why: string
}

/** WHAT A PROBE FOUND — both halves at once, because they are one reading.
 *
 *  Two fields rather than a union, and it is an invariant with an incident
 *  behind it (`@olai/chat`'s `agent.ts`: one probe, two reads). A registry
 *  that asked once for the handing list and again for the missing list would
 *  spawn the tool twice per conversation and could answer the two questions
 *  about two different moments. */
export interface Probed {
  /** The server to hand a session, or `null` where there is none to hand. */
  readonly server: StdioServer | null
  /** What a person is owed about the one they did not get, or `null` where an
   *  absence is the ordinary case and no fault. */
  readonly missing: NotHere | null
}

/**
 * A PROPERTY KIND this plugin contributes to the vault's vocabulary.
 *
 * `@olai/format` owns seven kinds — `text`, `date`, `int`, `path`, `doc`,
 * `ref`, `node` — and none of them is a terminal. Today a property NAMED
 * `terminal` gets the terminal door, which is name-matching, and the way it
 * goes wrong is not hypothetical: `brief` and `worktree` are both `path` and
 * only one of them names a checkout to probe.
 *
 * So a plugin contributes a KIND, the vault declares it in
 * `_olai/Properties.olai` like any other, and the face follows the kind
 * whatever the property is called. `@olai/format` imports no plugin — its kind
 * vocabulary becomes a parameter and the server hands it this table as data,
 * which is the same move `KoluDeps` makes with the vault walks.
 *
 * A kind whose plugin is DISABLED validates as plain text. The value is still
 * a name, nothing breaks, and it wears no face — which is exactly the state a
 * vault that declared nothing is already in.
 */
export interface PropKind {
  /** The word a declaration writes, and the word a dressing is licensed by. */
  readonly kind: string
  /** What the clause naming this kind says in a refusal — `` `terminal` (a
   *  padi terminal id)``. The plugin's own words, spent at BOTH doors (the
   *  live write's refusal and the broken file's error), because a person
   *  moving between them must read one sentence. */
  readonly takes: string
  /** Whether a value fits. `false` is refused at the plan and reported by the
   *  validator, in one sentence, {@link PropKind.takes}'. */
  readonly admits: (value: string) => boolean
}

/**
 * A FILE IN THE VAULT THIS PLUGIN OWNS, by convention — `_olai/Kolu.olai`.
 *
 * The basename is the plugin's; FINDING it among the served outline paths is
 * generic and stays in the server, so a config that parses to nothing still
 * has the wrench that opens it. What the file MEANS is the plugin's again:
 * `read` is handed the nodes that file contributed and answers whatever the
 * plugin's own half wants, which core carries and never inspects.
 *
 * A plugin that is disabled contributes no owned file, and the outline it
 * would have claimed is an ordinary outline — parsed, listed, editable, and
 * meaning nothing in particular. That is the absent state, and it is the state
 * every vault that has never heard of the plugin is already in.
 */
export interface OwnedFile<Node, Reading> {
  /** Case-folded at the caller's end — `"kolu.olai"`, which is what
   *  `_olai/Kolu.olai` reads as. */
  readonly basename: string
  readonly read: (nodes: ReadonlyArray<Node>, file: string | null) => Reading
}

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
 * `@olai/kolu-ui`'s `block.ts` already does with the drawer's entry. That is a
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
 * ## What the word IS today, said plainly rather than aspirationally
 *
 * {@link PropKind} is what this field is FOR: a plugin contributes a KIND, the
 * vault declares a property of that kind, and the face follows the kind whatever
 * the property is called — which is what would make `brief` and `worktree`, both
 * declared `path`, dressable apart. That reversal needs one thing this build
 * does not have. A vault's declarations deliberately do not travel (the tab
 * receives ANSWERS — `@olai/format`'s `meaning.ts` argues why the question is
 * settled where the set is), so the LICENCE has to cross instead, and no member
 * carries it yet.
 *
 * So TODAY the word a plugin writes here is the property KEY and the seam looks
 * a property up by it. That is recorded rather than papered over: it is the
 * arrangement `@olai/web`'s seam has always had, it is the one the server's own
 * probes already agree with, and the day the licence crosses, this field's
 * meaning changes in ONE place — here — rather than at every registration.
 */
export interface Dressing {
  /** The word this dressing is looked up by — see the header for what it is
   *  today and what it becomes. Never a literal at the call site: it is the
   *  plugin's own constant, the same one its server probes by. */
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
 * THE TAB'S OWN HALF OF THIS PLUGIN, mounted once around the page.
 *
 * A plugin's faces are LEAVES — a chip drawn per row, a pill in a bar — and a
 * subscription per leaf is what a shell mount exists to refuse: an outline can
 * carry a `worktree` on a dozen rows and a `terminal` on forty. So the plugin
 * subscribes ONCE, here, and hands every leaf an accessor over the answer, which
 * is the arrangement `@olai/kolu-ui`'s `fleet.tsx` and `@olai/web`'s `served.tsx`
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
 * WHAT CORE OFFERS EVERY PLUGIN'S SERVER HALF — the whole of it, and the same
 * blob whoever is asking.
 *
 * ## Why there is one shape rather than a slot per tenant
 *
 * `@olai/server`'s `Wiring` used to carry a field per appliance: a `kolu` half
 * holding an environment, a clock and an injectable dial, and an `odu` half
 * holding an environment, the served directory and an injectable dial. Two
 * records with three fields between them and the nouns changed — which is what
 * a NAMED SLOT is, and naming one is the thing a general package must stop
 * doing. What the two actually asked for was the same list: **what the process
 * can see** (the environment), **what time it is**, **which directory this
 * serve is about**, **two log channels**, and **a way for a test to hand the
 * dial a fake**. So that is the list, spelled once, and a third plugin is
 * handed it without core learning a word.
 *
 * Every field is here because one of the two tenants would otherwise have had
 * to be asked for it separately, and none is here for a plugin that does not
 * exist: `served` is odu's today (half of where a relative `worktree`
 * resolves) and `now` is kolu's (what a link's `since` is stamped from), and
 * each is offered to both because "which directory" and "what time is it" are
 * questions about the SERVE and not about an appliance. A plugin reads what it
 * needs and its own signature says which — see {@link PluginServer}.
 *
 * ## Why a composition root hands these in rather than a plugin reading them
 *
 * The same rule every other seam in this tree is built on, and it is not
 * negotiable at this boundary: a plugin that read `process.env` or called
 * `new Date()` would be a plugin a test cannot drive, and the two halves that
 * exist today are both already written the other way round
 * (`@olai/kolu-client`'s `MirrorOptions`, `@olai/odu-client`'s `OduDeps`).
 * What is new is only that the list has one spelling.
 */
export interface PluginServices {
  /** WHAT THE PROCESS CAN SEE. `$PADI_SOCKET`, `$OLAI_REPOS_DIR` — the
   *  variables an appliance's rendezvous is decided from, handed in so a test
   *  owns them and a composition root is the one place a real environment is
   *  reached for. */
  readonly env: Record<string, string | undefined>
  /** THE CLOCK, as ISO-8601. What a link's `since` is stamped from, and the
   *  reason a test that asserts "connected · just now" can own the instant it
   *  was rendered from. */
  readonly now: () => string
  /** THE DIRECTORY THIS SERVE IS ABOUT — the vault. Half of where a relative
   *  path in a property resolves to, and a fact about the serve rather than
   *  about whoever asked: a plugin that read it off the store would be a
   *  second answer to a question the composition root already holds. */
  readonly served: string
  /** ROUTINE NARRATION, at debug. On a machine that is not running the tool
   *  this is a line every few seconds and it is not news. */
  readonly say: (line: string) => void
  /** THE SENTENCES THE OWNER MUST READ — a malformed value in the vault, a
   *  socket that IS being served and refused us. Wired to a level the default
   *  console turns on, because a broken spell behind `OLAI_LOG_LEVEL=debug` is
   *  a sentence nobody is told. */
  readonly warn: (line: string) => void
  /**
   * THE INJECTABLE, for a test — a fake padi, a fake coordinator, whatever
   * this plugin dials.
   *
   * `unknown`, and the honesty of that is the point rather than a gap: core
   * cannot type a plugin's own test double without learning what the plugin
   * talks to, which is the one thing this whole arrangement exists to prevent.
   * It travels opaque and is NARROWED by the plugin, once, at its own edge —
   * the same trade every other `unknown` on {@link OlaiPlugin} makes, and the
   * only one a test ever fills.
   */
  readonly dial?: unknown
}

/**
 * ...AND WHAT COMES BACK — one plugin's server half, as core drives it.
 *
 * Four fields, and core inspects none of what passes through them. `deps` is
 * handed straight to `implementSurfaces` under this plugin's name; `published`
 * gives the half back its OWN write face the moment that sibling exists;
 * `revision` and `unloaded` are the two things that can happen to a vault.
 *
 * ## `deps` is `unknown` HERE and exact THERE
 *
 * The framework's `SurfaceDepsFor` types a deps record against each sibling's
 * own spec, which is precise for a LITERAL map and says nothing about a record
 * assembled by walking a registry — core's keys are runtime data. So the
 * agreement is kept where it CAN be checked: a plugin's own server module
 * annotates its return as `ImplementSurfaceDeps<typeof surface.spec>` against
 * its OWN surface, so a member it forgot or mis-shaped is a type error in that
 * plugin's package with that plugin's name on the file. Core carries the value
 * and never opens it — the division {@link OlaiPlugin} makes everywhere else.
 *
 * ## Why `published` exists, and why it is not the named slot it replaces
 *
 * `runtime.ts` used to hand kolu three read-back closures —
 * `fleet: () => published?.collections.fleet` and two more — because a half
 * has to WRITE to the members it answers for, and the surface does not exist
 * until it has been implemented. That was core naming another package's
 * members, three times, in a file that must not know one.
 *
 * A sibling composition removes the NAMING and not the ordering:
 * `implementSurfaces` returns a ctx per plugin KEY, so what core hands back is
 * one opaque value that is already this plugin's own, addressed by the only
 * word core knows about it. The plugin narrows it to its own surface's ctx,
 * which is a type it declares itself.
 *
 * It is called AFTER the composition rather than during it, which is the same
 * window the read-back closures were written for: the framework starts a
 * cell's connectors INSIDE `implementSurfaces`, so a half whose first beat
 * lands before the call returns must tolerate having no ctx yet. Both tenants
 * already do — that tolerance is what those closures were.
 */
export interface PluginServer<Revision> {
  /** This plugin's `ImplementSurfaceDeps`, against its own spec — see above
   *  for why the type is opaque on this side of the wall. */
  readonly deps: unknown
  /** This plugin's OWN ctx, handed back the moment its sibling is implemented.
   *  Absent on a half with nothing to publish. */
  readonly published?: (ctx: unknown) => void
  /**
   * A VAULT REVISION LANDED.
   *
   * ONE HOOK, and it carries the RICHER of the two readings the two tenants
   * ask for today: kolu wants the node list and which served file its owned
   * convention names, odu wants the whole derivation because the walk it feeds
   * asks the vault what it DECLARES as well as what it records. A core that
   * offered each of them their own argument would be a core that knew what
   * each plugin reads.
   *
   * So the hook is PARAMETRIC and every plugin narrows it at its own
   * signature: what core passes is the whole revision, and the type a plugin
   * writes is the part of it that plugin touches — a claim the compiler checks
   * rather than a comment. `Revision` is never named in this package for the
   * reason `@olai/format` is not a dependency of it: the vocabulary of a vault
   * record belongs downstairs, and a floor package that imported it would be
   * the interface learning what an outline is.
   */
  readonly revision: (revision: Revision) => void
  /** The store has NEVER published — the directory's read failed outright.
   *  Whatever this half derived FROM the vault is yesterday's reading and says
   *  so; what it holds from its own daemon is untouched. */
  readonly unloaded: () => void
}

/** THIS PLUGIN'S USER DOCS — the page the docs index assembles.
 *
 *  A plugin's docs live in its own directory, ruled, because a page that
 *  documents a thing and a page that sits beside it go stale at different
 *  rates and only one of them is noticed. `slug` is where the assembled page
 *  lands under `docs/plugins/`; `title` and `gloss` are the index's own line. */
export interface PluginDocs {
  readonly slug: string
  readonly title: string
  readonly gloss: string
}

/**
 * ONE PLUGIN.
 *
 * Read top to bottom this is the whole surface between core and an appliance:
 * a name, what it puts on the wire, what it probes for, what it runs, what it
 * hands an agent, what it owns in the vault, what it says when it fails, what
 * it teaches the format, what it draws, and what it documents. Nothing else
 * crosses, and the fence proves it (`packages/plugins/src/fence.test.ts`).
 *
 * The interface is deliberately roomier than its two tenants need, and the
 * room is not speculation: a chat AGENT — today a second hardcoded roster in
 * `@olai/chat`'s `agents/` — is probe plus failure sentences plus a
 * per-conversation attach, which is this shape with three of the fields empty.
 * Ruled: design for it, migrate later. The roster is untouched here.
 *
 * The shapes are deliberately `unknown` where core never inspects them: a
 * runtime half's deps, a dressing's components, a chrome slot's props and an
 * owned file's reading are the plugin's own, carried and handed back. What
 * core knows is a plugin's NAME — which is the sibling key, and therefore the
 * one word it needs — and never what is behind it.
 */
export interface OlaiPlugin {
  /** THE SIBLING KEY, and with it the preferences row, the docs slug and the
   *  word the `--plugins` flag takes. One spelling of it — and because the
   *  key is the wire prefix, the name and every tag it appears in cannot drift
   *  apart. */
  readonly name: string
  /** THIS PLUGIN'S OWN SURFACE — a whole one, declared in the plugin's own
   *  package with the plugin's own member names on it. Core composes it as a
   *  SIBLING under {@link OlaiPlugin.name}, so what reaches the wire is
   *  `surface/<name>/<member>/<verb>` and nothing in a general package
   *  computed that address. */
  readonly surface: { readonly spec: unknown }
  /** WHICH FACE sees which of its members, keyed by face name — this plugin's
   *  own `ExposeMap`, written against its own spec. A per-appliance decision
   *  that used to be a hand-written row in a general package's expose map,
   *  which is a table somebody had to remember to add to; a member missing
   *  from it is a member no face serves. A face a plugin never mentions is
   *  DENIED IN FULL, which is what `exposeFaces` does with an absent map and
   *  is what a plugin declining a face means. */
  readonly faces: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  /** The property kinds it teaches the vault's vocabulary. */
  readonly kinds?: ReadonlyArray<PropKind>
  /** Find the tool. Absence is a STATE, not an error — see {@link Probed}. */
  readonly probe?: unknown
  /** The subscription machinery the server forks, deps injected — reached
   *  through the plugin's `./server` door rather than through this manifest,
   *  so a composition root that wants a runtime does not pull the plugin's
   *  browser faces onto its graph ({@link PluginServer}, and
   *  {@link ./server.ts}, which is this package's own third door). */
  readonly runtimeHalf?: unknown
  /** Handed to chat sessions when the probe says yes. */
  readonly mcpServer?: unknown
  /** The vault file this plugin owns by convention. */
  readonly ownedFile?: OwnedFile<never, unknown>
  /** WHOLE SENTENCES, one per way of failing. Core displays; never composes. */
  readonly failures?: Readonly<Record<string, string>>
  /** What its kinds wear in the browser. Typed, unlike the fields above, and
   *  that is the difference between a value core CARRIES and one core DRAWS:
   *  the app mounts these faces, so the shape it mounts them against is a
   *  contract rather than an opaque blob ({@link Dressing}). */
  readonly dressings?: ReadonlyArray<Dressing>
  /** What it hangs in the app's chrome. Typed for {@link Dressing}'s reason. */
  readonly chrome?: Chrome
  /** THE TAB'S OWN HALF, around the page — one subscription however many
   *  leaves draw ({@link PluginMount}). Absent on a plugin with nothing to
   *  hold, which is a plugin whose faces are all pure. */
  readonly mount?: PluginMount
  /** The page the docs index assembles. */
  readonly docs?: PluginDocs
  /** What a scenario needs to drive it — the fake, the tags, the fixtures. */
  readonly testDrivers?: unknown
}

/** Solid's element type, re-exported so a plugin's component fields have a
 *  return type without every reader of this file importing `solid-js` for the
 *  one word. */
export type { JSX }
