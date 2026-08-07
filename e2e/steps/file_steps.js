// Every write to the outline file, and nothing else.
//
// This is the only file in the suite that edits Tasks.jsonl — by hand, and via
// `olai` itself, which is the other way a file changes under a running server
// and the one an agent actually uses. The scenarios that lean on it are about
// four different things — the live swap, the error banner, the /today zoom, a
// fold surviving a re-render, a state cleared from the CLI — and they all mean
// the same act, so they say it the same way.
//
// Nothing here waits for the page: the watcher turns a save into an `outline`
// event on its own schedule (0.15s debounce, 2s poll fallback), and the
// assertions that follow are what wait.

import assert from "node:assert/strict";
import { Given, When } from "@cucumber/cucumber";
import { createHash } from "node:crypto";

import { BREAKAGE, FIXTURE } from "../support/outline.js";

function records(text) {
  return text
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l));
}

function serialize(recs) {
  if (recs.length === 0) return "";
  return recs.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

function mintId(text, n = 0) {
  const h = createHash("sha1").update(`${text}\n${n}`).digest("hex").slice(0, 4);
  const used = new Set(records(text).map((r) => r.id));
  if (!used.has(h)) return h;
  return mintId(text, n + 1);
}

function nextOrd(recs, parent) {
  const ords = recs
    .filter((r) => (r.parent ?? null) === (parent ?? null))
    .map((r) => r.ord)
    .sort();
  if (ords.length === 0) return "V";
  // append after last: use a trailing mid digit (good enough for e2e)
  return ords[ords.length - 1] + "V";
}

function findByTitle(recs, title) {
  return recs.filter(
    (r) => typeof r.title === "string" && r.title.startsWith(title),
  );
}

When("I add the title {string} to the outline", async function (title) {
  const recs = records(this.outline);
  const id = mintId(this.outline);
  recs.push({ id, ord: nextOrd(recs, null), title });
  await this.rewrite(serialize(recs));
});

When(
  "I add the title {string} under {string} in the outline",
  async function (title, parent) {
    const recs = records(this.outline);
    const hits = findByTitle(recs, parent);
    assert.equal(hits.length, 1, `${parent}: expected one parent, got ${hits.length}`);
    const parentId = hits[0].id;
    const id = mintId(this.outline);
    recs.push({ id, parent: parentId, ord: nextOrd(recs, parentId), title });
    await this.rewrite(serialize(recs));
  },
);

// A rename touches the one thing BOTH panes draw. The node's key is its id —
// never its title — so renaming leaves the key alone and every copy of the
// node is the same element afterwards, morphed rather than replaced.
When(
  "I rename the title {string} to {string} in the outline",
  async function (from, to) {
    const recs = records(this.outline);
    const hits = findByTitle(recs, from);
    assert.notEqual(hits.length, 0, `${from} is not in the outline`);
    hits[0].title = hits[0].title.replace(from, to);
    await this.rewrite(serialize(recs));
  },
);

When("I remove the title {string} from the outline", async function (title) {
  const recs = records(this.outline);
  const hits = findByTitle(recs, title);
  assert.notEqual(hits.length, 0, `${title} is not in the outline`);
  const rootId = hits[0].id;
  const drop = new Set();
  const walk = (id) => {
    drop.add(id);
    for (const r of recs) if (r.parent === id) walk(r.id);
  };
  walk(rootId);
  await this.rewrite(serialize(recs.filter((r) => !drop.has(r.id))));
});

// A day node is a top-level node whose title IS the ISO day (what `olai daily`
// writes). The day comes from the server, because the server is the one that
// decides which day /today is looking for.
When("I add a day node for today holding {string}", async function (child) {
  const day = await this.today();
  const recs = records(this.outline);
  const dayId = mintId(this.outline);
  recs.push({ id: dayId, ord: nextOrd(recs, null), title: day });
  const childId = mintId(serialize(recs));
  recs.push({
    id: childId,
    parent: dayId,
    ord: nextOrd(recs, dayId),
    title: child,
  });
  await this.rewrite(serialize(recs));
});

// The CLI writing the file the server is reading: the same binary, the same
// write safety, and the page is not told — it finds out the way it finds out
// about an editor's save.
When("I check off {string} from the CLI", async function (title) {
  await this.olai("done", title);
});

// The write that moves a node to another FILE. `--file` is the outline it is
// leaving; where it lands is the command's own business (Archive.jsonl beside
// it), which is why no step says so.
When("I archive {string} from the CLI", async function (spec) {
  await this.olai("archive", spec);
});

// The same command aimed at the other outline in the directory. An `^anchor`
// is a name the whole loaded set shares, so this is how a scenario checks a
// node off from the file that only MIRRORS it — the write lands in the file
// that declares it, which is the whole of what "one real node" means.
When(
  "I check off {string} from the CLI against {string}",
  async function (spec, file) {
    await this.olaiOn(file, "done", spec);
  },
);

// ---- @include fragments ----------------------------------------------------
//
// A fragment is one node in a `.jsonl` file of its own; the outline names it,
// or names the directory it sits in with a glob (docs/syntax.md). What a
// scenario is about is never the writing — it is whether the outline already
// had a pattern matching what appeared — so the two phrasings below are the
// setup and the event, and one body.
// Each fragment needs a unique id across the loaded set — two files both
// id'd "frag" would be a linker error the moment the second appears.
const fragment = (rel, title) => {
  const id = createHash("sha1").update(rel).digest("hex").slice(0, 8);
  return JSON.stringify({ id, ord: "V", title }) + "\n";
};

Given("a fragment {string} holding {string}", async function (rel, title) {
  await this.write(rel, fragment(rel, title));
});

When("a fragment {string} appears holding {string}", async function (rel, title) {
  await this.write(rel, fragment(rel, title));
});

When("the outline includes the fragments in {string}", async function (pattern) {
  const recs = records(this.outline);
  const id = mintId(this.outline);
  recs.push({ id, ord: nextOrd(recs, null), include: pattern });
  await this.rewrite(serialize(recs));
});

When("I break the outline", async function () {
  await this.append(BREAKAGE);
});

When("I fix the outline", async function () {
  await this.rewrite(FIXTURE);
});
