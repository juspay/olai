import { ValidationFailure, verdictOf } from "@olai/format"
import { describe, expect, test } from "bun:test"
import { Schema } from "effect"

import {
  type AgentEntry,
  type ChatEntry,
  ChatEntry as ChatEntryUnion,
  isTaskOut,
  NodeContext,
  type ToolEntry,
  type UserEntry,
} from "./members.ts"
import { Json } from "../json.ts"
import { OpFailure } from "@olai/format"
import { Armed, Ask, Delivery, FileDiff, SignInReason, Spawned } from "@kolu/acp/wire"
import { armedTask, sentAgent } from "../outings.testlib.ts"

const ChatEntryFlat = Schema.Struct({
  id: Schema.String,
  seq: Schema.Int,
  since: Schema.String,
  kind: Schema.Literals(["user", "agent", "tool", "ask", "refusal", "notice"]),
  text: Schema.String,
  status: Schema.optionalKey(
    Schema.Literals(["pending", "in_progress", "completed", "failed"]),
  ),
  detail: Schema.optionalKey(Schema.String),
  called: Schema.optionalKey(Schema.String),
  row: Schema.optionalKey(Schema.String),
  reply: Schema.optionalKey(Json),
  asksThroughForm: Schema.optionalKey(Schema.Boolean),
  progress: Schema.optionalKey(Schema.String),
  diffs: Schema.optionalKey(Schema.Array(FileDiff)),
  locations: Schema.optionalKey(Schema.Array(Schema.String)),
  parent: Schema.optionalKey(Schema.String),
  spawned: Schema.optionalKey(Spawned),
  armed: Schema.optionalKey(Armed),
  refusal: Schema.optionalKey(OpFailure),
  ask: Schema.optionalKey(Ask),
  streaming: Schema.optionalKey(Schema.Boolean),
  stranded: Schema.optionalKey(Schema.Boolean),
  resumed: Schema.optionalKey(Schema.String),
  startedAt: Schema.optionalKey(Schema.String),
  context: Schema.optionalKey(Schema.Array(NodeContext)),
  attachments: Schema.optionalKey(Schema.Array(Schema.String)),
  queued: Schema.optionalKey(Schema.Boolean),
  delivery: Schema.optionalKey(Delivery),
  signIn: Schema.optionalKey(SignInReason),
  rang: Schema.optionalKey(Schema.String),
})

const encodeFlat = Schema.encodeUnknownSync(ChatEntryFlat)
const decodeFlat = Schema.decodeUnknownSync(ChatEntryFlat)
const encodeUnion = Schema.encodeUnknownSync(ChatEntryUnion)
const decodeUnion = Schema.decodeUnknownSync(ChatEntryUnion)

const SINCE = "2026-08-21T12:00:00.000Z"

const CONTEXT: NodeContext = {
  id: "order",
  title: "order the new cabinets",
  file: "house.olai",
  line: 4,
  path: ["Kitchen"],
}

const REFUSAL = new ValidationFailure({
  reason: "`done: Kitchen remodel` would leave the outlines invalid",
  verdict: verdictOf([{
    code: "duplicate-id",
    file: "house.olai",
    line: 3,
    message: "`order` is already the id of another node",
  }]),
})

