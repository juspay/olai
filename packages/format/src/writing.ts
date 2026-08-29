/**
 * The things a writer may ask for, and what one that landed says.
 *
 * They are SEMANTIC — "mark this node done", "start a new outline" — not
 * "replace bytes 40 through 90" — and that is the property the whole write path
 * is built on. A semantic edit can be re-derived from a newer snapshot when the
 * store has moved (`@olai/ops`' `ops.ts` retry), and it cannot express a broken
 * file: there is no request here whose result is not a set of whole records.
 *
 * Schemas rather than interfaces because these are the payloads a tool call
 * arrives as. One declaration is the type the planner switches on, the JSON
 * Schema the MCP tool advertises, and the decoder that refuses a malformed
 * call — three uses that would otherwise be three lists of field names kept in
 * step by hand.
 *
 * **Why this is on the FLOOR and not in `@olai/ops`, which produces it.** It was
 * in `@olai/ops` until the writes went onto the surface (`mcp-bridge`), and the
 * move is `./searching.ts`'s and `./reading.ts`'s, made for the third time and
 * for the identical reason: `@olai/surface` may not import `@olai/ops` (a store
 * has no business in a browser bundle) and `@olai/ops` may not import
 * `@olai/surface` ("an op does not know it is being called over a wire"). A
 * vocabulary both of them need therefore has exactly one home that is neither,
 * and this package is it — the ops layer PRODUCES these values, the surface
 * CARRIES them, and neither has to agree with the other by memory.
 *
 * Two names are not the ones `@olai/ops` knows them by, and both renames are
 * deliberate ({@link WriteRequest}, {@link WriteResult}): each says what it is
 * against the neighbours it now sits among, where the old name would have said
 * it against neighbours it no longer has. `@olai/ops` re-exports both under its
 * own names, exactly as it re-exports `./searching.ts`.
 */

import { Sort } from "./changes.ts"
import { Status } from "./node.ts"
import { REPEAT_GRAMMAR } from "./repeat.ts"
import { Schema } from "effect"

/** An id the request names. Spelled once so every op's `id` field carries the
 *  same description into the tool schemas. */
const Id = Schema.String.annotate({
  description: "The `id` of a node in the loaded set.",
})

const Title = Schema.String.annotate({
  description:
    "The node's title, verbatim. Inline tags live here — `#topic` and `@person`, two namespaces over the same alphabet.",
})

/**
 * Where a node goes among its siblings. Absent is "last", which is what a
 * capture wants; `before`/`after` name a sibling, which is what a reorder
 * wants. A struct rather than two loose fields so "both at once" is one check
 * in one place.
 */
const Anchor = {
  before: Schema.optionalKey(
    Schema.String.annotate({
      description: "Place it immediately before this sibling id.",
    }),
  ),
  after: Schema.optionalKey(
    Schema.String.annotate({
      description: "Place it immediately after this sibling id.",
    }),
  ),
}

/**
 * What a capture may say about ONE node.
 *
 * Declared once because it is asked twice, and the two answers must not differ:
 * `add_node` names a node with these fields, and every node hanging off its
 * `children` is described with exactly the same ones. A child that could carry
 * less than the node above it would make "capture this subtree" mean something
 * different depending on where in the subtree you stood.
 *
 * **The edges and the properties are here for that same sentence read forwards**
 * (`olai-batch-verbs`). A capture used to say what a node IS — its title, its
 * note, its date, its mark — and nothing about what it POINTS AT or what it
 * KNOWS, so a subtree arrived and then thirteen more calls wired it: one
 * `set_after` per dependency, one `set_prop` per fact, each its own round trip
 * and its own revision. {@link props}, {@link see} and {@link waitsOn} are those
 * verbs' own payloads, spelled at capture time, so a subtree arrives WITH its
 * edges and its facts in one plan, one validation and one all-or-none rename.
 * Nothing about the writes changes: the same planner writes them, and the same
 * refusals turn them away.
 */
const CAPTURE = {
  title: Title,
  desc: Schema.optionalKey(
    Schema.String.annotate({ description: "The note. Markdown, stored verbatim." }),
  ),
  date: Schema.optionalKey(
    Schema.String.annotate({
      description: "ISO date (`2026-08-10`) or datetime, making this a scheduled node.",
    }),
  ),
  /** The mark this node is born with, if any. One field rather than three
   *  booleans: the format allows AT MOST ONE mark, and a shape that can spell
   *  two is a shape a caller can get wrong. */
  mark: Schema.optionalKey(
    Status.annotate({
      description:
        "The mark this node is born with, written exactly as `set_done` / `set_doing` / `set_todo` would: `done` records the instant, so it lands on today's page; the other two store `true` and place it on no day — and a `doing` birth also stamps `started`, exactly as `set_doing` stamps it, since work born under way has no later door for a start. Absent leaves a bullet, which is not an unstarted task.",
    }),
  ),
  /** A chosen slug. Absent mints one — which is the usual case; supply one
   *  when the node needs a name a person will type. */
  id: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "A chosen id (`[A-Za-z0-9_-]+`), unique across the set. Absent mints one.",
    }),
  ),
  /**
   * The named facts this node is BORN carrying — `set_prop`'s map, written at
   * capture time instead of one call per key.
   *
   * A map rather than a list of `{key, value}` pairs, because that is what a
   * record's `custom` IS and what `set_prop` writes into. No `null` arm: there
   * is nothing on a node being born to take off, so the shape cannot spell the
   * removal and the planner has one fewer thing to refuse (`""` is still
   * absence, which is the writer's own rule rather than a second one).
   */
  props: Schema.optionalKey(
    Schema.Record(Schema.String, Schema.String).annotate({
      description:
        "Named facts this node is born with — the map `set_prop` writes into, several keys at once, with that verb's own refusals: for a key spelled like a field the format already has, and for a value that does not fit what its key DECLARES in `_olai/Properties.olai`. One bad value refuses the whole capture, children included, and nothing is written. A key holding an empty string is a key the file does not carry.",
    }),
  ),
  /** The free cross-references this node is born with — `set_see`'s list.
   *  Same targets as {@link waitsOn} below, and the same forward references. */
  see: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        "Free cross-references this node is born with — `set_see`'s list. Each names a node in the loaded set OR another node in THIS capture, by a chosen `id`, wherever it sits in the tree and including one declared LATER. An unknown target refuses the whole capture, with the closest id that exists.",
    }),
  ),
  /**
   * The ordering edges this node is born with — `set_after`'s list.
   *
   * `waitsOn` AND NOT `after`, which is the one place this vocabulary bends and
   * the bend is forced: at the top of a capture `after` already names the
   * SIBLING the node is placed after ({@link Anchor}), and it is a string where
   * this is a list. Two meanings for one word, differing by how deep in the tree
   * you are standing, is exactly the trap {@link CAPTURE} exists to prevent — so
   * the edge list takes the name `set_after`'s own title gives it ("what a node
   * waits on") and the anchor keeps the word it has always had.
   *
   * IT LEAVES ONE EDGE WITH TWO NAMES — `waitsOn` here, `after` on
   * {@link UpdateRequest}, which has no placement in it and so no collision to
   * resolve — and that is the cheaper of the two costs rather than a free
   * choice. Spelling it `waitsOn` in both would name the field after a
   * collision that only one of them has; spelling it `after` in both is the
   * trap. Both tool descriptions say which is which and why, because the
   * descriptions are the agent's only manual.
   */
  waitsOn: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        "The ids this node must come AFTER — `set_after`'s edges, written at capture time. Same targets as `see`: a node in the loaded set, or one in this capture named by its chosen `id`, forward references included. Spelled `waitsOn` rather than `after` because at the top of a capture `after` already names the SIBLING this node is placed after. An edge that would close a loop is refused NAMING the loop.",
    }),
  ),
  /**
   * THE BENT WORD, DECLARED SO IT CAN BE REFUSED.
   *
   * {@link waitsOn} is `after` under another name, and the bend is what makes
   * this field necessary: an agent that has read `set_after`, or that is
   * looking at the anchor one level up, writes `after` on a child and means the
   * edge list. An Effect struct DROPS a key it does not declare, so without
   * this the dependency would vanish and the call would report success — a
   * capture that silently lost half of what it said. It is the same trap
   * {@link childrenOf} spells at the floor of the unrolling, and it gets the
   * same answer: the field is declared, it accepts anything, and `@olai/ops`'
   * `plan.ts` refuses it BY NAME, pointing at the word that works.
   *
   * `Unknown` rather than an array of ids, because nothing here is going to be
   * read: what arrives is whatever the host sent, and it is being turned away
   * rather than interpreted.
   *
   * AT `add_node`'S ROOT IT IS OVERRIDDEN and means the placement anchor
   * ({@link Anchor} is spread after {@link ROOT}), which is the whole collision
   * this exists to make loud one level down. `create_outline`'s seed has no
   * anchor — the first row of an empty file has no siblings — so its root gets
   * this one, and refuses, which is right for the same reason.
   */
  after: Schema.optionalKey(
    Schema.Unknown.annotate({
      description:
        "NOT the edge list — write `waitsOn`. Anything here refuses the whole call, because `after` is the SIBLING anchor at the top of a capture and a child has no anchor.",
    }),
  ),
} as const

