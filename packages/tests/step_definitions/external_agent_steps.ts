/**
 * The agent olai did not start.
 *
 * These steps are the only ones in the suite that do not go through the
 * browser, and that is the point: the client of `olai mcp` is a coding agent
 * in a terminal, so a scenario about it has to be one. The assertions afterward
 * DO go through the browser, because the claim is not "the write happened" —
 * that has unit tests — but "the page a person is looking at followed a write
 * made by a process it has never heard of".
 *
 * Every tool answer is read from `structuredContent`, never from the prose in
 * `content`: the text is what a model reads, the structure is what a caller
 * acts on, and a test that parsed the prose would be asserting on wording.
 */

import * as assert from "node:assert";

import { Given, Then, When } from "@cucumber/cucumber";

import { olaiBin } from "../support/hooks.ts";
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
    // `scratch()` rather than `served` — a terminal agent WRITES the directory
    // it is pointed at, and that is the world's own guard for "this scenario
    // forgot its @scratch: tag", spelled once for every step that edits a file.
    this.terminalAgent = await connectTerminalAgent(olaiBin(), this.scratch());
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

/** Exactly these ids, in the order they came back — the shape a scoped or
 *  operator query is judged by, because what a narrowing does is take hits
 *  AWAY and "contains X" cannot see that happen. */
Then(
  "the terminal agent found exactly {string}",
  function (this: OlaiWorld, expected: string) {
    const hits = (structuredOf(this)["hits"] ?? []) as ReadonlyArray<
      { readonly id: string }
    >;
    assert.deepStrictEqual(
      hits.map((hit) => hit.id),
      expected === "" ? [] : expected.split(",").map((id) => id.trim()),
    );
  },
);
