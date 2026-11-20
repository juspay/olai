import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { Then, When } from "@olai/tests/harness/runner.ts";


import { expectCodeIn, expectSiteIn, rowsIn } from "@olai/tests/harness/errors.ts";
import { drainAndResync } from "@olai/tests/harness/scratch.ts";
import {
  attr,
  BACKSTOP_STEP_TIMEOUT,
  BACKSTOP_TIMEOUT,
  ERROR_ROW,
  NODE,
  OUTLINE_FAILURE,
  OUTLINE_LINK,
  POLL_TIMEOUT,
} from "@olai/tests/harness/world.ts";
import {
  BROKEN_FILE_LINE,
  BROKEN_FILE_LINK,
  STALE_BANNER,
} from "../selectors.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const rememberedFiles = new WeakMap<OlaiWorld, Map<string, string>>();

When("I remember the served bytes of {string}", function (this: OlaiWorld, file: string) {
  const files = rememberedFiles.get(this) ?? new Map<string, string>();
  files.set(file, fs.readFileSync(path.join(this.scratch(), file), "utf8"));
  rememberedFiles.set(this, files);
});

When("I restore the remembered served bytes of {string}", function (this: OlaiWorld, file: string) {
  const bytes = rememberedFiles.get(this)?.get(file);
  assert.notEqual(bytes, undefined, `no remembered bytes for ${file}`);
  this.writeServed(file, bytes!);
});

When("I remove the served file {string}", function (this: OlaiWorld, file: string) {
  fs.unlinkSync(path.join(this.scratch(), file));
});

When(
  "I rewrite {string} as:",
  function (this: OlaiWorld, file: string, contents: string) {
    this.writeServed(file, contents);
  },
);

/** Root reads a file whatever its mode, so a mode-based step cannot be asked
 *  there at all. */
const servedFileMode = (mode: number) =>
  async function (this: OlaiWorld, file: string) {
    if (typeof process.getuid === "function" && process.getuid() === 0) return "pending";
    fs.chmodSync(path.join(this.scratch(), file), mode);
    await drainAndResync(this.baseUrl, POLL_TIMEOUT);
    return undefined;
  };

When("the served file {string} cannot be read", servedFileMode(0o000));

When("the served file {string} can be read again", servedFileMode(0o644));

When(
  "another writer adds {string} to {string}",
  function (this: OlaiWorld, title: string, file: string) {
    this.appendServed(file, { id: "outsider", ord: "z0", title });
  },
);

When(
  "another writer appends {string} to the document/page {string}",
  function (this: OlaiWorld, line: string, file: string) {
    this.appendServedLine(file, line);
  },
);

When(
  "another writer retitles {string} to {string} in {string}",
  function (this: OlaiWorld, id: string, title: string, file: string) {
    const records = this.servedNodes(file).map((node) =>
      node["id"] === id ? { ...node, title } : node
    );
    assert.ok(
      records.some((node) => node["id"] === id),
      `${file} holds no node \`${id}\` to retitle`,
    );
    this.writeServed(file, records.map((node) => JSON.stringify(node)).join("\n"));
  },
);

When(
  "another writer lifts {string} to the top level of {string}",
  function (this: OlaiWorld, id: string, file: string) {
    const records = this.servedNodes(file).map((node) =>
      node["id"] === id ? { ...node, parent: undefined } : node
    );
    assert.ok(
      records.some((node) => node["id"] === id),
      `${file} holds no node \`${id}\` to lift`,
    );
    this.writeServed(file, records.map((node) => JSON.stringify(node)).join("\n"));
  },
);

