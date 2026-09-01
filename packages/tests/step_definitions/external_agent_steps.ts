/**
 * The agent olai did not start.
 *
 * These steps are the only ones in the suite that do not go through the
 * browser, and that is the point: the client of `/mcp` is a coding agent in
 * a terminal, so a scenario about it has to be one. The assertions afterward
 * DO go through the browser, because the claim is not "the write happened" —
 * that has unit tests — but "the page a person is looking at followed a write
 * made by a client it has never heard of".
 *
 * Every tool answer is read from `structuredContent`, never from the prose in
 * `content`: the text is what a model reads, the structure is what a caller
 * acts on, and a test that parsed the prose would be asserting on wording.
 */

import * as assert from "node:assert";

import { Given, Then, When } from "@cucumber/cucumber";
import { PROJECTABLE } from "@olai/format";

import { callTool, connectTerminalAgent, tryTool } from "../support/mcp.ts";
import { HYDRATION_TIMEOUT, type OlaiWorld } from "../support/world.ts";

/** The half of a tool result a CALLER acts on. The prose beside it is what a
 *  model reads, and a test that parsed prose would be asserting on wording. */
const structuredOf = (world: OlaiWorld): Record<string, unknown> =>
  ((world.toolAnswer ?? {})["structuredContent"] ?? {}) as Record<
    string,
    unknown
  >;

const agentOf = (world: OlaiWorld) => {
  if (world.terminalAgent === undefined) {
    throw new Error(
      "no terminal agent is connected; the scenario needs the Given step first",
    );
  }
  return world.terminalAgent;
};

Given(
  "a terminal agent is connected to the served directory",
  async function (this: OlaiWorld) {
    // The same `/mcp` the page's server already answers — one store, one
    // process. `scratch()` is only the guard that this scenario is allowed
    // to write the directory (the `@scratch:` tag); the client never opens
    // it itself.
    this.scratch();
    this.terminalAgent = await connectTerminalAgent(`${this.baseUrl}/mcp`);
  },
);

// ── what it does ───────────────────────────────────────────────────────

/** One step for the three marks rather than three copies of it: which marks
 *  there are is the format's list, and the tool that writes one is named after
 *  it (`set_done` / `set_doing` / `set_todo`). */
When(
  "the terminal agent marks {string} {word}",
  async function (this: OlaiWorld, id: string, mark: string) {
    this.toolAnswer = await callTool(agentOf(this), `set_${mark}`, { id });
  },
);

When(
  "the terminal agent captures {string} in {string}",
  async function (this: OlaiWorld, title: string, file: string) {
    await callTool(agentOf(this), "add_node", { title, file });
  },
);

/** The subtree the batch-capture scenario writes: four nodes, three levels,
 *  ONE call. The ids are chosen so the assertions can name the rows; a real
 *  agent would let them be minted and read them back out of `captured`. */
const PANTRY = {
  parent: "kitchen",
  id: "pantry",
  title: "the pantry",
  children: [
    {
      id: "shelves",
      title: "shelves",
      children: [{ id: "measure", title: "measure the alcove", mark: "todo" }],
    },
    { id: "paint", title: "paint it", mark: "done" },
  ],
};

When(
  "the terminal agent captures a pantry and everything in it, in one call",
  async function (this: OlaiWorld) {
    this.toolAnswer = await callTool(agentOf(this), "add_node", PANTRY);
  },
);

/**
 * The claim the batch op exists for, asserted the only way that distinguishes
 * it from the sequence it replaced: the tree is read ONCE, after the root
 * arrives. One call was one validation, one rename and one snapshot, so a tab
 * that has the root of the capture already has all of it — where a step that
 * waited for each row would pass just as happily on four separate writes
 * trickling in.
 */
Then(
  "the tree shows the whole captured subtree at once",
  async function (this: OlaiWorld) {
    await this.visibleNode("pantry")
      .first()
      .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });

    for (const id of ["shelves", "measure", "paint"]) {
      assert.ok(
        (await this.visibleNode(id).count()) > 0,
        `the root of the capture is on screen and "${id}" is not — the whole ` +
          "subtree went to disk in one atomic write, so the page that has one " +
          "of them has all of them",
      );
    }
  },
);

