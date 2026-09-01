/**
 * The model picker, over values.
 *
 * ACP's own `configOptions` and both agents' use of it ({@link ./models.ts}) —
 * so this is not one adapter's test even though the payloads in it are one
 * adapter's: the Claude Code adapter (0.66.0) is where the awkward cases live,
 * because it is the one whose picker offers ALIASES for the ids its CLI
 * reports. Opencode's picker offers the ids themselves and matches at the first
 * tier, which is the boring case a rule should also get right.
 *
 * What this file adds over a scenario is the near misses, cheap as values and
 * expensive to stage: a family alias against a lane-pinned row, two rows that
 * could both answer, a dated id no alias covers.
 */

import type { SessionConfigOption } from "@agentclientprotocol/sdk"
import { describe, expect, test } from "bun:test"

import { modelNameIn, modelPickerIn, pickerValueFor, sameModel } from "./models.ts"

describe("which config option is the model, and what it calls its values", () => {
  const picker = (
    options: Extract<SessionConfigOption, { type: "select" }>["options"],
  ): ReadonlyArray<SessionConfigOption> => [
    { id: "mode", name: "Mode", type: "select", currentValue: "plan", options: [] },
    { id: "model", name: "Model", type: "select", currentValue: "claude-opus-4-5", options },
  ]

  const labelsIn = (options: Extract<SessionConfigOption, { type: "select" }>["options"]) => {
    const read = modelPickerIn(picker(options))
    if (read === null) throw new Error("no model picker")
    return read.labels
  }

  test("the picked value is what the session says it is picking", () => {
    expect(modelPickerIn(picker([{ value: "claude-opus-4-5", name: "Opus" }])))
      .toMatchObject({ picked: "claude-opus-4-5" })
  })

  test("a flat picker is value → label", () => {
    const labels = labelsIn([
      { value: "claude-opus-4-5", name: "Opus" },
      { value: "claude-sonnet-4-5", name: "Sonnet" },
    ])
    expect(labels.get("claude-opus-4-5")).toBe("Opus")
    expect(labels.get("claude-sonnet-4-5")).toBe("Sonnet")
    expect(labels.size).toBe(2)
  })

  test("a grouped picker is read through its groups", () => {
    // The protocol tells a group from an option by SHAPE rather than by a tag,
    // and the adapter groups its models by tier.
    const labels = labelsIn([
      {
        group: "latest",
        name: "Latest",
        options: [
          { value: "claude-opus-4-5", name: "Opus" },
          { value: "claude-fable-5", name: "Fable" },
        ],
      },
      {
        group: "legacy",
        name: "Legacy",
        options: [{ value: "claude-sonnet-4-0", name: "Sonnet 4" }],
      },
    ])
    expect([...labels]).toEqual([
      ["claude-opus-4-5", "Opus"],
      ["claude-fable-5", "Fable"],
      ["claude-sonnet-4-0", "Sonnet 4"],
    ])
  })

  test("a live id the picker does not offer is absent rather than approximated", () => {
    // Which is what lets the caller keep the raw id and say so: a nearest match
    // onto a nearby row would be a model name nobody reported.
    expect(labelsIn([{ value: "claude-opus-4-5", name: "Opus" }])
      .get("claude-opus-4-5-20260101")).toBeUndefined()
    expect(labelsIn([]).size).toBe(0)
  })

  test("a session with no picker this adapter's shape leaves the model alone", () => {
    // `id === "model"` is the adapter's own spelling — ACP's only reserved hint
    // is `category`, and it says itself that it is UX-only. An agent that
    // spells the entry differently, or answers with something that is not a
    // select, costs the header a name and nothing else.
    expect(modelPickerIn(undefined)).toBeNull()
    expect(modelPickerIn([])).toBeNull()
    expect(modelPickerIn([
      { id: "model_id", name: "Model", type: "select", currentValue: "x", options: [] },
    ])).toBeNull()
    expect(modelPickerIn([{ id: "model", name: "Model", type: "boolean", currentValue: true }]))
      .toBeNull()
  })
})