When(
  "another writer archives {string} out of {string}",
  function (this: OlaiWorld, id: string, file: string) {
    const records = this.servedNodes(file);
    const moving = new Set<string>([id]);
    for (let pass = 0; pass < records.length; pass++) {
      for (const node of records) {
        const parent = node["parent"];
        if (typeof parent === "string" && moving.has(parent)) {
          moving.add(String(node["id"]));
        }
      }
    }
    assert.ok(records.some((node) => node["id"] === id), `${file} holds no \`${id}\``);
    this.writeServed(
      "_olai/Trash.olai",
      records
        .filter((node) => moving.has(String(node["id"])))
        .map((node) => {
          const moved =
            node["id"] === id ? { ...node, parent: undefined } : { ...node }
          return JSON.stringify(moved)
        })
        .join("\n"),
    );
    this.writeServed(
      file,
      records
        .filter((node) => !moving.has(String(node["id"])))
        .map((node) => JSON.stringify(node))
        .join("\n"),
    );
  },
);

When(
  "another writer files a row under {string} in {string}",
  function (this: OlaiWorld, under: string, file: string) {
    const parent = this.servedNodes(file).find((node) => node["title"] === under);
    assert.ok(
      parent !== undefined,
      `${file} holds no node titled ${JSON.stringify(under)} to file anything under`,
    );
    this.appendServed(file, {
      id: "interloper",
      parent: parent["id"],
      ord: "a0",
      title: "and something filed under it",
    });
  },
);

When("the served directory is taken away", function (this: OlaiWorld) {
  const root = this.scratch();
  const gone = `${root}.taken-away`;
  fs.renameSync(root, gone);
  fs.rmSync(gone, { recursive: true, force: true });
});

const drawn = async (
  world: OlaiWorld,
  file: string,
): Promise<{ ids: string[]; sites: string[] }> => {
  const rendered = await world.page
    .locator(`${NODE}${attr("data-file", file)}`)
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        id: node.getAttribute("data-node-id") ?? "?",
        line: node.getAttribute("data-line") ?? "?",
      })),
    );
  return {
    ids: rendered.map((node) => node.id),
    sites: rendered.map((node) => `${node.id}@${node.line}`),
  };
};

const sameMultiset = (
  shown: ReadonlyArray<string>,
  expected: ReadonlyArray<string>,
): boolean => {
  if (shown.length !== expected.length) return false;
  const a = [...shown].sort();
  const b = [...expected].sort();
  return a.every((id, index) => id === b[index]);
};

const countOf = (ids: ReadonlyArray<string>): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
};

Then(
  "the outline {string} shows exactly the nodes {string}",
  async function (this: OlaiWorld, file: string, wanted: string) {
    const expected = wanted
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    let seen: { ids: string[]; sites: string[] } = { ids: [], sites: [] };
    try {
      await this.waitUntil(async () => {
        seen = await drawn(this, file);
        return sameMultiset(seen.ids, expected);
      }, `${file} shows exactly ${expected.length} nodes: ${expected.join(", ")}`);
    } catch {
      const shownCounts = countOf(seen.ids);
      const expectedCounts = countOf(expected);
      const twice = [...shownCounts]
        .filter(([id, n]) => n > (expectedCounts.get(id) ?? 0))
        .map(([id, n]) => `${id} ×${n}`);
      const missing = [...expectedCounts]
        .filter(([id, n]) => n > (shownCounts.get(id) ?? 0))
        .map(([id]) => id);
      throw new Error(
        `${file} does not show the nodes it should.\n` +
          `  drawn (id@line): ${seen.sites.join(", ") || "(nothing)"}\n` +
          `  expected: ${expected.join(", ")}\n` +
          (missing.length > 0 ? `  MISSING: ${missing.join(", ")}\n` : "") +
          (twice.length > 0 ? `  DRAWN TOO OFTEN: ${twice.join(", ")}\n` : ""),
      );
    }
  },
);

