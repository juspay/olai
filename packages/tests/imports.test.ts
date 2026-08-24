/**
 * THE ONE DOOR, fenced at both ends: how this package reaches the client.
 *
 * The suite deliberately shares names with `@olai/web` rather than retyping
 * them — the testids, a scroll slack, a long-press deadline, the idle
 * commit, the keys a pick is stored under — because a constant typed twice
 * eventually disagrees with the app it is asserting about. What the sharing
 * used to SPELL was nineteen paths into that package's own `src/`, while its
 * manifest claimed nothing crossed the boundary at all; the two lies were
 * retired together (`@olai/web`'s `web-testlib-face`). Now a step names
 * `@olai/web/testlib` and nothing else: `src/suite.testlib.ts` is the
 * curated list, and its header says what goes in and why.
 *
 * The first fence is FOR the suite, and its sweep is the package, not the
 * step definitions alone: a support file is a step's contract one indirection
 * in, and a driver (`evidence.ts` reading the dim class) stands on the same
 * names for the same reason. Any specifier past the door is the boundary
 * moving back to day one, one import at a time.
 *
 * The second fence is FOR the door, and it is the older rule this file has
 * always held, restated at the place it now lives: the list may reach no
 * COMPONENT. A `.tsx` drags its whole import graph into a process with no
 * browser in it, and the client's graph reaches `wire.ts`, which dials at
 * module scope and throws without a `location`. That is not hypothetical:
 * the chat panel's rows started asking the server a question
 * (`chat/declared.ts`), `chat_steps.ts` was importing `NEAR` from
 * `chat/Transcript.tsx`, and the whole suite stopped booting before its
 * first scenario with an error about `connectSurface` — nothing to do with
 * any scenario, and nothing in the diff that looked like a test change. The
 * fix then was to move the constant into a plain module (`chat/near.ts`);
 * the rule now is that the door's CLOSURE holds no component either: one
 * ESM module evaluates every module it reaches, so a hop in ANY listed leaf
 * (`chat/near.ts` re-exporting the component it was extracted from, which is
 * exactly the historical shape) is the same boot death one import later. The
 * sweep below is the closure, therefore — not the door file's own text.
 */

import * as path from "node:path";

import { expect, test } from "bun:test";

import { read, tracked, withoutComments } from "./support/sweep.ts";

/** Every TypeScript file this package owns — a step, a support module, a
 *  driver, or one of these sweeps itself. */
const OWN = /^packages\/tests\/.+\.ts$/;

/** An import spelled at the client — `@olai/web`, however deep. The door
 *  itself is filtered out below; comments are stripped first, so the header
 *  may quote the shape being hunted. */
const AT_THE_CLIENT = /from\s+"(@olai\/web[^"]*)"/g;

/** The one specifier that may appear. */
const DOOR = "@olai/web/testlib";

test("no file in this package reaches the client past ./testlib", () => {
  const found = tracked(import.meta.filename)
    .filter((file) => OWN.test(file))
    .flatMap((file) =>
      [...withoutComments(read(file)).matchAll(AT_THE_CLIENT)].flatMap(
        (hit) =>
          hit[1] === DOOR
            ? []
            : [`${file.slice("packages/tests/".length)}: ${hit[1]}`],
      )
    );
  // An EQUALITY to the empty list rather than a count, so the failure names
  // the file and the specifier. The fix is always the same: name the door —
  // and what the door does not list, the door's list is the place to ask for.
  expect(found).toEqual([]);
});

/** Every RELATIVE specifier a file's code spells, by position rather than
 *  by statement (a braced list broken over lines is seen; prose is stripped
 *  first with the shared rule). Reachable-module grammar is this tree's: a
 *  name, an extension. "@olai/anything" stops the walk — another package's
 *  discipline is another package's fence. */
const relativesOf = (file: string): ReadonlyArray<string> =>
  [
    ...withoutComments(read(file)).matchAll(
      /(?:\bfrom\s*|^\s*import\s*|\bimport\(\s*|\brequire\(\s*)["']([^"'\n]+)["']/gm,
    ),
  ]
    .flatMap((hit) => (hit[1] === undefined ? [] : [hit[1]]))
    .filter((one) => one.startsWith("."));

/** The sibling a relative specifier names, as a root-relative path —
 *  normalised, because transitives climb (`../complete/trigger.ts`). */
const beside = (file: string, specifier: string): string =>
  path.posix.normalize(`${path.posix.dirname(file)}/${specifier}`);

test("the door reaches no component", () => {
  // A WALK, not one file's text: the door is one ESM module, so its full
  // closure is what the suite's first import evaluates — and a `.tsx` one
  // re-export in is the incident this test exists to not need re-learned.
  const seen = new Set<string>();
  const found: Array<string> = [];
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const specifier of relativesOf(file)) {
      const sibling = beside(file, specifier);
      if (sibling.endsWith(".tsx")) {
        found.push(`${file}: ${specifier}`);
      } else {
        visit(sibling);
      }
    }
  };
  visit("packages/web/src/suite.testlib.ts");
  expect(found).toEqual([]);
});
