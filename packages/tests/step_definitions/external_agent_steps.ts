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

import { DataTable, Given, Then, When } from "@cucumber/cucumber";

import { olaiBin } from "../support/hooks.ts";
import { callTool, connectTerminalAgent } from "../support/mcp.ts";
import type { OlaiWorld } from "../support/world.ts";

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

When(
  "the terminal agent marks {string} done",
  async function (this: OlaiWorld, id: string) {
    await callTool(agentOf(this), "set_done", { id });
  },
);

When(
  "the terminal agent captures {string} in {string}",
  async function (this: OlaiWorld, title: string, file: string) {
    await callTool(agentOf(this), "add_node", { title, file });
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
  "the terminal agent searches for {string}",
  async function (this: OlaiWorld, text: string) {
    this.toolAnswer = await callTool(agentOf(this), "search_nodes", { text });
  },
);

When(
  "the terminal agent tries to mark {string} done",
  async function (this: OlaiWorld, id: string) {
    // Not `callTool`: the refusal is what this step is FOR, so it is read off
    // the reply rather than thrown.
    const answered = await agentOf(this).call("tools/call", {
      name: "set_done",
      arguments: { id },
    });
    assert.strictEqual(
      answered.error,
      undefined,
      "a refused write came back as a JSON-RPC error, which says the server " +
        "could not process the call — but it processed it and said no, and " +
        "that answer has to reach the model",
    );
    this.toolAnswer = answered.result ?? {};
  },
);

// ── what it was told ───────────────────────────────────────────────────

Then(
  "the terminal agent was refused, and told the children to mark instead:",
  function (this: OlaiWorld, table: DataTable) {
    const answer = this.toolAnswer ?? {};
    assert.strictEqual(
      answer["isError"],
      true,
      `the write was not refused: ${JSON.stringify(answer)}`,
    );
    const detail = structuredOf(this) as {
      readonly kind?: string;
      readonly children?: ReadonlyArray<{ readonly id?: string }>;
    };
    assert.strictEqual(
      detail.kind,
      "derived",
      `the refusal came back as ${detail.kind ?? "nothing"}, so the agent was ` +
        "given a sentence to parse rather than the reason as data",
    );
    assert.deepStrictEqual(
      (detail.children ?? []).map((child) => child.id).sort(),
      table.raw().map((row) => row[0]).sort(),
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