/**
 * One node of a capture, and the tree hanging off it.
 *
 * The fields come from {@link CAPTURE} rather than from a second list of names
 * beside it — a hand-written copy would be a field this type has and the schema
 * does not, silently, the day somebody adds one. What is written by hand is the
 * one thing the schema cannot say: `children` is genuinely recursive, and
 * {@link NESTING} bounds the SCHEMA rather than the idea.
 */
type CaptureFields = Schema.Struct<typeof CAPTURE>["Type"]

export interface Capture extends CaptureFields {
  readonly children?: ReadonlyArray<Capture>
}

/**
 * A field table with its PROSE taken off, and nothing else touched.
 *
 * TWO things in this file want it and they want it for one reason: a schema
 * repeated inside another schema repeats every sentence on it, into the first
 * frame of every agent session, where the sentence is already written on the
 * tool that takes the request. {@link TERSE} is the capture's fields for every
 * level below the first ({@link childAt}); {@link arm} is a whole request's
 * fields inside `apply`'s union. The stripping is one rule, so it is one
 * function — the second copy of it would be the one nobody remembers to change.
 *
 * The cast is the price of Effect's field types: `annotate` answers a `Top`,
 * and what is being promised here is that the FIELDS are the ones handed in,
 * which is true by construction and unsayable in the type.
 */
const stripped = <F extends Schema.Struct.Fields>(fields: F): F =>
  Object.fromEntries(
    Object.entries(fields).map((
      [name, field],
    ) => [name, (field as Schema.Top).annotate({ description: undefined })]),
  ) as unknown as F

/** The capture's fields with their descriptions taken off, for every level
 *  BELOW the first ({@link childAt}). Derived rather than re-listed: a second
 *  field table is the drift {@link CAPTURE} exists to prevent, and the prose is
 *  the only thing that differs. */
const TERSE = stripped(CAPTURE)

/**
 * How many generations of `children` one call may nest below the node it adds.
 *
 * A CAP, and one this file would rather not have had: the format has no depth
 * limit, and nothing about planning a tree wants one. What has one is the JSON
 * Schema an MCP host reads. A recursive Effect schema compiles to a `$ref` into
 * a `$defs` pool — and the adapter that projects these schemas onto MCP INLINES
 * every local ref and STRIPS the pool, because `$ref` is rejected across the
 * host matrix it is byte-compatible with. A ref that cannot be inlined finitely
 * survives as a pointer into a pool that is no longer there, so `add_node`
 * would advertise a dangling reference and a whole tool would be unusable.
 *
 * So the nesting is unrolled, three levels of it, and the schema stays a finite
 * object an agent can actually read. Three is what the capture this was filed
 * for needs — an outline, its rooms, the things in them — and each further
 * level is another whole copy of the child schema in every `tools/list`. Deeper
 * than that is a second call under an id the first one hands back, which is why
 * the answer names every node it created.
 *
 * It lives HERE, beside the schema that unrolls it, and `@olai/ops`' `plan.ts` reads
 * it to refuse what the floor below lets through. That is the planner enforcing
 * the schema's limit rather than one of its own, and it is the whole reason the
 * limit is a refusal rather than a truncation. The alternative — a recursive
 * schema here and an unrolled twin built in the MCP projection — is exactly the
 * pair that projection deleted when it stopped advertising one object and
 * decoding against another.
 */
export const NESTING = 3

/**
 * The `children` field of a node that may nest `below` further generations —
 * the ONE declaration of it, read by the request's own root and by every level
 * under it, so "how deep may this go" is counted one way everywhere.
 *
 * At the floor the field stays PRESENT and accepts anything, which is the whole
 * point of spelling it: an Effect struct silently DROPS a key it does not
 * declare, so a floor that simply omitted `children` would swallow the deepest
 * level of a capture and report success. The planner refuses it instead, by
 * name, with nothing written (`@olai/ops`' `plan.ts`).
 */
const childrenOf = (below: number) =>
  Schema.optionalKey(
    below === 0
      // The one place the unrolled schema and the recursive interface disagree,
      // and it exists to be refused — so it is the one place a cast is needed.
      ? Schema.Array(Schema.Unknown).annotate({
        description:
          `A capture nests ${NESTING} levels of children and this node is at the last of them, so anything here refuses the whole call. Hang it off a second \`add_node\` instead, under an id from \`captured\`.`,
      }) as unknown as Schema.Codec<ReadonlyArray<Capture>>
      : Schema.Array(childAt(below - 1)).annotate({
        description:
          "Nodes to capture under this one, in this order. Each takes the same fields as this one, and may carry `children` of its own.",
      }),
  )

/**
 * The child schema, unrolled `below` further generations deep.
 *
 * The fields are {@link CAPTURE}'s with their prose taken off, and that is a
 * measured decision rather than a slip: the descriptions are identical at every
 * level, so spelling them four times would put three redundant copies of every
 * sentence in the first frame of every agent session (~2kB). The root says what
 * each field means, and the `children` blurb says a child takes the same ones.
 */
const childAt = (below: number): Schema.Codec<Capture> =>
  Schema.Struct({
    ...TERSE,
    // The ONE field whose prose survives the stripping, and it survives for the
    // reason the floor's does: it is not a description a reader can find
    // elsewhere, it is a REFUSAL, and this is where it will be met. `after`
    // means the sibling anchor one level up and nothing at all down here, so a
    // child is exactly where an agent writes it meaning the edge list
    // ({@link CAPTURE}'s `after`).
    after: CAPTURE.after,
    children: childrenOf(below),
  }) as unknown as Schema.Codec<Capture>

/**
 * A capture as a CALL names it: the documented fields, and the subtree that may
 * hang off them.
 *
 * Both ops that bring nodes into being take exactly this — the node `add_node`
 * adds, and the first node a new outline is born with — so "what one call may
 * capture" has one spelling and one depth. A tool that could capture less than
 * the other would be a reason to make two calls where the point is to make one.
 */
const ROOT = { ...CAPTURE, children: childrenOf(NESTING) } as const

/**
 * Where a record a call brings into being LANDS: under a node, or at the top
 * level of an outline.
 *
 * One declaration for the two ops that create a record — `add_node` and
 * `add_mirror` — because the planner answers it with one function
 * (`@olai/ops`' `plan.ts`'s `landsIn`) and two copies of the prose would be two
 * agent-facing descriptions of one rule, free to drift. Neither field says
 * "node" or "mirror": what lands is the caller's business, and where it lands
 * is this.
 */
const LANDING = {
  /** The outline to write into. Required only when there is no `parent`: with
   *  one, the file is wherever the parent lives, and a second answer could
   *  disagree with it. */
  file: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "Outline to write into, relative to the served directory. Required when `parent` is absent; ignored when it is present (it goes in its parent's file).",
    }),
  ),
  parent: Schema.optionalKey(
    Schema.String.annotate({
      description: "Id of the node it goes under. Absent puts it at top level.",
    }),
  ),
} as const

