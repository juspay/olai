// Every write to the outline file, and nothing else.
//
// This is the only file in the suite that edits Tasks.rkt — by hand, and via
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

// A rename touches the one thing BOTH panes draw. The node's key is its
// ^anchor, or a hash of its file and child ordinals (docs/cli.md) — never its
// title — so renaming leaves the key alone and every copy of the node is the
// same element afterwards, morphed rather than replaced.
When(
  "I rename the title {string} to {string} in the outline",
  async function (from, to) {
    const lines = this.outline.split("\n");
    const at = lines.findIndex((l) => l.trim().startsWith(from));
    assert.notEqual(at, -1, `${from} is not in the outline`);
    lines[at] = lines[at].replace(from, to);
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

// The CLI writing the file the server is reading: the same binary, the same
// write safety, and the page is not told — it finds out the way it finds out
// about an editor's save.
When("I check off {string} from the CLI", async function (title) {
  await this.olai("done", title);
});

// ---- @include fragments ----------------------------------------------------
//
// A fragment is one node in a `#lang olai` file of its own; the outline names
// it, or names the directory it sits in with a glob (docs/syntax.md). What a
// scenario is about is never the writing — it is whether the outline already
// had a pattern matching what appeared — so the two phrasings below are the
// setup and the event, and one body.
const fragment = (title) => `#lang olai\n${title}\n`;

Given("a fragment {string} holding {string}", async function (rel, title) {
  await this.write(rel, fragment(title));
});

When("a fragment {string} appears holding {string}", async function (rel, title) {
  await this.write(rel, fragment(title));
});

When("the outline includes the fragments in {string}", async function (pattern) {
  await this.append(`@include ${pattern}\n`);
});

When("I break the outline", async function () {
  await this.append(BREAKAGE);
});

When("I fix the outline", async function () {
  await this.rewrite(FIXTURE);
});