const REPRESENTATIVE: ReadonlyArray<{ name: string; entry: ChatEntry }> = [
  {
    name: "user (bare)",
    entry: {
      id: "user:1",
      seq: 0,
      since: SINCE,
      kind: "user",
      text: "hello",
    },
  },
  {
    name: "user (context, pictures, refused)",
    entry: {
      id: "user:2",
      seq: 1,
      since: SINCE,
      kind: "user",
      text: "done order",
      context: [CONTEXT],
      attachments: ["shot.png"],
      delivery: "refused",
    },
  },
  {
    name: "user (refused for want of a signature)",
    entry: {
      id: "user:5",
      seq: 13,
      since: SINCE,
      kind: "user",
      text: "rewrite the kitchen note",
      delivery: "refused",
      signIn: "account",
    },
  },
  {
    name: "user (waiting its turn at the agent)",
    entry: {
      id: "user:3",
      seq: 11,
      since: SINCE,
      kind: "user",
      text: "and check the other one",
      queued: true,
    },
  },
  {
    name: "user (rung by a machine)",
    entry: {
      id: "user:4",
      seq: 12,
      since: SINCE,
      kind: "user",
      text: "olai · kolu · two terminals waiting · 14:32",
      rang: "kolu",
    },
  },
  {
    name: "agent (streaming)",
    entry: {
      id: "agent:1",
      seq: 2,
      since: SINCE,
      kind: "agent",
      text: "looking",
      streaming: true,
    },
  },
  {
    name: "agent (settled)",
    entry: {
      id: "agent:2",
      seq: 3,
      since: SINCE,
      kind: "agent",
      text: "found it",
    },
  },
  {
    name: "tool (announced)",
    entry: {
      id: "tool:call-1",
      seq: 4,
      since: SINCE,
      kind: "tool",
      text: "Grep",
      status: "pending",
    },
  },
  {
    name: "tool (running, with body)",
    entry: {
      id: "tool:call-2",
      seq: 5,
      since: SINCE,
      kind: "tool",
      text: "explore the outline",
      status: "in_progress",
      detail: '{"pattern":"worktops"}',
      progress: "halfway",
      diffs: [{ path: "notes/cabinets.md", oldText: "pine", newText: "oak" }],
      called: "engine_tool",
      row: "owner",
      reply: {
        sort: "edited",
        id: "order",
        title: "order the new cabinets",
        file: "house.olai",
        nudge: null,
      },
      locations: ["house.olai:4"],
      parent: "tool:agent-1",
      spawned: sentAgent({ kind: "Explore" }),
    },
  },
  {
    name: "tool (a background task, ended)",
    entry: {
      id: "tool:call-4",
      seq: 7,
      since: SINCE,
      kind: "tool",
      text: "kolu watch --states waiting,awaiting",
      status: "failed",
      progress: 'Background command "kolu fleet watch" failed with exit code 3',
      armed: armedTask({
        task: "bwa85c0r2",
        description: "kolu fleet watch",
        ended: "failed",
      }),
    },
  },
  {
    name: "tool (stranded)",
    entry: {
      id: "tool:call-3",
      seq: 6,
      since: SINCE,
      kind: "tool",
      text: "Grep",
      status: "in_progress",
      stranded: true,
    },
  },
  {
    name: "tool (asks through a form, resumed)",
    entry: {
      id: "tool:call-5",
      seq: 14,
      since: SINCE,
      kind: "tool",
      text: "AskUserQuestion",
      status: "in_progress",
      asksThroughForm: true,
      resumed: "2026-08-21T13:00:00.000Z",
      startedAt: "2026-08-21T13:00:00.000Z",
    },
  },
  {
    name: "ask (pending, subagent)",
    entry: {
      id: "ask:1",
      seq: 7,
      since: SINCE,
      kind: "ask",
      text: "Allow `Bash`?",
      parent: "tool:agent-1",
      ask: { fields: [], link: null, outcome: null },
    },
  },
  {
    name: "ask (answered)",
    entry: {
      id: "ask:2",
      seq: 8,
      since: SINCE,
      kind: "ask",
      text: "Shall I?",
      ask: {
        fields: [],
        link: null,
        outcome: { how: "answered", answers: [{ key: "question_0", values: ["yes"] }] },
      },
    },
  },
  {
    name: "refusal",
    entry: {
      id: "refusal:1",
      seq: 9,
      since: SINCE,
      kind: "refusal",
      text: "`outlines_done` was refused",
      refusal: REFUSAL,
    },
  },
  {
    name: "notice",
    entry: {
      id: "notice:1",
      seq: 10,
      since: SINCE,
      kind: "notice",
      text: "cancelled",
    },
  },
]

for (const { name, entry } of REPRESENTATIVE) {
  test(`encoding is byte-identical for ${name}`, () => {
    const oldJson = JSON.stringify(encodeFlat(entry))
    const newJson = JSON.stringify(encodeUnion(entry))
    expect(newJson).toBe(oldJson)

    const encoded = JSON.parse(oldJson) as unknown
    expect(JSON.stringify(encodeUnion(decodeUnion(encoded)))).toBe(newJson)
    expect(JSON.stringify(encodeFlat(decodeFlat(encoded)))).toBe(oldJson)
  })
}

test("every kind is represented in the encoding proof", () => {
  const kinds = new Set(REPRESENTATIVE.map((one) => one.entry.kind))
  expect([...kinds].sort()).toEqual([
    "agent",
    "ask",
    "notice",
    "refusal",
    "tool",
    "user",
  ])
})

const HEAD = {
  id: "row:1",
  seq: 0,
  since: SINCE,
  text: "hello",
}

