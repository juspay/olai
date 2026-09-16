/**
 * THE SHAPE AN ENGINE'S `e2e/fake` DESCRIPTOR ANSWERS — the one contract the
 * harness holds an engine to, and the whole of what it may know or say about
 * one (section 13.3).
 *
 * The type lives in `@olai/bundle/fake.ts` — the bundle generates the roster,
 * so it owns the type of what it emits. This re-export is the door every
 * engine's `e2e/fake/index.ts` imports from.
 */
export type { Fake } from "@olai/bundle/fake";