export const AddRequest = Schema.Struct({
  op: Schema.Literal("add"),
  ...LANDING,
  /** The node, and the subtree under it. One call, one plan, one validation,
   *  one write, one commit — which is what makes a half-captured outline
   *  impossible. */
  ...ROOT,
  ...Anchor,
})

/** The marks are one op: same resolver, same refusals, and the format's own
 *  exclusion rule means setting any of them clears the others. The op names
 *  ARE the format's mark names, read from it rather than re-listed — a fourth
 *  mark should not be writable everywhere except here. */
export const MarkRequest = Schema.Struct({
  op: Status,
  id: Id,
  /** Take the mark off instead of putting it on. */
  undo: Schema.optionalKey(Schema.Boolean),
})

/**
 * What a text field is expected to hold before this write replaces it — the
 * one CONDITIONAL thing a request may say, and absent from every caller that
 * is simply typing.
 *
 * It exists because "put back what I replaced" is a narrower claim than "set
 * this": it is only entitled to overwrite the words it wrote. Absent, a write
 * is last-one-wins, which is what `set_title` has always meant and what a
 * person retyping a line means. Present, the planner refuses when the field
 * says something else — and it refuses on EVERY attempt, which is the whole
 * reason this lives here rather than in a caller: the write gate re-plans a
 * request when the store moves under it, so a check made once before the loop
 * is a check the retry does not make (found by review, 2026-08-12 — the retry
 * path silently overwrote a concurrent retitle).
 */
const Was = (what: string) =>
  `What this field is expected to hold right now. Absent overwrites whatever is ` +
  `there, which is the ordinary case. Supply it to make the write CONDITIONAL — ` +
  `${what} — and it is refused, naming what is there, if anything else has been ` +
  `written since you read it.`

export const TitleRequest = Schema.Struct({
  op: Schema.Literal("title"),
  id: Id,
  title: Title,
  was: Schema.optionalKey(
    Schema.String.annotate({
      description: Was("putting back a title you read a moment ago"),
    }),
  ),
})

export const DescRequest = Schema.Struct({
  op: Schema.Literal("desc"),
  id: Id,
  /** `null` removes the note. */
  desc: Schema.NullOr(Schema.String),
  /** `null` is a real answer here — "expects no note at all" — which is why
   *  the CHECK is on the field being present rather than on its content. */
  was: Schema.optionalKey(
    Schema.NullOr(Schema.String).annotate({
      description: Was("putting back a note you read a moment ago; `null` expects none"),
    }),
  ),
})

export const DateRequest = Schema.Struct({
  op: Schema.Literal("date"),
  id: Id,
  /** `null` clears it. */
  date: Schema.NullOr(Schema.String),
})

/**
 * The REPEAT RULE, set or cleared — {@link DateRequest}'s shape one field
 * along, and deliberately so: both are one optional field on the record with
 * one value and no condition, so a second arrangement here would be a
 * difference nobody could justify.
 *
 * The value is the rule's own TEXT (./repeat.ts), verbatim, because that is
 * what the record holds: the grammar is spelled in the file, and this is the
 * field that carries the spelling. Nothing on the way parses it — the per-line
 * rule at the far end is the gate, exactly as it is for the `date` beside it —
 * so a rule this grammar does not have is refused in the validator's own
 * words, with `file:line`, rather than by whichever door happened to send it.
 */
export const RepeatRequest = Schema.Struct({
  op: Schema.Literal("repeat"),
  id: Id,
  /** `null` clears it, which is how a recurrence STOPS: the node keeps the day
   *  it is on and stops coming back. */
  repeat: Schema.NullOr(Schema.String),
})

/**
 * One CUSTOM key on a node — a named fact, set or taken off.
 *
 * The only writer of `custom` (./custom.ts), and the only write in this file
 * whose subject is a key rather than a field. Nothing here judges the value and
 * nothing gives the key a meaning: a `pr` is a URL because a person wrote one,
 * and the day a reading wants `isbn` the key is already sayable.
 *
 * IT CANNOT REACH A SYSTEM FIELD, and that is structural rather than policed:
 * every field this format declares lives at the top level and this writes
 * inside one map. The single rule left is about SHADOWING — a custom key
 * spelled like a field (`done`, `date`, `see`, `title`, and the word `status`)
 * is refused toward the verb that writes that fact, because
 * `{"done":true,"custom":{"done":"yesterday"}}` is a legal record and an
 * unreadable one.
 *
 * `was` USED to be deliberately absent, where {@link DescRequest} and
 * {@link TitleRequest} have one, on the argument that a property is one short
 * value under a name — the gesture was "this node's `stage` is `review`", not
 * "replace what I read". The chips retired it: a property is edited in a text
 * box now, exactly as a title and a note are, so a typed commit could land on
 * top of a write nobody saw with nothing on screen to say so. And the web's
 * half is always conditional — the chip's commit carries the snapshot the
 * editor opened on, an add carries `null` for "the key was not there", and an
 * UNDO carries what its own write left, which is the guarantee the text verbs'
 * inverses already made. What stayed is the case the door means by default:
 * absent, a write is last-one-wins.
 */
export const PropRequest = Schema.Struct({
  op: Schema.Literal("prop"),
  id: Id,
  key: Schema.String.annotate({
    description:
      "The property's name. Any key, except one spelled like a field the format already has (`done`, `doing`, `todo`, `status`, `date`, `see`, `after`, `id`, `title`, `created`, `changed`) — those are refused toward the verb that writes them.",
  }),
  /** `null` removes the property. So does `""`, which is the writer's own rule
   *  for absence (./write.ts) rather than a second one: a key holding nothing
   *  is a key the file does not carry. */
  value: Schema.NullOr(Schema.String).annotate({
    description:
      "What the property holds, as text. `null` removes it — and so does the empty string, since a key holding nothing is a key the file does not carry. A key the vault DECLARES in `_olai/Properties.olai` has a type, and a value that does not fit it is REFUSED with the values it may hold named: `merge` is one of its declared variants' ids, `records` is a whole number, `dispatched` is a date and nothing else — the commentary goes in the note. An accepted spelling is stored as the one canonical spelling (`2026-08-25 10:06` lands as the instant a mark records). Every other key is text and takes anything, as before.",
  }),
  /* The CONDITION, spelled the text verbs' way and for one key instead of one
   *  field: `null` is a real answer here — "expects no such key", which is
   *  what the drawer's ADD editor sends — so the CHECK is on the field being
   *  present rather than on its content. */
  was: Schema.optionalKey(
    Schema.NullOr(Schema.String).annotate({
      description: Was(
        "putting back a property value you read a moment ago; `null` expects the key to be absent — which is what an add is",
      ),
    }),
  ),
})

/**
 * A row somewhere else: among its siblings, under another node, or in ANOTHER
 * OUTLINE — and in every case the SAME node, carrying the id it has always had.
 *
 * **`file` is the field that made the third case sayable**, and it is
 * {@link LANDING}'s own pair arriving on a verb that used to refuse it. A
 * `parent` in another outline just works — the parent decides the file, exactly
 * as it does for `add_node` — and `file` alone is that outline's top level.
 * What crossing costs is nothing: the record keeps its id, so every `see`,
 * `after`, `blocks`, `mirror` and typed `node` property aimed at it (or at
 * anything under it) goes on resolving, and the ordering graph was never
 * per-file to begin with. A PIN goes on resolving too, and by the same law read
 * one grammar over: a pin's title is an ADDRESS, and a node address normalises
 * to the id it names, so even a qualified spelling that now points at the
 * outline the node LEFT still draws it (./address.ts).
 *
 * **THE ONE REFERENCE A CROSSING CAN BREAK IS A `ref`**, and it is worth
 * spelling because `ref` and `node` are two promises rather than two words.
 * `node` is EXISTENCE, which an id surviving is exactly enough for. `ref`
 * additionally asserts ANCESTRY — the value is a child of the declaration's
 * `under` root (./typing.ts's `variantsOf`) — so moving the ROOT carries its
 * variants and every `ref` holds, while moving one VARIANT out of that root
 * makes each `ref` at it `bad-prop`. That one is REFUSED at the write gate,
 * with nothing written at either end, which is the law working rather than a
 * hole: the whole set is judged before either file is.
 *
 * **`parent` IS STILL SAME-FILE BY THE FORMAT**, and that has not changed: a
 * `.olai` is an independent tree and a record's parent lives in its own file.
 * What changed is that the SUBTREE travels with the reparenting, so the record
 * that lands has its parent in the file it landed in. The sentence that used to
 * stand here — "a move never crosses outlines, archiving is what does" — was a
 * statement about this planner rather than about the format, and the dance it
 * pointed at (recreate under NEW ids, trash the old subtree — ids are unique
 * across the set including the trash, so the same ones cannot be reused)
 * silently detaches every reference into what moved. That was the gap.
 *
 * **The trash is neither end of it.** A node goes into `_olai/Trash.olai`
 * through `trash_node`, which records the outline it left, and comes back out
 * through `untrash_node`, which tidies the scaffold above it and re-opens the
 * marks that stop being true the moment a branch is live again. Naming a trash
 * here is refused toward whichever of those two the caller meant. Reordering
 * rows INSIDE a trash is a move like any other, because nothing crosses.
 */
