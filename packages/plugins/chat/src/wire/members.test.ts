/**
 * ChatEntry is a kind-discriminated union over the writer's encoding.
 *
 * The old shape was one struct with every kind-specific field optional. The
 * new shape is six structs, discriminated on `kind`. These tests are the
 * proof the ruling asked for: every row the writer produces encodes to the
 * same JSON through both schemas; the decoder now also requires the flags'
 * only honest value; and a non-call row with a `status` is a type error
 * rather than a fact a consumer has to re-check.
 */

import { ValidationFailure, verdictOf } from "@olai/format"
import { describe, expect, test } from "bun:test"
import { Schema } from "effect"

import {
  type AgentEntry,
  Armed,
  Ask,
  type ChatEntry,
  ChatEntry as ChatEntryUnion,
  Delivery,
  FileDiff,
  isTaskOut,
  NodeContext,
  OpFailure,
  Spawned,
  type ToolEntry,
  type UserEntry,
  Wrote,
} from "./members.ts"

/**
 * The PRE-UNION shape, pinned here so the old schema can be deleted from the
 * spec without losing the encoding proof. Field order and optionality are the
 * contract for rows the writer produces: those must stringify identically
 * through this and through {@link ChatEntryUnion}. The decoder is stricter
 * than this pin — see the negative cases below.
 */
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
  progress: Schema.optionalKey(Schema.String),
  diffs: Schema.optionalKey(Schema.Array(FileDiff)),
  wrote: Schema.optionalKey(Wrote),
  locations: Schema.optionalKey(Schema.Array(Schema.String)),
  parent: Schema.optionalKey(Schema.String),
  spawned: Schema.optionalKey(Spawned),
  armed: Schema.optionalKey(Armed),
  refusal: Schema.optionalKey(OpFailure),
  ask: Schema.optionalKey(Ask),
  streaming: Schema.optionalKey(Schema.Boolean),
  stranded: Schema.optionalKey(Schema.Boolean),
  context: Schema.optionalKey(Schema.Array(NodeContext)),
  attachments: Schema.optionalKey(Schema.Array(Schema.String)),
  queued: Schema.optionalKey(Schema.Boolean),
  delivery: Schema.optionalKey(Delivery),
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

