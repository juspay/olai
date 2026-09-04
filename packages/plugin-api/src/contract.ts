import type { Effect } from "effect"

/**
 * THE SHAPES BOTH HALVES OF A PLUGIN SHARE — what a probe answers, what a kind
 * is, what a doorbell may do, and the three fields that ARE a plugin's identity.
 *
 * ## Why these are their own file
 *
 * `./plugin.ts` is the BROWSER half's interface and its fields return
 * `JSX.Element`, so it names `solid-js`. `./services.ts` is the SERVER half's
 * and it names `effect` and the bridge. Neither process wants the other's
 * graph — a server that evaluated a `.tsx` dies on `react/jsx-dev-runtime`
 * before it has served anything, which is not hypothetical (`@olai/server`'s
 * `pluginPolicy.ts` carries that hazard on the import that looked innocent).
 * What both halves genuinely share is a handful of DATA shapes with no runtime
 * behind them at all, and this is them.
 *
 * ## And why they are in this package rather than in the registry
 *
 * They were, until a plugin started importing the interface. The registry
 * (`@olai/bundle`) names every plugin, so a plugin that reached back into it
 * for the shape of its own `PropKind` would be the cycle the manifests decline
 * to express — the reason `olai-plugin-odu`'s `server.ts` re-declared
 * `Deliveries` structurally for a while, and the reason it no longer has to.
 * This package names no plugin, which is the whole of what makes the arrow
 * one-way.
 */

/**
 * AN MCP SERVER TO SPAWN, in olai's terms — `olai-plugin-chat` renders it into what
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
 * `olai-plugin-chat` and each plugin spell this shape THEMSELVES, and the three
 * declarations are the arrangement rather than a duplication to tidy away. It
 * used to be that a plugin COULD NOT import this package — it held the registry
 * too, and the registry imports every plugin — and that premise left with the
 * registry ({@link ./plugin.ts}'s header argues the reversal); the three
 * spellings stayed, because `olai-plugin-chat` is a general package one floor down
 * that is handed a list and must not learn that a plugin system exists. So the
 * agreement is still proved where the two ends meet, which is now the
 * `chat/session-start` waterfall a server half pushes its thunk onto
 * ({@link ./services.ts}'s `SessionStart`) rather than a `probesOf` over a
 * compiled-in list. It is the same trade {@link ./browser.ts}'s four services
 * make in the other direction: a plugin re-declares only the part it reads, and
 * contravariance makes the narrower spelling the stronger claim.
 *
 * ## IT WENT TO `@olai/acp` FOR A REVISION, AND CAME BACK
 *
 * The agents phase read it as a shape TWO WALLS needed — an engine plugin
 * saying how to get itself, and `olai-plugin-chat` saying what an absent MCP server
 * was — and moved it to the floor package under both. The second reader turned
 * out not to exist: an engine's install sentence is drawn by that engine's own
 * BROWSER half out of a slot, so no server-side registration ever needed the
 * shape, and `olai-plugin-chat` had gone on declaring its own copy the whole time
 * (`servers.ts`, the contravariant re-spelling this header argues for).
 *
 * So it is back here, beside the probe that is its only reader, and
 * `@olai/acp`'s door is the poorer for one fewer word that was never the
 * protocol's. An engine plugin that wants the shape for its install sentence
 * takes it from HERE, which it already imports for `Agents`.
 *
 * `why` IS A WHOLE SENTENCE and nothing composes around it. The words belong to
 * whoever found out — the five ways a padi can fail are `olai-plugin-kolu`'s to
 * word, and where to get opencode is `olai-plugin-opencode`'s — because a
 * sentence built out of a core template with a plugin's noun dropped into it is
 * a debug log line on a screen. **Core displays a sentence and never composes
 * one.**
 */

/**
 * SOMETHING THIS HOST DOES NOT HAVE, and what a person is owed about it.
 *
 * `where` is where the thing WOULD be, in whichever way makes sense for it: the
 * file a probe asked for, or the page a person downloads it from. `null` for the
 * ways of being absent that name no place at all.
 */
export interface NotHere {
  readonly name: string
  readonly where: string | null
  readonly why: string
}