export const MoveRequest = Schema.Struct({
  op: Schema.Literal("move"),
  id: Id,
  /** The new parent, or `null` for top level. ABSENT leaves the parent alone,
   *  which is how a pure reorder is spelled. A parent in ANOTHER outline
   *  carries the node and everything under it into that outline. */
  parent: Schema.optionalKey(Schema.NullOr(Schema.String)),
  /** The outline to move it into, at top level — the other half of
   *  {@link LANDING}'s pair, with that pair's own rule about which one wins. */
  file: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "Outline to move it into, AT TOP LEVEL, relative to the served directory — the node and everything under it, every id kept. Absent leaves it in the outline it is already in. Ignored when `parent` is present (it goes in its parent's file).",
    }),
  ),
  ...Anchor,
})

/**
 * One node, into two — the head it keeps and the tail that becomes the sibling
 * after it.
 *
 * IT IS ONE OP AND NOT TWO, and that is the whole reason it exists. Retitling
 * the node and adding the sibling are two writes at two revisions: the pair can
 * half-land, and both halves of the half are wrong — a tail written with the
 * head still saying the whole sentence duplicates it, and a head written with
 * the tail refused loses what was typed. One request is one plan, one
 * validation and one all-or-none rename, which is the property `add`'s
 * `children` was built for one level up.
 *
 * WHAT IT TAKES IS TWO TITLES, never an offset. A caller that named a character
 * position would be naming a range into a field — the one thing this whole
 * table refuses — and a position re-planned against a newer snapshot would cut
 * somebody else's retitle in half. Two texts mean the same thing against any
 * revision, exactly as `set_title`'s one does.
 *
 * EVERYTHING ELSE STAYS WITH THE HEAD — children, note, mark, date, edges — and
 * the tail is born a bare bullet, which is what `add` mints. That is Workflowy's
 * split read through this format: the row you were in is still that row, and
 * what came off it is a new line under nothing.
 */
export const SplitRequest = Schema.Struct({
  op: Schema.Literal("split"),
  id: Id,
  title: Schema.String.annotate({
    description:
      "What the node KEEPS — the first half of its title, verbatim. It goes on carrying its children, note, mark, date and edges.",
  }),
  rest: Schema.String.annotate({
    description:
      "What comes OFF it — the second half, verbatim, written as a brand-new node placed immediately after this one among its siblings. It is born a bullet: no mark, no note, no date, nothing under it.",
  }),
})

/**
 * Two nodes, into one — this node's title appended to the sibling above it,
 * which then adopts everything that hung under this one.
 *
 * `split` read backwards, and one op for the same reason: the merge is a
 * retitle, a note, N reparentings and a trash, and a sequence of those can
 * stop in the middle with the outline saying something nobody wrote. One plan,
 * one validation, one rename.
 *
 * THE SIBLING ABOVE IS NOT A FIELD, for the reason `move_node`'s `parent` is
 * one and this is not: "the row above" is a fact about the set, so it is read
 * off the snapshot this write is judged against — which is also what makes the
 * request re-plannable when the store moves under it. A node that is first
 * among its siblings has nothing above it and the call is refused saying so.
 *
 * WHAT SURVIVES, and it is the whole of the semantics:
 *
 *   - the TITLES are concatenated, in reading order, with nothing put between
 *     them (Workflowy's own join — the two halves were one line);
 *   - the NOTES are concatenated too, one blank line apart, and a node with
 *     none simply takes the other's. A note that vanished from the page would
 *     be the silent loss this codebase refuses, and the trash is not where
 *     anybody looks for it;
 *   - the CHILDREN move, in order, to the end of the sibling's own — nothing
 *     may be orphaned by a keystroke;
 *   - the MARK, the DATE and the EDGES of the node being merged go WITH ITS
 *     RECORD into `_olai/Trash.olai`, because the format allows one mark per node
 *     and the surviving row already has its own answer. Nothing is destroyed —
 *     the record is in the trash with its ids intact — and the answer's `nudge`
 *     says what went, so a `done` never disappears silently.
 */
export const MergeRequest = Schema.Struct({
  op: Schema.Literal("merge"),
  id: Schema.String.annotate({
    description:
      "The `id` of the node to merge INTO THE SIBLING ABOVE IT. Its title is appended to that sibling's, its note joined to that sibling's, its children moved under it — and its own record goes to `_olai/Trash.olai`, keeping its id, mark, date and edges.",
  }),
})

export const TrashRequest = Schema.Struct({
  op: Schema.Literal("trash"),
  id: Id,
})

/**
 * COPY a node and everything under it, as the sibling immediately below it.
 *
 * One field, and the shortest request in this file, because everything the copy
 * SAYS is already on disk: the op reads the subtree it is pointed at and writes
 * it again. There is no anchor, no parent and no title here — a duplicate lands
 * beside the thing it duplicates, which is the whole of the gesture, and
 * `move_node` is what carries it somewhere else afterwards.
 *
 * WHAT DIFFERS BETWEEN THE COPY AND THE ORIGINAL IS EXACTLY TWO THINGS, and
 * both of them are about identity rather than about content:
 *
 *   - **every `id` in the copy is fresh** — the root's and every descendant's —
 *     so the copy is a second THING rather than a second claim on the first.
 *     That is what the whole op exists to promise;
 *   - **the two STAMPS are the copy's own.** `created` is the instant the copy
 *     was made and `changed` is absent, exactly as they are on a node a capture
 *     brought into being: those two fields are the ledger's rather than a
 *     writer's ({@link ./node.ts}'s `STAMPED` neighbours), and a ledger does not
 *     make up a past it did not see.
 *
 * Everything else comes across verbatim, THE MARKS INCLUDED — a `done` with the
 * instant it was stamped at, a `todo`, a date, a repeat rule, a note, the
 * properties, and the `doc` a node names. Every alternative invents something
 * the caller did not say: dropping the mark says the copy was never a task,
 * re-stamping the `done` says it was finished today, rewriting it to `todo`
 * says it has not started. A copy that says something its original does not is
 * not a copy, and the one field it is entitled to differ in is the one that
 * says WHICH node it is.
 *
 * **WHAT THE COPY POINTS AT is one rule with two halves.** A reference the
 * subtree makes to ITSELF follows the copy — a mirror placed under it, a `see`
 * between two of its nodes, an `after` edge one of them waits on — so the copy
 * is self-contained rather than reaching back into the original. A reference it
 * makes to anything OUTSIDE keeps its target, because that target was not
 * copied and there is nothing else the reference could mean. A mirror stays a
 * MIRROR either way: a placement is copied as a placement, never expanded into
 * a twin of the node it shows.
 *
 * AND THE THIRD CASE, which is the rule read from the other end: a reference
 * pointing INTO the subtree from outside it is not followed at all — the
 * original keeps it. That record was not copied and this write was not asked
 * to touch it, so copying its edge would invent a second claim nobody made and
 * moving it would take one away. Only the records being copied are rewritten.
 */
export const DuplicateRequest = Schema.Struct({
  op: Schema.Literal("duplicate"),
  id: Schema.String.annotate({
    description:
      "The `id` of the node to copy. The copy — it and everything under it, with fresh ids throughout — lands as the sibling immediately below it.",
  }),
})