Then(
  "the terminal agent was told it captured {int} nodes",
  function (this: OlaiWorld, many: number) {
    const captured = structuredOf(this)["captured"] as
      | ReadonlyArray<{ readonly id: string }>
      | undefined;
    assert.strictEqual(
      captured?.length,
      many,
      "a capture answers with every node it made — id and title — so the next " +
        `call can name one without searching for an id nobody chose. It said: ${
          JSON.stringify(captured)
        }`,
    );
  },
);

When(
  "the terminal agent creates the outline {string} seeded with {string}",
  async function (this: OlaiWorld, file: string, title: string) {
    await callTool(agentOf(this), "create_outline", {
      file,
      seed: { title },
    });
  },
);

When(
  "the terminal agent creates the outline {string} holding a whole tree",
  async function (this: OlaiWorld, file: string) {
    // The seed is a capture, `children` and all — so the file and everything in
    // it are one plan, one validation, one rename. Two calls used to be the
    // only way, and a refused second one left an empty outline behind.
    this.toolAnswer = await callTool(agentOf(this), "create_outline", {
      file,
      seed: {
        id: "shed",
        title: "the shed",
        children: [{
          id: "clear",
          title: "clear it out",
          mark: "todo",
          children: [{ id: "tins", title: "the old paint tins" }],
        }],
      },
    });
  },
);

/**
 * The ledger ops, as a terminal agent calls them.
 *
 * The mirror's own id is CHOSEN here so the assertions can name the row it
 * draws — a real agent would let one be minted and read it back off the
 * answer's `id`, which is the same field `remove_mirror` then takes.
 */
When(
  "the terminal agent mirrors {string} at the top of {string} as {string}",
  async function (this: OlaiWorld, target: string, file: string, id: string) {
    this.toolAnswer = await callTool(agentOf(this), "add_mirror", {
      target,
      file,
      id,
    });
  },
);

When(
  "the terminal agent retires the mirror {string}",
  async function (this: OlaiWorld, id: string) {
    this.toolAnswer = await callTool(agentOf(this), "remove_mirror", { id });
  },
);

/**
 * THE COPY, as a terminal asks for one — one id, and the op reads the rest off
 * the disk. What comes back is asserted with `duplicate_steps.ts`'s own steps,
 * which read the records: the claim is about ids and fields rather than about
 * a row appearing.
 */
When(
  "the terminal agent duplicates {string}",
  async function (this: OlaiWorld, id: string) {
    this.toolAnswer = await callTool(agentOf(this), "duplicate_node", { id });
  },
);

/** The arrow is written from the node that WAITS — `a blocks b` is spelled as
 *  `b after a`, and the ops layer writes it one way. */
When(
  "the terminal agent makes {string} wait on {string}",
  async function (this: OlaiWorld, id: string, blocker: string) {
    this.toolAnswer = await callTool(agentOf(this), "set_after", {
      id,
      add: [blocker],
    });
  },
);

When(
  "the terminal agent searches for {string}",
  async function (this: OlaiWorld, text: string) {
    this.toolAnswer = await callTool(agentOf(this), "search_nodes", { text });
  },
);

/** The same query, asking for the notes with it — the one field of a record a
 *  hit does not carry unless it is asked for. */
When(
  "the terminal agent searches for {string} with the notes",
  async function (this: OlaiWorld, text: string) {
    this.toolAnswer = await callTool(agentOf(this), "search_nodes", {
      text,
      withDesc: true,
    });
  },
);

/**
 * A WHOLE OUTLINE, in one call — `read_subtree` given a `file` rather than an
 * id.
 *
 * Through {@link tryTool} rather than {@link callTool} because both outcomes
 * are the subject here: a path the set serves is answered whole, and one it
 * does not is REFUSED with the closest that it does. A step that threw on the
 * refusal would need a second spelling of the same call to say so.
 */
When(
  "the terminal agent reads the whole outline {string}",
  async function (this: OlaiWorld, file: string) {
    this.toolAnswer = await tryTool(agentOf(this), "read_subtree", { file });
  },
);

/** The lean walk: same outline, no notes. Depth still applies; truncated is
 *  unchanged; `desc` is what leaves. */
