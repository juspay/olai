import type { Effect } from "effect"
export interface StdioServer {
  readonly name: string
  /** Absolute: the file that answered the probe. */
  readonly command: string
  readonly args: ReadonlyArray<string>
  /** What to set when launching it, beyond what it inherits. */
  readonly env: Readonly<Record<string, string>>
}

/** What a probe found — both halves of one reading. */
export interface Probed {
  readonly server: StdioServer | null
  /**
   * What a person is owed about the one they did not get, or `null` where the
   * absence is ordinary and no fault. `where` is where the thing WOULD be — the
   * file a probe asked for, or the page it is downloaded from — and `null` for
   * an absence that names no place at all.
   */
  readonly missing: {
    readonly name: string
    readonly where: string | null
    readonly why: string
  } | null
  /**
   * Where in this app a person sees what the server works on — an app address
   * such as `/browser` — or absent where there is nothing to look at.
   */
  readonly at?: string
}

export interface PropKind {
  /**
   * The bare word this plugin contributes — `terminal`, not `kolu-terminal`;
   * {@link kindWordOf} composes it with the registering plugin's name. The bare
   * word may itself carry a hyphen; the plugin name may not.
   */
  readonly kind: string
  /** What the clause naming this kind says in a refusal — `` `kolu-terminal` (a
   *  padi terminal id)``. It names the COMPOSED word. */
  readonly takes: string
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
 * What happened in a conversation, as a plugin that mirrors one is told. None
 * of the three is a human message.
 */
export type ConversationSeen =
  | {
    readonly kind: "delivered"
    /** The transcript row this doorbell was written as. */
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

/** A delivery address and the lifetime that still authorizes its use — pass the
 * whole recipient on, between readers and into async work. */
export interface DeliveryRecipient {
  readonly agent: string
  readonly session: string
  readonly current: () => boolean
}

export interface Deliveries {
  /** Addressed notices from delivery-only plugins, such as transport failures. A
   * plugin that declares a selectable wake uses its issued recipient instead. */
  readonly notify: (
    to: { readonly agent: string; readonly session: string },
    say: () => string | null,
    options?: { readonly coalesce?: string },
  ) => Effect.Effect<void>
  /** The conversations that chose this plugin, read synchronously. `pick` is the
   * browser-written choice, opaque to chat, and `null` on a delivery-only
   * plugin's node address. */
  readonly scopes: () => ReadonlyArray<DeliveryRecipient & { readonly pick: (typeof import("effect").Schema.Json)["Type"] }>
  /**
   * One machine-marked message into one conversation. THE BODY MUST CARRY ITS
   * OWN ATTRIBUTION: a conversation replayed from the agent's own store rebuilds
   * its rows out of message chunks and the mark is not among them. Which of
   * core's three arms a body took is not reported back.
   */
  readonly deliver: (
    to: DeliveryRecipient,
    /**
     * The words, composed at the moment they enter the conversation rather than
     * when this was called: a body can wait through a running turn, or until
     * somebody opens the conversation. `null` drops the delivery.
     */
    say: () => string | null,
    options?: {
      /**
       * This turn is olai's own and nobody's question to answer: the alert faces
       * are suppressed and the busy cue keeps saying "working" for the span of
       * the turn, however it ends.
       */
      readonly sleep?: true
      /**
       * Messages sharing a key, while still undelivered, replace each other in
       * place. The key is scoped to the calling plugin. A body sent with no key
       * never replaces and is never replaced.
       */
      readonly coalesce?: string
    },
  ) => Effect.Effect<void>
}

export interface PluginWire {
  readonly name: string
  readonly surface: { readonly spec: unknown }
  readonly faces: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}

/**
 * The sibling map, keyed by the plugin's own name, which IS the wire prefix: a
 * member declared `fleet` in `olai-plugin-kolu` is `surface/kolu/fleet/get` on
 * the wire. A plugin left out of the list is absent from the record.
 */
export const surfacesOf = (
  plugins: ReadonlyArray<PluginWire>,
): Record<string, PluginWire["surface"]> =>
  Object.fromEntries(plugins.map((plugin) => [plugin.name, plugin.surface]))

/**
 * ...and the expose maps for ONE face, keyed the same way. A plugin that says
 * nothing about this face is ABSENT from the result rather than
 * present-and-empty.
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