/**
 * Take a subtree back OUT of an `_olai/Trash.olai` — the inverse `archive` never
 * had, built once here and exposed on both faces together (HACKING.md's
 * consistency rule; `parity-unarchive`).
 *
 * Where it lands is the one real question, and the DEFAULT answer is the
 * archive's own record of where it came from: the scaffold of ancestor titles
 * `archive` wrote above the node, matched back against the live outlines
 * beside the archive. That chain is titles rather than ids — the scaffold's
 * ids are minted, precisely so they cannot collide with the live ancestors' —
 * so the match can be empty (the chain was retitled or archived itself) or
 * plural (two branches spell the same path), and both are REFUSALS that name
 * what was found rather than guesses. `parent` and `file` are the caller's way
 * past them, and they are {@link LANDING}'s own pair: under that node, or at
 * the top level of that outline.
 */
export const UntrashRequest = Schema.Struct({
  op: Schema.Literal("untrash"),
  id: Schema.String.annotate({
    description:
      "The `id` of a node in an `_olai/Trash.olai`. It comes back out with everything under it.",
  }),
  file: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "Outline to restore into, at top level. Ignored when `parent` is present. Absent (with no `parent`), the recorded chain of ancestor titles decides — refused, naming what it found, when that chain matches nowhere or more than one place.",
    }),
  ),
  parent: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "Id of the live node it goes back under. Absent, the recorded ancestor chain decides (see `file`).",
    }),
  ),
})

/**
 * THE TRASH, EMPTIED — the one write in this vocabulary that destroys rather
 * than moves, and the only one the trash has ever had.
 *
 * `trash` made a trash rather than a shredder, and `untrash` made it one
 * you can reach back into; what neither of them gave anybody is a way to stop
 * carrying what was put away. This is that way, and it is deliberately the
 * SMALLEST shape that can be: the one trash named outright, every record in
 * it removed, the file left behind holding nothing. There is no `id` here and
 * there never will be — deleting ONE node out of the trash is a shredder aimed
 * at a row, which is the gesture #109's deferral is about and is still the
 * human's to rule on. What this op can say is "stop keeping the pile", which
 * is what emptying a bin means.
 *
 * **THERE IS ONE TRASH, SO THE SUBJECT IS ONE FILE.** The list that used to
 * sit here was the shape of a union of per-directory piles; with one
 * `_olai/Trash.olai` that union is a single path, and an array that can name
 * the same file twice (or none) is a fossil of the old convention. A leftover
 * `Archive.olai` is not the trash and is refused.
 *
 * **WHAT IT IS REFUSED FOR is the rule `remove_mirror` already keeps**, read
 * over every record this write deletes: a record that is still NAMED by
 * something staying behind — a mirror placed in a live outline, a `see`, an
 * `after` — is not deletable, because the set it would leave is one the
 * validator condemns (`unknown-target`). So the call is refused naming what
 * still points in, and the way through is to re-point or retire those first.
 * References BETWEEN records in the same emptying are not dependents: they go
 * when they go.
 *
 * **AND {@link EmptyRequest.was} IS THE OTHER HALF OF THAT HONESTY.** A write
 * is re-planned against a newer snapshot when the store moves under it, and a
 * re-plan of this one silently widens: a record put away in between is a record
 * the retry deletes, and nobody agreed to it. The field is the count — the very
 * number the web's confirm puts in front of somebody — checked on every attempt
 * against the snapshot that attempt is judged on, which is where `set_title`'s
 * own `was` learned to live. Optional, because an agent sweeping a directory
 * means "whatever is there" and a caller that showed a number means the number.
 *
 * **AND IT DESTROYS EXACTLY AS MUCH AS IT SAYS.** The file is rewritten with no
 * records in it, through the same gate, in the same all-or-none rename, and
 * the write is committed by whichever door commits every other write — so the
 * bytes are recoverable from git to exactly the extent git had already recorded
 * them, and no further. A `doc` a trashed node named is a FILE and is not
 * touched: a document is not a node, nothing here names bytes, and a `.md` left
 * without a referrer is a file a person can see and remove.
 */
export const EmptyRequest = Schema.Struct({
  op: Schema.Literal("empty"),
  file: Schema.String.annotate({
    description:
      "The trash this write empties — `_olai/Trash.olai`, root-relative, exactly as `list_outlines` spells it. Every record in it goes, the source-file signposts and ancestor-title scaffold included, and the file stays behind empty. A leftover `Archive.olai` is not the trash and is refused. Refused for an outline that is not the trash, for one the set does not hold, for a trash that holds nothing, and while anything outside it still points into it — naming what to re-point first.",
  }),
  was: Schema.optionalKey(
    Schema.Int.annotate({
      description:
        "How many records the named trash is expected to hold RIGHT NOW. Absent empties whatever is there, which is what a sweep means. Supply it when a number was shown to somebody — the web's confirm names one — and the write is refused, naming both counts, if a record arrived in the meantime: the alternative is deleting something nobody agreed to and reporting the count they read.",
    }),
  ),
})

/**
 * What a brand-new outline is born holding: a capture, exactly as `add_node`
 * takes one — the same fields, the same `children`, the same depth.
 *
 * No parent (it is top-level by definition) and no placement (it is the first
 * row of an empty file); everything else is {@link ROOT}, because a seed that
 * could say less would be a reason to make a second call, and the second call
 * is what this whole feature exists to delete. It is also what closes the last
 * hole in the atomicity claim: a `create` that lands followed by an `add` that
 * refuses left an empty outline behind, and now the file and everything in it
 * are one plan, one validation and one rename — a refused seed leaves no file
 * at all.
 */
const Seed = Schema.Struct(ROOT)

export const CreateRequest = Schema.Struct({
  op: Schema.Literal("create"),
  file: Schema.String.annotate({
    description:
      "Relative path of the new outline under the served directory. Must end in " +
      "`.olai`. No absolute path, no `..` / `.` segments, no separators inside a " +
      "segment. Refused if that file already exists among the loaded outlines.",
  }),
  seed: Schema.optionalKey(
    Seed.annotate({
      description:
        "What the new outline is born holding — a capture, exactly as `add_node` takes " +
        "one: a title, optional note/date/mark/id, the `props` / `see` / `waitsOn` a " +
        "node is born carrying, and `children` nesting the same way, with the same " +
        "forward references. So a new outline, everything in it AND the order its steps " +
        "happen in is ONE call, and a seed that is refused leaves no file behind. Absent " +
        "creates the outline empty.",
    }),
  ),
})

/**
 * Replace a DOCUMENT's text — the one write that is not about a node, because
 * a document has none: a `.md` is content the way a `desc` is, and its unit is
 * the file.
 *
 * WHOLE TEXT, deliberately. A patch language here would be a second way to
 * assemble bytes, and the glued-line bug is what this layer exists to make
 * unrepresentable; a document handed over whole is stored verbatim, and there
 * is nothing between the caller's text and the file for anyone to get wrong.
 * Nothing about the text is validated — markdown is interpreted at view time,
 * and a `.md` cannot make a set invalid (docs/format.md's Documents).
 *
 * `was` is the conflict story, and it is {@link TitleRequest}'s `was` at file
 * size: the same file can be edited in vim mid-session, so a caller that read
 * the document and is writing back what it edited says what it read — and the
 * write is refused, on EVERY retry the write gate makes, if the file has moved
 * since. Absent overwrites, which is what "set this document to X" means.
 */
export const WriteDocumentRequest = Schema.Struct({
  op: Schema.Literal("doc"),
  file: Schema.String.annotate({
    description:
      "Path of a document (`.md`) under the served directory, exactly as the set lists it.",
  }),
  text: Schema.String.annotate({
    description:
      "The document's new text, whole and verbatim. Markdown, stored exactly as given " +
      "and interpreted only at view time.",
  }),
  was: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "The text this write expects the document to hold right now — what you read " +
        "before editing. Supply it to make the write CONDITIONAL: if the file has " +
        "changed since (another editor, a `git pull`), the write is refused instead of " +
        "landing on top of words you have not seen. Absent overwrites whatever is there.",
    }),
  ),
})

