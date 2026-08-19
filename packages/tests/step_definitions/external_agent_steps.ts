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
    const listed = await this.terminalAgent.call("tools/list");
    this.toolsOffered = (
      (listed.result?.tools ?? []) as ReadonlyArray<{ name: string }>
    ).map((tool) => tool.name);
  },
);

// ── what it is allowed to do ───────────────────────────────────────────

Then(
  "the terminal agent is offered the tool {string}",
  function (this: OlaiWorld, name: string) {
    assert.ok(
      this.toolsOffered.includes(name),
      `the tool surface offers ${this.toolsOffered.join(", ")} — no \`${name}\``,
    );
  },
);

Then("the terminal agent is offered no file tools", function (this: OlaiWorld) {
  // The closed list is a closed list from out here too. What would make an
  // agent able to write a broken outline is any tool that names a FILE or a
  // shell, and the way that ships is by somebody adding a convenience.
  const forbidden = this.toolsOffered.filter((name) =>
    /read_file|write_file|edit|list_dir|glob|grep|bash|shell|exec/i.test(name),
  );
  assert.deepStrictEqual(
    forbidden,
    [],
    `the tool surface offers ${forbidden.join(", ")}, which name bytes rather ` +
      "than nodes — the whole guarantee is that an agent cannot express a " +
      "malformed outline",
  );
});

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