When(
  "the terminal agent reads the whole outline {string} without the notes",
  async function (this: OlaiWorld, file: string) {
    this.toolAnswer = await tryTool(agentOf(this), "read_subtree", {
      file,
      withDesc: false,
    });
  },
);

When(
  "the terminal agent reads the node {string}",
  async function (this: OlaiWorld, id: string) {
    this.toolAnswer = await callTool(agentOf(this), "read_node", { id });
  },
);

/**
 * A shaped walk: `read_subtree` with `fields`, the projection a caller
 * names. Through {@link tryTool} — both outcomes are pinned below: a
 * vocabulary the caller can name is answered, and one it cannot is refused
 * naming the legal one.
 */
When(
  "the terminal agent walks {string} with only the fields {string}",
  async function (this: OlaiWorld, id: string, fields: string) {
    this.toolAnswer = await tryTool(agentOf(this), "read_subtree", {
      id,
      fields: fields.split(",").map((one) => one.trim()),
    });
  },
);

When(
  "the terminal agent walks {string} one level deep with only the fields {string}",
  async function (this: OlaiWorld, id: string, fields: string) {
    this.toolAnswer = await tryTool(agentOf(this), "read_subtree", {
      id,
      depth: 1,
      fields: fields.split(",").map((one) => one.trim()),
    });
  },
);

When(
  "the terminal agent walks {string} with the fields {string} and the notes turned off",
  async function (this: OlaiWorld, id: string, fields: string) {
    this.toolAnswer = await tryTool(agentOf(this), "read_subtree", {
      id,
      fields: fields.split(",").map((one) => one.trim()),
      withDesc: false,
    });
  },
);

When(
  "the terminal agent reads {string} with the children shaped as {string}",
  async function (this: OlaiWorld, id: string, fields: string) {
    this.toolAnswer = await tryTool(agentOf(this), "read_node", {
      id,
      fields: fields.split(",").map((one) => one.trim()),
    });
  },
);

/**
 * EVERY ROW OF A SHAPED WALK — root and all — proved to be id + the shape +
 * the walk's own structure, and nothing else. The assertion is the
 * subtraction: the rows know the fixture carries notes and situating, so a
 * walk that quietly carried them anyway would pass every "has the field"
 * check and is caught only here.
 */
const shapedRowsOf = (
  answer: Record<string, unknown>,
): ReadonlyArray<Record<string, unknown>> => {
  const rows: Array<Record<string, unknown>> = [];
  // The face signs the TOP of every answer with its `root` and a `vintage`;
  // the projection is the rows, so the envelope is lifted before the shape
  // is judged.
  const { root: _root, vintage: _vintage, ...first } = answer;
  const dig = (row: Record<string, unknown>) => {
    rows.push(row);
    for (const child of (row["children"] ?? []) as ReadonlyArray<Record<string, unknown>>) {
      dig(child);
    }
  };
  dig(first);
  return rows;
};

const claimShape = (
  rows: ReadonlyArray<Record<string, unknown>>,
  fields: ReadonlyArray<string>,
  // `read_node`'s child rows are REFERENCES — no `children` — where a walk's
  // rows carry the structure, so which rows owe the walk's own keys is said
  // by the caller.
  structure: "walk" | "references",
): void => {
  // The row's allowed keys: the structure the WALK owns (id / children /
  // truncated / the placements named as `placed`) plus exactly the named
  // fields. The union across rows must be the whole projection — a walk that
  // SHAPED but forgot a field is a subtler silence than one that never
  // shaped at all.
  const allowed = new Set(["id", "children", "truncated", "placed", ...fields]);
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      assert.ok(
        allowed.has(key),
        `a shaped row carried "${key}", which was not named: ${JSON.stringify(row)}`,
      );
      if (key !== "id" && key !== "children" && key !== "truncated" && key !== "placed") {
        seen.add(key);
      }
    }
    assert.strictEqual(typeof row["id"], "string", "every row is still an id first");
    if (structure === "walk") {
      assert.ok(
        Array.isArray(row["children"]),
        "the walk's structure was never a field: children rides as a key of the walk",
      );
    }
  }
  assert.deepStrictEqual(
    [...seen].sort(),
    [...fields].sort(),
    "the rows, together, carry the whole projection the caller named",
  );
};