/**
 * A brand-new document under the served directory — `create_outline`'s twin
 * for the other kind of file, and split from {@link WriteDocumentRequest} for
 * the reason those two are split: a write that could mint a file on a mistyped
 * path would turn every typo into a new document, silently. Create refuses a
 * path that exists; write refuses one that does not.
 */
export const CreateDocumentRequest = Schema.Struct({
  op: Schema.Literal("create-doc"),
  file: Schema.String.annotate({
    description:
      "Relative path of the new document under the served directory. Must end in " +
      "`.md`. No absolute path, no `..` / `.` segments, no separators inside a " +
      "segment. Refused if that document already exists.",
  }),
  text: Schema.optionalKey(
    Schema.String.annotate({
      description: "What the document is born holding. Absent creates it empty.",
    }),
  ),
})

/**
 * Add and/or remove `see` targets on an existing node. Incremental rather
 * than a whole-array replace: an agent that has just discovered one reference
 * should not have to re-state every other one it already set. Both fields are
 * optional, but at least one target must be named — the planner refuses a
 * no-op with a teaching message.
 */
export const SeeRequest = Schema.Struct({
  op: Schema.Literal("see"),
  id: Id,
  add: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        "Ids to add to this node's `see` list. Each must name a node in the loaded set; an unknown one is refused with the closest id that exists.",
    }),
  ),
  remove: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        "Ids to drop from this node's `see` list. Naming one that is not there is a no-op for that id.",
    }),
  ),
})

/**
 * A second PLACEMENT of a node that already exists.
 *
 * It takes what `add_node` takes minus everything that describes a node, and
 * that subtraction is the format's own: a mirror is exactly
 * `{id, parent?, ord, mirror}`, because any field describing the node itself has
 * an authoritative copy at the target and a second one here could only disagree
 * with it (docs/format.md's Two record shapes). So there is no `title` to give,
 * no `mark`, no `desc` — the schema cannot spell them, which is one fewer thing
 * the planner has to refuse.
 *
 * What is left is where the placement GOES, which is the same question
 * `add_node` answers: under a `parent`, or at the top level of a `file`, placed
 * among the siblings there by `before` / `after`.
 */
export const MirrorRequest = Schema.Struct({
  op: Schema.Literal("mirror"),
  target: Schema.String.annotate({
    description:
      "The `id` this mirror shows. Any node in the loaded set, in any outline — and it may itself be a mirror, in which case the chain is followed to the node at its end.",
  }),
  ...LANDING,
  /** The placement's OWN id — not the target's. Absent mints one; supply one
   *  when the placement itself needs a name a person will type, which is what
   *  a ledger convention like `now-<item>` is. */
  id: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "A chosen id for the PLACEMENT (`[A-Za-z0-9_-]+`), unique across the set — not the target's id. Absent mints one, and the answer's `id` names it either way.",
    }),
  ),
  ...Anchor,
})

/**
 * Retire one placement.
 *
 * `id` names the MIRROR record, never the node it shows: what goes is the line
 * that placed it, and the target is not touched. That is why this is its own op
 * rather than an arm of `archive` — see {@link ../../../packages/ops/README.md},
 * and the planner's own refusal for the id of a regular node.
 */
export const UnmirrorRequest = Schema.Struct({
  op: Schema.Literal("unmirror"),
  id: Schema.String.annotate({
    description:
      "The `id` of the MIRROR record — the placement — not of the node it shows.",
  }),
})

/**
 * Add and/or remove `after` edges on a node — what it must come after.
 *
 * {@link SeeRequest}'s shape exactly, because it is the same gesture over the
 * other kind of edge: incremental, so an agent that has just learned about one
 * dependency does not re-state the others, and at least one target must be
 * named. What differs is what the edges MEAN — `after` is the ordering graph, so
 * an add that would close a loop is refused (docs/format.md's Status) where a
 * `see` cycle is fine.
 */
export const AfterRequest = Schema.Struct({
  op: Schema.Literal("after"),
  id: Id,
  add: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        "Ids this node must come AFTER. Each must name a node in the loaded set; unknowns are refused with the closest id that exists, and an add that would close a loop is refused naming the loop.",
    }),
  ),
  remove: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        "Ids to drop from this node's `after` list. Naming one that is not there is a no-op for that id.",
    }),
  ),
})

/**
 * SEVERAL FIELDS OF ONE NODE, in one write.
 *
 * The narrow half of the batching pair ({@link ApplyRequest} is the wide one),
 * and it exists because the common shape of an agent's edit is not a batch of
 * unrelated ops at all: it is one node, four facts. `set_title` then `set_desc`
 * then `set_prop` then `set_done` is four round trips, four revisions and four
 * pending rows for a gesture a person would call one.
 *
 * **It is the single verbs, folded — not a fifth way to write a node.** Every
 * field below is planned as exactly the request that field's own verb takes,
 * against the set as the fields before it left it, so every refusal arrives
 * word for word: a shadowed property key, an unknown `after` target answered
 * with the closest id, an edge that would close a loop named as a loop, and the
 * done-over-open-work gate refusing precisely as `set_done` would. There is no
 * second planner here and therefore no second policy.
 *
 * **The order is fixed and it is a decision** — `title`, `desc`, `date`,
 * `repeat`, `props`, `after`, and the MARK LAST. (`repeat` and `date` swap when
 * the call is STOPPING a recurrence, which is the one bend and the planner's
 * own: a rule needs a date under it, so removal goes before addition.) A mark is a claim about the node as it
 * now stands, so it is judged against the node this call has finished making:
 * `{mark: "doing", after: ["order"]}` is a caller saying "start this" and "this
 * waits on `order`" in one breath, and it is REFUSED, because the edge is in
 * place by the time the mark is asked for. The other order would have landed a
 * `doing` and drawn it blocked a frame later, which is the state `set_doing`'s
 * own gate exists to make unreachable.
 *
 * **`null` removes, everywhere it is spellable** — the note, the date, one
 * property, and the mark, which is the one new spelling: `mark: null` takes off
 * whatever mark the node carries, where `set_done`/`set_doing`/`set_todo` each
 * need to be told which one it is to undo it. A node carrying none is refused,
 * as taking a mark off a node that has none has always been.
 *
 * **AND THE CONDITIONAL WRITE COMES WITH IT** ({@link Was}), which is the one
 * field here that had to be carried forward rather than left out. This shape's
 * whole claim is that it is the single verbs folded, so a field one of those
 * verbs has and this one cannot spell is a hole in the claim — and it is the
 * one hole that is UNSAFE rather than merely inconvenient. An Effect struct
 * silently drops a key it does not declare, so an agent moving from
 * `set_title {id, title, was}` to `update {id, title, desc, was}` would have
 * been handed exactly what it asked for minus the guard it asked for, with
 * nothing anywhere saying so — the `children`-at-the-floor trap
 * ({@link childrenOf}) wearing another verb's clothes.
 *
 * It covers `title` and `desc` and NOTHING ELSE, and the shape of the rule
 * is not this shape's invention. `set_date` and `set_after` have no `was` at
 * all, and `set_prop`'s is ONE condition about ONE key ({@link PropRequest}),
 * which a key-by-key merge cannot spell — `props` here stays an outright
 * write, key by key, exactly as one unconditional `set_prop` per key would be.
 * A `was` naming a field this call is not writing is refused too: a condition
 * on a write that is not happening is a caller that has mis-typed one of the
 * two.
 */
