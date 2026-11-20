import type { WriteRequest } from "@olai/format"

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

export const DOCUMENTS: ReadonlyArray<string | readonly [file: string, text: string]> = [
  ["notes/plan.md", "# Plan\n\nthe first draft\n"],
  "notes/page.html",
]

export const BROKEN: Record<string, string> = {
  "torn.olai": `{"id":"torn","ord":"a0"`,
}

export interface Step {
  readonly what: string
  readonly op: WriteRequest
}

export const SCRIPT: ReadonlyArray<Step> = [
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
  { what: "trash a node and what is under it", op: { op: "trash", id: "spare" } },
  {
    what: "trash an id nothing declares — refused with the near miss",
    op: { op: "trash", id: "spar" },
  },
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
  {
    what: "empty an outline that is not the trash — refused",
    op: { op: "empty", file: "house.olai" },
  },
  { what: "empty the trash", op: { op: "empty", file: "_olai/Trash.olai" } },
  {
    what: "empty a trash that now holds nothing — refused",
    op: { op: "empty", file: "_olai/Trash.olai" },
  },
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
  { what: "trash a node others point at, which is allowed", op: { op: "trash", id: "beds" } },
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
  {
    what: "add born doing — the start rides the capture",
    op: {
      op: "add",
      parent: "kitchen",
      title: "boil the kettle",
      children: [{ title: "watch it", mark: "doing" }],
    },
  },
  {
    what: "a node to run rounds on",
    op: { op: "add", parent: "kitchen", title: "season the pan", id: "season" },
  },
  { what: "doing — the first round opens", op: { op: "doing", id: "season" } },
  { what: "done — the round is banked", op: { op: "done", id: "season" } },
  { what: "undone — the bank stands", op: { op: "done", id: "season", undo: true } },
  { what: "doing again — a fresh round stamped over the bank", op: { op: "doing", id: "season" } },
  { what: "done again — the second round adds in", op: { op: "done", id: "season" } },
  { what: "a bare undo leaves the work banked", op: { op: "done", id: "season", undo: true } },
  {
    what: "delete the document the script minted",
    op: { op: "delete", file: "notes/next.md" },
  },
  {
    what: "delete it again — refused with the near miss",
    op: { op: "delete", file: "notes/next.md" },
  },
  {
    what: "delete an outline holding records — refused, naming them",
    op: { op: "delete", file: "house.olai" },
  },
  {
    what: "delete a page of the kinds olai only shows — refused",
    op: { op: "delete", file: "notes/page.html" },
  },
]
