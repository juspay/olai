/**
 * The projection, over values.
 *
 * These are the payloads a real agent sends, written out by hand from the
 * pinned adapter's own `dist/elicitation.js` (0.66.0) — a single-select with an
 * "Other" box, a multi-select, and the plan-mode permission request whose first
 * allow-flavoured option silently switched the session's permission mode for as
 * long as the panel answered these by machine.
 *
 * Nothing here needs a subprocess, which is the point of {@link ./asks.ts}
 * being pure: what a form LOOKS like for a question nobody has asked yet is a
 * unit test rather than a scenario nobody can write.
 */

import type {
  CreateElicitationRequest,
  RequestPermissionRequest,
} from "@agentclientprotocol/sdk"
import { UsageFailure } from "@olai/format"
import type { AskField } from "@olai/surface"
import { describe, expect, test } from "bun:test"

import { contentOf, formOf, PERMISSION_FIELD, permissionFormOf } from "./asks.ts"

/** The shape `askUserQuestionsToCreateRequest` builds for ONE single-select
 *  question: the question itself as the message, a titled `oneOf`, and the
 *  per-question free-text companion beside it. */
const oneQuestion: CreateElicitationRequest = {
  mode: "form",
  sessionId: "s1",
  toolCallId: "call-1",
  message: "Which library should we use for date formatting?",
  requestedSchema: {
    type: "object",
    properties: {
      question_0: {
        type: "string",
        title: "Library",
        oneOf: [
          { const: "date-fns", title: "date-fns", description: "Tree-shakeable" },
          { const: "Luxon", title: "Luxon" },
        ],
      },
      question_0_custom: {
        type: "string",
        title: "Other",
        description: "Type your own answer instead of choosing an option above (optional).",
        _meta: {
          _askUserQuestionCustomAnswer: { questionId: "question_0", isCustomAnswer: true },
        },
      },
    },
  },
}

const field = (fields: ReadonlyArray<AskField>, key: string): AskField => {
  const found = fields.find((each) => each.key === key)
  if (found === undefined) throw new Error(`no field \`${key}\``)
  return found
}

const formIn = (request: CreateElicitationRequest) => {
  const projected = formOf(request)
  if (projected._tag !== "form") throw new Error(`undrawable: ${projected.why}`)
  return projected.form
}

describe("a question, as a form", () => {
  test("the message is the question and the options are the choices", () => {
    const form = formIn(oneQuestion)

    expect(form.message).toBe("Which library should we use for date formatting?")
    const choice = field(form.fields, "question_0")
    expect(choice.kind).toBe("choice")
    expect(choice.label).toBe("Library")
    expect(choice.choices).toEqual([
      { value: "date-fns", label: "date-fns", hint: "Tree-shakeable" },
      { value: "Luxon", label: "Luxon", hint: null },
    ])
  })

  test("the free-text box says which question it belongs to", () => {
    // Drawn as a seventh field it would read as a second question. The marker
    // is un-namespaced in the adapter on purpose — several agents bridge their
    // own "ask the user" tool this way — so it is read as the shared thing it
    // is.
    expect(field(formIn(oneQuestion).fields, "question_0_custom")).toMatchObject({
      kind: "text",
      attachedTo: "question_0",
    })
  })

  test("a multi-select is a field that takes several", () => {
    const form = formIn({
      ...oneQuestion,
      message: "Please answer the following questions.",
      requestedSchema: {
        type: "object",
        properties: {
          question_0: {
            type: "array",
            title: "Features",
            description: "Which features do you want to enable?",
            items: {
              anyOf: [
                { const: "search", title: "Search" },
                { const: "journal", title: "Journal" },
              ],
            },
          },
        },
      },
    })

    expect(field(form.fields, "question_0")).toMatchObject({
      kind: "choices",
      label: "Features",
      hint: "Which features do you want to enable?",
    })
    expect(field(form.fields, "question_0").choices).toHaveLength(2)
  })

  test("a field with no title is left unlabelled rather than called `question_0`", () => {
    // The single-question case: the question travels as the message, and a
    // label invented from the property key is the schema's plumbing on screen.
    const form = formIn({
      ...oneQuestion,
      requestedSchema: {
        type: "object",
        properties: { question_0: { type: "string", enum: ["yes", "no"] } },
      },
    })
    expect(field(form.fields, "question_0").label).toBeNull()
    expect(field(form.fields, "question_0").choices).toEqual([
      { value: "yes", label: "yes", hint: null },
      { value: "no", label: "no", hint: null },
    ])
  })

  test("the other primitives an MCP server may ask for are drawable", () => {
    const form = formIn({
      ...oneQuestion,
      requestedSchema: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", title: "Name" },
          age: { type: "integer", title: "Age" },
          rating: { type: "number", title: "Rating" },
          agree: { type: "boolean", title: "Agree?" },
        },
      },
    })
    expect(form.fields.map((each) => each.kind)).toEqual([
      "text",
      "integer",
      "number",
      "boolean",
    ])
    expect(field(form.fields, "name").required).toBe(true)
    expect(field(form.fields, "age").required).toBe(false)
  })

  test("a field this panel cannot draw makes the whole question undrawable", () => {
    // Half a form is worse than none: somebody submits believing they answered
    // all of it, and the agent acts on the half that arrived. The caller
    // declines and SAYS so — never silently ignored (HACKING.md).
    const projected = formOf({
      ...oneQuestion,
      requestedSchema: {
        type: "object",
        properties: {
          question_0: { type: "string", oneOf: [{ const: "a", title: "a" }] },
          weird: { type: "_something-new" },
        },
      },
    } as CreateElicitationRequest)

    expect(projected._tag).toBe("undrawable")
    if (projected._tag !== "undrawable") return
    expect(projected.why).toContain("weird")
    expect(projected.why).toContain("_something-new")
  })

  test("a url elicitation is undrawable rather than half-drawn", () => {
    const projected = formOf({
      mode: "url",
      sessionId: "s1",
      elicitationId: "e1",
      message: "Sign in",
      url: "https://example.invalid/auth",
    })
    expect(projected._tag).toBe("undrawable")
  })
})