export const UpdateRequest = Schema.Struct({
  op: Schema.Literal("update"),
  id: Id,
  title: Schema.optionalKey(Title),
  desc: Schema.optionalKey(
    Schema.NullOr(Schema.String).annotate({
      description: "The note, replaced whole. Markdown, stored verbatim; `null` removes it.",
    }),
  ),
  date: Schema.optionalKey(
    Schema.NullOr(Schema.String).annotate({
      description:
        "ISO date (`2026-08-10`) or datetime, scheduling the node; `null` clears it.",
    }),
  ),
  /** The repeat rule, `set_repeat`'s own field — in the fold for the reason
   *  every other single verb is: a shape claiming to be the verbs folded with
   *  one of them missing is a hole a caller finds by having a field silently
   *  dropped. Written BEFORE the mark, like the date it needs, so a call that
   *  schedules a node, gives it a rule and ticks it in one breath spawns the
   *  next occurrence off the values this call wrote. */
  repeat: Schema.optionalKey(
    Schema.NullOr(Schema.String).annotate({
      description:
        `The repeat rule, in the format's own words — ${REPEAT_GRAMMAR}; \`null\` stops the recurrence. Needs a \`date\` on the node (set one in the same call if it has none).`,
    }),
  ),
  /** MERGED per key, which is `set_prop`'s own semantics repeated: this is not
   *  the node's whole map. A key not named here is left exactly as it is. */
  props: Schema.optionalKey(
    Schema.Record(Schema.String, Schema.NullOr(Schema.String)).annotate({
      description:
        "Properties to write, MERGED key by key — exactly as one `set_prop` per key would, and in the same words when one is refused. A key not named here is left alone; `null` (or `\"\"`) removes the one it names. A key spelled like a field the format already has is refused toward the verb that writes that fact, and a value that does not fit what its key DECLARES in `_olai/Properties.olai` is refused with the values it may hold named.",
    }),
  ),
  /** REPLACED, and it is the one field here that could plausibly have been
   *  incremental. See the tool's own description for the argument. */
  after: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        "What this node must come AFTER, as the WHOLE list — this REPLACES the node's `after` rather than adding to it, and `[]` clears it. Written that way because every other field here is the field's whole value; `set_after` is the incremental verb, taking `add` / `remove`. The difference against what the node holds now is what is actually written, so the refusals are that verb's: an unknown target is answered with the closest id that exists, and an edge that would close a loop is refused NAMING the loop.",
    }),
  ),
  /** What this write expects to find — {@link TitleRequest}'s and
   *  {@link DescRequest}'s own field, per field, because a call that writes two
   *  of them may be conditional on either. Nested rather than flattened into
   *  `titleWas` / `descWas`: the condition is ABOUT a field, so it is spelled
   *  under the field's own name, and one more conditional field later is one
   *  more key here rather than one more spelling convention. */
  was: Schema.optionalKey(
    Schema.Struct({
      title: Schema.optionalKey(
        Schema.String.annotate({
          description: Was("putting back a title you read a moment ago"),
        }),
      ),
      desc: Schema.optionalKey(
        Schema.NullOr(Schema.String).annotate({
          description: Was(
            "putting back a note you read a moment ago; `null` expects none",
          ),
        }),
      ),
    }).annotate({
      description:
        "What this write expects those fields to hold RIGHT NOW, checked before anything is written and on every retry — `set_title`'s and `set_desc`'s `was`, per field. Supply the half you read; the write is refused, naming what is there, if anything else has been written since. Only `title` and `desc` take one here — a condition on one KEY is `set_prop`'s own `was`, which a merged map cannot spell. A `was` for a field this call is not writing is refused.",
    }),
  ),
  /** LAST in the fold, whatever order the caller wrote the fields in. */
  mark: Schema.optionalKey(
    Schema.NullOr(Status).annotate({
      description:
        "The mark, written exactly as `set_done` / `set_doing` / `set_todo` writes it — `done` records the instant, the other two store `true`. `null` takes off whatever mark the node carries. Applied LAST, after every other field here, so it is judged against the node this call has finished making: asking for `doing` in the same breath as an `after` edge on an unfinished task is refused, as `set_doing` refuses it.",
    }),
  ),
})

/**
 * One batched arm: a request schema with its TOP-LEVEL prose taken off.
 *
 * {@link stripped} over a whole request rather than over one field table, and
 * paid for by a measurement: the nineteen request schemas of {@link BATCHED},
 * inside one array schema, are nineteen more copies of every field sentence they
 * carry in the FIRST frame of every agent
 * session, and every one of those sentences is already in that frame — on the
 * tool that takes the request, where the agent reads it. On this repo's own
 * surface the `apply` schema is 14.1 kB of `tools/list` with the prose and
 * 5.9 kB without, against a whole tool list that was 44.1 kB before this
 * feature and is 64.2 kB after it.
 *
 * TOP LEVEL ONLY: a capture's `children` keeps its own nested prose, including
 * the sentence at the floor of the unrolling that says a fourth level is a
 * second call. That one is not a description a reader can find elsewhere; it is
 * a refusal, written where it will be met.
 */
const arm = <F extends Schema.Struct.Fields>(schema: Schema.Struct<F>): Schema.Struct<F> =>
  Schema.Struct(stripped(schema.fields))

/**
 * Every verb {@link ApplyRequest} may carry, as the union it switches on.
 *
 * THE ARMS ARE THE REQUESTS THEMSELVES, not tagged copies of them: each schema
 * above already carries the `op` literal that names it, so a batched
 * `set_done` and a called `set_done` decode against one declaration. A parallel
 * list of "batch forms" is the drift this whole file is arranged to prevent —
 * it would be nineteen shapes free to fall behind the nineteen they mirror (nineteen SCHEMAS, carrying twenty-one verbs — the three marks share one request, as they do everywhere else). What
 * {@link arm} takes off is the PROSE and nothing else, so the two still decode
 * identically and are still one declaration.
 *
 * **WHAT IS LEFT OUT, and why it is exactly four.** The file ops —
 * `create_outline`, `create_document`, `write_document` — are the writes whose
 * subject is a FILE rather than a node, and the tool surface's own sentence is
 * that everything there is about nodes. Each is already atomic over the thing it
 * makes (a `create` with a seed that is refused leaves no file behind; a
 * document is one text, whole), so a batch buys them nothing but a way to make a
 * mistyped path part of somebody else's transaction. `apply` itself is the
 * fourth, for a plainer reason: a batch of batches is one flat batch with an
 * index nobody can name.
 *
 * `update` IS in, and that is the pair working: a batch of `update`s is the
 * shape "reconcile these five lanes" actually has.
 *
 * AND `empty` IS IN, which is the one entry that has to argue against the
 * paragraph above rather than with it: it NAMES files. What that sentence is
 * really about is a write whose subject is a file's EXISTENCE — a path that may
 * be mistyped into somebody else's transaction — and this one has no such
 * subject: every archive it names must already be in the loaded set, they are
 * left standing afterwards, and what the op is about is the RECORDS in them. A
 * batch is genuinely useful over it — emptying the trash and marking the lane
 * that finished with it is one write — which the other three have no use for.
 *
 * WHAT A BATCH IS NOT is a way to spell ONE emptying as several. `empty` takes
 * every archive it means in its own `files`, and its holder check is over that
 * union; two `empty` entries in one batch are two emptyings, each judged
 * against its own union and the second against the set the first left. That is
 * `apply`'s documented sequencing working exactly as it should, and it is the
 * wrong tool for a single gesture over several piles — which is why the browser
 * sends one op and the tool's own description says to name them together.
 */
const BATCHED = [
  arm(AddRequest),
  arm(MarkRequest),
  arm(TitleRequest),
  arm(DescRequest),
  arm(DateRequest),
  arm(RepeatRequest),
  arm(PropRequest),
  arm(UpdateRequest),
  arm(MoveRequest),
  arm(SplitRequest),
  arm(MergeRequest),
  arm(TrashRequest),
  arm(DuplicateRequest),
  arm(UntrashRequest),
  arm(EmptyRequest),
  arm(SeeRequest),
  arm(MirrorRequest),
  arm(UnmirrorRequest),
  arm(AfterRequest),
] as const

/**
 * How many ops one batch may run.
 *
 * A CAP, and — like {@link NESTING} — one this file would rather not have had.
 * Nothing about folding the planner wants a limit: the plan is one plan however
 * long the run, and the write is one write. What has a limit is what a REFUSAL
 * can usefully say. A batch is all-or-nothing, so the whole of a thousand-op run
 * is undone by its last op, and the sentence explaining that is a sentence about
 * a plan nobody can hold in their head. A hundred is well past the thirteen
 * calls this feature was filed for and well short of that.
 *
 * It lives beside the schema that quotes it, and `@olai/ops`' `plan.ts` reads it
 * to refuse — the same arrangement `NESTING` has, and for the same reason: the
 * limit is a refusal that names the number rather than a truncation nobody sees.
 */
