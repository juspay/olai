/**
 * THE DOT'S FACE — every padi state, folded, with nothing left to a default.
 *
 * The test that matters here is not "green means working": it is that the fold
 * is TOTAL over padi's own vocabulary and that the two states most easily
 * confused stay apart. Three claims:
 *
 *   1. every agent state padi can report lands on a face, and the two that are
 *      about YOU (`awaiting`) and about the machine (`working`) are different
 *      faces — the confusion kolu's own `agentPaintClass` header calls "the
 *      fucknotif defect", one layer down;
 *   2. `waiting` is gray, deliberately, and this test is where that decision is
 *      written down in a form that fails if somebody changes it by accident;
 *   3. a terminal the fleet does not hold is `gone` and not `parked` — the
 *      difference between "nothing is running" and "there is nothing".
 */

import { describe, expect, it } from "bun:test"
import { DOT_FACES, type DotFace } from "@olai/surface"
import { faceOf } from "./face.ts"
import type { PadiTerminal } from "@kolu/padi-client/surface"

/** An ACTIVE record with one agent state on it, and nothing else that the fold
 *  reads. Cast rather than built whole: `PadiActiveTerminal` carries thirty
 *  fields this fold never touches, and a fixture that spelled them all would
 *  be a test of the schema rather than of the fold. */
const active = (state: string | null): PadiTerminal =>
  ({
    state: "active",
    agent: state === null ? null : { kind: "claude-code", state },
  }) as unknown as PadiTerminal

describe("the dot's face", () => {
  it("is green only while the machine is working", () => {
    // The three states padi folds to `working`, spelled out rather than
    // asserted through `agentBucket` — a test that reused the fold it is
    // testing would agree with a broken one.
    for (const state of ["thinking", "tool_use", "running_background"]) {
      expect(faceOf(active(state))).toBe("working")
    }
  })

  it("is amber only when the agent is blocked on you", () => {
    expect(faceOf(active("awaiting_user"))).toBe("awaiting")
  })

  it("greys a finished turn rather than giving it a face of its own", () => {
    // THE DECISION, pinned. padi's `waiting` is "the turn ended"; kolu paints
    // it a dimmed linger and RANKS it idle. The door's dot is the rank reading
    // — it answers "does this lane want me" — so a finished turn is gray. If
    // this ever needs to change, this line is the argument to re-open.
    expect(faceOf(active("waiting"))).toBe("parked")
  })

  it("greys a terminal with no agent in it — a plain shell is not a fault", () => {
    expect(faceOf(active(null))).toBe("parked")
  })

  it("greys both dormant arms", () => {
    expect(faceOf({ state: "sleeping" } as unknown as PadiTerminal)).toBe("parked")
    expect(faceOf({ state: "parked" } as unknown as PadiTerminal)).toBe("parked")
  })

  it("says GONE for a terminal the fleet does not hold", () => {
    // Not `parked`: a property naming a retired terminal is still a true
    // record of where the work happened, and a gray dot would claim the
    // terminal is sitting there idle.
    expect(faceOf(undefined)).toBe("gone")
  })

  it("never falls through — an unknown agent state is gray, not undefined", () => {
    // padi's own `agentBucket` keeps a `default` arm so a state this build has
    // never heard of surfaces as `other` at runtime rather than throwing. This
    // is the same promise one layer up: a re-pin that adds a state cannot make
    // a chip draw nothing.
    expect(faceOf(active("some_state_from_a_newer_kolu"))).toBe("parked")
  })
})