Then(
  "the outline {string} is marked unreadable",
  async function (this: OlaiWorld, file: string) {
    await this.page
      .locator(`${OUTLINE_LINK}${attr("data-file", file)}[data-broken="true"]`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

When(
  "I open the unreadable outline {string}",
  async function (this: OlaiWorld, file: string) {
    await this.showSidebar();
    await this.outlineLink(file).click();
    await this.page
      .locator(`${OUTLINE_FAILURE}${attr("data-file", file)}`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the outline failure shows an error at {string}",
  async function (this: OlaiWorld, site: string) {
    await expectSiteIn(this.page.locator(OUTLINE_FAILURE), site, "this outline's place");
  },
);

Then(
  "the outline failure shows an error with code {string}",
  async function (this: OlaiWorld, code: string) {
    await expectCodeIn(this.page.locator(OUTLINE_FAILURE), code, "this outline's place");
  },
);

Then(
  "the outline failure does not show an error at {string}",
  async function (this: OlaiWorld, site: string) {
    const failure = this.page.locator(OUTLINE_FAILURE);
    await failure.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const rows = await rowsIn(failure);
    assert.ok(
      !rows.some((row) => row.includes(site)),
      `this outline's place draws "${site}", which is another file's row:\n  ` +
        rows.join("\n  "),
    );
  },
);

Then("the stale banner is shown", async function (this: OlaiWorld) {
  await this.page
    .locator(STALE_BANNER)
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

Then(
  "the stale banner eventually appears",
  { timeout: BACKSTOP_STEP_TIMEOUT },
  async function (this: OlaiWorld) {
    await this.page
      .locator(STALE_BANNER)
      .waitFor({ state: "visible", timeout: BACKSTOP_TIMEOUT });
  },
);

Then(
  "the stale banner says {string}",
  async function (this: OlaiWorld, text: string) {
    const banner = this.page.locator(STALE_BANNER);
    await banner.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.ok(
      (await banner.innerText()).includes(text),
      `the banner to say "${text}"`,
    );
  },
);

Then("the stale banner is gone", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(STALE_BANNER).count()) === 0,
    "the banner is gone, so the set on disk validates again",
  );
});

Then(
  "the stale banner names {int} file(s)",
  async function (this: OlaiWorld, many: number) {
    const banner = this.page.locator(STALE_BANNER);
    await banner.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    assert.strictEqual(
      await banner.locator(BROKEN_FILE_LINE).count(),
      many,
      `the summary to name ${many} file(s); it says:\n  ` + (await banner.innerText()),
    );
  },
);

Then(
  "the stale banner names {string} as {string}",
  async function (this: OlaiWorld, file: string, state: string) {
    const banner = this.page.locator(STALE_BANNER);
    await banner.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const line = banner.locator(
      `${BROKEN_FILE_LINE}${attr("data-file", file)}${attr("data-state", state)}`,
    );
    await line
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
    assert.ok(
      (await line.count()) > 0,
      `the banner to name "${file}" as "${state}"; it says:\n  ` +
        (await banner.innerText()),
    );
  },
);

Then(
  "the stale banner links to {string}",
  async function (this: OlaiWorld, file: string) {
    const banner = this.page.locator(STALE_BANNER);
    await banner.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    const link = banner.locator(`${BROKEN_FILE_LINK}${attr("data-file", file)}`);
    await link
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT })
      .catch(() => undefined);
    assert.ok(
      (await link.count()) > 0,
      `the banner to link to "${file}"; it says:\n  ` + (await banner.innerText()),
    );
  },
);

Then("the stale banner enumerates nothing", async function (this: OlaiWorld) {
  const banner = this.page.locator(STALE_BANNER);
  await banner.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  assert.strictEqual(
    await banner.locator(ERROR_ROW).count(),
    0,
    "the banner is enumerating error rows over somebody else's page",
  );
});

Then("the served bytes of {string} are unchanged", function(this: OlaiWorld, file: string) {
  const bytes = rememberedFiles.get(this)?.get(file);
  assert.notEqual(bytes, undefined, `no remembered bytes for ${file}`);
  assert.equal(fs.readFileSync(path.join(this.scratch(), file), "utf8"), bytes);
});