describe("what the agent calls the model it is running", () => {
  /** The picker the adapter actually sent, captured off the wire at 0.66.0.
   *  Every value in it is an ALIAS — this is the whole reason the lookup needs
   *  a rule rather than a `Map.get`. */
  const OFFERED = new Map([
    ["default", "Default (recommended)"],
    ["opus[1m]", "Opus (1M context)"],
    ["claude-fable-5[1m]", "Fable"],
    ["sonnet", "Sonnet"],
    ["haiku", "Haiku"],
  ])

  test("a picked value is itself, which is the case that always worked", () => {
    expect(modelNameIn(OFFERED, "sonnet")).toBe("Sonnet")
    expect(modelNameIn(OFFERED, "claude-fable-5[1m]")).toBe("Fable")
    expect(modelNameIn(OFFERED, "default")).toBe("Default (recommended)")
  })

  test("the same model in the adapter's two spellings of a context lane", () => {
    // What the session came up on: the picker said `claude-fable-5[1m]` and the
    // CLI's `init` said `claude-fable-5`. One model, two spellings, and reading
    // them as two was the header changing its language mid-session.
    expect(modelNameIn(OFFERED, "claude-fable-5")).toBe("Fable")
    // The other spelling of the same hint, which the adapter treats as equal.
    expect(modelNameIn(OFFERED, "claude-fable-5-1m")).toBe("Fable")
  })

  test("a live API id lands on the alias row that names it", () => {
    // The bug, as three lines. After a `/model`, the next turn's `init` reports
    // the concrete API id; the picker offers only the alias. The header used to
    // give up and print the id.
    expect(modelNameIn(OFFERED, "claude-sonnet-5")).toBe("Sonnet")
    expect(modelNameIn(OFFERED, "claude-haiku-4-5")).toBe("Haiku")
  })

  test("a family alias does not lend the live id a context lane it never stated", () => {
    // Constructed against the real adapter in review, not imagined: `/model
    // claude-opus-4-5` runs a 200k session, the live id arrives laneless, and
    // the picker's only Opus row is the 1M one. Answering it named a context
    // window five times the real one — in the header a person reads to decide
    // whether to `/compact`, which is the one question that number is for.
    //
    // The raw id claims nothing, and claiming nothing is the truthful answer to
    // a lane the CLI did not report.
    expect(modelNameIn(OFFERED, "claude-opus-4-5")).toBeNull()
    expect(modelNameIn(OFFERED, "claude-opus-5")).toBeNull()
    // A LANELESS Opus row answers it, because then nothing is being added.
    const plain = new Map([...OFFERED, ["opus", "Opus"]])
    plain.delete("opus[1m]")
    expect(modelNameIn(plain, "claude-opus-5")).toBe("Opus")
  })

  test("tier 2 is an identity, so the adapter's own two spellings still meet", () => {
    // Not the same claim as the alias tier above, and the difference is why
    // this one is allowed to cross a lane spelling: `claude-fable-5[1m]` and
    // `claude-fable-5` are ONE id written the adapter's two ways
    // (`canonicalizeModelId` is its own equality), not a family and a guess at
    // which member of it. Refusing here would have flipped the header from
    // "Fable" to a raw id on the first turn of every session.
    expect(modelNameIn(OFFERED, "claude-fable-5")).toBe("Fable")
  })

  test("`default` names no model, so nothing resolves onto it", () => {
    // It is the adapter's word for "whichever one the CLI recommends today".
    // It is also a bare word sitting in the alias tier, so it has to be said
    // rather than assumed.
    expect(modelNameIn(new Map([["default", "Default (recommended)"]]), "claude-opus-5"))
      .toBeNull()
    expect(modelNameIn(new Map([["default", "Default (recommended)"]]), "default-5"))
      .toBeNull()
  })

  test("two lanes on offer is answered by the one the live id is in", () => {
    // A picker offering a bare `sonnet` and a `sonnet[1m]` is offering two
    // context lanes. The live id states none, so it is the LANELESS row — and
    // saying "Sonnet" adds nothing to what the CLI reported, where naming the
    // 1M row would have.
    const both = new Map([["sonnet", "Sonnet"], ["sonnet[1m]", "Sonnet (1M context)"]])
    expect(modelNameIn(both, "claude-sonnet-5")).toBe("Sonnet")
  })

  test("two rows that could both be it is a question this does not answer", () => {
    // Tier 2, where the lane rule cannot help: two values that are one id in
    // the adapter's two spellings of the SAME lane. Nothing tells them apart,
    // so nothing is said.
    const lanes = new Map([
      ["claude-opus-5[1m]", "Opus (1M context)"],
      ["claude-opus-5-1m", "Opus, again"],
    ])
    expect(modelNameIn(lanes, "claude-opus-5")).toBeNull()
    // ... and the same refusal a tier down, on two spellings of one family.
    const cased = new Map([["sonnet", "Sonnet"], ["SONNET", "Sonnet, shouting"]])
    expect(modelNameIn(cased, "claude-sonnet-5")).toBeNull()
  })

  test("nothing is approximated onto a row that is merely nearby", () => {
    // The rule the picker's own note has always stated, and it still holds:
    // these are exact comparisons, and a model this picker does not offer is
    // reported raw by the caller rather than rounded to a neighbour.
    expect(modelNameIn(OFFERED, "gpt-5")).toBeNull()
    expect(modelNameIn(OFFERED, "claude-opus-4-5-20260101")).toBeNull()
    // A multi-word value never plays in the alias tier: `claude-sonnet-4-5` is
    // not what `claude-sonnet-5` says it is, however much of it overlaps.
    expect(modelNameIn(new Map([["claude-sonnet-4-5", "Sonnet 4.5"]]), "claude-sonnet-5"))
      .toBeNull()
    expect(modelNameIn(new Map(), "claude-sonnet-5")).toBeNull()
    expect(modelNameIn(OFFERED, "")).toBeNull()
  })
})

