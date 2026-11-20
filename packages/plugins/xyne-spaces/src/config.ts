import { Effect, Schema } from "effect"

import { customText, isRegular, type Derived, type NodeAgent } from "@olai/format"
import { serviceTag } from "@olai/plugin-api/services"

export type Seats = ReadonlyArray<Pick<NodeAgent, "id" | "file" | "title" | "engine" | "session">>

export const Seating = serviceTag<{
  readonly in: (derived: Derived) => Seats
}>("chat.seating")

export const CHANNEL_PROP = "xyne-channel"

export const DEFAULT_TRIM = 500

export const Config = Schema.Struct({
  "reply-limit": Schema.Union([Schema.Int, Schema.NumberFromString.check(Schema.isInt())]).check(Schema.isGreaterThanOrEqualTo(1)).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(DEFAULT_TRIM)),
    Schema.annotate({ description: "maximum reply characters mirrored to a channel" }),
  ),
})


export interface ChannelBind {
  readonly node: string
  readonly file: string
  readonly title: string
  readonly channel: string
  readonly engine: string
  readonly session: string
}

export interface SpacesReading {
  readonly binds: ReadonlyArray<ChannelBind>
  readonly named: ReadonlyArray<{ readonly node: string; readonly file: string }>
  readonly trim: number
}

export const spacesConfigIn = (derived: Derived, seated: Seats, trim = DEFAULT_TRIM): SpacesReading => {
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

  return { binds, named, trim }
}

export const bindOf = (
  reading: SpacesReading,
  agent: string,
  session: string,
): ChannelBind | undefined =>
  reading.binds.find((bind) => bind.engine === agent && bind.session === session)
