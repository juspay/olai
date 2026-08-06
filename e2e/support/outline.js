// The outline a scenario boots against, and the breakage one scenario feeds
// it.
//
// The fixture is a REAL `#lang olai` file (e2e/fixtures/Tasks.rkt), read once
// per run and written into each scenario's temp dir: the language is the only
// validator, so a typo in it is a srcloc out of `olai check` — which the CI
// smoke lane runs over this file — and not a browser-level mystery three
// layers away. The quoteless outline has no comment syntax, which is why what
// the fixture is FOR is written here rather than in it.
//
// Fiction, like examples/: no personal data reaches this suite. Every title in
// it is distinct enough that a step can name a node by a SUBSTRING of its
// title and mean one node.
//
// Two of its notes are the sizes features/note.feature is about, and their
// LENGTH is what makes them: "Ship the server" carries one long enough to wrap
// several times at either viewport (so there is something to fold, and its
// note-less child is a place to point at that must not open it), and "Inbox"
// carries one that fits on a line at both (so there is nothing to fold at
// all). "Write the tests" stays note-less for a second reason — two scenarios
// delete that line, and a note under it would be orphaned by the same edit.
//
// EVERY edit a step makes to it changes the file's SIZE. The store's staleness
// probe is mtime (whole seconds) + size, so a same-second same-size rewrite is
// invisible to a running server — the same discipline
// olai/tests/integration/serve.rkt keeps.

import * as fs from "node:fs/promises";
import * as path from "node:path";

const FIXTURES = path.join(import.meta.dirname, "..", "fixtures");

export const FIXTURE = await fs.readFile(
  path.join(FIXTURES, "Tasks.rkt"),
  "utf8",
);

// The document the fixture's `@doc` names, and where it names it from. The
// LANGUAGE requires the file to be there, so it is staged into every
// scenario's temp dir beside the outline — an outline without it does not
// load at all, and nothing else in this suite would ever get to run.
export const DOC_PATH = path.join("notes", "serve.md");

export const DOC = await fs.readFile(path.join(FIXTURES, DOC_PATH), "utf8");

// A form the expander rejects — `@date` wants an ISO date — with a srcloc the
// banner can name. A string, not a file: it must not parse, so it cannot be
// one of the repo's checked outlines. The same broken form stands in for "a
// file mid-edit" in olai/tests/integration/serve.rkt and nix/smoke.nix.
export const BREAKAGE = "Broken\n  @date not-a-date\n";