/** WHAT A PROBE FOUND — both halves at once, because they are one reading.
 *
 *  Two fields rather than a union, and it is an invariant with an incident
 *  behind it (`olai-plugin-chat`'s `agent.ts`: one probe, two reads). A registry
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
 * claims the key equal to its own composed word ({@link ./services.ts}'s
 * `Kinds.register`, which sets `claims` to the word it just composed out of the
 * registering fiber's name), so an enabled plugin declares `kolu-terminal` /
 * `odu-worktree` for
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
 * between them is what `--plugins` means one more time (`@olai/server`'s
 * `propKinds.ts`). It used to be one function over two lists a composition root
 * held; it is two READINGS now, and the split is the phase rather than a
 * refactor — the ENABLED half is what the mounted fibers registered
 * ({@link ./services.ts}'s `Kinds`), and the BUILT half is read off every row of
 * the bundle INCLUDING the rows this serve disabled (`@olai/bundle`'s
 * `declaredKinds`), because a disabled row never mounts and its words still have
 * to be reachable. A DECLARATION is refused against every kind this BINARY was built
 * with, so `{"type":"kolu-terminal"}` is a legal row on a serve running only odu and
 * `{"type":"banana"}` is refused naming every legal word; a VALUE is held to
 * the kinds this serve is RUNNING, because {@link PropKind.admits} is a promise
 * only a plugin that is here can make. A file's verdict may not depend on a
 * flag on the machine, and that split is the whole of how it does not.
 *
 * ## It is registered on the SERVER door
 *
 * Declared here, because a kind is part of what a plugin IS. Registered through
 * {@link ./services.ts}'s `Kinds`, for the reason the probe is a
 * `chat/session-start` listener on that same door: the vocabulary is spent by
 * the validator and the write planner, which is a process that renders nothing,
 * and everything of this plugin that carries SolidJS is in its BROWSER half — a
 * chunk the server never fetches and never evaluates. The browser needs none of
 * it — a vault's declarations deliberately do not travel (`@olai/format`'s
 * `meaning.ts`). What the browser gets instead is the same consult's ANSWER per
 * drawn value, which is what the KIND-KEYED slots one floor up are keyed by
 * ({@link ./browser.ts}'s `SLOTS`, the three rows whose `keyedBy` is `"kind"`):
 * the WORD, never the property key.
 */
