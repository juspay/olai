/**
 * The old record shape, read for the last time.
 *
 * Every outline written before properties spells a node's facts as fields of
 * the record — `todo`, `doing`, `done`, `date`, `see`, `after`, `blocks`. This
 * module turns one of those into the shape `./node.ts` now declares, and it is
 * the ONLY place in olai that knows those seven words. Nothing else reads them,
 * nothing else writes them, and a sweep test (`packages/tests/props.test.ts`)
 * says so, because the one way a migration like this rots is a second reader
 * left behind that goes on half-understanding files nobody writes any more.
 *
 * EAGER, AND ONCE. The server rewrites every outline it serves the first time
 * it starts on a binary that has this (`@olai/server`'s `migrate.ts`), rather
 * than translating on the fly for ever. A reader that accepts both shapes is a
 * format with two spellings of every fact, and every rule downstream has to
 * keep asking which one it got — which is exactly the "two chances to disagree"
 * this codebase refuses everywhere else. One sweep, one flip, and the vault's
 * next commit carries it.
 *
 * ## What faithful means here
 *
 * Every mark, every instant, every date and every edge survives EXACTLY, and
 * that is provable rather than asserted: {@link meaningOf} reads the six facts
 * off an old record by hand, the new accessors read the same six off what came
 * out, and `migrate.test.ts` compares them over a corpus. The one thing that is
 * deliberately not preserved is the record's own key ORDER, which the writer
 * owns and always did (./write.ts).
 *
 * ## What it declines to touch
 *
 * A record it cannot migrate faithfully is left EXACTLY as it was, and the file
 * it is in is left alone with it — reported, never guessed at. There are three,
 * and every one of them is already a record no set could load:
 *
 *   - a record carrying TWO marks. Three fields could hold three answers to one
 *     question and the validator refused the set for it (`several-marks`); one
 *     `status` key can hold one, so migrating would mean choosing which of the
 *     two to throw away. The record was never servable, so nothing is lost by
 *     leaving it — and the human who has to fix it should see what they wrote
 *     rather than half of it;
 *   - a record carrying an old field AND a `props` map, which is a file some
 *     other tool has been in the middle of. There is no rule for merging them
 *     that is not a guess;
 *   - a record carrying a key this format has no field for. That one is about
 *     the REWRITE rather than the meaning: what comes out of here is serialised
 *     by ./write.ts, which writes the fields it knows and no others, so a `titel`
 *     would be silently deleted by the step whose whole promise is faithfulness.
 *     The validator was about to name it; it still can, because the bytes stay.
 *
 * A file holding either keeps every byte, so a second start finds the same
 * problem and says the same thing. That is what makes declining safe: this is
 * not a step that can be half-done.
 */

import { MirrorNode, type Node, RegularNode } from "./node.ts"
import { EDGE_FIELDS, MARKS, SINCE, STATUS } from "./props.ts"

/** The seven words this module exists to stop everyone else from knowing.
 *  Declaration order is only for the report; nothing reads it as precedence
 *  except {@link markIn}, which reads {@link MARKS} for that. */
const LEGACY_FIELDS = [...MARKS, "date", ...EDGE_FIELDS] as const

/** Which of the old fields a record carries. Empty means the record is already
 *  in the new shape (or is a mirror, which never had any of them). */
const legacyIn = (record: Readonly<Record<string, unknown>>): ReadonlyArray<string> =>
  LEGACY_FIELDS.filter((field) => record[field] !== undefined)