export const BATCH_AT_MOST = 100

/**
 * SEVERAL OPS, one write.
 *
 * The wide half of the batching pair. Where {@link UpdateRequest} folds the
 * fields of one node, this folds whole verbs over whole outlines: mark these
 * four done, move that one, hang a property on each of the five it left behind.
 *
 * **ALL OR NOTHING, and that is the entire product.** The ops are planned in
 * the order given, each against the set as the ops before it left it — so an op
 * may name a node an earlier op created, retitle what an earlier op moved, or
 * mark what an earlier op captured — and the whole run produces ONE plan, which
 * the write gate validates once, renames once and stamps with one revision. Any
 * refusal anywhere aborts everything: nothing is written, the file on disk is
 * byte for byte what it was, and the answer names the INDEX of the op that
 * refused with that verb's own refusal underneath it.
 *
 * That is the property a caller cannot build for itself. Thirteen calls in a
 * loop is thirteen revisions, and the seventh refusing leaves six on disk with
 * nothing to say which six — the half-captured outline `add_node`'s `children`
 * was built to make impossible, at the scale of a lane rather than a subtree.
 *
 * **It is not a transaction language.** There is no rollback verb, no
 * condition, no branch and nothing to read mid-batch: the ops are the ops the
 * agent already has, in a list. What it buys is atomicity and a round trip, and
 * a caller that wants to LOOK at something between two writes is a caller
 * making two calls, correctly.
 */
export const ApplyRequest = Schema.Struct({
  op: Schema.Literal("apply"),
  ops: Schema.Array(Schema.Union([...BATCHED])).annotate({
    description:
      `The ops, in the order they are applied — at most ${BATCH_AT_MOST} of them. Each is exactly what its own tool takes, plus the \`op\` tag that names the verb: \`{"op":"done","id":"order"}\`, \`{"op":"prop","id":"lane","key":"pr","value":"…"}\`, \`{"op":"add","parent":"plan","title":"…"}\`. Each op sees the set as the ops before it left it, so a later one may name what an earlier one created. Any refusal aborts the whole list.`,
  }),
})

/**
 * Every ask above, as one union — what a writer sends and what the planner
 * switches on.
 *
 * `WriteRequest` rather than `Request`, which is what `@olai/ops` calls it and
 * goes on calling it. The rename is the `OutlineSummary` one made again: this
 * package already exports `NodeRequest`, `SubtreeRequest`, `SearchRequest` and
 * `CommitRequest`, so a bare `Request` here would be the one request among six
 * that does not say which question it is — read against those neighbours it
 * looks like their supertype, which it is not.
 */
export const WriteRequest = Schema.Union([
  AddRequest,
  MarkRequest,
  TitleRequest,
  DescRequest,
  DateRequest,
  RepeatRequest,
  PropRequest,
  MoveRequest,
  SplitRequest,
  MergeRequest,
  TrashRequest,
  DuplicateRequest,
  UntrashRequest,
  EmptyRequest,
  CreateRequest,
  SeeRequest,
  MirrorRequest,
  UnmirrorRequest,
  AfterRequest,
  WriteDocumentRequest,
  CreateDocumentRequest,
  UpdateRequest,
  ApplyRequest,
])
export type WriteRequest = typeof WriteRequest.Type

/** One op of a batch — {@link BATCHED} as a type, so the planner's fold names
 *  what it is folding rather than re-narrowing the whole write union at every
 *  step. It is a strict subset of {@link WriteRequest}, which is what makes the
 *  fold able to call the one planner. */
export type BatchedRequest = typeof ApplyRequest.Type["ops"][number]

/** One node a capture brought into being. The id matters most when nobody
 *  chose it: a minted id is unguessable, and a caller that just wrote thirteen
 *  nodes should not have to search for them.
 *
 *  Not {@link Found}, which is what a READ answers with: that one carries
 *  `file:line` and an ancestor path, and a plan has neither — the file it
 *  describes has not been written, so a line number here would be invented. */
export const Minted = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
})
export type Minted = typeof Minted.Type

/**
 * What an op that succeeded says. The node it was about, where that node lives
 * NOW (archiving moves it), and the one-line summary that becomes both the git
 * commit subject and the tool's reply.
 *
 * `WriteResult` rather than `@olai/ops`' own `Applied`, and the rename is the
 * load-bearing half of putting it here. `@olai/surface` exports an `Applied` of
 * its own — the KEYBOARD's answer, deliberately a different type (it adds
 * `undo` and drops `summary`, `sort`, `captured` and `rev`), argued at length in
 * that package's `edit.ts` and explicitly ruled un-unifiable by the #167 audit.
 * Two different things called `Applied`, both about a write that landed, both
 * carrying `id`, `title` and `nudge`, is the collision the `Outline` /
 * `OutlineSummary` trap taught to spell out: not a rename away from a compile
 * error, a rename away from a PLAUSIBLE one. So this one is named for the
 * family it joins — {@link CommitResult}, {@link PushResult} — and the two
 * `Applied`s never meet.
 *
 * A SCHEMA rather than the interface it was, for the reason {@link Found}
 * became one: it crosses a wire now. `ops.run` is a surface procedure, and a
 * procedure's answer has to be a shape both ends decode against rather than a
 * type only one end can check.
 */
export const WriteResult = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  file: Schema.String,
  summary: Schema.String,
  /** What the rollup noticed about a write that landed — the last task under a
   *  parent going done, a branch ticked over unfinished ones. Advice, carried
   *  back so an agent and a person both see it; absent when there is nothing
   *  to say, and never a reason a write did not happen. */
  nudge: Schema.optionalKey(Schema.String),
  /**
   * What this write CHANGED, in the format's own classification — the same
   * word the commit panel draws a pending row with.
   *
   * The `summary` above is a commit subject and this is a value to switch on,
   * which is what a reader that draws a write rather than logging one needs:
   * the chat transcript says *marked done* / *note rewritten* / *moved* about
   * an olai write, because it may never say it with a text diff. Derived from
   * the two readings the write is made of (`@olai/ops`' `sorted.ts`) rather
   * than from the op's name, so there is one classification of a change in this
   * codebase and not two.
   *
   * ABSENT when the write changed no record — a mark set on a node that
   * already carried it. Additive and optional, like `nudge` and `why`.
   */
  sort: Schema.optionalKey(Sort),
  /** Every node this write brought into being, parent before child and siblings
   *  in the order they were given — id and title, so the caller can mark, note
   *  or capture UNDER one of them without a search for an id it never chose. A
   *  plain capture is a list of one; absent only when the op created no NODE,
   *  which is how the format spells an empty list everywhere else.
   *
   *  A placed mirror is absent from it, and that is the same word read
   *  strictly: `add_mirror` creates a placement of a node that already exists,
   *  not a node, and it has no title to report. `id` above names the placement
   *  it made, which is what `remove_mirror` takes. */
  captured: Schema.optionalKey(Schema.Array(Minted)),
  /** The store revision this write produced. */
  rev: Schema.Int,
  /**
   * WHY THIS WRITE IS NOT IN THE HISTORY YET, in one sentence.
   *
   * There is always one, which is why this is not optional and why the
   * `committed` boolean that used to sit beside it is gone. Nothing commits a
   * write on its own any more: `--commit=auto` was one commit per op, made
   * inside the write gate, and it turned a train of thought into a dozen
   * commits — so it is the server's quiet window now, and a write that has
   * landed is a write that is WAITING, under every mode there is
   * (`@olai/ops`' `whyOf`).
   *
   * Six different pieces of news wear "not yet", and for a while the difference
   * between them went only to the server log — where somebody reading a browser
   * can never see it, and where a person who knows perfectly well that their
   * notes are a git repository is left with a write that quietly said
   * `committed: false`. So the reason travels with the answer: the agent reads
   * it in its tool result, the panel draws it beside the call, and nothing has
   * to be inferred from a boolean that had one value.
   */
  why: Schema.String,
})
export type WriteResult = typeof WriteResult.Type