export interface PropKind {
  /**
   * THE BARE WORD THIS PLUGIN CONTRIBUTES — `terminal`, not `kolu-terminal`.
   *
   * The SERVICE prefixes it with the registering fiber's own name
   * ({@link kindWordOf}, this file's, called by the `Kinds` service on the server
   * and by `Slots` in the tab so that one word cannot become two spellings), so
   * what a vault declares is `kolu-terminal` and what the page's licence carries
   * is the same. It is the move the wire already makes
   * with a member — a plugin declares `fleet` and the framework composes
   * `surface/kolu/fleet/get` — and it buys the same two things here:
   *
   *   - two plugins cannot collide on a word, because two names cannot; and
   *   - a plugin's BUILT-IN declaration can only ever claim a key carrying its
   *     own name, so enabling one can never take over a column somebody has
   *     been using for something of their own.
   *
   * THE BARE WORD MAY ITSELF CARRY A HYPHEN — chat's is `agent-session`, and
   * what a vault declares is `chat-agent-session`. The separator is fenced out
   * of the PLUGIN half only, which is where the whole of the injectivity lives;
   * {@link kindWordOf}'s body argues that asymmetry and names its one cost.
   *
   * A plugin writes the bare word once and the composition happens where the
   * plugin's own name is: inside the service, minted from the word the registry
   * bound it under, never off an argument a caller supplied. What each plugin
   * does spell for itself is a copy of that composition for its own vault walk —
   * a constant beside the bare word (`olai-plugin-odu`'s `WORKTREE_TYPE`), which
   * it wrote when it could not import this package at all and still writes now
   * that it can, because the walk wants the composed word at module scope and a
   * registration has not happened yet there. `@olai/bundle`'s `kinds.test.ts`
   * holds the two spellings equal.
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
 * THE HELD DOOR — one opaque record per plugin per vault.
 *
 * Core does not open it. The plugin parses what it wrote.
 */
export interface PluginHeld {
  readonly load: () => Record<string, unknown> | null
  readonly save: (value: Record<string, unknown>) => void
}

/**
 * ONE PROPERTY, WRITTEN — the narrowest door onto the vault's write gate, and
 * deliberately not the gate itself.
 *
 * The two gestures that bind a node to a conversation are a property write plus
 * something else: *start an agent session* opens the conversation and then names
 * it on the node, and *assign to node…* names one that already exists and then
 * marks it. Both used to be composed in `@olai/server`'s `runtime.ts`, because
 * that was the only place both halves were in hand — the chat's verb and the ops
 * layer's request. A plugin that owns the first half needs the second.
 *
 * WHAT IT IS NOT is `@olai/ops`' `Ops`, handed over. A plugin holding the write
 * gate could trash a node, move a subtree or empty an archive; what these two
 * gestures do is set ONE key on ONE node, and a door shaped like the gesture is a
 * door with nothing else behind it. The write still goes through the same
 * planner, the same validator and the same ledger commit a keystroke does —
 * this is the narrowing of WHAT may be asked, not of who judges it.
 */
export interface PropWrite {
  /** The node the key is set on. */
  readonly node: string
  /** The property's key, as the vault spells it. */
  readonly key: string
  /** ...and its value, whole. Not conditional: a caller that wanted
   *  compare-and-set would be asking for a second decision this door does not
   *  make. */
  readonly value: string
}

/**
 * A REFUSAL, AS THE WRITE GATE ANSWERS ONE — `@olai/format`'s `OpFailure`,
 * spelled structurally.
 *
 * Re-declared rather than imported, for {@link ../services.ts}'s `ToolServer`
 * reason and `Vault.revision`'s: this package does not depend on `@olai/format`,
 * because the vault's grammar travels to a plugin as DATA and a floor package
 * importing the vocabulary would be the format learning what a terminal is. What
 * survives the structural spelling is the one field Effect's own narrowing uses —
 * error matching in this tree is `_tag`-structural precisely so two module
 * instances cannot stop recognising each other's classes — so a plugin that
 * imports `@olai/format` itself (every plugin that writes does) narrows this to
 * the real union at its own edge, once, and says so where it does it.
 */
export interface Refusal {
  readonly _tag: string
}

/** ...AND ONE THIS SERVE ACTUALLY REFUSED, as a plugin watching writes is told.
 *
 *  `op` is the ops request's own verb (`set_prop`, `add_node`, …) and is a word
 *  rather than a union for the reason above: the vocabulary is the ops layer's,
 *  and a copy of it here would be a second list to keep in step. */
export interface Refused {
  readonly op: string
  readonly failure: Refusal
}

/**
 * WHAT HAPPENED IN A CONVERSATION, as a plugin that mirrors one is told.
 *
 * Three kinds, and none of them is a human message. `delivered` is a doorbell
 * that actually went into the conversation (the thunk answered, the row was
 * written). `replied` is an orchestrator turn that settled, with the full
 * reply. `turn` is the ephemeral working signal, start and end.
 */
export type ConversationSeen =
  | {
    readonly kind: "delivered"
    /** The transcript row, so a later mark on the same doorbell is not a second digest. */
    readonly id: string
    readonly from: string
    readonly agent: string
    readonly session: string
    readonly body: string
  }
  | {
    readonly kind: "replied"
    /** The agent row THIS turn produced — not the newest agent row in the transcript. */
    readonly id: string
    readonly agent: string
    readonly session: string
    readonly text: string
  }
  | {
    readonly kind: "turn"
    readonly agent: string
    readonly session: string
    readonly status: "working" | "done"
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
 * way `olai-plugin-chat`'s note already spells it rather than minted a second time.
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
    /** A derived node-agent scope. Absent means a person picked the whole file
     * for an unassigned conversation. */
    readonly under?: string
  }>
  /** The scopes that hear a claim made by `node` in `file`. Manual whole-file
   * scopes all hear it; among nested node scopes only the nearest ancestor does.
   * ONE ANSWER BEHIND ONE DOOR, so every doorbell asks the same question and
   * none of them spells the precedence: it is the row that OFFERS `deliveries`
   * that owns it, which is the chat's, and it was core's while the chat was. */
  readonly ringing: (
    file: string,
    node: string,
  ) => ReturnType<Deliveries["scopes"]>
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
   * AN EFFECT THAT CANNOT FAIL, which is the same "fire and forget" the two log
   * channels beside it once were, said in the type. It is an Effect because BOTH
   * ends of it are one: `olai-plugin-chat`'s own door hands one back, and a plugin
   * `yield*`s it from inside its own fiber. It used to answer `void`, which meant
   * a composition root stood between the two forking the chat's Effect for the
   * plugin — a bridge with a fiber on both sides of it, and the one place a
   * dropped return value was silent.
   *
   * `never` in the error channel is the honest half rather than an omission: the
   * caller is a doorbell with nowhere to put a refusal, and there is no arm of
   * the three below a plugin would answer differently.
   *
   * THE BODY MUST CARRY ITS OWN ATTRIBUTION, and this is the one thing this door
   * asks of the words. Core marks the row, and the mark is a live affordance the
   * browser draws a face from — but a conversation resumed from the agent's own
   * store rebuilds its rows out of message chunks, and the mark is not among
   * them. So the WORDS have to say who is speaking, or a replayed transcript
   * puts the plugin's words in the person's mouth.
   *
   * CARRY, not OPEN, and the difference is one a round of use taught. The rule
   * said the first line, and the panel draws a mark and a byline above the row —
   * so a first line that named its author spent the one line a glance gets on a
   * question already answered twice above it. Anywhere in the body satisfies the
   * replay, because a replay rebuilds the whole text; the first line is the one
   * a reader gets for free, and it is better spent saying what happened.
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
       * Core files a held slot under the PAIR `(plugin, coalesce)` — `olai-plugin-chat`'s
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
  ) => Effect.Effect<void>
}