Then(
  "every row of the walk carries exactly {word}, {word}, {word}",
  function (this: OlaiWorld, one: string, two: string, three: string) {
    claimShape(shapedRowsOf(structuredOf(this)), [one, two, three], "walk");
  },
);

Then(
  "every row of the shallow walk carries exactly {word}",
  function (this: OlaiWorld, field: string) {
    claimShape(shapedRowsOf(structuredOf(this)), [field], "walk");
  },
);

Then(
  "the walk's structure is the tree's own",
  function (this: OlaiWorld) {
    // The structure is the claim `fields` never touches: the shape is STILL
    // nested, the children are still the tree's children, and a shaped row
    // is the same row the full walk of this fixture answers with its
    // situating included.
    const tree = structuredOf(this);
    const of = (
      row: Record<string, unknown>,
    ): ReadonlyArray<string> =>
      ((row["children"] ?? []) as ReadonlyArray<Record<string, unknown>>).map(
        (child) => child["id"] as string,
      );
    assert.deepStrictEqual(of(tree), ["demo", "order", "install", "chase-tiler"]);
    const install = ((tree["children"] ?? []) as ReadonlyArray<Record<string, unknown>>)
      .find((row) => row["id"] === "install");
    assert.ok(install, "the walk reached install");
    assert.deepStrictEqual(of(install), ["hinges", "chase-supplier"]);
  },
);

Then(
  "the row {string} in the shallow walk is said truncated",
  function (this: OlaiWorld, id: string) {
    const row = shapedRowsOf(structuredOf(this)).find((one) => one["id"] === id);
    assert.ok(row, `the walk did not reach ${id}`);
    assert.strictEqual(row["truncated"], true, "the cut is said on the caller's row too");
  },
);

Then(
  "the node arrived whole and its children carry exactly {word}",
  function (this: OlaiWorld, field: string) {
    const answer = structuredOf(this);
    // "Whole" as facts the shape cannot name back: the place, the ancestry,
    // and the answer's own id.
    assert.strictEqual(answer["id"], "kitchen");
    assert.strictEqual(answer["file"], "house.olai");
    assert.strictEqual(typeof answer["line"], "number", "a whole node is situated");
    claimShape(
      (answer["children"] ?? []) as ReadonlyArray<Record<string, unknown>>,
      [field],
      "references",
    );
  },
);

Then(
  "the refusal lists every legal field name",
  function (this: OlaiWorld) {
    const reason = String(structuredOf(this)["reason"] ?? "");
    // One place the vocabulary is learned: the refusal sentence names the
    // whole legal set, so an agent correcting from prose can. The list is
    // the format's own rather than retyped — a hand-spelled one here can
    // only ever prove the two spellings once agreed.
    for (const legal of PROJECTABLE) {
      assert.ok(
        reason.includes(`\`${legal}\``),
        `the refusal does not name \`${legal}\`: ${reason}`,
      );
    }
    assert.ok(
      reason.includes("`custom.<key>`"),
      `the one key form must be named too: ${reason}`,
    );
  },
);
When(
  "the terminal agent creates the document {string} holding {string}",
  async function (this: OlaiWorld, file: string, text: string) {
    this.toolAnswer = await callTool(agentOf(this), "create_document", {
      file,
      text,
    });
  },
);

When(
  "the terminal agent rewrites {string} expecting {string}, as {string}",
  async function (this: OlaiWorld, file: string, was: string, text: string) {
    this.toolAnswer = await callTool(agentOf(this), "write_document", {
      file,
      text,
      was,
    });
  },
);


Then(
  "the terminal agent was refused with the kind {string}",
  function (this: OlaiWorld, kind: string) {
    const answer = this.toolAnswer ?? {};
    assert.strictEqual(
      answer["isError"],
      true,
      `the write was not refused: ${JSON.stringify(answer)}`,
    );
    assert.strictEqual(
      structuredOf(this)["kind"],
      kind,
      "the refusal has to carry its kind as data — a sentence to parse is " +
        "what the taxonomy exists to replace",
    );
  },
);