/** Why a record could not be migrated — or `null` for one that can. */
const refusalFor = (
  record: Readonly<Record<string, unknown>>,
): string | null => {
  const marks = MARKS.filter((mark) => record[mark] !== undefined)
  if (marks.length > 1) {
    return `it carries ${
      marks.map((mark) => `\`${mark}\``).join(" and ")
    }, and one \`${STATUS}\` cannot hold both — drop whichever is stale, then start again`
  }
  if (record["props"] !== undefined) {
    return `it carries both \`props\` and ${
      legacyIn(record).map((field) => `\`${field}\``).join(", ")
    }, and there is no rule for merging them that is not a guess`
  }
  // A KEY THE FORMAT DOES NOT DEFINE, and this one is about what rewriting
  // COSTS rather than about what the record means. A migrated file is written
  // by ./write.ts, which emits the fields it knows and no others — so a record
  // carrying `titel` would come back without it, and a typo the validator was
  // about to name would instead be quietly deleted by the step that was
  // supposed to be faithful. The record is one no set could load anyway; it
  // keeps its bytes and gets its own sentence.
  const unknown = Object.keys(record).filter((key) =>
    !KNOWN_FIELDS.has(key) && !(LEGACY_FIELDS as ReadonlyArray<string>).includes(key)
  )
  if (unknown.length > 0) {
    return `it carries ${
      unknown.map((key) => `\`${key}\``).join(", ")
    }, which this format has no field for — rewriting the record would drop it`
  }
  return null
}

/** Every field either record shape declares, asked of the schemas rather than
 *  listed: what a rewrite is able to carry over is exactly what a writer knows
 *  how to write, and both read this same declaration. */
const KNOWN_FIELDS: ReadonlySet<string> = new Set([
  ...Object.keys(RegularNode.fields),
  ...Object.keys(MirrorNode.fields),
])

/** The mark a record stores, in {@link MARKS} precedence — the reading the old
 *  `markOf` did, kept here because this is the last module entitled to
 *  it. Only ever asked of a record {@link refusalFor} has cleared, so the
 *  precedence decides nothing. */
const markIn = (
  record: Readonly<Record<string, unknown>>,
): string | undefined => MARKS.find((mark) => record[mark] !== undefined)

/**
 * The six facts an old record states, as one value — what "byte-faithful in
 * meaning" is measured against.
 *
 * Read off the OLD spelling by hand, on purpose: a comparison whose two sides
 * both went through the migration would agree with itself about anything. The
 * other side is built with the accessors every reading in olai now uses
 * (`migrate.test.ts`), so what is being compared is what the file said before
 * against what the format answers after.
 */
export interface Meaning {
  readonly mark: string | undefined
  /** The instant the mark was reached — `undefined` for a bare `true`, which
   *  is a state somebody reached and declined to date. */
  readonly since: string | undefined
  readonly date: string | undefined
  readonly edges: Readonly<Record<string, ReadonlyArray<string>>>
}

export const meaningOf = (record: Readonly<Record<string, unknown>>): Meaning => {
  const mark = markIn(record)
  const value = mark === undefined ? undefined : record[mark]
  const date = record["date"]
  return {
    mark,
    since: typeof value === "string" ? value : undefined,
    date: typeof date === "string" ? date : undefined,
    edges: Object.fromEntries(
      EDGE_FIELDS.flatMap((field) => {
        const held = record[field]
        return Array.isArray(held) ? [[field, held as ReadonlyArray<string>]] : []
      }),
    ),
  }
}

/** What one record's migration came to. `unchanged` is a record that was
 *  already in the new shape — the common case on every start after the first,
 *  and what makes the sweep idempotent without a marker file to remember it
 *  by. */
export type RecordResult =
  | { readonly kind: "unchanged" }
  | { readonly kind: "migrated"; readonly record: Record<string, unknown> }
  | { readonly kind: "refused"; readonly why: string }

/**
 * One record, in the new shape.
 *
 * The old fields come OUT and their facts go into `props`; every other key —
 * `id`, `parent`, `ord`, `title`, `desc`, `doc`, `mirror`, and anything a
 * future field might be — is carried over verbatim, in the order it arrived.
 * The writer re-orders both the record and the map when it serialises
 * (./write.ts), so nothing here has to.
 *
 * A key holding an EMPTY list is dropped rather than carried, which is the
 * writer's own rule for absence applied at the moment of the move: `{"see":[]}`
 * could reach a file written by hand, and it must not become a `props` entry
 * that then differs from a record with no `see` at all.
 */
export const migrateRecord = (
  record: Readonly<Record<string, unknown>>,
): RecordResult => {
  if (legacyIn(record).length === 0) return { kind: "unchanged" }

  const why = refusalFor(record)
  if (why !== null) return { kind: "refused", why }

  const props: Record<string, unknown> = {}
  const mark = markIn(record)
  if (mark !== undefined) {
    props[STATUS] = mark
    const value = record[mark]
    // A string is the instant the state was reached; `true` is the state
    // reached without one, and it becomes an ABSENT `since` rather than any
    // value at all. Those two are the whole of what a mark field held.
    if (typeof value === "string") props[SINCE] = value
  }
  if (typeof record["date"] === "string") props["date"] = record["date"]
  for (const field of EDGE_FIELDS) {
    const held = record[field]
    if (Array.isArray(held) && held.length > 0) props[field] = held
  }

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    if ((LEGACY_FIELDS as ReadonlyArray<string>).includes(key)) continue
    out[key] = value
  }
  if (Object.keys(props).length > 0) out["props"] = props
  return { kind: "migrated", record: out }
}

/** What one FILE's migration came to. `left` carries every reason a record in
 *  it was declined, with the line it is on, because a file is migrated whole or
 *  not at all and the human needs all of them rather than the first. */
export type FileResult =
  | { readonly kind: "unchanged" }
  /** Ready for ./write.ts. Typed as records rather than as raw objects because
   *  they ARE records: every key on every one of them is a field this format
   *  declares — that is exactly what {@link refusalFor}'s third arm establishes,
   *  and it is what makes serialising them lossless. They are not yet VALID
   *  (a `title` could be a number, an id could be a duplicate); the validator is
   *  next and says so, as it would have about the file before. */
  | { readonly kind: "migrated"; readonly records: ReadonlyArray<Node> }
  | { readonly kind: "left"; readonly why: ReadonlyArray<{ line: number; why: string }> }

/**
 * One outline's lines, migrated — or a reason the file was left alone.
 *
 * WHOLE OR NOT AT ALL, the same bargain ./parse.ts strikes for decoding: a file
 * that is half in each shape is a file no reader has a rule for, and one that
 * is entirely in the old shape is a file the next start can try again on. So
 * one declined record leaves every byte of its file untouched.
 *
 * A line that is not JSON, or is not an object, is not this module's to judge —
 * the file keeps it verbatim and ./parse.ts says what is wrong with it in the
 * words it already has. A migration that started rewriting broken files would
 * be a second validator, arriving before the real one and with less to say.
 * Such a line means the file cannot be rewritten at all, since the records this
 * hands back are what get serialised; it is reported as left, so a vault with a
 * broken outline is told rather than silently half-flipped.
 *
 * Blank lines go, and that is the one liberty taken: readers tolerate them and
 * writers never emit them (docs/format.md), so a rewritten file is a written
 * file and takes the writer's rules. A file with nothing BUT blank lines is
 * unchanged rather than emptied — there are no records in it to migrate, so
 * there is nothing this step is for.
 */
export const migrateOutline = (contents: string): FileResult => {
  const lines = contents.split("\n")
  // Asserted rather than decoded, and the assertion is {@link refusalFor}'s
  // third arm: a record that reaches this list carries only fields the format
  // declares, which is the whole of what ./write.ts needs to write it back
  // without losing a key. Decoding here would be the validator, one phase
  // early and with the wrong vocabulary for what it found.
  const records: Array<Node> = []
  const left: Array<{ line: number; why: string }> = []
  let touched = false

  for (const [index, text] of lines.entries()) {
    const line = index + 1
    if (text.trim() === "") continue

    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      left.push({ line, why: "this line is not JSON" })
      continue
    }
    if (json === null || typeof json !== "object" || Array.isArray(json)) {
      left.push({ line, why: "every line is one node, written as a JSON object" })
      continue
    }

    const record = json as Record<string, unknown>
    const result = migrateRecord(record)
    if (result.kind === "refused") left.push({ line, why: result.why })
    else if (result.kind === "unchanged") records.push(record as unknown as Node)
    else {
      records.push(result.record as unknown as Node)
      touched = true
    }
  }

  if (left.length > 0) return { kind: "left", why: left }
  return touched ? { kind: "migrated", records } : { kind: "unchanged" }
}