/** One plugin's wire half — its sibling key, its surface, and which of its
 *  members each face may see. The three things a composition root needs and
 *  the only three it gets. */
export interface PluginWire {
  readonly name: string
  readonly surface: { readonly spec: unknown }
  readonly faces: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}

/**
 * THE SIBLING MAP — what `composeSurfaceContracts`, `implementRootedSurfaces`,
 * `exposeRootedFaces` and `connectSurfaces` all take, out of whatever list of
 * plugin halves the caller is holding.
 *
 * Keyed by the plugin's own name, which IS the wire prefix: a member declared
 * `fleet` in `olai-plugin-kolu` is `surface/kolu/fleet/get` on the wire, and
 * nothing computed that string but the framework.
 *
 * ## Why it lives on the SHARED CONTRACT and not in the registry
 *
 * It was `@olai/bundle`'s, beside a compiled-in `WIRES` it was nearly always
 * called on — which made it look like a reading of the registry. It never was:
 * both callers today hand it a list they got somewhere else (the SERVE hands it
 * what its fibers registered, the TAB hands it what the roster told it to
 * load), and neither of them can reach a registry. What is left in the registry
 * is the ROWS; this is a reading of `PluginWire`, so it belongs beside
 * `PluginWire`.
 *
 * A plugin left out of the list is simply ABSENT from the record — no tag, no
 * handler, no expose row, no `surface/<name>/` on the wire at all — which is
 * what makes "disabled means absent" a property of the caller's list rather
 * than a mechanism anybody has to write.
 */
export const surfacesOf = (
  plugins: ReadonlyArray<PluginWire>,
): Record<string, PluginWire["surface"]> =>
  Object.fromEntries(plugins.map((plugin) => [plugin.name, plugin.surface]))

/**
 * ...and the expose maps for ONE face, keyed the same way — what the gate takes
 * beside the sibling map.
 *
 * One map per sibling rather than one map with dotted paths, which is the
 * framework's own shape and its reason is worth keeping in view: a sibling's
 * map is written against that sibling's own spec, which is what keeps the keys
 * compiler-checked and what stops `"a.b"` meaning two things depending on
 * whether `a` is a namespace or a sibling.
 *
 * A plugin that says nothing about this face is ABSENT from the result rather
 * than present-and-empty, and the difference is the whole default-deny
 * contract: the gate denies a sibling with no map in full, which is what a
 * plugin that never mentioned the agent's face means.
 */
export const exposeMapsOf = (
  plugins: ReadonlyArray<PluginWire>,
  face: string,
): Record<string, Readonly<Record<string, unknown>>> =>
  Object.fromEntries(
    plugins.flatMap((plugin) => {
      const map = plugin.faces[face]
      return map === undefined ? [] : [[plugin.name, map] as const]
    }),
  )


