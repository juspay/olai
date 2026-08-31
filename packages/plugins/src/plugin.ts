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
import type { PluginWire } from "./surfaces.ts"

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
 * `@olai/chat` and each plugin spell this shape THEMSELVES, and the three
 * declarations are the arrangement rather than a duplication to tidy away. A
 * plugin may not import this package ({@link OlaiPlugin}'s header: the registry
 * imports every plugin), and `@olai/chat` is a general package one floor down
 * that the composition root hands a list to — so the agreement is proved where
 * the two ends meet, at `@olai/plugins/server`'s `probesOf` and the registry's
 * `satisfies`, and nothing below this floor learns that a plugin system exists.
 * It is the same trade {@link AppFurniture} makes in the other direction.
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
 * `ref`, `node` — and none of them is a terminal. A plugin's vault walk USED TO
 * READ ONE HARDCODED KEY, which is name-matching, and the way that went wrong
 * was not hypothetical: `brief` and `worktree` are both `path` and only one of
 * them names a checkout to probe, so nothing could tell them apart.
 *
 * So a plugin contributes a KIND, the vault declares it in
 * `_olai/Properties.olai` like any other, and the face follows the kind
 * whatever the property is called. `@olai/format` imports no plugin — its kind
 * vocabulary is a PARAMETER and the server hands it this table as data, which
 * is the same move `KoluDeps` makes with the vault walks.
 *
 * WHAT THAT COSTS A VAULT IS NOTHING, and the two layers are why. A kind
 * claims the key equal to its own composed word ({@link ./server.ts}'s
 * `kindsOf`), so an enabled plugin declares `kolu-terminal` / `odu-worktree` for
 * a vault that has said nothing about them — and olai never writes anybody's
 * vault to do it. A row of the vault's own always wins, which is how a kind
 * moves onto a short key and how a face is taken away again.
 *
 * There is still deliberately NO FALLBACK to the key's NAME, which is a
 * different thing from the claim and is worth keeping apart: a fallback would
 * read a key's spelling and guess, where the claim is a DECLARATION like any
 * other — one a plugin can only ever make about a key carrying its own name.
 *
 * A kind whose plugin is DISABLED validates as plain text. The value is still
 * a name, nothing breaks, and it wears no face — which is exactly the state a
 * vault that declared nothing is already in.
 *
 * ## Two vocabularies, and which question reads which
 *
 * The table core assembles out of these has two halves, and the distance
 * between them is what `--plugins` means one more time ({@link ./server.ts}'s
 * `kindsOf`). A DECLARATION is refused against every kind this BINARY was built
 * with, so `{"type":"kolu-terminal"}` is a legal row on a serve running only odu and
 * `{"type":"banana"}` is refused naming every legal word; a VALUE is held to
 * the kinds this serve is RUNNING, because {@link PropKind.admits} is a promise
 * only a plugin that is here can make. A file's verdict may not depend on a
 * flag on the machine, and that split is the whole of how it does not.
 *
 * ## It is reached on the SERVER door
 *
 * Declared here, because a kind is part of what a plugin IS. Reached through
 * {@link ./server.ts}, for {@link OlaiPlugin.probe}'s reason: the vocabulary is
 * spent by the validator and the write planner, which is a process that renders
 * nothing, and a manifest carries this plugin's SolidJS faces. The browser
 * needs none of it — a vault's declarations deliberately do not travel
 * (`@olai/format`'s `meaning.ts`). What the browser gets instead is the same
 * consult's ANSWER per drawn value, which is what the dressing table one floor
 * up is keyed by ({@link Dressing}): the WORD, never the property key.
 */
export interface PropKind {
  /**
   * THE BARE WORD THIS PLUGIN CONTRIBUTES — `terminal`, not `kolu-terminal`.
   *
   * The registry PREFIXES it with the plugin's name ({@link ./surfaces.ts}'s
   * `kindWordOf`), so what a vault declares is `kolu-terminal` and what the
   * page's licence carries is the same. It is the move the wire already makes
   * with a member — a plugin declares `fleet` and the framework composes
   * `surface/kolu/fleet/get` — and it buys the same two things here:
   *
   *   - two plugins cannot collide on a word, because two names cannot; and
   *   - a plugin's BUILT-IN declaration can only ever claim a key carrying its
   *     own name, so enabling one can never take over a column somebody has
   *     been using for something of their own.
   *
   * A plugin writes the bare word once and the composition happens where the
   * registry is. What each plugin does spell for itself is a copy of that
   * composition for its own vault walk — it may not import this package — and
   * `./kinds.test.ts` holds the two spellings equal.
   */
  readonly kind: string
  /** What the clause naming this kind says in a refusal — `` `kolu-terminal` (a
   *  padi terminal id)``. The plugin's own words, spent at BOTH doors (the
   *  live write's refusal and the broken file's error), because a person
   *  moving between them must read one sentence. It names the COMPOSED word,
   *  because that is the one a person has to type. */
  readonly takes: string
  /** Whether a value fits. `false` is refused at the plan and reported by the
   *  validator, in one sentence, {@link PropKind.takes}'. */
  readonly admits: (value: string) => boolean
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
 * rows around it, which is a request the panel should refuse.
 *
 * A plugin that contributes none is drawn with a plain generic, which is the
 * same bargain an agent olai has no shape for already gets — and never another
 * plugin's mark, which would teach a reader something false the first time a
 * third tenant arrived.
 */
export type PluginMark = () => JSX.Element

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
  /**
   * THE DOORBELL'S DOOR — which conversations opted into THIS plugin's wakes,
   * and the one write-only verb that reaches them ({@link Deliveries}).
   *
   * The second field on this blob built PER PLUGIN rather than handed out whole
   * ({@link dial} is the first), and for that one's reason turned around: a door
   * keyed by nobody would hand one plugin the conversations a person scoped to
   * another. The key is the plugin's `name`, which is the one word core knows,
   * and the composition root closes over it exactly where it already closes over
   * it for `dial` — so this is not a second lookup, it is the same one.
   *
   * REQUIRED, unlike `dial`, and the difference is about what CAN be absent. A
   * real serve legitimately dials nothing; there is no serve where the door is
   * missing. What varies is whether anybody walked through it — a machine with
   * no agent installed answers `scopes()` with the empty list forever, which is
   * the honest machine-without-the-tool state and needs no failure channel on a
   * verb that cannot fail.
   */
  readonly deliveries: Deliveries
}

/**
 * ONE GENERIC CAPABILITY: DELIVER A MESSAGE INTO A CONVERSATION — the whole of
 * what core grows so that a plugin can ring a doorbell.
 *
 * ## It speaks conversations and files, and it will never speak anything else
 *
 * There is no terminal here, no fleet, no board and no watcher — and that is the
 * fence rather than an accident of today's one caller: the door is generic or it
 * does not land. A plugin says WHO to reach and WHAT to say; core knows how a
 * conversation takes a message and knows nothing about why this one was worth
 * sending. The same bar the rest of this file keeps, one capability later: core
 * may know a plugin's name, and may not know anything else about it.
 *
 * ## Two bare strings and not a `Conversation`
 *
 * A conversation is the PAIR `(agent, session)`, because a session id means
 * nothing to the wrong agent — core's own identity for the thing, spelled the
 * way `@olai/chat`'s note already spells it rather than minted a second time.
 * It is two fields here rather than a type imported from `@olai/surface` because
 * this package declares no dependency on the wire and says so on purpose in its
 * manifest; a schema pulled in to name a pair of strings would be that wall
 * coming down for a pair of strings.
 *
 * ## WRITE-ONLY, and that is the load-bearing half
 *
 * There is no `read`, no `transcript`, no `history`, and there is no arm of this
 * interface where one could be added without saying so in the type. A plugin can
 * put a sentence INTO a conversation and can never learn what is in one — not
 * what a person typed, not what the agent answered, not whether anybody read it.
 * A capability that could do both would be the appliance reading the human's
 * mail, and no amount of care at the call site takes that back afterwards.
 */
export interface Deliveries {
  /**
   * THE CONVERSATIONS THAT OPTED INTO THIS PLUGIN'S WAKES, each with the file a
   * person picked to filter by.
   *
   * SYNCHRONOUS, and that shapes what is behind it: the composition root builds
   * this blob inside a plain `.map`, and the caller is a watcher sink with no
   * Effect around it. So core mirrors the table in memory and the disk copy
   * follows the write rather than leading the read.
   *
   * The list is the WHOLE of the scope. A conversation is on it because somebody
   * picked a file for it, and it leaves when somebody clears it: there is no
   * serve-level default, and no way for an AGENT to add one — the member that
   * writes this is drawn for the browser and refused to the agent face, which is
   * where that reads as physics rather than as a promise. A fresh conversation's
   * doorbell is off, and the only thing that turns it on is a person.
   */
  readonly scopes: () => ReadonlyArray<{
    readonly agent: string
    readonly session: string
    readonly file: string
  }>
  /**
   * ONE MACHINE-MARKED MESSAGE INTO ONE CONVERSATION. Core owns the mechanics;
   * the plugin owns every word.
   *
   * WHAT CORE DOES WITH IT, in three arms: a conversation this panel is in whose
   * agent is idle takes it as a turn; one whose agent is mid-turn HOLDS it and
   * lets it in at the turn boundary, behind whatever the human queued first; a
   * conversation nobody is in holds it until somebody opens it, and it arrives
   * as that session's first message. Which arm a body took is not reported back,
   * because there is no arm a plugin would answer differently.
   *
   * FIRE AND FORGET, like {@link PluginServices.say} and
   * {@link PluginServices.warn} beside it, and for their reason: the caller is a
   * sink with nowhere to put a failure, and a rejected promise nobody has a
   * reason to catch is an unhandled rejection in somebody's server log.
   *
   * THE BODY MUST OPEN WITH ITS OWN ATTRIBUTION, and this is the one thing this
   * door asks of the words. Core marks the row, and the mark is a live
   * affordance the browser draws a face from — but a conversation resumed from
   * the agent's own store rebuilds its rows out of message chunks, and the mark
   * is not among them. So the SENTENCE has to say who is speaking, or a replayed
   * transcript puts the plugin's words in the person's mouth.
   */
  readonly deliver: (
    to: { readonly agent: string; readonly session: string },
    /**
     * THE WORDS, COMPOSED AT THE MOMENT THEY ENTER THE CONVERSATION — not when
     * this was called.
     *
     * ## Why a thunk and not a string
     *
     * A body can WAIT: through a running turn, or until somebody opens the
     * conversation, which may be hours. A string handed over at ring time is a
     * claim about the world drafted then and read now, and the world moves — a
     * delivery was found arriving about two terminals that had been killed and
     * a lane that had been merged and closed while it queued. A message the
     * agent reads has to be true when it is READ, which is the same was-clause
     * honesty the board's own writes keep.
     *
     * So core asks for the words at the last possible moment and the plugin
     * derives afresh. It is the no-standing-set rule spent one floor over: a
     * plugin holding its own answer between the drafting and the delivery would
     * be keeping a second copy of a truth that had already changed.
     *
     * `null` DROPS THE DELIVERY. A body whose subject has entirely gone — every
     * terminal it was about settled while it waited — is not a shorter message,
     * it is no message, and a plugin says so by answering with nothing. Where
     * several bodies were coalescing into one, only the ones that still answer
     * are joined; if none does, no row is written at all.
     */
    say: () => string | null,
    options?: {
      /**
       * MESSAGES SHARING A KEY, WHILE STILL UNDELIVERED, REPLACE EACH OTHER —
       * in place, so the one that lands keeps the position the first one took
       * and arrival order survives the replacing.
       *
       * It is what lets a plugin send a fresh whole sentence per event and have
       * a person read ONE message rather than five. Composing the combined
       * sentence stays the plugin's authorship; holding exactly one stays core's
       * mechanics.
       *
       * ## THE KEY IS SCOPED TO THE PLUGIN, and a plugin never spells that
       *
       * Core files a held slot under the PAIR `(plugin, coalesce)` — `@olai/chat`'s
       * `holding` mints the identity out of both — so a key is chosen among this
       * plugin's OWN messages and nothing else. Two plugins that both say `digest`
       * are two subjects with two slots, and neither can swallow the other's
       * sentence; a word as ordinary as that one is safe to pick without
       * consulting anybody. It is the same pairing that makes the held-slot cap
       * and the turn-it-off drop per plugin rather than per conversation, and a
       * caller that spells its own name into the key is repeating what core
       * already did rather than earning anything by it.
       *
       * ## AND NO KEY IS A REAL ARM, but not the one a doorbell takes
       *
       * A body sent with no key is filed under a fresh identity of core's own: it
       * never replaces and is never replaced. That arm is for a plugin whose
       * sentences are each about a DIFFERENT thing, where the newer one does not
       * contain the older and replacing would lose what the first said. A plugin
       * whose body is a fresh derivation of standing state is in the other case
       * and should key BOTH its meanings — the newest sentence already says
       * everything its predecessor said, so replacing costs nothing and reading
       * five near-identical messages costs a person something.
       *
       * IT USED TO say a wake takes the no-key arm, from a draft in which a body
       * was an account of one event rather than of everything standing. The only
       * caller has keyed both of its meanings since, and this line agreeing with
       * it is the difference between a doc a caller can follow and one it
       * contradicts.
       */
      readonly coalesce?: string
    },
  ) => void
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

/**
 * ONE PLUGIN, as the BROWSER and the registry see it.
 *
 * Read top to bottom this is the whole surface between core and an appliance's
 * FACES: a name, what it puts on the wire, which face may see which of its
 * members, what its kinds wear, what it hangs in the chrome, and what it mounts
 * around the page. Nothing else crosses this door, and the fence proves it
 * (`packages/plugins/src/fence.test.ts`).
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
 * A plugin's user docs live at `packages/plugin-<name>/docs.md`, which LOOKS
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
   *  delivers nothing, and on one content to wear the generic. */
  readonly mark?: PluginMark
}

/** Solid's element type, re-exported so a plugin's component fields have a
 *  return type without every reader of this file importing `solid-js` for the
 *  one word. */
export type { JSX }
