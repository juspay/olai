// Every write to the outline file, and nothing else.
//
// This is the only file in the suite that edits Tasks.rkt. The scenarios that
// lean on it are about three different things — the live swap, the error
// banner, the /today zoom, a fold surviving a re-render — and they all mean
// the same act, so they say it the same way.
//
// Nothing here waits for the page: the watcher turns a save into an `outline`
// event on its own schedule (0.15s debounce, 2s poll fallback), and the
// assertions that follow are what wait.

import assert from "node:assert/strict";
import { When } from "@cucumber/cucumber";

import { BREAKAGE, FIXTURE } from "../support/outline.js";

When("I add the title {string} to the outline", async function (title) {
  await this.append(`${title}\n`);
});

// Nesting is two spaces (docs/syntax.md), so a child is the parent's line
// again with two more of them, on the line after it.
When(
  "I add the title {string} under {string} in the outline",
  async function (title, parent) {
    const lines = this.outline.split("\n");
    const at = lines.findIndex((l) => l.trim() === parent);
    assert.notEqual(at, -1, `${parent} is not in the outline`);
    const indent = " ".repeat(lines[at].search(/\S/) + 2);
    lines.splice(at + 1, 0, `${indent}${title}`);
    await this.rewrite(lines.join("\n"));
  },
);

// By its own line, at whatever depth it sits: a title is unique in the
// fixture, so "the line that says this" means one line.
When("I remove the title {string} from the outline", async function (title) {
  const lines = this.outline.split("\n");
  const kept = lines.filter((l) => l.trim() !== title);
  assert.notEqual(kept.length, lines.length, `${title} is not in the outline`);
  await this.rewrite(kept.join("\n"));
});

// A day node is a top-level node whose title IS the ISO day (what `olai daily`
// writes). The day comes from the server, because the server is the one that
// decides which day /today is looking for.
When("I add a day node for today holding {string}", async function (child) {
  await this.append(`${await this.today()}\n  ${child}\n`);
});

When("I break the outline", async function () {
  await this.append(BREAKAGE);
});

When("I fix the outline", async function () {
  await this.rewrite(FIXTURE);
});