/**
 * A PLUGIN-OWNED WORD, PREFIXED WITH THE PLUGIN'S NAME — the one composition,
 * and the reason plugin-owned names cannot collide or capture.
 *
 * kolu contributes the bare kind `terminal` and a vault declares
 * `kolu-terminal`. It is the same move the wire makes with a member — a plugin
 * declares `fleet` and the framework composes `surface/kolu/fleet/get` — and it
 * is here for the same two reasons:
 *
 *   - **collisions become unreachable.** Two plugins that both contribute
 *     `terminal` compose to two different words. The assembly counts anyway
 *     (`./services.ts`'s `Kinds` counts them at registration), because a proof nobody re-checks is the class
 *     of thing this repo keeps turning into a test.
 *   - **and so does CAPTURE**, which is the sharper one and is why the human
 *     ruled it. A plugin's built-in declaration claims the key equal to its own
 *     composed word, so enabling kolu can only ever declare `kolu-terminal`. A
 *     person's own `terminal` column is not something a flag on the machine can
 *     take over — and a board that WANTS the short key writes one row saying so
 *     (`{"title":"terminal","custom":{"type":"kolu-terminal"}}`), which is the
 *     user's key, the plugin's kind, and the user's own file.
 *
 * ON THE SHARED CONTRACT because all three doors compose one: the server
 * assembles the vocabulary, the browser registers the dressings, and neither
 * may spell the rule for itself. A plugin CAN read it now — this package names
 * no plugin, so the arrow that used to forbid the import is gone — and each
 * still spells its own composed word from its own `name` for its own walk,
 * because a plugin's walk runs where core's table is not; `@olai/bundle`'s
 * `kinds.test.ts` holds the two spellings equal.
 *
 * THE SEPARATOR IS FORBIDDEN INSIDE THE PLUGIN HALF — that half alone, and the
 * asymmetry is what makes the composition injective and the collision
 * unreachable rather than merely counted. It used to be forbidden inside BOTH,
 * and the argument for that was sound but stronger than it needed to be; the
 * body says which half, why, and what the human's `chat-agent-session` ruling
 * costs a plugin whose own name carries a hyphen.
 */
export const KIND_SEPARATOR = "-"

export const kindWordOf = (plugin: string, kind: string): string => {
  // NEITHER HALF MAY BE EMPTY, and this is not hygiene — it is half of the
  // proof below. An empty plugin name would put the joint at index 0 and an
  // empty kind would leave nothing after it, so either way the word names a
  // half that is not there, and it would still be a legal `type` for a vault to
  // write.
  for (const [what, segment] of [["plugin name", plugin], ["kind", kind]] as const) {
    if (segment.length === 0) {
      throw new Error(`plugins: a ${what} may not be empty — it is half of a composed kind word.`)
    }
  }
  // ONE HALF MUST CARRY NO SEPARATOR, AND IT IS THE PLUGIN'S.
  //
  // The argument this refusal was born with is still true and is exactly why
  // one half stays fenced: without a fence the composition is AMBIGUOUS, and
  // ambiguity is what makes a collision possible at all. `kindWordOf("ab",
  // "c-d")` and `kindWordOf("ab-c", "d")` both spell `ab-c-d`, so two plugins
  // whose names genuinely differ could still land on one word — the count in
  // `./services.ts`'s `Kinds` would catch it, but a refusal about a word
  // neither author wrote is a refusal nobody can act on.
  //
  // What that argument does not establish is that BOTH halves need the fence,
  // which is what this function used to refuse. Fix the split direction — a
  // composed word decomposes at its FIRST separator — and fencing the plugin
  // half alone is sufficient: the first separator in `${plugin}-${kind}` is
  // then always the joint, the prefix before it is the whole plugin name and
  // the rest is the whole kind, so the pair is recovered from the word and no
  // two pairs can spell one. That is injectivity, and `@olai/bundle`'s
  // `kinds.test.ts` holds it as a round-trip rather than as this paragraph.
  //
  // WHY THE PLUGIN HALF AND NOT THE KIND: because the human ruled the word.
  // Chat contributes the bare kind `agent-session` and a vault declares
  // `chat-agent-session`, with existing vaults keeping their bare key by one
  // row, `{"title":"agent-session","custom":{"type":"chat-agent-session"}}`. A
  // kind fenced against the separator makes that spelling unconstructible, and
  // the honest alternative — rename the bare kind to `session` and let the row
  // read `chat-session` — is a spelling the human did not rule. It is also the
  // wrong half to fence on the merits: a kind word is a plugin author's noun
  // and hyphens are how English nouns compound, while a plugin name is already
  // a wire sibling key with a grammar of its own.
  //
  // AND WHAT IT COSTS, said plainly because it is a real loss: A PLUGIN WHOSE
  // NAME CARRIES A HYPHEN MAY NO LONGER CONTRIBUTE A KIND AT ALL. A name is
  // held to `/^[a-z][a-z0-9-]*$/` (`@olai/bundle`'s `fence.test.ts`), which
  // admits one, and `xyne-spaces` in this tree has one. It registers no kind
  // today, so this build refuses nothing; a hyphenated plugin that later wants
  // a word must be renamed first. The alternative was to narrow the plugin-name
  // grammar to a hyphen-free word for everyone, and that is a rename of a
  // shipped sibling key — its tags, its preferences row, its docs slug, its
  // `olai.yml` row — charged to every plugin to buy a fence only the
  // kind-contributing ones need. So it is refused HERE, where the name is
  // spent, and the message names the plugin, so an author reads it about their
  // own plugin rather than about the grammar.
  if (plugin.includes(KIND_SEPARATOR)) {
    throw new Error(
      `plugins: the plugin name "${plugin}" carries "${KIND_SEPARATOR}", which is the ` +
        "separator a kind word is composed with, and the plugin name is the half that may " +
        "not carry it — a composed word is split at its FIRST separator, so a name carrying " +
        "one would leave two plugins' words indistinguishable. A plugin whose name has a " +
        "hyphen contributes no kind; rename the plugin, or contribute none.",
    )
  }
  return `${plugin}${KIND_SEPARATOR}${kind}`
}

