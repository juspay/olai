import { Json } from "../json.ts"

import { Conversing } from "./session.ts"
import {
  Armed,
  Ask,
  AuthMethod,
  AuthStatus,
  Command,
  Delivery,
  FileDiff,
  PlanStep,
  Saying,
  Server,
  Setting,
  SignIn,
  SignInReason,
  Spawned,
  TerminalView,
  ToolStatus,
  Usage,
  Watching,
} from "@kolu/acp/wire"
import { isStillRunning } from "@kolu/acp-harness"
import { BusyCause, Found, OpFailure } from "@olai/format"
import { Schema } from "effect"

export const NodeContext = Schema.Struct({
  trashed: Schema.optionalKey(Schema.Boolean),
  id: Found.fields.id,
  title: Found.fields.title,
  file: Found.fields.file,
  line: Found.fields.line,
  path: Found.fields.path,
})
export type NodeContext = typeof NodeContext.Type

const chatEntryHead = {
  id: Schema.String,
  seq: Schema.Int,
  since: Schema.String,
}

const parent = Schema.optionalKey(Schema.String)

export const UserEntry = Schema.Struct({
  ...chatEntryHead,
  kind: Schema.Literal("user"),
  text: Schema.String,
  context: Schema.optionalKey(Schema.Array(NodeContext)),
  attachments: Schema.optionalKey(Schema.Array(Schema.String)),
  queued: Schema.optionalKey(Schema.Literal(true)),
  delivery: Schema.optionalKey(Delivery),
  signIn: Schema.optionalKey(SignInReason),
  rang: Schema.optionalKey(Schema.String),
})
export type UserEntry = typeof UserEntry.Type

export const AgentEntry = Schema.Struct({
  ...chatEntryHead,
  kind: Schema.Literal("agent"),
  text: Schema.String,
  streaming: Schema.optionalKey(Schema.Literal(true)),
})
export type AgentEntry = typeof AgentEntry.Type

export const ToolEntry = Schema.Struct({
  ...chatEntryHead,
  kind: Schema.Literal("tool"),
  text: Schema.String,
  status: ToolStatus,
  detail: Schema.optionalKey(Schema.String),
  called: Schema.optionalKey(Schema.String),
  row: Schema.optionalKey(Schema.String),
  reply: Schema.optionalKey(Json),
  asksThroughForm: Schema.optionalKey(Schema.Literal(true)),
  terminals: Schema.optionalKey(Schema.Array(TerminalView)),
  progress: Schema.optionalKey(Schema.String),
  diffs: Schema.optionalKey(Schema.Array(FileDiff)),
  locations: Schema.optionalKey(Schema.Array(Schema.String)),
  parent,
  spawned: Schema.optionalKey(Spawned),
  armed: Schema.optionalKey(Armed),
  stranded: Schema.optionalKey(Schema.Literal(true)),
  resumed: Schema.optionalKey(Schema.String),
  startedAt: Schema.optionalKey(Schema.String),
})
export type ToolEntry = typeof ToolEntry.Type

export const AskEntry = Schema.Struct({
  ...chatEntryHead,
  kind: Schema.Literal("ask"),
  text: Schema.String,
  parent,
  ask: Ask,
})
export type AskEntry = typeof AskEntry.Type

export const RefusalEntry = Schema.Struct({
  ...chatEntryHead,
  kind: Schema.Literal("refusal"),
  text: Schema.String,
  refusal: OpFailure,
})
export type RefusalEntry = typeof RefusalEntry.Type

export const NoticeEntry = Schema.Struct({
  ...chatEntryHead,
  kind: Schema.Literal("notice"),
  text: Schema.String,
})
export type NoticeEntry = typeof NoticeEntry.Type

export const ChatEntry = Schema.Union([
  UserEntry,
  AgentEntry,
  ToolEntry,
  AskEntry,
  RefusalEntry,
  NoticeEntry,
])
export type ChatEntry = typeof ChatEntry.Type

export const sayingKey = (piece: Pick<Saying, "of" | "at">): string =>
  `${piece.of}#${piece.at}`

export const sayingEnd = (piece: Pick<Saying, "at" | "text">): number =>
  piece.at + piece.text.length

export const SAYING_MS = 120

export { isRunningStatus, isStillRunning, isTaskOut } from "@kolu/acp-harness"

export const isAgentOut = (entry: ToolEntry): boolean =>
  entry.spawned !== undefined && isStillRunning(entry)

export const outSince = (entry: ToolEntry): string =>
  isStillRunning(entry) ? entry.resumed ?? entry.since : entry.since

export const sentToDo = (spawned: Spawned | undefined, title: string): string =>
  spawned?.said ?? title

