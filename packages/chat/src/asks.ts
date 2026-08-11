/**
 * The two payloads that ask a PERSON something, projected into one shape — and
 * the answer projected back.
 *
 * ACP has two of them and they arrive by different methods, but a reader is
 * being asked the same kind of thing by both, so the panel draws one thing:
 *
 *   - **`elicitation/create`, form mode.** A JSON Schema of primitive-typed
 *     properties. The Claude Code adapter renders its `AskUserQuestion` tool
 *     into one of these — a titled `oneOf` per single-select question, an array
 *     with a titled `anyOf` per multi-select, and beside each one a free-text
 *     "Other" box marked with a shared `_meta` key — and the answers go back as
 *     that tool's own `updatedInput`. MCP servers attached to the session reach
 *     the same method, with schemas of their own shape.
 *   - **`session/request_permission`.** A list of named options for one tool
 *     call. That is a single-select with the options already spelled out, so it
 *     becomes exactly that: one field, one choice per option.
 *
 * Everything here is a PURE function over a payload. Nothing waits, nothing
 * emits, and nothing knows a subprocess exists — which is what makes the shape
 * of a form somebody has never seen a unit test rather than a scenario.
 *
 * ## What is drawable, and what happens when something is not
 *
 * ACP's property schemas are `string` (with or without an enum), `array` of
 * enum, `boolean`, `number`, `integer` — and a reserved arm for kinds that do
 * not exist yet. The first five each get a field kind. The last one makes the
 * whole request UNDRAWABLE, and the caller declines it saying which property
 * and which type: half a form is a form somebody can submit while believing
 * they answered all of it, and an agent that then acts on the half it got is
 * the failure this rule exists to prevent. Never silently ignored — it renders
 * as a notice, like every other thing that went wrong (HACKING.md).
 *
 * "A value, or a `UsageFailure` saying why not" is how everything here answers,
 * in both directions. It is the vocabulary the rest of olai already refuses
 * things in — `UsageFailure` is precisely "the request itself is wrong; nothing
 * was read" — so a question this panel cannot draw and an answer that does not
 * fit its question are the same kind of no, spelled the same way.
 *
 * ## Text, both ways
 *
 * An answer travels as STRINGS ({@link AskAnswer}), whatever the field's type,
 * because what a person did was type characters or press a choice. Turning
 * those back into the numbers and booleans the schema asked for happens in
 * {@link contentOf}, which is the one place the schema is understood — and a
 * value that cannot be what the field asked for is REFUSED there rather than
 * coerced into a zero.
 */

import type {
  CreateElicitationRequest,
  ElicitationPropertySchema,
  ElicitationSchema,
  EnumOption,
  PermissionOption,
  RequestPermissionRequest,
} from "@agentclientprotocol/sdk"
import { UsageFailure } from "@olai/format"
import { type AskAnswer, type AskChoice, type AskField, YES_NO } from "@olai/surface"

/** A form to put in front of a person: what the agent said it needs, and the
 *  fields to fill in. */
export interface Form {
  readonly message: string
  readonly fields: ReadonlyArray<AskField>
}

/**
 * The `_meta` key an agent marks a per-question free-text box with.
 *
 * Deliberately un-namespaced in the adapter that emits it, so that clients can
 * recognise the same marker across the several agents bridging their own
 * "ask the user" tool onto ACP. Read here for one reason: a box that belongs to
 * the question above it is drawn INSIDE that question rather than as a seventh
 * field nobody can tell apart from the six real ones.
 */
const CUSTOM_ANSWER = "_askUserQuestionCustomAnswer"

// ── elicitation/create, form mode ──────────────────────────────────────

/** A form elicitation, as a form. */
export const formOf = (request: CreateElicitationRequest): Form | UsageFailure => {
  if (request.mode !== "form") {
    return new UsageFailure({
      reason:
        `the agent asked for a \`${request.mode}\` elicitation, which this panel does not draw`,
    })
  }
  const fields = fieldsOf((request as { requestedSchema?: ElicitationSchema }).requestedSchema)
  return fields instanceof UsageFailure ? fields : { message: request.message, fields }
}

const fieldsOf = (
  schema: ElicitationSchema | undefined,
): ReadonlyArray<AskField> | UsageFailure => {
  const properties = schema?.properties ?? {}
  const required = new Set(schema?.required ?? [])
  const fields: Array<AskField> = []
  // Insertion order, which is the order the agent wrote the properties in and
  // therefore the order it means them to be read: an "Other" box is emitted
  // straight after the question it belongs to.
  for (const [key, property] of Object.entries(properties)) {
    const field = fieldOf(key, property, required.has(key))
    if (field === null) {
      return new UsageFailure({
        reason: `the agent asked for \`${key}\`, a \`${
          String((property as { type?: unknown }).type)
        }\` field this panel does not draw`,
      })
    }
    fields.push(field)
  }
  return fields
}

/** One property, as a field — or `null` for a type this panel has no control
 *  for, which makes the whole request undrawable. */
const fieldOf = (
  key: string,
  property: ElicitationPropertySchema,
  required: boolean,
): AskField | null => {
  const shape = property as {
    readonly type?: unknown
    readonly title?: unknown
    readonly description?: unknown
    readonly enum?: unknown
    readonly oneOf?: unknown
    readonly items?: unknown
    readonly _meta?: Record<string, unknown> | null
  }
  const common = {
    key,
    label: textOr(shape.title, null),
    hint: textOr(shape.description, null),
    required,
    attachedTo: attachedTo(shape._meta),
  }

  switch (shape.type) {
    case "string": {
      const choices = choicesOf(shape.oneOf, shape.enum)
      return choices === null
        ? { ...common, kind: "text", choices: [] }
        : { ...common, kind: "choice", choices }
    }
    case "array": {
      const items = shape.items as
        | { readonly anyOf?: unknown; readonly enum?: unknown }
        | undefined
      const choices = choicesOf(items?.anyOf, items?.enum)
      // An array with no enumerable items is a list of free text, which has no
      // control here — and inventing one out of a comma-separated box would be
      // this layer deciding what a separator is.
      return choices === null ? null : { ...common, kind: "choices", choices }
    }
    case "boolean":
      return { ...common, kind: "boolean", choices: [] }
    case "number":
      return { ...common, kind: "number", choices: [] }
    case "integer":
      return { ...common, kind: "integer", choices: [] }
    default:
      return null
  }
}