const REJECTED: ReadonlyArray<{ name: string; row: unknown }> = [
  { name: "a tool row without status", row: { ...HEAD, kind: "tool" } },
  { name: "an ask row without ask", row: { ...HEAD, kind: "ask" } },
  { name: "a refusal row without refusal", row: { ...HEAD, kind: "refusal" } },
  {
    name: "streaming: false",
    row: { ...HEAD, kind: "agent", streaming: false },
  },
  {
    name: "queued: false",
    row: { ...HEAD, kind: "user", queued: false },
  },
  {
    name: "stranded: false",
    row: { ...HEAD, kind: "tool", status: "pending", stranded: false },
  },
  {
    name: "asksThroughForm: false",
    row: { ...HEAD, kind: "tool", status: "pending", asksThroughForm: false },
  },
]

for (const { name, row } of REJECTED) {
  test(`${name} fails to decode`, () => {
    expect(Schema.is(ChatEntryFlat)(row)).toBe(true)
    expect(Schema.is(ChatEntryUnion)(row)).toBe(false)
    expect(() => decodeUnion(row)).toThrow()
  })
}

test("a kind-wrong extra key is dropped at decode, not re-emitted", () => {
  const row = { ...HEAD, kind: "user", status: "pending" }
  expect(Schema.is(ChatEntryFlat)(row)).toBe(true)
  const back = decodeUnion(row)
  expect(back.kind).toBe("user")
  expect("status" in back).toBe(false)
  expect(JSON.stringify(encodeUnion(back))).not.toContain("status")
})

test("a non-call row with a status is unrepresentable", () => {
  const user = {
    id: "user:1",
    seq: 0,
    since: SINCE,
    kind: "user" as const,
    text: "hello",
  }
  const asUser: UserEntry = user
  expect(asUser.kind).toBe("user")

  const tool: ToolEntry = {
    id: "tool:call-1",
    seq: 0,
    since: SINCE,
    kind: "tool",
    text: "Grep",
    status: "pending",
  }
  expect(tool.status).toBe("pending")
})

type StatusOf<T> = T extends { status: infer S } ? S : never
type HasNoStatus<T> = [StatusOf<T>] extends [never] ? true : false
const _userHasNoStatus: HasNoStatus<UserEntry> = true
const _agentHasNoStatus: HasNoStatus<AgentEntry> = true
const _toolStatus: StatusOf<ToolEntry> = "pending"
void _userHasNoStatus
void _agentHasNoStatus
void _toolStatus

describe("which rows have a task still out", () => {
  const row = (extra: Partial<ToolEntry>): ToolEntry => ({
    id: "tool:1",
    seq: 0,
    since: SINCE,
    kind: "tool",
    text: "kolu watch --states waiting,awaiting",
    status: "in_progress",
    ...extra,
  })

  test("armed, no ending, and the wire still calls the call running", () => {
    expect(isTaskOut(row({ armed: armedTask({ task: "bu13xz2ie" }) }))).toBe(true)
    expect(isTaskOut(row({ status: "pending", armed: armedTask({ task: "bu13xz2ie" }) }))).toBe(true)
  })

  test("... and NOT once the harness has said how it ended", () => {
    expect(
      isTaskOut(row({ status: "failed", armed: armedTask({ task: "bu13xz2ie", ended: "killed" }) })),
    ).toBe(false)
    expect(
      isTaskOut(row({ status: "completed", armed: armedTask({ task: "bu13xz2ie", ended: "completed" }) })),
    ).toBe(false)
  })

  test("... and NOT when the CALL went terminal with the ending unsaid", () => {
    expect(isTaskOut(row({ status: "failed", armed: armedTask({ task: "bu13xz2ie" }) }))).toBe(false)
    expect(isTaskOut(row({ status: "completed", armed: armedTask({ task: "bu13xz2ie" }) }))).toBe(false)
  })

  test("... and NOT when its own turn walked away from it", () => {
    expect(
      isTaskOut(row({ stranded: true, armed: armedTask({ task: "bu13xz2ie" }) })),
    ).toBe(false)
  })

  test("a row that armed nothing has no task out, however it stands", () => {
    expect(isTaskOut(row({}))).toBe(false)
    expect(isTaskOut(row({ status: "completed" }))).toBe(false)
    expect(isTaskOut(row({ spawned: sentAgent({ kind: "Explore" }) }))).toBe(false)
  })
})
