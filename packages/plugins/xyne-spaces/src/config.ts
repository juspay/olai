/** Spaces channels joined to the seating supplied by a declared service. */
import { customText, isRegular, type Derived, type NodeAgents } from "@olai/format"
import { serviceTag } from "@olai/plugin-api/services"

/** Chat owns the reading and its vocabulary; the consumer names its contract. */
export const Seating = serviceTag<{
  readonly in: (derived: Derived) => NodeAgents
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
 * The roster comes from the seating door: put-away and mirrors are already out, and which COLUMN the
 * bindings are in is the vault's answer rather than a key spelled here. The
 * channel is a second custom key on the same node. First claim wins where two
 * nodes name one session, the same rule as chat's own `agentAt`.
 */
export const spacesConfigIn = (derived: Derived, seated: NodeAgents): SpacesReading => {
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
