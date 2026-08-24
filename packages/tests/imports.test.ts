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
 * always held, restated at the place it now lives: the list may re-export no
 * COMPONENT. A `.tsx` drags its whole import graph into a process with no
 * browser in it, and the client's graph reaches `wire.ts`, which dials at
 * module scope and throws without a `location`. That is not hypothetical:
 * the chat panel's rows started asking the server a question
 * (`chat/declared.ts`), `chat_steps.ts` was importing `NEAR` from
 * `chat/Transcript.tsx`, and the whole suite stopped booting before its
 * first scenario with an error about `connectSurface` — nothing to do with
 * any scenario, and nothing in the diff that looked like a test change. The
 * fix then was to move the constant into a plain module (`chat/near.ts`);
 * the rule now is that the door offers nothing else.
 */

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

test("the door re-exports no component", () => {
  const found = [
    ...withoutComments(read("packages/web/src/suite.testlib.ts")).matchAll(
      /from\s+"([^"]+\.tsx)"/g,
    ),
  ].map((hit) => hit[1]);
  // Same shape on purpose: a component through the door is the suite dying
  // at boot again, one connectSurface-style import away.
  expect(found).toEqual([]);
});
