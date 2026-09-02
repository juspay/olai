/**
 * A spawned server's state home is the HARNESS'S, never the developer's.
 *
 * The guard for the isolation half of the state-pollution work: olai keeps
 * per-machine records (which conversation a directory's panel was in) under
 * the XDG state home — and every `olai web` PRUNES the records whose
 * directories have died, once per boot (`./lock.ts`, `@olai/state`'s
 * `pruneGone`). What home a server under test reads, writes and sweeps is
 * therefore no longer academic: an unisolated child sweeps the developer's
 * real `~/.local/state/olai`, and "the record for a vault that died" is
 * exactly what such a home holds thousands of.
 *
 * The e2e harness answers this with `isolateEnv` (`packages/tests/support/
 * workers.ts`: one XDG state home per scratch/corpus server, torn down with
 * it). THIS file pins the unit-test half: `./child.testlib.ts` must hand a
 * spawned server a state home of its own, the way it already hands it a
 * runtime directory — so that no boot this suite starts can ever read, write
 * or prune the developer's own. The scenario below is the observable half:
 * `$HOME` names a fake home holding ONE planted record for a dead directory,
 * and a server boot must not touch the one home it was never pointed at.
 *
 * The ambient answer is pinned one package down, where the home is resolved:
 * `@olai/state`'s own suite asserts `bun test` never answers the developer's
 * by default (`scripts/bun-test-preload.ts` carrying the variable for the
 * whole process, as it long has for `XDG_RUNTIME_DIR`).
 */

import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { startWeb } from "./child.testlib.ts"
import { served } from "./serve.testlib.ts"

test("a spawned server never touches the state home of the HOME it was given", async () => {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-fake-home-")))
  // What `stateHome()` answers in a process with no XDG_STATE_HOME:
  // `~/.local/state/olai` (@olai/state). Planted there: one record for a
  // directory that died — the shape every real home holds by the thousand,
  // and the boot sweep's whole subject. A server pointed nowhere near this
  // home must leave the record intact, whatever it does.
  const somebodyElses = path.join(
    home,
    ".local",
    "state",
    "olai",
    "chat",
    "deadd00ddeadd00d.json",
  )
  fs.mkdirSync(path.dirname(somebodyElses), { recursive: true, mode: 0o700 })
  fs.writeFileSync(
    somebodyElses,
    JSON.stringify({
      cwd: path.join(home, "served-and-gone"),
      agent: "claude",
      session: "ses_wasmine",
    }) + "\n",
    { mode: 0o600 },
  )
  // HOME is how the fallback is reached — never XDG_STATE_HOME, which the
  // harness is the one to supply (or fail to).
  const web = startWeb({ root: served(), env: { HOME: home } })
  try {
    await web.address()
  } finally {
    web.kill()
    await web.exited()
  }
  try {
    expect(fs.existsSync(somebodyElses)).toBe(true)
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
  }
})