/*
 * THE ENABLEMENT FILTER IS GONE, and where it went is the phase.
 *
 * `enabled(plugins, names)` and `isEnabled(names, name)` lived here: a filter
 * over a list of halves, and the same question asked about one name. They were
 * the whole of how a serve decided which plugins ran, and they were on the
 * INTERFACE package — the one a plugin is written against — because everything
 * that composed a roster read them.
 *
 * Nothing calls either. `--plugins` is a `disabled` PATCH over rows now
 * (`@olai/bundle`'s `pluginsPatch`, applied by `@cordisjs/plugin-include` on
 * the way in), so a plugin that is off is never loaded rather than filtered out
 * of a list — and the preferences row that needed `isEnabled` reads a state
 * word off the roster cell instead.
 *
 * They are deleted rather than kept for a caller who might return, and the
 * reason is that they are the RETIRED answer to a question this tree still
 * asks. Left here they would be the most discoverable one: whoever adds the
 * third reading of enablement — the writable roster is a later phase — would
 * find a filter on the interface package before they found the patch, and it
 * would be the wrong shape for a mechanism whose whole point is that a
 * disabled row never mounts.
 */

/**
 * THE DOORBELL'S SENTENCE, when this plugin wakes conversations — in PIECES,
 * because core draws the control between them.
 *
 * The strip row reads `<subject> · <from> <the picker>`, and with nothing
 * picked it reads `<subject> · off`. Core owns the row, the picker and the
 * numeral; it composes no clause of its own, which is why the drawn half of
 * this is three strings and not one. A single sentence with a hole in it
 * would make core the author of everything around the hole, and the four ways
 * a wake could be described have nothing in common but that they are wakes —
 * the same argument {@link NotHere}'s `why` makes one door over, and the
 * third time this tree has spent it.
 *
 * {@link Wake.faults} is the same rule read from the other end: none of those
 * is drawn anywhere, so each is one whole sentence rather than pieces, and
 * core carries the one the cause names into a conversation without joining
 * anything to it.
 *
 * SUBJECT FIRST. What is being woken ON is the subject, and the file is the
 * FILTER over it — a control that led with the file would be describing its own
 * mechanism to somebody who wants to know what it does.
 *
 * `waiting` is the same rule where a COUNT is involved: core holds the bodies,
 * so core knows the number and only the number. The plugin says what its
 * bodies ARE, in both grammatical numbers, because a tree that stored one form
 * and added an `s` would be a tree that had decided what the noun is.
 *
 * REGISTERED ON THE SERVER DOOR ({@link ./services.ts}'s `Wakes`) and never
 * hung in a browser slot, for {@link PropKind}'s reason: the declaration has a
 * SERVER reader — the member that writes a scope refuses a plugin that declares
 * no wake, and it reads this off what the mounted fibers registered — and a
 * composition root that reached for a plugin's faces to find it would put a UI
 * runtime on the graph of a process that renders nothing. It was a FIELD on the
 * server half (`PluginServerHalf.wake`) read off every built row; a
 * registration is the same declaration made by a fiber that is actually here,
 * which is what {@link ./services.ts}'s `Wakes` argues.
 *
 * Absent is a plugin that wakes nobody, which is a whole plugin: no strip
 * row, no picker, no doorbell — the state every machine without the tool
 * is already in.
 */
