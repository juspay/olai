/**
 * THE MIRROR'S CHANNELS, joined to another plugin's seating answer.
 *
 * Spaces owns `xyne-channel`, channel selection and reply trimming. It does
 * not own which property seats a node or how the vault declares that property.
 * The old import of chat's kind word made this file repeat that interpretation.
 * Now the server asks `chat.seating` about the same derived snapshot whose
 * channel properties are read below, and this function joins the two answers.
 * A change to chat's binding grammar stays behind its service; a change to
 * Spaces channel policy stays here.
 *
 * The consumer mints a tag with the key and shape it expects. A tag declares
 * a requirement; it does not provide a service or import its implementation.
 * `server.ts` names it in `needs`, so a mirror with no seating provider is
 * `waiting`, with no subscription or sibling registered. It is not a running
 * mirror guessing that nobody is seated. Chat arriving activates it; chat
 * leaving unwinds its registrations; chat returning runs its setup again.
 * Already-posted messages are emissions and cannot be taken back by teardown.
 *
 * Secrets remain in the environment. Channel intent belongs on the node,
 * whose session may change: a seated node without a session is named intent
 * and posts nothing, while a conversation no eligible node claims is ignored.
 */
import { customText, isRegular, type Derived, type NodeAgent } from "@olai/format"
import { serviceTag } from "@olai/plugin-api/services"

/** The mirror needs these seat fields, not the roster's memory counts. */
export type Seats = ReadonlyArray<Pick<NodeAgent, "id" | "file" | "title" | "engine" | "session">>

/** Chat owns the reading and its vocabulary; the consumer names its contract. */
export const Seating = serviceTag<{
  readonly in: (derived: Derived) => Seats
}>("chat.seating")

export const CHANNEL_PROP = "xyne-channel"

/** Default orchestrator-reply cap, the human's ruling. */
export const DEFAULT_TRIM = 500

export interface ChannelBind {
  readonly node: string
  readonly file: string
  readonly title: string
  readonly channel: string
  readonly engine: string
  readonly session: string
}

export interface SpacesReading {
  /** Node agents that have both a current session and a channel. */
  readonly binds: ReadonlyArray<ChannelBind>
  /** Any live node carrying {@link CHANNEL_PROP}, session or not — intent. */
  readonly named: ReadonlyArray<{ readonly node: string; readonly file: string }>
  readonly trim: number
}

/**
 * What the vault says the mirror's knobs are, read off one revision.
 *
 * The roster comes from the seating door: put-away and mirrors are already out.
 * Which column holds bindings is the vault's answer rather than a key spelled here. The
 * channel is a second custom key on the same node. First claim wins where two
 * nodes name one session, the same rule as chat's own `agentAt`.
 */
export const spacesConfigIn = (derived: Derived, seated: Seats): SpacesReading => {
  const channelOf = new Map<string, string>()
  for (const located of derived.nodes) {
    if (!isRegular(located)) continue
    const channel = customText(located.node, CHANNEL_PROP)?.trim()
    if (channel === undefined || channel === "") continue
    channelOf.set(located.node.id, channel)
  }

  const named: Array<{ readonly node: string; readonly file: string }> = []
  const claimed = new Set<string>()
  const binds: Array<ChannelBind> = []
  for (const agent of seated) {
    const channel = channelOf.get(agent.id)
    if (channel === undefined) continue
    named.push({ node: agent.id, file: agent.file })
    if (agent.session === null) continue
    const pair = `${agent.engine}/${agent.session}`
    if (claimed.has(pair)) continue
    claimed.add(pair)
    binds.push({
      node: agent.id,
      file: agent.file,
      title: agent.title,
      channel,
      engine: agent.engine,
      session: agent.session,
    })
  }

  return { binds, named, trim: DEFAULT_TRIM }
}

/** The bind for this conversation, or nothing — a chat no node agent
 *  claims, or a node agent with no `xyne-channel`. */
export const bindOf = (
  reading: SpacesReading,
  agent: string,
  session: string,
): ChannelBind | undefined =>
  reading.binds.find((bind) => bind.engine === agent && bind.session === session)