/** One well-formed row of each kind, as the transcript's writer actually
 *  produces them — not a hand-built object that happens to type-check. Extra
 *  keys a kind does not carry are absent, which is the encoding the wire has
 *  always used. */
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
    // A plugin's doorbell put this one there. It goes out down the person's
    // lane and carries the same delivery vocabulary, which is why it is a
    // `user` row and not a seventh kind — so the encoding proof needs a
    // representative that actually carries the mark rather than one that would
    // pass whatever the union did with an absent field.
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
      wrote: {
        sort: "edited",
        id: "order",
        title: "order the new cabinets",
        file: "house.olai",
        nudge: null,
      },
      locations: ["house.olai:4"],
      parent: "tool:agent-1",
      spawned: { kind: "Explore" },
    },
  },
  {
    // The row a background task lives on, with both halves of `armed` on it —
    // the fields it is armed with and the harness’s own ending — so the
    // encoding proof has a representative that actually carries the field
    // rather than one that would pass whatever the union did with it.
    name: "tool (a background task, ended)",
    entry: {
      id: "tool:call-4",
      seq: 7,
      since: SINCE,
      kind: "tool",
      text: "kolu watch --states waiting,awaiting",
      status: "failed",
      progress: 'Background command "kolu fleet watch" failed with exit code 3',
      armed: {
        task: "bwa85c0r2",
        description: "kolu fleet watch",
        ended: "failed",
      },
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
    name: "ask (pending, subagent)",
    entry: {
      id: "ask:1",
      seq: 7,
      since: SINCE,
      kind: "ask",
      text: "Allow `Bash`?",
      parent: "tool:agent-1",
      ask: { fields: [], outcome: null },
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
      text: "`set_done` was refused",
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

/**
 * The union is a stricter decoder, not literally the same byte language.
 *
 * The old struct accepted four shapes the writer never produces: a tool row
 * without `status`, an ask without `ask`, a refusal without `refusal`, and
 * the flags as `false`. A future second producer learns that contract from a
 * red test rather than from a live panel that silently drew nothing.
 */
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
]

for (const { name, row } of REJECTED) {
  test(`${name} fails to decode`, () => {
    expect(Schema.is(ChatEntryFlat)(row)).toBe(true)
    expect(Schema.is(ChatEntryUnion)(row)).toBe(false)
    expect(() => decodeUnion(row)).toThrow()
  })
}

test("a kind-wrong extra key is dropped at decode, not re-emitted", () => {
  // The sanitizing direction: the old struct re-emitted `status` on a user
  // row; the union accepts the bytes and encodes without the key. Same bytes
  // for well-formed rows; a second producer's junk does not round-trip.
  const row = { ...HEAD, kind: "user", status: "pending" }
  expect(Schema.is(ChatEntryFlat)(row)).toBe(true)
  const back = decodeUnion(row)
  expect(back.kind).toBe("user")
  expect("status" in back).toBe(false)
  expect(JSON.stringify(encodeUnion(back))).not.toContain("status")
})

/**
 * A non-call row with a `status` must fail the typecheck. `@ts-expect-error`
 * fails the build when the line it guards compiles — which is what rules out
 * the union collapsing back into a struct with everything optional.
 *
 * Each body is valid on its own without the extra field, so the annotation is
 * the only thing on the line that can fail (the same shape
 * `packages/ops/src/tools.test.ts` uses).
 */
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

  const _user: UserEntry = {
    ...user,
    // @ts-expect-error — status is a tool row's field
    status: "pending",
  }

  const _agent: AgentEntry = {
    id: "agent:1",
    seq: 0,
    since: SINCE,
    kind: "agent",
    text: "looking",
    // @ts-expect-error — status is a tool row's field
    status: "in_progress",
  }

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

/** `status` is not a key of a user row, even optionally. `extends { status?: … }`
 *  would pass for any object (structural excess); inferring the field does not. */
type StatusOf<T> = T extends { status: infer S } ? S : never
type UserStatus = StatusOf<UserEntry>
type _userHasNoStatus = [UserStatus] extends [never] ? true : false
const _userHasNoStatus: _userHasNoStatus = true
const _toolStatus: StatusOf<ToolEntry> = "pending"
void _userHasNoStatus
void _toolStatus

/**
 * WHICH ROWS HAVE A TASK STILL OUT — the rule four askings share, as a table.
 *
 * It is here rather than in one of the four because it is `isRunningStatus`'s
 * neighbour and for its reason: the SERVER asks it (which calls a turn may not
 * strand, and what the strip is told is running) and the BROWSER asks it (the
 * rail, and whether the panel's clock has anything to tick for), and one of
 * them answering differently from the others is a rail gone out under a clock
 * still counting.
 *
 * THE SECOND CONJUNCT IS THE POINT of the table. This rule was written out by
 * hand in three places once, and one of the three forgot the STATUS — a row
 * whose call went terminal without the harness saying how the task ended kept
 * the count above zero, which is the strip up and a 1 Hz timer in every open
 * tab under a row that already says the call is over. The code is right; what
 * was missing is anything that fails when somebody simplifies it back.
 */
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
    expect(isTaskOut(row({ armed: { task: "bu13xz2ie" } }))).toBe(true)
    // `pending` is a running state — it is what every call is announced with.
    expect(isTaskOut(row({ status: "pending", armed: { task: "bu13xz2ie" } }))).toBe(true)
  })

  test("... and NOT once the harness has said how it ended", () => {
    expect(
      isTaskOut(row({ status: "failed", armed: { task: "bu13xz2ie", ended: "killed" } })),
    ).toBe(false)
    expect(
      isTaskOut(row({ status: "completed", armed: { task: "bu13xz2ie", ended: "completed" } })),
    ).toBe(false)
  })

  test("... and NOT when the CALL went terminal with the ending unsaid", () => {
    // The case that was already wrong once, and the one no other test covers:
    // a cancelled turn resolves an armed call to `failed`, the harness never
    // says what became of the task, and nothing is ever going to. A count that
    // kept this row would keep the strip up for the life of the panel.
    expect(isTaskOut(row({ status: "failed", armed: { task: "bu13xz2ie" } }))).toBe(false)
    expect(isTaskOut(row({ status: "completed", armed: { task: "bu13xz2ie" } }))).toBe(false)
  })

  test("... and NOT when its own turn walked away from it", () => {
    // A dead agent's tasks: the exemption that keeps an armed row unstranded
    // is the transcript's, and it stops at the conversation's end.
    expect(
      isTaskOut(row({ stranded: true, armed: { task: "bu13xz2ie" } })),
    ).toBe(false)
  })

  test("a row that armed nothing has no task out, however it stands", () => {
    expect(isTaskOut(row({}))).toBe(false)
    expect(isTaskOut(row({ status: "completed" }))).toBe(false)
    expect(isTaskOut(row({ spawned: { kind: "Explore" } }))).toBe(false)
  })
})
