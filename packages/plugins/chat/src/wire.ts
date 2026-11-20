/**
 * This module may import the framework, `effect`, `@kolu/acp/wire`,
 * `@olai/format` and its own wire slice and NOTHING ELSE: no `solid-js`, which
 * would put a UI runtime on the server's graph, and nothing that speaks ACP's
 * transport, which would put a subprocess on the browser's.
 */

import { collection } from "@kolu/surface"
import { Conversing, PanelAddress } from "./wire/session.ts"
import { collectionDeltasSchema, defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
import { AgentItem } from "@olai/format"

import { Agents, ItemLocation, NO_AGENT_ROSTER, sameAgentRoster } from "./wire/agents.ts"
import { AskAnswer, Saying } from "@kolu/acp/wire"
import {
  AgentChoice,
  AttachChunk,
  Attached,
  ChatEntry,
  ChatFailure,
  ChatState,
  Conversation,
  Listed,
  SessionInfo,
} from "./wire/members.ts"

export const name = "chat"
export const transcriptRows = collection({ name: "transcript", keySchema: Schema.String, schema: ChatEntry })
export const sayingRows = collection({ name: "saying", keySchema: Schema.String, schema: Saying })

export const TRANSCRIPT_WINDOW = 60

export const TRANSCRIPT_PAGE = TRANSCRIPT_WINDOW

export const surface = defineSurface({
  cells: {
    sessionsRevision: { schema: Schema.Number, default: 0, verbs: ["get"] },
    engines: { schema: Schema.Array(AgentChoice), default: [], verbs: ["get"], arrayKey: "id" },
    agents: {
      schema: Agents,
      default: NO_AGENT_ROSTER,
      verbs: ["get"],
      equals: sameAgentRoster,
      arrayKey: "id",
    },
  },
  streams: {
    state: { inputSchema: PanelAddress, outputSchema: ChatState, arrayKey: "name" },
    transcript: { inputSchema: PanelAddress, outputSchema: collectionDeltasSchema(Schema.String, ChatEntry) },
    saying: { inputSchema: PanelAddress, outputSchema: collectionDeltasSchema(Schema.String, Saying) },
  },
  procedures: {
    conversation: {
      send: {
        input: Schema.Struct({
          conv: PanelAddress,
          scope: Schema.NullOr(Schema.String),
          text: Schema.String,
          steer: Schema.optionalKey(Schema.Boolean),
          attachments: Schema.optionalKey(Schema.Array(Schema.String)),
          context: Schema.optionalKey(Schema.Array(Schema.String)),
        }),
        error: ChatFailure,
      },
      resend: {
        input: Schema.Struct({ conv: PanelAddress, scope: Schema.NullOr(Schema.String), id: Schema.String }),
        error: ChatFailure,
      },
      attach: {
        input: Schema.Struct({ ...AttachChunk.fields, conv: PanelAddress }),
        output: Attached,
        error: ChatFailure,
      },
      cancel: {
        input: Schema.Struct({ conv: PanelAddress, scope: Schema.NullOr(Schema.String) }),
        error: ChatFailure,
      },
      signIn: {
        input: Schema.Struct({
          conv: PanelAddress,
          scope: Schema.NullOr(Schema.String),
          method: Schema.NullOr(Schema.String),
        }),
        error: ChatFailure,
      },
      signInInput: {
        input: Schema.Struct({
          conv: PanelAddress,
          scope: Schema.NullOr(Schema.String),
          text: Schema.String,
        }),
        error: ChatFailure,
      },
      signInCancel: {
        input: Schema.Struct({ conv: PanelAddress, scope: Schema.NullOr(Schema.String) }),
        error: ChatFailure,
      },
      setSetting: {
        input: Schema.Struct({ agent: Schema.String, session: Schema.String, config: Schema.String,
          value: Schema.Union([Schema.String, Schema.Boolean]) }),
        error: ChatFailure,
      },
      setModel: {
        input: Schema.Struct({ agent: Schema.String, session: Schema.String, value: Schema.String }),
        error: ChatFailure,
      },
      seen: {
        input: Schema.Struct({ agent: Schema.String, session: Schema.String, at: Schema.String }),
        error: ChatFailure,
      },
      newChat: {
        input: Schema.Struct({ agent: Schema.String, item: AgentItem, say: Schema.optionalKey(Schema.String) }),
        output: Schema.Struct({ node: Schema.String, to: Schema.NullOr(Schema.Struct({ agent: Schema.String, session: Schema.String })), refusal: Schema.NullOr(Schema.String) }),
        error: ChatFailure,
      },
      locations: {
        input: Schema.Struct({ filter: Schema.String, limit: Schema.Number, keys: Schema.Array(Schema.String) }),
        output: Schema.Struct({ items: Schema.Array(ItemLocation) }),
        error: ChatFailure,
      },
      startAgentSession: {
        input: Schema.Struct({
          node: Schema.String,
          agent: Schema.String,
        }),
        output: Schema.NullOr(Conversing),
        error: ChatFailure,
      },
      closeAgent: {
        input: Schema.Struct({
          node: Schema.String,
        }),
        error: ChatFailure,
      },
      retie: {
        input: Schema.Struct({
          node: Schema.String,
          agent: Schema.String,
          session: Schema.String,
        }),
        error: ChatFailure,
      },
      sleep: {
        input: Schema.Struct({
          node: Schema.String,
        }),
        error: ChatFailure,
      },
      setSleeping: {
        input: Schema.Struct({
          node: Schema.String,
          on: Schema.Boolean,
        }),
        error: ChatFailure,
      },
      setOpens: {
        input: Schema.Struct({
          path: Schema.String,
          beside: Schema.Boolean,
        }),
        error: ChatFailure,
      },
      tidyMemory: {
        input: Schema.Struct({
          node: Schema.String,
        }),
        output: Schema.Union([
          Schema.Struct({ _tag: Schema.Literal("Started") }),
          Schema.Struct({ _tag: Schema.Literal("Refused"), said: Schema.String }),
        ]),
      },
      reopen: {
        input: Schema.Struct({ conv: PanelAddress, scope: Schema.NullOr(Schema.String) }),
        error: ChatFailure,
      },
      sessions: {
        output: Listed,
        error: ChatFailure,
      },
      answer: {
        input: Schema.Struct({
          conv: PanelAddress,
          scope: Schema.optional(Schema.NullOr(Schema.String)),
          id: Schema.String,
          answers: Schema.Array(AskAnswer),
        }),
        error: ChatFailure,
      },
      decline: {
        input: Schema.Struct({ conv: PanelAddress, scope: Schema.optional(Schema.NullOr(Schema.String)), id: Schema.String }),
        error: ChatFailure,
      },
      scope: {
        input: Schema.Struct({
          agent: Schema.String,
          session: Schema.String,
          plugin: Schema.String,
          pick: Schema.Json,
        }),
        error: ChatFailure,
      },
      earlier: {
        input: Schema.Struct({
          conv: PanelAddress,
          before: Schema.Number,
          limit: Schema.Number,
        }),
        output: Schema.Array(ChatEntry),
        error: ChatFailure,
      },
    },
  },
})

export const faces = {
  browser: {
    sessionsRevision: "resource",
    state: "resource",
    engines: "resource",
    agents: "resource",
    transcript: "resource",
    saying: "resource",
    "conversation.send": "tool",
    "conversation.resend": "tool",
    "conversation.attach": "tool",
    "conversation.cancel": "tool",
    "conversation.signIn": "tool",
    "conversation.signInInput": "tool",
    "conversation.signInCancel": "tool",
    "conversation.setModel": "tool",
    "conversation.setSetting": "tool",
    "conversation.seen": "tool",
    "conversation.newChat": "tool",
    "conversation.locations": "tool",
    "conversation.startAgentSession": "tool",
    "conversation.closeAgent": "tool",
    "conversation.retie": "tool",
    "conversation.sleep": "tool",
    "conversation.setSleeping": "tool",
    "conversation.setOpens": "tool",
    "conversation.tidyMemory": "tool",
    "conversation.reopen": "tool",
    "conversation.sessions": "tool",
    "conversation.answer": "tool",
    "conversation.decline": "tool",
    "conversation.scope": "tool",
    "conversation.earlier": "tool",
  },
} as const

export * from "./wire/session.ts"
export * from "./wire/agents.ts"
export * from "./wire/members.ts"