When(
  "the terminal agent tries to duplicate {string}",
  async function (this: OlaiWorld, id: string) {
    this.toolAnswer = await tryTool(agentOf(this), "duplicate_node", { id });
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

/** The same tool, SCOPED — the narrowing a person gets by filtering a zoomed
 *  page, said out loud so an agent can ask the same question. Without it the
 *  two faces would answer different questions with one grammar, which is the
 *  deviation HACKING.md forbids. */
When(
  "the terminal agent searches for {string} under {string}",
  async function (this: OlaiWorld, text: string, under: string) {
    this.toolAnswer = await callTool(agentOf(this), "search_nodes", {
      text,
      under,
    });
  },
);

// ── documents, from a terminal ─────────────────────────────────────────

/**
 * The two reads, over the same wire the writes go over.
 *
 * `resources/read` next door reaches the same files by URI and is a different
 * claim: a RESOURCE is something a host may or may not put in front of a
 * model, and a tool is something the model can call. The write verbs describe
 * their own guard in terms of what a caller READ, so the read had to be a tool
 * the caller can reach.
 */
When(
  "the terminal agent lists the documents",
  async function (this: OlaiWorld) {
    this.toolAnswer = await callTool(agentOf(this), "list_documents", {});
  },
);

Then(
  "the terminal agent was shown the document {string} titled {string}",
  function (this: OlaiWorld, file: string, title: string) {
    const listed = (structuredOf(this)["documents"] ?? []) as ReadonlyArray<
      { readonly file: string; readonly title: string; readonly bytes: number }
    >;
    const found = listed.find((one) => one.file === file);
    assert.ok(
      found,
      `the listing is ${JSON.stringify(listed.map((one) => one.file))} — no \`${file}\``,
    );
    // The title is DERIVED — the document's first line with its heading marks
    // off — because a `.md` has no record for a name to be written on. It is
    // the same line the app draws under a node that attaches one.
    assert.strictEqual(found.title, title);
    assert.ok(
      found.bytes > 0,
      `\`${file}\` is listed weighing ${found.bytes} bytes, and it is not empty`,
    );
  },
);

When(
  "the terminal agent reads the document {string}",
  async function (this: OlaiWorld, file: string) {
    this.toolAnswer = await callTool(agentOf(this), "read_document", { file });
  },
);

When(
  "the terminal agent tries to read the document {string}",
  async function (this: OlaiWorld, file: string) {
    // `tryTool`, not `callTool`: the refusal is what this step is FOR.
    this.toolAnswer = await tryTool(agentOf(this), "read_document", { file });
  },
);

Then(
  "the terminal agent was handed the document text {string}",
  function (this: OlaiWorld, said: string) {
    const text = structuredOf(this)["text"];
    assert.ok(
      typeof text === "string" && text.includes(said),
      `the document read as ${JSON.stringify(text)}, which does not carry ` +
        `${JSON.stringify(said)} — a body a write is judged against has to be ` +
        "the body",
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

When(
  "the terminal agent tries to rewrite {string} expecting {string}, as {string}",
  async function (this: OlaiWorld, file: string, was: string, text: string) {
    // `tryTool`, not `callTool`: the refusal is what this step is FOR.
    this.toolAnswer = await tryTool(agentOf(this), "write_document", {
      file,
      text,
      was,
    });
  },
);

When(
  "the terminal agent tries to mark {string} done",
  async function (this: OlaiWorld, id: string) {
    // `tryTool`, not `callTool`: the refusal is what this step is FOR, so it
    // is read off the reply rather than thrown.
    this.toolAnswer = await tryTool(agentOf(this), "set_done", { id });
  },
);

// ── what it was told ───────────────────────────────────────────────────

/** The refusal's own SENTENCE, beside the kind above — because what a refusal
 *  teaches is the half a caller acts on when the kind alone cannot say which
 *  node to name instead. */
Then(
  "the terminal agent was refused, saying {string}",
  function (this: OlaiWorld, said: string) {
    const reason = structuredOf(this)["reason"];
    assert.ok(
      typeof reason === "string" && reason.includes(said),
      `the refusal reads ${JSON.stringify(reason)}, which does not say ` +
        `${JSON.stringify(said)}`,
    );
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

Then(
  "the terminal agent was told {string}",
  function (this: OlaiWorld, said: string) {
    const nudge = structuredOf(this)["nudge"];
    assert.ok(
      typeof nudge === "string" && nudge.includes(said),
      `the answer's nudge was ${JSON.stringify(nudge)}, which does not mention ` +
        `${JSON.stringify(said)} — advice about a write that HAPPENED travels ` +
        "on the answer, in a field of its own",
    );
  },
);

Then(
  "the terminal agent found {string} in {string}",
  function (this: OlaiWorld, id: string, file: string) {
    const hits = (structuredOf(this)["hits"] ?? []) as ReadonlyArray<{
      readonly id: string;
      readonly file: string;
      readonly line: number;
    }>;
    const found = hits.find((hit) => hit.id === id);
    assert.ok(
      found,
      `no hit for "${id}" among ${hits.map((hit) => hit.id).join(", ")}`,
    );
    assert.strictEqual(found.file, file);
    // A hit that could not say WHERE would leave the agent no way to point a
    // person at it, which is the reason these queries are over parsed nodes.
    assert.ok(
      found.line >= 1,
      `the hit for "${id}" carries no line number`,
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
 * The refusal, over the wire an agent uses.
 *
 * Read from `structuredContent` like every other assertion here: the prose is
 * what a model reads, the structure is what a caller acts on — and a refusal a
 * caller cannot act on is a refusal that may as well be silence.
 */
Then(
  "the terminal agent was refused {string} and told {string}",
  function (this: OlaiWorld, token: string, teaching: string) {
    const refusals = (structuredOf(this)["refusals"] ?? []) as ReadonlyArray<
      { readonly token: string; readonly reason: string }
    >;
    const found = refusals.find((one) => one.token === token);
    assert.ok(
      found,
      `no refusal naming \`${token}\` among ${JSON.stringify(refusals)} — an ` +
        "empty answer with no reason is the silence this field exists to end",
    );
    assert.ok(
      found.reason.includes(teaching),
      `the refusal for \`${token}\` reads ${JSON.stringify(found.reason)}, ` +
        `which does not say what the operator takes (${teaching})`,
    );
  },
);

/** The other half: a query the grammar COULD read says nothing about
 *  refusals, so an agent cannot mistake "found nothing" for "asked wrongly". */
Then("the terminal agent was refused nothing", function (this: OlaiWorld) {
  assert.strictEqual(
    structuredOf(this)["refusals"],
    undefined,
    "a readable query carried a refusal",
  );
});

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