export interface Wake {
  /** What the wake is ON. "wake on terminal activity". */
  readonly subject: string
  /** What the file IS, as a lead-in to the picker. "terminals from". */
  readonly from: string
  /** What this plugin's held bodies are, in the plugin's own words and in both
 *  numbers — core supplies the numeral and joins them, and that is the whole
 *  of core's authorship on the strip. */
  readonly waiting: { readonly one: string; readonly many: string }
  /**
 * WHICH KINDS OF SERVED FILE THIS WAKE CAN BE SCOPED TO — `@olai/format`'s
 * own file-kind words (`kinds.ts`: `outline`, `document`, `hypertext`,
 * `csv`, `image`, `pdf`), as data.
 *
 * ## Why the plugin answers this and core does not
 *
 * A scope is a FILTER, and only the thing doing the filtering knows what it
 * reads out of a file. kolu derives its claimed set from the `kolu-terminal`
 * values on a file's un-done NODES, so a file that holds no nodes derives
 * the empty set for ever — a doorbell that never rings, never digests, and
 * goes on being beaten for, which is quiet-because-broken wearing
 * quiet-and-fine's face. That is the plugin's fact about the plugin's own
 * derivation; core stores a path and never opens it.
 *
 * So the picker offers the kinds named here and no others (`@olai/web`'s
 * `chat/scopable.ts`), and a scope already stored on some other kind is a
 * FAULT rather than a silence ({@link unwatchable}). Before this field the
 * picker offered every file the directory served, `.md` included, and the
 * human's screenshot of it is what this member exists for.
 *
 * ## Words rather than a predicate, because it has to TRAVEL
 *
 * `PropKind.admits` is a function because its one reader is in this process.
 * The picker is in a browser, so what crosses is DATA — the same move
 * everything else on this member makes, carried on the roster
 * (`@olai/surface`'s `BuiltPlugin`'s `wake.kinds`) and read against the same
 * registry at the other end.
 *
 * NON-EMPTY, because a wake that admits no kind is a control nobody could
 * ever point at anything: the picker would draw, open, and offer nothing.
 * The words are plain strings HERE — this package declares no dependency on
 * the format, the way it declares none on the wire. A plugin that can see
 * `@olai/format` types its own list against the union that matches what it
 * walks. Kolu's is `NodeKind`, the record-holding kinds: `FileKind` is every
 * kind the registry claims, documents included, and that is the bound this
 * field's first cut offered and this round retired.
 */
  readonly kinds: readonly [string, ...Array<string>]
  /**
 * WHAT A CONVERSATION IS TOLD WHEN THIS DOORBELL STOPS WATCHING — one WHOLE
 * sentence per WAY THAT CAN HAPPEN, keyed by the way's own word.
 *
 * ## A TABLE AND NOT TWO FIELDS, which is the difference between a wrong
 * sentence and a compile error
 *
 * Core does not choose between these; it INDEXES them, by the cause its own
 * walk recorded on the row (`olai-plugin-chat`'s `Scoped.fault`, which travels as
 * `@olai/surface`'s `Wake.fault`). That is the whole reason the keys are the
 * cause's own words rather than two prose-shaped names: a third way for a
 * doorbell to stop watching adds a member to that union, and every plugin's
 * declaration goes red naming the sentence it now owes — where a pair of
 * sibling fields and a ternary at the composition root would fall through to
 * whichever one the else-arm happened to hold, and tell somebody their file
 * had been renamed while it sat in front of them. It is `@olai/format`'s own
 * discipline for its kind table, spent one package up: the registry decides,
 * the surfaces owe an answer per row, and the type checker names the debt.
 *
 * ## Whole sentences, because there is no control to draw between their
 * halves
 *
 * ## Why this one is not in pieces when the three above are
 *
 * The three above are pieces because core draws a PICKER between them: the
 * row is `<subject> · <from> <the picker>`, and core owns the arrangement.
 * This is not drawn anywhere. It is a MESSAGE, put into a conversation
 * through the door core already built for this plugin, and a message is
 * whole authored paragraphs or it is core writing prose
 * (`olai-plugin-chat`'s `deliveries.ts`, whose `joined` joins them and composes
 * none). So core carries this string and delivers it: no lead-in, no
 * count, no naming of the file, no abbreviation.
 *
 * It NAMES NO FILE for that reason, which is the one thing a reader will
 * notice is missing. Core knows the path — it stores it — but a sentence
 * with core's hole punched in it is the shape this whole field exists to
 * refuse, and the person reading is looking at a strip that draws the path
 * beside the words. What the sentence has to say is what the plugin knows
 * and core does not: that nothing is being watched now.
 *
 * ## Why the TABLE is required where the WAKE itself is not
 * ({@link ./services.ts}'s `Wakes.register`, which a plugin may simply never
 * call)
 *
 * A plugin that wakes nobody declares no `wake` at all and is a whole
 * plugin. A plugin that DOES wake has scoped conversations; a scoped
 * conversation's file can be renamed out from under it, and a stored pick
 * can name any path at all — so there is no plugin for which either row is
 * inapplicable, and an optional one would be a plugin that rings and then,
 * on the one day it matters, says nothing.
 *
 * ## IT USED TO BE NOTHING AT ALL, and the silence was the defect
 *
 * A person scopes a conversation to `lanes.olai`; somebody renames the
 * file. The doorbell's derivation is a pure function of the revision and
 * finds no such file, so it derives nothing — forever — while the strip
 * goes on drawing the control as ON. That silence is byte for byte the
 * silence of a fleet with nothing standing, on every channel there is, and
 * this PR retires the hand-run fleet watch that was the second opinion. A
 * quiet doorbell and a broken one must not look alike, so the broken one
 * says so, once, in the conversation it stopped ringing
 * (`olai-plugin-chat`'s `Chat.faults`).
 */
  readonly faults: {
    /** THE FILE IS NOT SERVED ANY MORE — renamed, moved or deleted while the
     *  doorbell was on it. The common one, and the one this whole fault path
     *  was first built for. */
    readonly gone: string
    /**
     * ...AND THE FILE IS RIGHT THERE AND IS NOT A KIND THIS WAKE CAN WATCH —
     * {@link kinds}' other half.
     *
     * TWO SENTENCES AND NEVER ONE WITH AN *or* IN IT. The consequence is
     * identical — nothing is watched, nothing is derived, and the row leaves
     * this plugin's door so that no heartbeat can go on claiming a live watch
     * over it — but WHAT HAPPENED is not, and a person reading either one has
     * a different thing to do about it. A single sentence covering both would
     * say *renamed, or moved, or deleted, or not an outline* on every rename
     * for ever: the message paying, in the common case, for a state that only
     * a stored pick can be in.
     *
     * HOW A CONVERSATION GETS INTO IT AT ALL, now the picker cannot. The
     * picker offers only {@link kinds}, so nothing a person presses today can
     * reach this. What can: a pick stored before that filter existed (the
     * `2026-09-01.md` in the human's screenshot), a tab left open from an
     * older serve, and a record edited by hand. All three are a row on disk
     * that outlives a picker-only fix, which is why this is a fault the serve
     * DERIVES per revision rather than a refusal at the write.
     */
    readonly unwatchable: string
  }
}