/**
 * Exactly these ADDRESSES, in the order they came back — the shape a scoped or
 * operator query is judged by, because what a narrowing does is take hits AWAY
 * and "contains X" cannot see that happen.
 *
 * By the address rather than by an id, because an answer holds two kinds of
 * thing: `#order` is a record and `notes/cabinets.md` is a document, and the
 * written form is what tells them apart — the same string the app writes into
 * the bar. Reading `hit.id` was fine while every hit was a node and reads back
 * `undefined` for the other half.
 */
Then(
  "the terminal agent found exactly {string}",
  function (this: OlaiWorld, expected: string) {
    const hits = (structuredOf(this)["hits"] ?? []) as ReadonlyArray<
      { readonly at: { readonly kind: string; readonly id?: string; readonly path?: string } }
    >;
    assert.deepStrictEqual(
      hits.map((hit) => (hit.at.kind === "node" ? `#${hit.at.id}` : hit.at.path)),
      expected === "" ? [] : expected.split(",").map((one) => one.trim()),
    );
  },
);

/**
 * EVERY TOP-LEVEL NODE THE FILE HOLDS, by title and in order — the whole claim
 * of the `file` arm, asserted the only way that tells it from the sequence it
 * replaces: one call, and everything in it.
 *
 * By TITLE rather than by id, because the roots here are what a person put in
 * the outline and one of them was captured a step earlier with an id nobody
 * chose.
 */
Then(
  "the terminal agent was handed the roots {string}",
  function (this: OlaiWorld, expected: string) {
    const answer = this.toolAnswer ?? {};
    assert.notStrictEqual(
      answer["isError"],
      true,
      `the read was refused: ${JSON.stringify(answer["structuredContent"])}`,
    );
    const roots = (structuredOf(this)["roots"] ?? []) as ReadonlyArray<
      { readonly title: string }
    >;
    assert.deepStrictEqual(
      roots.map((root) => root.title),
      expected.split(",").map((one) => one.trim()),
    );
  },
);

/** The near miss, in the words `read_document` refuses a mistyped `.md` in —
 *  one typo, one answer, whichever verb it landed at. */
Then(
  "the terminal agent was pointed at {string}",
  function (this: OlaiWorld, file: string) {
    // A substring rather than a pattern: a path is full of dots, and a regexp
    // built out of one would pass on a sentence naming a file that differs by
    // exactly those characters.
    const reason = String(structuredOf(this)["reason"] ?? "");
    assert.ok(
      reason.includes(`did you mean \`${file}\``),
      "a path the set does not hold is refused with the closest one that it " +
        `does — never answered as an outline holding nothing. It said: ${reason}`,
    );
  },
);

/** The note a hit carries when the query asked for it — the selection and its
 *  notes in one call, rather than a `read_node` per row. */
Then(
  "the terminal agent was handed the note {string}",
  function (this: OlaiWorld, note: string) {
    const hits = (structuredOf(this)["hits"] ?? []) as ReadonlyArray<
      { readonly desc?: string }
    >;
    assert.deepStrictEqual(hits.map((hit) => hit.desc), [note]);
  },
);

/** The parent id a node read answers — the fact a write takes, which `path`
 *  (titles) does not carry. */
Then(
  "the terminal agent was handed the parent {string}",
  function (this: OlaiWorld, parent: string) {
    assert.strictEqual(
      structuredOf(this)["parent"],
      parent,
      `the read did not carry parent ${parent}: ${
        JSON.stringify(structuredOf(this))
      }`,
    );
  },
);

/**
 * Walk every node in a subtree answer — a single tree or an outline of roots —
 * and assert none of them carried a note. The lean read's whole claim.
 */
Then(
  "no node in the answer carries a note",
  function (this: OlaiWorld) {
    type Row = {
      readonly desc?: unknown
      readonly children?: ReadonlyArray<Row>
    };
    const walk = (node: Row): ReadonlyArray<Row> => [
      node,
      ...(node.children ?? []).flatMap(walk),
    ];
    const answer = structuredOf(this);
    const rows = "roots" in answer
      ? (answer["roots"] as ReadonlyArray<Row>).flatMap(walk)
      : walk(answer as Row);
    const noted = rows.filter((row) => Object.hasOwn(row, "desc"));
    assert.deepStrictEqual(
      noted,
      [],
      `the lean walk still carried notes: ${JSON.stringify(noted)}`,
    );
  },
);