describe("a permission request, as the same form", () => {
  /** The adapter's plan-mode exit, verbatim in shape: `auto` FIRST and
   *  allow-flavoured, which is what a client answering by machine picked. */
  const exitPlanMode: RequestPermissionRequest = {
    sessionId: "s1",
    toolCall: {
      toolCallId: "call-9",
      title: "Ready to code?",
      kind: "switch_mode",
    },
    options: [
      { kind: "allow_always", name: 'Yes, and use "auto" mode', optionId: "auto" },
      { kind: "allow_once", name: "Yes, and manually approve edits", optionId: "default" },
      { kind: "reject_once", name: "No, keep planning", optionId: "plan" },
    ],
  }

  test("the tool call's title is the question and the options are the choices", () => {
    const form = permissionFormOf(exitPlanMode)

    expect(form.message).toBe("Ready to code?")
    expect(form.fields).toHaveLength(1)
    expect(form.fields[0]).toMatchObject({ key: PERMISSION_FIELD, kind: "choice" })
    expect(form.fields[0]?.choices).toEqual([
      { value: "auto", label: 'Yes, and use "auto" mode', hint: null },
      { value: "default", label: "Yes, and manually approve edits", hint: null },
      { value: "plan", label: "No, keep planning", hint: null },
    ])
  })

  test("the order is the agent's own — nothing is sorted or preselected", () => {
    // Moving the reject to the front, or marking one as the safe default, would
    // be this layer having an opinion about which answer a person meant.
    const form = permissionFormOf(exitPlanMode)
    expect(form.fields[0]?.choices.map((choice) => choice.value)).toEqual([
      "auto",
      "default",
      "plan",
    ])
  })
})

describe("the answers, going back", () => {
  const fields = formIn(oneQuestion).fields

  test("a picked option travels as the option's own value", () => {
    const content = contentOf(fields, [{ key: "question_0", values: ["Luxon"] }])
    expect(content).toEqual({ content: { question_0: "Luxon" } })
  })

  test("a field left alone is absent rather than empty", () => {
    // Absent is the schema's own way of saying nothing was chosen, and the
    // adapter reads it as "skipped". An empty string would be an answer.
    const content = contentOf(fields, [{ key: "question_0_custom", values: ["  "] }])
    expect(content).toEqual({ content: {} })
  })

  test("a multi-select travels as the list it is", () => {
    const many: ReadonlyArray<AskField> = [{
      key: "question_0",
      label: null,
      hint: null,
      kind: "choices",
      choices: [],
      required: false,
      attachedTo: null,
    }]
    expect(contentOf(many, [{ key: "question_0", values: ["a", "b"] }])).toEqual({
      content: { question_0: ["a", "b"] },
    })
  })

  test("a number is a number and a boolean is a boolean", () => {
    const typed: ReadonlyArray<AskField> = [
      {
        key: "age",
        label: "Age",
        hint: null,
        kind: "integer",
        choices: [],
        required: false,
        attachedTo: null,
      },
      {
        key: "agree",
        label: "Agree?",
        hint: null,
        kind: "boolean",
        choices: [],
        required: false,
        attachedTo: null,
      },
    ]
    expect(
      contentOf(typed, [
        { key: "age", values: ["41"] },
        { key: "agree", values: ["false"] },
      ]),
    ).toEqual({ content: { age: 41, agree: false } })
  })

  test("a number field given something else is refused, not coerced to zero", () => {
    const typed: ReadonlyArray<AskField> = [{
      key: "age",
      label: "Age",
      hint: null,
      kind: "integer",
      choices: [],
      required: false,
      attachedTo: null,
    }]
    const refused = contentOf(typed, [{ key: "age", values: ["forty"] }])
    expect(refused).toBeInstanceOf(UsageFailure)
    expect((refused as UsageFailure).reason).toContain("forty")
  })

  test("an answer for a field nobody asked for is refused", () => {
    // The form on screen is not the form that was sent, so nothing about the
    // rest of it can be trusted either.
    expect(contentOf(fields, [{ key: "question_7", values: ["x"] }]))
      .toBeInstanceOf(UsageFailure)
  })

  test("a required field left empty is refused", () => {
    const required: ReadonlyArray<AskField> = [{
      key: "name",
      label: "Name",
      hint: null,
      kind: "text",
      choices: [],
      required: true,
      attachedTo: null,
    }]
    const refused = contentOf(required, [])
    expect(refused).toBeInstanceOf(UsageFailure)
    expect((refused as UsageFailure).reason).toContain("Name")
  })
})