describe("whether two model strings are the same model", () => {
  // The question a restored conversation turns on: the panel remembers what
  // this conversation was RUNNING and the load reports what the agent put it
  // on, and the model is set back only when those two disagree
  // (`chat-model-reverts-on-restart`). Answering "disagree" too readily costs a
  // round trip and a picker moved for nothing; answering it too rarely is the
  // bug still there.
  const OFFERED = new Map([
    ["default", "Default (recommended)"],
    ["claude-fable-5[1m]", "Fable"],
    ["sonnet", "Sonnet"],
    ["haiku", "Haiku"],
  ])

  test("the same string is the same model, whatever anybody offers", () => {
    expect(sameModel(OFFERED, "sonnet", "sonnet")).toBe(true)
    // Including one nothing here has a name for: two strings that are the same
    // string are the same model without a picker's help.
    expect(sameModel(new Map(), "gpt-5", "gpt-5")).toBe(true)
  })

  test("a picker value and the live id it resolves to are one model", () => {
    // The case that matters: what we remembered is a `/model`, which arrives as
    // a concrete API id, and what the load reports is the picker's own alias.
    // Read as strings these disagree, and the panel would set a model the
    // session is already on at every single boot.
    expect(sameModel(OFFERED, "sonnet", "claude-sonnet-5")).toBe(true)
    expect(sameModel(OFFERED, "claude-fable-5[1m]", "claude-fable-5")).toBe(true)
  })

  test("two different models disagree, which is what makes it worth asking", () => {
    expect(sameModel(OFFERED, "sonnet", "haiku")).toBe(false)
    expect(sameModel(OFFERED, "sonnet", "claude-haiku-4-5")).toBe(false)
  })

  test("`default` is not the model it resolves to, because nothing here can know", () => {
    // The adapter's word for "whichever one the CLI recommends today" resolves
    // to a concrete model, and the picker's `configOptions` never say which —
    // so a session on `default` and a note saying `claude-sonnet-5` are two
    // different answers as far as anything on this wire goes. Erring this way
    // costs one round trip; erring the other way is a `/model` silently lost.
    expect(sameModel(OFFERED, "default", "claude-sonnet-5")).toBe(false)
  })

  test("a model the picker cannot name answers only for itself", () => {
    // Both unnameable: `modelNameIn` gives up on each, each stands for itself,
    // and two different ids stay two different models rather than collapsing
    // into one `null`.
    expect(sameModel(OFFERED, "gpt-5", "claude-opus-4-5-20260101")).toBe(false)
    expect(sameModel(OFFERED, "sonnet", "gpt-5")).toBe(false)
  })
})

describe("the picker's own word for a model", () => {
  // The other direction of the same bridge, and the one a REQUEST crosses: what
  // the panel remembers is what the CLI reported (`claude-sonnet-5`), and a
  // `session/set_config_option` takes a value the picker offers (`sonnet`).
  const OFFERED = new Map([
    ["default", "Default (recommended)"],
    ["opus[1m]", "Opus (1M context)"],
    ["claude-fable-5[1m]", "Fable"],
    ["sonnet", "Sonnet"],
    ["haiku", "Haiku"],
  ])

  test("a live id is asked for as the row that names it", () => {
    expect(pickerValueFor(OFFERED, "claude-sonnet-5")).toBe("sonnet")
    expect(pickerValueFor(OFFERED, "claude-haiku-4-5")).toBe("haiku")
    // The adapter's two spellings of one id are one row, so the row is found
    // for the spelling the CLI uses as well as the one the picker does.
    expect(pickerValueFor(OFFERED, "claude-fable-5")).toBe("claude-fable-5[1m]")
  })

  test("a value the picker offers is already its own word", () => {
    expect(pickerValueFor(OFFERED, "sonnet")).toBe("sonnet")
    expect(pickerValueFor(OFFERED, "opus[1m]")).toBe("opus[1m]")
    // Including `default`, which names no model but IS a row: a conversation
    // sitting on it is put back on it by name.
    expect(pickerValueFor(OFFERED, "default")).toBe("default")
  })

  test("no row is `null`, and the caller asks in the words it has", () => {
    // The refusals `modelNameIn` already makes, arriving here as "nothing to
    // translate into": a lane the live id never claimed, a dated pin, a model
    // from somewhere else entirely. An agent that resolves them still can.
    expect(pickerValueFor(OFFERED, "claude-opus-5")).toBeNull()
    expect(pickerValueFor(OFFERED, "claude-haiku-4-5-20251001")).toBeNull()
    expect(pickerValueFor(OFFERED, "gpt-5")).toBeNull()
  })

  test("two rows sharing a name answer for neither", () => {
    // A picker naming two values alike is a picker that cannot say which row a
    // name means. Nothing is guessed; the raw string goes out instead.
    const twice = new Map([["sonnet", "Sonnet"], ["sonnet-alt", "Sonnet"]])
    expect(pickerValueFor(twice, "sonnet-alt")).toBe("sonnet-alt")
    expect(pickerValueFor(twice, "claude-sonnet-5")).toBeNull()
  })
})