// ── what it may READ ───────────────────────────────────────────────────

/**
 * A body, over the door a body is asked for through — the one consumer the
 * preview's change was measured against.
 *
 * A `.html`'s bytes stopped crossing the websocket when the browser stopped
 * asking for them: a preview draws a frame that fetches the file over HTTP, so
 * what it needs from the wire is the file's REVISION and nothing more
 * (`@olai/surface`'s `Head`). That is a change to what one READER asks for, and
 * this is the assertion that it was only that: an agent has no frame, so a
 * `resources/read` of the same file must still be answered with the file.
 *
 * It is a raw `resources/read` rather than a tool call because that is what the
 * surface publishes — `surface://collections/<member>/<key>`, the same URI a
 * `.mcp.json` client reaches — and going through the tool table would be
 * testing a door this member does not have.
 */
When(
  "the terminal agent reads the file {string}",
  async function (this: OlaiWorld, file: string) {
    const uri = `surface://collections/documents/${file}`;
    // UNTIL THE KEY IS THERE, because a scenario writes the file a moment
    // before asking for it and the directory is published on the store's own
    // clock. A `resources/read` of a key the collection does not hold is
    // refused rather than held open — which is the right answer to a path that
    // is not there, and the wrong one to a path that is about to be. Waiting
    // here rather than in the scenario keeps the sentence a person reads about
    // what an agent may READ.
    let refusal = "nothing was said";
    try {
      await this.waitUntil(async () => {
        const answered = await agentOf(this).call("resources/read", { uri });
        if (answered.error !== undefined) {
          refusal = `${answered.error.message} (${answered.error.code})`;
          return false;
        }
        const contents = (answered.result?.["contents"] ??
          []) as ReadonlyArray<{ readonly text?: string }>;
        this.resourceRead = contents[0]?.text ?? "";
        return true;
      }, `${uri} to be readable`);
    } catch {
      throw new Error(
        `${uri} was never readable — the last refusal was: ${refusal}`,
      );
    }
  },
);

Then(
  "the terminal agent was handed {string}",
  function (this: OlaiWorld, said: string) {
    const read = this.resourceRead ?? "";
    assert.ok(
      read.includes(said),
      `what the agent read was ${JSON.stringify(read)}, which does not carry ` +
        `${JSON.stringify(said)} — the reader with no frame of its own still ` +
        "needs the body",
    );
  },
);

/**
 * A batch, and the one property the browser is the right place to prove: the
 * page sees ONE snapshot for the whole run.
 *
 * Three ops that a loop would have sent as three calls at three revisions, so a
 * tab would have drawn the first, then the second, then the third. `apply` is
 * one plan, one validation, one rename and one publication — a page that has
 * any of it has all of it, which is the same claim `add_node`'s `children`
 * makes one level down and the reason the assertion reads the tree once.
 */
When(
  "the terminal agent applies three ops in one call",
  async function (this: OlaiWorld) {
    this.toolAnswer = await callTool(agentOf(this), "apply", {
      ops: [
        { op: "add", parent: "kitchen", id: "worktop", title: "fit the worktop" },
        { op: "after", id: "worktop", add: ["install"] },
        { op: "prop", id: "worktop", key: "agent", value: "claude-opus" },
      ],
    });
  },
);

When(
  "the terminal agent applies a batch whose last op is refused",
  async function (this: OlaiWorld) {
    // The first two would land on their own; the third names an id nothing
    // declares. All-or-nothing means the first two do not.
    this.toolAnswer = await tryTool(agentOf(this), "apply", {
      ops: [
        { op: "add", parent: "kitchen", id: "never", title: "never written" },
        { op: "title", id: "order", title: "renamed by a batch" },
        { op: "done", id: "nowhere" },
      ],
    });
  },
);

When(
  "the terminal agent updates {string} in one call",
  async function (this: OlaiWorld, id: string) {
    this.toolAnswer = await callTool(agentOf(this), "update", {
      id,
      title: "order the walnut cabinets",
      desc: "walnut, six week lead time",
      props: { supplier: "the joiner" },
    });
  },
);
