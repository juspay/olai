import * as assert from "node:assert";

import { Given, Then, When } from "@olai/tests/harness/runner.ts";
import { PROJECTABLE } from "@olai/format";

import { callTool, connectTerminalAgent, tryTool } from "@olai/tests/harness/mcp.ts";
import { HYDRATION_TIMEOUT, type OlaiWorld } from "@olai/tests/harness/world.ts";

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
    this.scratch();
    this.terminalAgent = await connectTerminalAgent(`${this.baseUrl}/mcp`);
  },
);

When(
  "the terminal agent marks {string} {word}",
  async function (this: OlaiWorld, id: string, mark: string) {
    this.toolAnswer = await callTool(agentOf(this), `outlines_${mark}`, { id });
  },
);

When(
  "the terminal agent captures {string} in {string}",
  async function (this: OlaiWorld, title: string, file: string) {
    await callTool(agentOf(this), "outlines_add", { title, file });
  },
);

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
    this.toolAnswer = await callTool(agentOf(this), "outlines_add", PANTRY);
  },
);

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
    await callTool(agentOf(this), "files_create", {
      file,
      seed: { title },
    });
  },
);

When(
  "the terminal agent creates the outline {string} holding a whole tree",
  async function (this: OlaiWorld, file: string) {
    this.toolAnswer = await callTool(agentOf(this), "files_create", {
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

When(
  "the terminal agent mirrors {string} at the top of {string} as {string}",
  async function (this: OlaiWorld, target: string, file: string, id: string) {
    this.toolAnswer = await callTool(agentOf(this), "outlines_mirror", {
      target,
      file,
      id,
    });
  },
);

When(
  "the terminal agent retires the mirror {string}",
  async function (this: OlaiWorld, id: string) {
    this.toolAnswer = await callTool(agentOf(this), "outlines_unmirror", { id });
  },
);

When(
  "the terminal agent duplicates {string}",
  async function (this: OlaiWorld, id: string) {
    this.toolAnswer = await callTool(agentOf(this), "outlines_duplicate", { id });
  },
);

When(
  "the terminal agent makes {string} wait on {string}",
  async function (this: OlaiWorld, id: string, blocker: string) {
    this.toolAnswer = await callTool(agentOf(this), "outlines_after", {
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

When(
  "the terminal agent searches for {string} with the notes",
  async function (this: OlaiWorld, text: string) {
    this.toolAnswer = await callTool(agentOf(this), "search_nodes", {
      text,
      withDesc: true,
    });
  },
);

When(
  "the terminal agent reads the whole outline {string}",
  async function (this: OlaiWorld, file: string) {
    this.toolAnswer = await tryTool(agentOf(this), "outlines_subtree", { file });
  },
);

When(
  "the terminal agent reads the whole outline {string} without the notes",
  async function (this: OlaiWorld, file: string) {
    this.toolAnswer = await tryTool(agentOf(this), "outlines_subtree", {
      file,
      withDesc: false,
    });
  },
);

When(
  "the terminal agent reads the node {string}",
  async function (this: OlaiWorld, id: string) {
    this.toolAnswer = await callTool(agentOf(this), "outlines_read", { id });
  },
);

When(
  "the terminal agent walks {string} with only the fields {string}",
  async function (this: OlaiWorld, id: string, fields: string) {
    this.toolAnswer = await tryTool(agentOf(this), "outlines_subtree", {
      id,
      fields: fields.split(",").map((one) => one.trim()),
    });
  },
);

When(
  "the terminal agent walks {string} one level deep with only the fields {string}",
  async function (this: OlaiWorld, id: string, fields: string) {
    this.toolAnswer = await tryTool(agentOf(this), "outlines_subtree", {
      id,
      depth: 1,
      fields: fields.split(",").map((one) => one.trim()),
    });
  },
);

When(
  "the terminal agent walks {string} with the fields {string} and the notes turned off",
  async function (this: OlaiWorld, id: string, fields: string) {
    this.toolAnswer = await tryTool(agentOf(this), "outlines_subtree", {
      id,
      fields: fields.split(",").map((one) => one.trim()),
      withDesc: false,
    });
  },
);

When(
  "the terminal agent reads {string} with the children shaped as {string}",
  async function (this: OlaiWorld, id: string, fields: string) {
    this.toolAnswer = await tryTool(agentOf(this), "outlines_read", {
      id,
      fields: fields.split(",").map((one) => one.trim()),
    });
  },
);

const shapedRowsOf = (
  answer: Record<string, unknown>,
): ReadonlyArray<Record<string, unknown>> => {
  const rows: Array<Record<string, unknown>> = [];
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
  structure: "walk" | "references",
): void => {
  const structureKeys = structure === "walk"
    ? new Set(["children", "truncated", "placed"])
    : new Set<string>();
  const allowed = new Set(["id", ...structureKeys, ...fields]);
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      assert.ok(
        allowed.has(key),
        `a shaped row carried "${key}", which was not named: ${JSON.stringify(row)}`,
      );
      if (key !== "id" && !structureKeys.has(key)) {
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
    this.toolAnswer = await callTool(agentOf(this), "markdown_create", {
      file,
      text,
    });
  },
);

When(
  "the terminal agent rewrites {string} expecting {string}, as {string}",
  async function (this: OlaiWorld, file: string, was: string, text: string) {
    this.toolAnswer = await tryTool(agentOf(this), "markdown_write", {
      file,
      text: text.replace(/\\n/g, "\n"),
      was: was.replace(/\\n/g, "\n"),
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

Then(
  "the terminal agent was handed the placements {string}",
  function (this: OlaiWorld, expected: string) {
    const answer = this.toolAnswer ?? {};
    assert.notStrictEqual(
      answer["isError"],
      true,
      `the read was refused: ${JSON.stringify(answer["structuredContent"])}`,
    );
    const placed = (structuredOf(this)["placed"] ?? []) as ReadonlyArray<
      { readonly id: string }
    >;
    assert.deepStrictEqual(
      placed.map((entry) => entry.id),
      expected === "" ? [] : expected.split(",").map((one) => one.trim()),
    );
  },
);

Then(
  "the terminal agent was pointed at {string}",
  function (this: OlaiWorld, file: string) {
    const reason = String(structuredOf(this)["reason"] ?? "");
    assert.ok(
      reason.includes(`did you mean \`${file}\``),
      "a path the set does not hold is refused with the closest one that it " +
        `does — never answered as an outline holding nothing. It said: ${reason}`,
    );
  },
);

Then(
  "the terminal agent was handed the note {string}",
  function (this: OlaiWorld, note: string) {
    const hits = (structuredOf(this)["hits"] ?? []) as ReadonlyArray<
      { readonly desc?: string }
    >;
    assert.deepStrictEqual(hits.map((hit) => hit.desc), [note]);
  },
);

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

When("the terminal agent asks to read the fetched file {string}", async function(this: OlaiWorld, file: string) {
  const answer = await agentOf(this).call("tools/call", { name: "markdown_read", arguments: { file } });
  this.resourceRead = JSON.stringify(answer);
  assert.ok(answer.error !== undefined || answer.result?.["isError"] === true);
  const listed = await agentOf(this).call("tools/list", {});
  assert.equal(JSON.stringify(listed).includes("vault_bodies_get"), false);
});
Then("the terminal agent cannot read a fetched body", function(this: OlaiWorld) {
  assert.ok(this.resourceRead?.includes("error") || this.resourceRead?.includes("isError"));
});

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

When(
  "the terminal agent applies three ops in one call",
  async function (this: OlaiWorld) {
    this.toolAnswer = await callTool(agentOf(this), "outlines_apply", {
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
    this.toolAnswer = await tryTool(agentOf(this), "outlines_apply", {
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
    this.toolAnswer = await callTool(agentOf(this), "outlines_update", {
      id,
      title: "order the walnut cabinets",
      desc: "walnut, six week lead time",
      props: { supplier: "the joiner" },
    });
  },
);

When("the terminal agent commits as {string}", async function (this: OlaiWorld, message: string) {
  this.toolAnswer = await callTool(agentOf(this), "git_commit", { message });
});

When("the terminal agent sets property {string} on {string} to {string}", async function (this: OlaiWorld, key: string, id: string, value: string) {
  this.toolAnswer = await tryTool(agentOf(this), "outlines_prop", { id, key, value });
});
Then("the terminal refusal says {string}", function (this: OlaiWorld, reason: string) {
  assert.equal(this.toolAnswer?.isError, true);
  assert.ok(JSON.stringify(structuredOf(this)).includes(reason), JSON.stringify(this.toolAnswer));
});
When("the terminal agent inspects definition configuration", async function (this: OlaiWorld) {
  this.toolAnswer = await callTool(agentOf(this), "vault-plugins_inspect", {});
});
Then("the definition layout names its Config properties and reserved keys", function (this: OlaiWorld) {
  const layout = structuredOf(this).layout as { config: { schema: string; properties: string; reserved: string[] } };
  assert.equal(layout.config.schema, "Config");
  assert.match(layout.config.properties, /properties on the definition node/);
  assert.deepEqual(layout.config.reserved, ["plugin", "approved"]);
});
When("the terminal agent runs definition {string}", async function (this: OlaiWorld, name: string) {
  this.toolAnswer = await callTool(agentOf(this), "vault-plugins_run", { name });
});
Then("the definition run reports {string} as {string} from {string}", function (this: OlaiWorld, key: string, value: string, setBy: string) {
  const readings = structuredOf(this).configurationValues as Array<{ key: string; value: unknown; setBy: string }>;
  assert.ok(readings.some(reading => reading.key === key && reading.value === value && reading.setBy === setBy), JSON.stringify(readings));
});

When("the terminal agent searches for {string} with kind {string}", async function(this: OlaiWorld, text: string, kind: string) {
  this.toolAnswer = await callTool(agentOf(this), "search_nodes", { text, kind });
});

Then("every terminal search hit is a node and includes {string}", function(this: OlaiWorld, id: string) {
  const hits = structuredOf(this).hits as Array<{ at: { kind: string }; id?: string }>;
  assert.ok(hits.some(hit => hit.id === id));
  assert.ok(hits.every(hit => hit.at.kind === "node"));
});
