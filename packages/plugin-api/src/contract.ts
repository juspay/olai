import type { Effect } from "effect"
export interface StdioServer {
  readonly name: string
  /** Absolute: the file that answered the probe, not a word to resolve again. */
  readonly command: string
  readonly args: ReadonlyArray<string>
  /** What to set when launching it, beyond what it inherits. */
  readonly env: Readonly<Record<string, string>>
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
  /**
   * WHAT A PERSON IS OWED about the one they did not get, or `null` where an
   * absence is the ordinary case and no fault.
   *
   * `where` is where the thing WOULD be, in whichever way makes sense for it:
   * the file a probe asked for, or the page a person downloads it from. `null`
   * for the ways of being absent that name no place at all.
   */
  readonly missing: {
    readonly name: string
    readonly where: string | null
    readonly why: string
  } | null
  /**
   * WHERE IN THIS APP A PERSON SEES WHAT THE SERVER WORKS ON — an app address
   * such as `/browser` — or absent where there is nothing to look at.
   *
   * It is the probing plugin's own page, named by the plugin that owns it, so
   * a roster can draw the server as a link without learning what the server
   * is: chat renders the chip as an anchor and knows nothing about browsing.
   */
  readonly at?: string
}

export interface PropKind {
  /**
   * THE BARE WORD THIS PLUGIN CONTRIBUTES — `terminal`, not `kolu-terminal`.
   *
   * The SERVICE prefixes it with the registering fiber's own name
   * ({@link kindWordOf}), so what a vault declares is `kolu-terminal` and what
   * the page's licence carries is the same:
   *
   *   - two plugins cannot collide on a word, because two names cannot; and
   *   - a plugin's BUILT-IN declaration can only ever claim a key carrying its
   *     own name, so enabling one can never take over a column somebody has
   *     been using for something of their own.
   *
   * THE BARE WORD MAY ITSELF CARRY A HYPHEN — chat's is `agent-session`, and
   * what a vault declares is `chat-agent-session`. The separator is fenced out
   * of the PLUGIN half only.
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

export interface PropWrite {
  readonly node: string
  readonly key: string
  readonly value: string
}

export interface Refusal {
  readonly _tag: string
}

export interface Refused {
  readonly op: string
  readonly failure: Refusal
  readonly writer: string
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

/** A delivery address and the lifetime that still authorizes its use. Retain
 * this capability when passing a recipient between readers and async work. */
export interface DeliveryRecipient {
  readonly agent: string
  readonly session: string
  readonly current: () => boolean
}

export interface Deliveries {
  /** Addressed notices from delivery-only plugins, such as transport failures.
   * A plugin declaring a selectable wake must use its issued recipient instead. */
  readonly notify: (
    to: { readonly agent: string; readonly session: string },
    say: () => string | null,
    options?: { readonly coalesce?: string },
  ) => Effect.Effect<void>
  /** Registered wakes receive explicit browser-written choices, opaque to chat.
   * Delivery-only plugins receive node conversation addresses with `pick: null`.
   * Pass the whole recipient to `deliver`: `current` carries the authority of
   * that choice or node binding through startup and queued work. Reads are
   * synchronous; successful choice writes persist before publishing new rows.
   */
  readonly scopes: () => ReadonlyArray<DeliveryRecipient & { readonly pick: (typeof import("effect").Schema.Json)["Type"] }>
  /**
   * ONE MACHINE-MARKED MESSAGE INTO ONE CONVERSATION. Core owns the mechanics;
   * the plugin owns every word.
   *
   * WHAT CORE DOES WITH IT, in three arms: a conversation this panel is in whose
   * agent is idle takes it as a turn; one whose agent is mid-turn HOLDS it and
   * lets it in at the turn boundary, behind whatever the human queued first; a
   * conversation nobody is in holds it until somebody opens it, and it arrives
   * as that session's first message. Which arm a body took is not reported back.
   *
   * THE BODY MUST CARRY ITS OWN ATTRIBUTION, and this is the one thing this door
   * asks of the words: a conversation resumed from the agent's own store
   * rebuilds its rows out of message chunks and the mark is not among them, so
   * the WORDS have to say who is speaking. Anywhere in the body satisfies the
   * replay.
   */
  readonly deliver: (
    to: DeliveryRecipient,
    /**
     * THE WORDS, COMPOSED AT THE MOMENT THEY ENTER THE CONVERSATION — not when
     * this was called. A body can WAIT: through a running turn, or until
     * somebody opens the conversation, so a message the agent reads has to be
     * true when it is READ.
     *
     * `null` DROPS THE DELIVERY. Where several bodies were coalescing into one,
     * only the ones that still answer are joined; if none does, no row is
     * written at all.
     */
    say: () => string | null,
    options?: {
      /**
       * THIS TURN IS OLAI'S OWN, and not anybody's question to answer: a pass
       * over a node agent's own memory, where a question asked inside it is
       * cancelled by the pass rather than answered by a person. The flag is
       * read for the span of the turn — it suppresses the alert faces and keeps
       * the busy cue saying "working" — and is cleared when the turn ends,
       * however it ends.
       */
      readonly sleep?: true
      /**
       * MESSAGES SHARING A KEY, WHILE STILL UNDELIVERED, REPLACE EACH OTHER —
       * in place, so the one that lands keeps the position the first one took
       * and arrival order survives the replacing.
       *
       * THE KEY IS SCOPED TO THE PLUGIN, and a plugin never spells that: core
       * files a held slot under the PAIR `(plugin, coalesce)`, so a key is
       * chosen among this plugin's OWN messages and nothing else.
       *
       * A body sent with no key is filed under a fresh identity of core's own:
       * it never replaces and is never replaced.
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
 * `fleet` in `olai-plugin-kolu` is `surface/kolu/fleet/get` on the wire.
 *
 * A plugin left out of the list is simply ABSENT from the record — no tag, no
 * handler, no expose row, no `surface/<name>/` on the wire at all.
 */
export const surfacesOf = (
  plugins: ReadonlyArray<PluginWire>,
): Record<string, PluginWire["surface"]> =>
  Object.fromEntries(plugins.map((plugin) => [plugin.name, plugin.surface]))

/**
 * ...and the expose maps for ONE face, keyed the same way — what the gate takes
 * beside the sibling map. One map per sibling rather than one map with dotted
 * paths, so the keys stay compiler-checked against that sibling's own spec.
 *
 * A plugin that says nothing about this face is ABSENT from the result rather
 * than present-and-empty: the gate denies a sibling with no map in full.
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
 * and the reason plugin-owned names cannot collide or capture. kolu
 * contributes the bare kind `terminal` and a vault declares `kolu-terminal`.
 *
 * THE SEPARATOR IS FORBIDDEN INSIDE THE PLUGIN HALF — that half alone, which
 * is what makes the composition injective.
 */
export const KIND_SEPARATOR = "-"

export const kindWordOf = (plugin: string, kind: string): string => {
  for (const [what, segment] of [["plugin name", plugin], ["kind", kind]] as const) {
    if (segment.length === 0) {
      throw new Error(`plugins: a ${what} may not be empty — it is half of a composed kind word.`)
    }
  }
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

/** Queue words shared with chat. The contributing face owns the pick's meaning. */
export interface Wake {
  readonly subject: string
  readonly waiting: { readonly one: string; readonly many: string }
}

export interface Forbidden {
  readonly key: string
  readonly says: string
}

export interface MintedTicket {
  readonly bearer: string
  readonly release: () => void
}

export const NOWHERE_TO_WRITE: Refusal & { readonly reason: string } = {
  _tag: "UsageFailure",
  reason: "this process is serving no directory, so there is nothing to write to",
}

export const NO_TICKET: MintedTicket = { bearer: "", release: () => {} }
