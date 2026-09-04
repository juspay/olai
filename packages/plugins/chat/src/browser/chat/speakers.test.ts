/**
 * WHOSE FACE GOES OVER WHICH ROW — the rule, without a browser.
 *
 * What is asserted here is the ATTRIBUTION and the RUN: that a plugin's
 * doorbell is never drawn as the person whose lane it travels down, that an
 * agent's calls are the agent rather than a fourth party, and that a face is
 * owed once per stretch rather than once per row. Nothing here reads a class, a
 * glyph or a colour — {@link ./speakers.ts} answers in parties, and what a
 * party LOOKS like is {@link ./Speaker.tsx}'s.
 */

import { describe, expect, test } from "bun:test"

import type { AgentEntry, NoticeEntry, ToolEntry, UserEntry } from "olai-plugin-chat/wire"
import { facedAt, onTheRight, sameSpeaker, speakerOf } from "./speakers.ts"

const head = { seq: 0, since: "2026-08-31T12:00:00.000Z" }

const said = (extra: Partial<UserEntry> = {}): UserEntry => ({
  ...head,
  id: "user-1",
  kind: "user",
  text: "what is left on the lane?",
  ...extra,
})

const answered = (extra: Partial<AgentEntry> = {}): AgentEntry => ({
  ...head,
  id: "agent-1",
  kind: "agent",
  text: "two steps",
  ...extra,
})

const called = (extra: Partial<ToolEntry> = {}): ToolEntry => ({
  ...head,
  id: "tool-1",
  kind: "tool",
  text: "read_subtree",
  status: "completed",
  ...extra,
})

const noticed = (extra: Partial<NoticeEntry> = {}): NoticeEntry => ({
  ...head,
  id: "notice-1",
  kind: "notice",
  text: "conversation resumed",
  ...extra,
})

describe("whose row it is", () => {
  test("a message somebody typed is the person's", () => {
    expect(speakerOf(said())).toEqual({ of: "human" })
  })

  test("... and the same row with a plugin's mark on it is the PLUGIN's", () => {
    // The mark is the only difference between the two rows, which is the whole
    // reason it is stamped: a doorbell travels down the human's lane.
    expect(speakerOf(said({ rang: "kolu" }))).toEqual({ of: "plugin", name: "kolu" })
  })

  test("the mark names WHICH plugin, since a conversation can have two doors", () => {
    expect(speakerOf(said({ rang: "odu" }))).toEqual({ of: "plugin", name: "odu" })
  })

  test("the agent's prose, its calls and its questions are one party", () => {
    expect(speakerOf(answered())).toEqual({ of: "agent" })
    expect(speakerOf(called())).toEqual({ of: "agent" })
  })

  test("the panel's own words about the conversation are nobody's", () => {
    expect(speakerOf(noticed())).toBeNull()
  })

  test("a row whose value has not landed yet is nobody's", () => {
    expect(speakerOf(undefined)).toBeNull()
  })
})

describe("the same party, or not", () => {
  test("two plugins are not one another", () => {
    expect(sameSpeaker({ of: "plugin", name: "kolu" }, { of: "plugin", name: "odu" }))
      .toBe(false)
  })

  test("one plugin is itself", () => {
    expect(sameSpeaker({ of: "plugin", name: "kolu" }, { of: "plugin", name: "kolu" }))
      .toBe(true)
  })

  test("a plugin is never the person whose lane it borrowed", () => {
    expect(sameSpeaker({ of: "plugin", name: "kolu" }, { of: "human" })).toBe(false)
  })

  test("nobody is not the same as nobody", () => {
    expect(sameSpeaker(null, null)).toBe(false)
  })
})

describe("where a run begins", () => {
  test("the first row of a conversation is always faced", () => {
    expect(facedAt(said(), undefined)).toEqual({ of: "human" })
  })

  test("a second row from the same party is not", () => {
    expect(facedAt(answered({ id: "agent-2" }), answered())).toBeNull()
  })

  test("a tool call does not break the agent's run, and gets no face of its own", () => {
    expect(facedAt(called(), answered())).toBeNull()
  })

  test("... so the paragraph AFTER a run of calls is still inside it", () => {
    expect(facedAt(answered({ id: "agent-2" }), called())).toBeNull()
  })

  test("the party changing is what draws a face", () => {
    expect(facedAt(answered(), said())).toEqual({ of: "agent" })
    expect(facedAt(said(), answered())).toEqual({ of: "human" })
  })

  test("a doorbell under a person's own message is faced as the plugin", () => {
    expect(facedAt(said({ id: "user-2", rang: "kolu" }), said()))
      .toEqual({ of: "plugin", name: "kolu" })
  })

  test("... and the person's next message is faced again, not folded into it", () => {
    expect(facedAt(said({ id: "user-3" }), said({ id: "user-2", rang: "kolu" })))
      .toEqual({ of: "human" })
  })

  test("a second doorbell from the same plugin does not repeat the face", () => {
    expect(facedAt(said({ id: "user-3", rang: "kolu" }), said({ id: "user-2", rang: "kolu" })))
      .toBeNull()
  })

  test("... but one from a different plugin does", () => {
    expect(facedAt(said({ id: "user-3", rang: "odu" }), said({ id: "user-2", rang: "kolu" })))
      .toEqual({ of: "plugin", name: "odu" })
  })

  test("the panel's own line wears no face, whatever is above it", () => {
    expect(facedAt(noticed(), answered())).toBeNull()
  })

  test("... and it ends the run, so the next speaker is named again", () => {
    expect(facedAt(answered({ id: "agent-2" }), noticed())).toEqual({ of: "agent" })
  })
})

describe("which side the words are on", () => {
  test("the person's, and only the person's", () => {
    expect(onTheRight({ of: "human" })).toBe(true)
    expect(onTheRight({ of: "agent" })).toBe(false)
    // A machine's sentence travels down the human's lane and must never wear
    // the human's bubble — the row's oldest rule, asked here of its face.
    expect(onTheRight({ of: "plugin", name: "kolu" })).toBe(false)
  })
})
