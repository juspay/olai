/**
 * THE SCRIPT — every op kind, twice, over one directory: what the planner is
 * held to when its shape changes underneath it.
 *
 * `perf-batch-assemble`'s decomplect moved two things about {@link ./plan.ts}
 * without meaning to move one answer: the questions a planner asks of the set
 * became a value handed in ({@link ./asked.ts}), and the switch that dispatched
 * twenty-six verbs became a TABLE. Both are behaviour-preserving by
 * construction and neither is behaviour-preserving by inspection — a context
 * that answered a shade differently from asking the set, or a table entry keyed
 * at the wrong verb, is a refusal nobody sees until an agent meets it.
 *
 * So this is the corpus the two claims are checked over
 * (`./plans.golden.test.ts`), and it is DATA rather than a suite for one
 * reason: the same script has to run against the planner as it stood BEFORE the
 * decomplect, in the checkout that still holds it, and be compared op by op.
 * Nothing here imports the planner, the fold, or anything that changed — the
 * requests are values and the corpus is text.
 *
 * ## What it covers, and why each op appears twice
 *
 * Every arm of the vocabulary, in a run where each op is planned against the
 * set the ops before it left — so a verb sees what the verbs before it wrote,
 * which is the state the batch fold puts a planner in. Each verb appears at
 * least once ANSWERING and at least once REFUSING, because a table keyed at the
 * wrong verb and a context that lost a fact fail differently: the first
 * usually plans something absurd, and the second refuses something that should
 * have landed (or lands something that should have been refused about a file
 * the set could not read).
 *
 * THAT SENTENCE IS ASSERTED, per verb, rather than left as a claim about a list
 * (`./plans.golden.test.ts`) — it was written before it was true of the file
 * below it, and six verbs answered without ever refusing until a reviewer
 * counted them. A promise about coverage that nothing checks is exactly the
 * promise the next decomplect will lean on.
 *
 * THE REFUSALS ARE THE POINT, and they are chosen to be the ones that read the
 * SET rather than the request: a file the set could not parse (every `writable`
 * gate), a path that is not an outline (`landsIn`), a path that is not a
 * document, a file that already exists, a trash that is not the trash, a
 * restore whose recorded source file is gone. Those are exactly the questions
 * the context now answers, so a wrong context shows up here as a sentence that
 * changed.
 *
 * Not a suite: `bun test` collects only `*.test.ts`.
 */

import type { WriteRequest } from "@olai/format"

/** The outlines the script runs over. A tree with marks, dates, properties,
 *  edges and a mirror; a second outline so a cross-file placement and a
 *  same-file rule can both be asked; a trash with a real pile in it (a source
 *  signpost above an ancestor scaffold above what was put away), so `untrash`
 *  and `empty` have something to work on. */
export const OUTLINES: Record<string, string> = {
  "house.olai": [
    `{"id":"kitchen","ord":"a0","title":"Kitchen remodel","desc":"the big one"}`,
    `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01T09:00:00-04:00"}`,
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","todo":true,"date":"2026-08-20","custom":{"pr":"https://x/1"}}`,
    `{"id":"install","parent":"kitchen","ord":"a2","title":"install them","todo":true,"after":["order"]}`,
    `{"id":"garden","ord":"a1","title":"Garden"}`,
    `{"id":"beds","parent":"garden","ord":"a0","title":"build the beds","doing":true,"date":"2026-08-24","repeat":"every monday"}`,
    `{"id":"seeds","parent":"garden","ord":"a1","title":"buy seeds","see":["beds"]}`,
    `{"id":"loose","ord":"a2","title":"a node with nothing under it"}`,
  ].join("\n"),
  "notes.olai": [
    `{"id":"notes","ord":"a0","title":"Notes"}`,
    `{"id":"shown","parent":"notes","ord":"a0","mirror":"kitchen"}`,
    `{"id":"stray","parent":"notes","ord":"a1","title":"a line to file"}`,
    `{"id":"spare","parent":"notes","ord":"a2","title":"a spare line, pointed at by nothing"}`,
  ].join("\n"),
  "_olai/Trash.olai": [
    `{"id":"pile","ord":"a0","title":"house.olai"}`,
    `{"id":"scaffold","parent":"pile","ord":"a0","title":"Kitchen remodel"}`,
    `{"id":"tiles","parent":"scaffold","ord":"a0","title":"choose the tiles","todo":true}`,
    `{"id":"gone","ord":"a1","title":"vanished.olai"}`,
    `{"id":"orphan","parent":"gone","ord":"a0","title":"nothing to go back to"}`,
  ].join("\n"),
}