export const AttachChunk = Schema.Struct({
  uploadScope: Schema.optionalKey(Schema.String),
  name: Schema.String,
  data: Schema.String,
  appendTo: Schema.optionalKey(Schema.String),
})
export type AttachChunk = typeof AttachChunk.Type

export const Attached = Schema.Struct({
  path: Schema.String,
  name: Schema.String,
})
export type Attached = typeof Attached.Type

export const Conversation = Schema.Struct({
  id: Schema.String,
  title: Schema.NullOr(Schema.String),
  updatedAt: Schema.NullOr(Schema.String),
})
export type Conversation = typeof Conversation.Type

export const SessionInfo = Schema.Struct({
  ...Conversation.fields,
  agent: Schema.String,
  messageCount: Schema.NullOr(Schema.Number),
  supersededBy: Schema.NullOr(Conversing),
})
export type SessionInfo = typeof SessionInfo.Type

export const Unreachable = Schema.Struct({
  agent: Schema.String,
  why: Schema.String,
})
export type Unreachable = typeof Unreachable.Type

export const Listed = Schema.Struct({
  sessions: Schema.Array(SessionInfo),
  unreachable: Schema.Array(Unreachable),
})
export type Listed = typeof Listed.Type

export const AgentChoice = Schema.Union([
  Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    standing: Schema.Literal("here"),
  }),
  Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    standing: Schema.Literal("not-here"),
    missing: Schema.Struct({
      name: Schema.String,
      where: Schema.NullOr(Schema.String),
      why: Schema.String,
    }),
  }),
])
export type AgentChoice = typeof AgentChoice.Type

export const Talking = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("agent"),
    id: Schema.String,
    name: Schema.String,
    steers: Schema.Boolean,
    queues: Schema.Boolean,
    methods: Schema.Array(AuthMethod),
  }),
  Schema.Struct({ kind: Schema.Literal("asking") }),
])
export type Talking = typeof Talking.Type

export const agentIn = (
  state: { readonly talking: Talking | null },
): Extract<Talking, { kind: "agent" }> | null =>
  state.talking?.kind === "agent" ? state.talking : null

export const notHere = (server: Server): boolean => {
  switch (server.standing) {
    case "connected":
    case "handed":
      return false
    case "unattached":
    case "missing":
      return true
  }
}

export const Missing = Schema.Struct({ kind: Schema.Literal("missing") })
export type Missing = typeof Missing.Type

export const UnopenedCause = Schema.Union([BusyCause, Missing])
export type UnopenedCause = typeof UnopenedCause.Type

export const Unopened = Schema.Struct({
  why: Schema.String,
  what: Schema.NullOr(Schema.String),
  cause: Schema.optionalKey(UnopenedCause),
})

export const Wake = Schema.Struct({ name: Schema.String, pick: Json, waiting: Schema.Int })
export type Wake = typeof Wake.Type

export type Unopened = typeof Unopened.Type

export const OffBecause = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("no-engine") }),
  Schema.Struct({ kind: Schema.Literal("none-installed") }),
])
export type OffBecause = typeof OffBecause.Type

export const ChatState = Schema.Struct({
  settings: Schema.Array(Setting),
  plan: Schema.Array(PlanStep),
  status: Schema.Literals(["off", "booting", "idle", "thinking", "gone"]),
  off: Schema.NullOr(OffBecause),
  session: Schema.NullOr(Conversation),
  uploadScope: Schema.NullOr(Schema.String),
  bound: Schema.NullOr(Schema.String),
  model: Schema.NullOr(Schema.String),
  identity: Schema.NullOr(AuthStatus),
  models: Schema.Array(Schema.Struct({ value: Schema.String, name: Schema.String })),
  usage: Schema.NullOr(Usage),
  commands: Schema.Array(Command),
  signIn: Schema.NullOr(SignIn),
  roster: Schema.Array(AgentChoice),
  talking: Schema.NullOr(Talking),
  asking: Schema.Int,
  watching: Schema.Array(Watching),
  trouble: Schema.NullOr(Schema.String),
  sleep: Schema.Boolean,
  cancelled: Schema.Boolean,
  unopened: Schema.NullOr(Unopened),
  servers: Schema.Array(Server),
  wake: Schema.Array(Wake),
})
export type ChatState = typeof ChatState.Type

export const CHAT_OFF: ChatState = {
  settings: [],
  plan: [],
  status: "off",
  off: null,
  session: null,
  uploadScope: null,
  bound: null,
  model: null,
  identity: null,
  models: [],
  usage: null,
  commands: [],
  signIn: null,
  roster: [],
  talking: null,
  asking: 0,
  watching: [],
  trouble: null,
  sleep: false,
  cancelled: false,
  unopened: null,
  servers: [],
  wake: [],
}

export const ChatFailure = OpFailure