/**
 * WHERE A SESSION IS SEATED — the subtree its writes are fenced to, and the keys
 * it may not touch inside it.
 *
 * Re-declared here for {@link Refusal}'s reason: the shape is
 * `@olai/server`'s (`mcp/tickets.ts`), and it is three fields of strings that
 * both ends have to spell. Contravariance makes the agreement the strong
 * direction — whoever completes the ticket door hands over a value that has to
 * satisfy both spellings at the composition root, so a drift is a type error in
 * the one file that holds both.
 *
 * `forbidden` is inside the fence rather than beside it: a node agent may write
 * anywhere under its own node and still may not rewrite the property that says
 * WHICH conversation it is, because that is the binding rather than the work.
 */
export interface Seated {
  readonly under: string
  readonly forbidden: ReadonlyArray<string>
}

/** ...AND THE CREDENTIAL ITSELF. `release` is the session's teardown, which is
 *  why this is a value and not a string: reaping a node scope drops its MCP
 *  footprint in the same breath. */
export interface MintedTicket {
  readonly bearer: string
  readonly release: () => void
}

/** WHAT A WRITE IS REFUSED WITH where there is no vault to write to at all — the
 *  bench arm of {@link ../services.ts}'s `Ops.prop`, said once here so the door
 *  does not compose a sentence inside a provision. */
export const NOWHERE_TO_WRITE: Refusal & { readonly reason: string } = {
  _tag: "UsageFailure",
  reason: "this process is serving no directory, so there is nothing to write to",
}

/** ...AND WHAT A CREDENTIAL IS where there is no MCP face to narrow — the bench
 *  and headless arm of {@link ../services.ts}'s `Tools.ticket`. The bearer is
 *  empty rather than absent so the type stays one shape: a caller that must not
 *  seat a session unfenced tests the string, and the one caller in this tree
 *  does. */
export const NO_TICKET: MintedTicket = { bearer: "", release: () => {} }