/** The documents beside them: one `.md` a `doc` write can replace, and one file
 *  the set holds the PATH of and not the bytes. */
export const DOCUMENTS: ReadonlyArray<string | readonly [file: string, text: string]> = [
  ["notes/plan.md", "# Plan\n\nthe first draft\n"],
  "notes/page.html",
]

/** A file that did not parse — the fact behind every `writable` refusal in the
 *  script, and the one thing a planner may never write over. */
export const BROKEN: Record<string, string> = {
  "torn.olai": `{"id":"torn","ord":"a0"`,
}

/** One step of the script: the request, and what this step is FOR — the phrase
 *  a failing comparison names, so a divergence reads as a verb and a reason
 *  rather than as an index. */
export interface Step {
  readonly what: string
  readonly op: WriteRequest
}

/**
 * The run, in order. Each step is planned against the set the steps before it
 * left; a step that REFUSES leaves the set where it was, exactly as a batch's
 * refusal leaves nothing behind — so the ops after it go on against the world
 * the last successful one made.
 *
 * The ORDER is load-bearing in a few places and says so where it is: a `split`
 * after a `title`, an `untrash` after the `create` that mints the outline its
 * pile came from, an `empty` last because it takes the trash away.
 */
export const SCRIPT: ReadonlyArray<Step> = [
  // ── add ──────────────────────────────────────────────────────────────
  {
    what: "add under a parent, with edges and properties",
    op: {
      op: "add",
      parent: "kitchen",
      title: "fit the worktop",
      waitsOn: ["demo"],
      see: ["order"],
      props: { agent: "claude-opus" },
    },
  },
  {
    what: "add at the top level of an outline, with a subtree and a forward reference",
    op: {
      op: "add",
      file: "house.olai",
      title: "Shed",
      children: [
        { id: "roof", title: "roof it", waitsOn: ["frame"] },
        { id: "frame", title: "frame it" },
      ],
    },
  },
  {
    what: "add into a file the set could not read — the writable gate",
    op: { op: "add", file: "torn.olai", title: "nowhere" },
  },
  {
    what: "add into a path that is not an outline at all",
    op: { op: "add", file: "notes/plan.md", title: "nowhere" },
  },
  {
    what: "add under an id nothing declares — the did-you-mean",
    op: { op: "add", parent: "kitchn", title: "nowhere" },
  },
  // ── the four marks ───────────────────────────────────────────────────
  { what: "todo on a bullet", op: { op: "todo", id: "loose" } },
  { what: "doing, which the order gate judges", op: { op: "doing", id: "install" } },
  { what: "done on the node it was waiting for", op: { op: "done", id: "order" } },
  { what: "doing again, now that the way is clear", op: { op: "doing", id: "install" } },
  { what: "cancelled over open work below it", op: { op: "cancelled", id: "garden" } },
  {
    what: "done over unfinished work below it — refused, naming what stands there",
    op: { op: "done", id: "kitchen" },
  },
  { what: "todo undone, back to a bullet", op: { op: "todo", id: "loose", undo: true } },
  { what: "a mark on a mirror — refused, naming the node", op: { op: "done", id: "shown" } },
  // ── the fields ───────────────────────────────────────────────────────
  { what: "title", op: { op: "title", id: "loose", title: "a line with a name" } },
  {
    what: "title with a stale `was` — refused without reading the set",
    op: { op: "title", id: "loose", title: "later", was: "something else" },
  },
  { what: "desc", op: { op: "desc", id: "loose", desc: "a note under it" } },
  { what: "desc cleared", op: { op: "desc", id: "kitchen", desc: null } },
  { what: "date", op: { op: "date", id: "loose", date: "2026-09-01" } },
  { what: "date cleared", op: { op: "date", id: "order", date: null } },
  { what: "repeat, canonicalised", op: { op: "repeat", id: "loose", repeat: "every monday" } },
  { what: "repeat cleared", op: { op: "repeat", id: "beds", repeat: null } },
  { what: "prop written", op: { op: "prop", id: "loose", key: "source", value: "inbox" } },
  { what: "prop removed", op: { op: "prop", id: "order", key: "pr", value: null } },
  {
    what: "prop shadowing a field the format has — refused toward the verb that writes it",
    op: { op: "prop", id: "loose", key: "done", value: "yes" },
  },
  // ── structure ────────────────────────────────────────────────────────
  { what: "move under another parent", op: { op: "move", id: "loose", parent: "garden" } },
  { what: "move to the top level", op: { op: "move", id: "loose", parent: null } },
  {
    what: "move under its own descendant — refused, naming the loop",
    op: { op: "move", id: "kitchen", parent: "order" },
  },
  { what: "split a title in two", op: { op: "split", id: "seeds", title: "buy", rest: "seeds" } },
  { what: "merge into the sibling above", op: { op: "merge", id: "install" } },
  {
    what: "merge the first row of a file — refused, there is nothing above it",
    op: { op: "merge", id: "kitchen" },
  },
  { what: "duplicate a subtree", op: { op: "duplicate", id: "garden" } },
  {
    what: "duplicate a placement — refused, a mirror is not a subtree",
    op: { op: "duplicate", id: "shown" },
  },
  // A node NOTHING points at, so the trash it lands in can still be emptied
  // below: `empty_trash` refuses while anything outside the trash points into
  // it, which is a rule this script has to sequence around rather than trip
  // over.
  { what: "trash a node and what is under it", op: { op: "trash", id: "spare" } },
  {
    what: "trash an id nothing declares — refused with the near miss",
    op: { op: "trash", id: "spar" },
  },
  // ── the files ────────────────────────────────────────────────────────
  //
  // BEFORE the create below, which is the whole of what this step asks: the
  // recorded chain names an outline the directory does not have.
  {
    what: "untrash whose recorded outline is nowhere — refused",
    op: { op: "untrash", id: "orphan" },
  },
  { what: "create an outline, seeded", op: { op: "create", file: "vanished.olai", seed: { title: "back again" } } },
  {
    what: "create an outline that already exists — refused",
    op: { op: "create", file: "house.olai" },
  },
  { what: "create an empty outline", op: { op: "create", file: "notes/plans.olai" } },
  {
    what: "untrash by the recorded chain, now that the source file is back",
    op: { op: "untrash", id: "tiles" },
  },
  { what: "untrash into a named file", op: { op: "untrash", id: "orphan", file: "notes.olai" } },
  // ── the trash, emptied ───────────────────────────────────────────────
  //
  // HERE and not at the end: what is put away above is out again, and nothing
  // live points into what is left, which is the one state `empty_trash`
  // answers in. The edges the script adds below would each refuse it.
  {
    what: "empty an outline that is not the trash — refused",
    op: { op: "empty", file: "house.olai" },
  },
  { what: "empty the trash", op: { op: "empty", file: "_olai/Trash.olai" } },
  {
    what: "empty a trash that now holds nothing — refused",
    op: { op: "empty", file: "_olai/Trash.olai" },
  },
  // ── the edges ────────────────────────────────────────────────────────
  { what: "see added", op: { op: "see", id: "loose", add: ["order"] } },
  { what: "see removed", op: { op: "see", id: "loose", remove: ["order"] } },
  {
    what: "see naming an id nothing declares — refused with the near miss",
    op: { op: "see", id: "loose", add: ["ordr"] },
  },
  { what: "after added", op: { op: "after", id: "loose", add: ["demo"] } },
  {
    what: "after closing a loop — refused, naming the loop",
    op: { op: "after", id: "demo", add: ["loose"] },
  },
  { what: "after removed", op: { op: "after", id: "loose", remove: ["demo"] } },
  // ── the placements ───────────────────────────────────────────────────
  { what: "mirror placed in another file", op: { op: "mirror", target: "order", file: "notes.olai" } },
  {
    what: "mirror inside what it shows — refused, naming the loop",
    op: { op: "mirror", target: "kitchen", parent: "demo" },
  },
  { what: "unmirror the placement", op: { op: "unmirror", id: "shown" } },
  {
    what: "unmirror a node that is not a placement — refused",
    op: { op: "unmirror", id: "loose" },
  },
  // ── the documents ────────────────────────────────────────────────────
  { what: "write a document, whole", op: { op: "doc", file: "notes/plan.md", text: "# Plan\n\nthe second draft\n" } },
  {
    what: "write a document with a stale `was` — refused",
    op: { op: "doc", file: "notes/plan.md", text: "third", was: "not what is there" },
  },
  {
    what: "write a path that is not a document — refused with the near miss",
    op: { op: "doc", file: "notes/plans.md", text: "nowhere" },
  },
  { what: "create a document", op: { op: "create-doc", file: "notes/next.md", text: "# Next\n" } },
  {
    what: "create a document that already exists — refused",
    op: { op: "create-doc", file: "notes/plan.md" },
  },
  // ── the two that fold the rest ───────────────────────────────────────
  {
    what: "update several fields of one node at once",
    op: { op: "update", id: "loose", title: "the line", date: "2026-09-02" },
  },
  {
    what: "update whose `was` has gone stale — refused",
    op: { op: "update", id: "loose", title: "again", was: { title: "not the title" } },
  },
  {
    what: "apply a run of ops, each seeing the last one's work",
    op: {
      op: "apply",
      ops: [
        { op: "add", parent: "garden", title: "mulch", id: "mulch" },
        { op: "todo", id: "mulch" },
        { op: "after", id: "mulch", add: ["beds"] },
        { op: "prop", id: "mulch", key: "agent", value: "claude-opus" },
      ],
    },
  },
  {
    what: "apply whose third op is refused — the index is named and nothing lands",
    op: {
      op: "apply",
      ops: [
        { op: "add", parent: "garden", title: "compost", id: "compost" },
        { op: "todo", id: "compost" },
        { op: "done", id: "nowhere-at-all" },
      ],
    },
  },
  // ...and the one that is left over: a node others point at, put away last so
  // the emptied trash above is not what this step is about.
  { what: "trash a node others point at, which is allowed", op: { op: "trash", id: "beds" } },
  // ── the refusals the six quiet verbs have ────────────────────────────
  //
  // APPENDED, and the position is the point: the rows above were recorded from
  // the planner as it stood before the decomplect, and a step inserted among
  // them would move every hash after it — so what a reader can check on the
  // fixture's diff is that the earlier rows did not move (pi's SHOULD-1, whose
  // finding was that the header claimed a refusal per verb and six verbs had
  // none). Each of these refuses for the verb's OWN reason and refuses wherever
  // it sits: a settled mark, a stale condition, an id nothing declares, a half
  // of a split with nothing in it. `demo` is `done` in the corpus and no step
  // above touches it, which is what makes the first two hold here.
  {
    what: "todo over a settled mark — refused, the instant is on a day's page",
    op: { op: "todo", id: "demo" },
  },
  {
    what: "cancelled over a node already done — refused for the same reason",
    op: { op: "cancelled", id: "demo" },
  },
  {
    what: "desc with a stale `was` — refused, the note is not the one it expected",
    op: { op: "desc", id: "demo", desc: "a second note", was: "not the note it holds" },
  },
  {
    what: "date on an id nothing declares — refused with the near miss",
    op: { op: "date", id: "dem", date: "2026-09-09" },
  },
  {
    what: "repeat on an id nothing declares — the same door, one field over",
    op: { op: "repeat", id: "dem", repeat: "every day" },
  },
  // SPLIT, three more times: it is on the brief's own watch-list and appeared
  // exactly once. Both of its own refusals — an empty head and an empty tail —
  // and one more that ANSWERS, so the verb is exercised on both sides of its
  // gate rather than only past it.
  {
    what: "split leaving a blank row behind — refused",
    op: { op: "split", id: "demo", title: "  ", rest: "the rest" },
  },
  {
    what: "split with nothing on the other side — refused",
    op: { op: "split", id: "demo", title: "demolition", rest: "   " },
  },
  {
    what: "split a node that carries a mark, a date and children",
    op: { op: "split", id: "kitchen", title: "Kitchen", rest: "remodel" },
  },
]
