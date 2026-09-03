/**
 * A PADI FOR ONE SCENARIO — spawned before the server that dials it.
 *
 * The terminal door's scenarios are about what a CHIP does with a fleet.
 * Getting a fleet from a real kolu would make them a test of somebody's daemon
 * on whatever machine the suite runs on — and would make "is a padi running
 * here" a property of the laptop, which is exactly the trap the fake kolu on
 * PATH already exists to avoid (`./hooks.ts`'s `FAKE_KOLU_DIR`). So a scenario
 * that wants terminals gets its own padi, serving padi's REAL surface over a
 * real unix socket, with a fleet named by its tag.
 *
 * `../agent/padi/fake-padi.ts` is the far end and argues its own honesty. This
 * module is the harness half: where the socket goes, how the spawn is waited
 * on, and how it is torn down.
 *
 * ## The socket path is the harness's, not the algebra's
 *
 * A real olai finds padi at `$XDG_RUNTIME_DIR/padi-<digest>/padi.sock`, derived
 * from the state root. A scenario cannot use that: two workers would collide on
 * one path, and the digest is a fact about a state root the harness does not
 * own. `$PADI_SOCKET` is kolu's own answer to exactly this — the README's
 * "Finding the socket" tells a client to be GIVEN the socket rather than derive
 * one — so the scenarios exercise the same door a containerised padi does.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** The far end, run by bun the way the fake ACP agent is — and its NEIGHBOUR
 *  now, which is the point: the readiness line it prints and the wait below are
 *  one protocol, and this path is one directory rather than one package away. */
const FAKE_PADI = path.resolve(import.meta.dirname, "fake-padi.ts");

/** Where a `@padi:<name>` tag's fleet is read from. One JSON per fleet, named
 *  by the tag, so a scenario says which world it is in and the file says what
 *  is in it. */
const FLEETS = path.resolve(import.meta.dirname, "fixtures");

export interface LivePadi {
  /** What to put in the server's `$PADI_SOCKET`. */
  readonly socket: string;
  readonly stop: () => void;
}

/**
 * Spawn a padi serving `fleet`, and wait until it is LISTENING.
 *
 * The wait is on the child's own readiness line rather than on a timer, for the
 * reason every wait in this harness is: a server spawned against a socket that
 * is not bound yet dials, finds nothing, and reports `absent` — which is a
 * legitimate state, so the scenario would not fail, it would silently test the
 * wrong thing.
 */
export const startPadi = async (fleet: string): Promise<LivePadi> => {
  // A directory per padi, so two workers never share a socket path. Unix
  // sockets have a ~100 byte path limit on some platforms, which is why this is
  // a short temp dir and not a path under the scratch corpus.
  const dir = mkdtempSync(path.join(tmpdir(), "olai-padi-"));
  const socket = path.join(dir, "padi.sock");
  const child = spawn("bun", [FAKE_PADI, socket, path.join(FLEETS, `${fleet}.json`)], {
    stdio: ["ignore", "pipe", "pipe"],
    // Its own group, so the stop below takes it down whatever it spawned —
    // the same discipline the server's spawn keeps.
    detached: true,
  });
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  let said = "";
  child.stderr?.on("data", (chunk: string) => {
    said += chunk;
  });

  const listening = new Promise<void>((resolve, reject) => {
    child.stdout?.on("data", (chunk: string) => {
      if (chunk.includes("listening")) resolve();
    });
    void once(child, "exit").then(() => {
      reject(new Error(`fake padi exited before listening: ${said}`));
    });
  });
  await listening;

  return {
    socket,
    stop: () => {
      try {
        // The GROUP, negated pid — the same reason the server's teardown does
        // it: a child that spawned anything must not outlive the scenario.
        process.kill(-child.pid!, "SIGKILL");
      } catch {
        // Already gone. Tearing down something that has died is not an error,
        // and throwing here would fail a scenario that passed.
      }
      rmSync(dir, { recursive: true, force: true });
    },
  };
};