/** The titled options, or the bare ones, or `null` for a field that enumerates
 *  nothing. The protocol offers both spellings and a titled option is the one
 *  with something to read, so it wins where both are present. */
const choicesOf = (
  titled: unknown,
  bare: unknown,
): ReadonlyArray<AskChoice> | null => {
  if (Array.isArray(titled) && titled.length > 0) {
    return (titled as ReadonlyArray<EnumOption>).map((option) => ({
      value: option.const,
      label: textOr(option.title, option.const),
      hint: textOr(option.description, null),
    }))
  }
  if (Array.isArray(bare) && bare.length > 0) {
    return (bare as ReadonlyArray<unknown>).map((value) => ({
      value: String(value),
      label: String(value),
      hint: null,
    }))
  }
  return null
}

/** Which field this one is the free-text companion of, if any. */
const attachedTo = (meta: Record<string, unknown> | null | undefined): string | null => {
  const marker = meta?.[CUSTOM_ANSWER] as { readonly questionId?: unknown } | undefined
  return typeof marker?.questionId === "string" ? marker.questionId : null
}

// ── session/request_permission ─────────────────────────────────────────

/** The one field a permission request is: pick an option. */
export const PERMISSION_FIELD = "permission"

/**
 * A permission request, as the same form everything else is drawn as.
 *
 * The tool call's own title is the message — for a plan-mode exit the adapter
 * makes that "Ready to code?", which is exactly the question — and each option
 * becomes a choice whose VALUE is the option id the protocol wants back.
 *
 * Nothing here reads the option KINDS. Sorting `allow`-flavoured options to the
 * front, or marking one as the safe default, would be this layer having an
 * opinion about which answer a person meant; the agent already sent them in the
 * order it wants them read.
 */
export const permissionFormOf = (request: RequestPermissionRequest): Form => ({
  message: textOr(request.toolCall.title, "the agent is asking for permission"),
  fields: [{
    key: PERMISSION_FIELD,
    label: null,
    hint: null,
    kind: "choice",
    choices: request.options.map((option: PermissionOption): AskChoice => ({
      value: option.optionId,
      label: option.name,
      hint: null,
    })),
    required: true,
    attachedTo: null,
  }],
})

// ── the answers, going back ────────────────────────────────────────────

/**
 * The answers as the content an elicitation response carries: one entry per
 * field somebody actually filled in, typed the way its schema asked for.
 *
 * Three things are REFUSED rather than smoothed over, because each of them is a
 * question whose answer would otherwise be invented:
 *
 *   - an answer for a field that was never asked for — the form on screen is
 *     not the form that was sent, so nothing about the rest of it can be
 *     trusted either;
 *   - `not a number` in a number field, which coerced would be a `0` nobody
 *     typed;
 *   - a required field left empty.
 *
 * A field left blank is simply ABSENT from the content, which is the schema's
 * own way of saying nothing was chosen — the adapter reads a missing key as
 * "skipped", and writes nothing into the tool's answers for it.
 */
export const contentOf = (
  fields: ReadonlyArray<AskField>,
  answers: ReadonlyArray<AskAnswer>,
): Record<string, string | number | boolean | Array<string>> | UsageFailure => {
  const byKey = new Map(fields.map((field) => [field.key, field]))
  const content: Record<string, string | number | boolean | Array<string>> = {}

  for (const answer of answers) {
    const field = byKey.get(answer.key)
    if (field === undefined) {
      return new UsageFailure({
        reason: `\`${answer.key}\` is not one of the fields this question asked for`,
      })
    }
    const value = valueOf(field, answer.values)
    if (value instanceof UsageFailure) return value
    if (value !== undefined) content[field.key] = value
  }

  for (const field of fields) {
    if (field.required && content[field.key] === undefined) {
      return new UsageFailure({
        reason: `${field.label ?? field.key} needs an answer`,
      })
    }
  }
  return content
}

/** One field's answer, typed — or `undefined` for one left alone. */
const valueOf = (
  field: AskField,
  values: ReadonlyArray<string>,
): string | number | boolean | Array<string> | undefined | UsageFailure => {
  if (field.kind === "choices") {
    const picked = values.filter((value) => value !== "")
    return picked.length === 0 ? undefined : [...picked]
  }
  const only = (values[0] ?? "").trim()
  if (only === "") return undefined
  switch (field.kind) {
    case "boolean":
      return only === YES_NO.yes
    case "number":
    case "integer": {
      const number = Number(only)
      if (!Number.isFinite(number) || (field.kind === "integer" && !Number.isInteger(number))) {
        return new UsageFailure({
          reason: `${field.label ?? field.key} wants ${
            field.kind === "integer" ? "a whole number" : "a number"
          }, and \`${only}\` is not one`,
        })
      }
      return number
    }
    default:
      return only
  }
}

/** A string that is actually there, or the fallback. The protocol spells
 *  "absent" three ways — missing, `null`, `""` — and a label made of one of
 *  those is a blank line where a reader expected a word. */
const textOr = <T>(value: unknown, fallback: T): string | T =>
  typeof value === "string" && value !== "" ? value : fallback
