/**
 * What a step definition may IMPORT of the client, as a fence rather than as a
 * habit.
 *
 * The suite deliberately shares constants with `@olai/web` rather than
 * retyping them — a scroll slack, a long-press duration, the idle commit, the
 * testids — because a number typed twice is a number that eventually disagrees
 * with the app it is asserting about. What it may NOT do is import a
 * COMPONENT for one, and that line is not aesthetic: a `.tsx` drags its whole
 * import graph into a process with no browser in it, and the client's graph
 * reaches `wire.ts`, which dials at module scope and throws without a
 * `location`.
 *
 * That is not hypothetical. The chat panel's rows started asking the server a
 * question (`chat/declared.ts`), `chat_steps.ts` was importing `NEAR` from
 * `chat/Transcript.tsx`, and the whole suite stopped booting before its first
 * scenario with an error about `connectSurface` — nothing to do with any
 * scenario, and nothing in the diff that looked like a test change. The fix was
 * to move the constant into a plain module (`chat/near.ts`); this is what makes
 * it not need re-discovering, at the moment somebody types the import rather
 * than the next time a component reaches the wire.
 *
 * IT IS NOT A BAN ON THE CLIENT — `@olai/web/src/client/**.ts` is the whole
 * point of the sharing. It is a ban on the one extension that means "this file
 * draws something", which is exactly the class that pulls a graph.
 */

import { expect, test } from "bun:test";

import { read, tracked, withoutComments } from "./support/sweep.ts";

/** An import of a client COMPONENT — `@olai/web/…/Anything.tsx`, however it is
 *  spelled. Comments are stripped before this runs, so the paragraph above may
 *  quote the shape it hunts. */
const A_COMPONENT = /from\s+"@olai\/web\/[^"]*\.tsx"/g;

test("no step definition imports a client component", () => {
  // `tracked` leaves the caller out of its own listing.
  const found = tracked(import.meta.filename)
    .filter((file) =>
      /^packages\/tests\/(step_definitions|support)\/[^/]+\.ts$/.test(file)
    )
    .flatMap((file) =>
      [...withoutComments(read(file)).matchAll(A_COMPONENT)].map((hit) =>
        `${file.slice("packages/tests/".length)}: ${hit[0]}`
      )
    );
  // An EQUALITY to the empty list rather than a count, so the failure names the
  // file and the import: what to do about one is always the same — move the
  // constant into a module that holds a constant.
  expect(found).toEqual([]);
});
