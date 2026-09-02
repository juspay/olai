/**
 * A spawned server's state home is the HARNESS'S, never the developer's.
 *
 * The guard for the isolation half of the state-pollution work: olai keeps
 * per-machine records (which conversation a directory's panel was in) under
 * the XDG state home — and every `olai web` PRUNES the records whose
 * directories have died, once per boot, forked once the vault is held
 * (`./lock.ts`, `@olai/state`'s `pruneGone`). What home a server under test
 * reads, writes and sweeps is therefore no longer academic: an unisolated
 * child sweeps the developer's real `~/.local/state/olai`, and "the record
 * for a vault that died" is exactly what such a home holds thousands of.
 *
 * The e2e harness answers this with `isolateEnv` (`packages/tests/support/
 * workers.ts`: one XDG state home per scratch/corpus server, torn down with
 * it). THIS file pins the unit-test half, from both directions. A child
 * `./child.testlib.ts` spawns must not touch a home it was never pointed at —
 * neither the one its fake `$HOME` would compute, nor the harness's ambient
 * one (`process.env`s, which the child inherits), because THAT is the line a
 * naive refactor quietly removes. And a boot over a home it WAS pointed at
 * must prune at all: delete the call in `./lock.ts` and nothing else in the
 * tree says no.
 */

import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { startWeb } from "./child.testlib.ts"
import { served } from "./serve.testlib.ts"

const writeRecord = (at: string, cwd: string): void => {
  fs.mkdirSync(path.dirname(at), { recursive: true, mode: 0o700 })
  fs.writeFileSync(
    at,
    JSON.stringify({ cwd, agent: "claude", session: "ses_wasmine" }) + "\n",
    { mode: 0o600 },
  )
}

/** The forked sweep gets a beat to run before anything is asserted. */
const settled = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 500))

const until = async (predicate: () => boolean, timeout = 10_000): Promise<boolean> => {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (predicate()) return true
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return predicate()
}

test("a spawned server never touches a state home it was not handed", async () => {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-fake-home-")))
  // What `stateHome()` answers in a process with no XDG_STATE_HOME:
  // `~/.local/state/olai` (@olai/state). Planted there: one record for a
  // directory that died — the shape every real home holds by the thousand,
  // and the boot sweep's whole subject. HOME is how the fallback is reached
  // — never XDG_STATE_HOME, which the harness is the one to supply.
  const byHome = path.join(home, ".local", "state", "olai", "chat", "deadd00ddeadd00d.json")
  writeRecord(byHome, path.join(home, "served-and-gone"))
  // The ambient home — the preload's answer (`scripts/bun-test-preload.ts`),
  // which the child inherits through `process.env` whether or not
  // `child.testlib.ts` overrides it. Planted the same way: a child WITHOUT
  // the override sweeps this home, and that is the red.
  const harnesses = process.env["XDG_STATE_HOME"]
  if (harnesses === undefined || harnesses === "") {
    throw new Error("the preload did not hand this suite a state home")
  }
  const ambient = path.join(harnesses, "olai", "chat", "statehome-ambient.json")
  writeRecord(ambient, path.join(home, "ambient-served-and-gone"))
  const web = startWeb({ root: served(), env: { HOME: home } })
  try {
    await web.address()
    await settled()
  } finally {
    web.kill()
    await web.exited()
  }
  try {
    expect(fs.existsSync(byHome)).toBe(true)
    expect(fs.existsSync(ambient)).toBe(true)
  } finally {
    fs.rmSync(home, { recursive: true, force: true })
    fs.rmSync(ambient, { force: true })
  }
})

test("a boot prunes the state home it was handed, once it is serving", async () => {
  const mine = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-state-home-")))
  const root = served()
  // An explicit XDG_STATE_HOME wins over the harness default spelled in
  // `child.testlib.ts` — which is itself the exercising half of this test:
  // the child is handed this home and the sweep, forked once the vault is
  // held, walks it. One record for a directory that died, one for the very
  // root being served: the first must go, the second must stay.
  const dead = path.join(mine, "olai", "chat", "1gone1gone1gone1g.json")
  writeRecord(dead, path.join(mine, "served-and-gone"))
  const aboutRoot = path.join(mine, "olai", "chat", "a11vea11vea11vea.json")
  writeRecord(aboutRoot, root)
  const web = startWeb({ root, env: { XDG_STATE_HOME: mine } })
  try {
    await web.address()
    expect(await until(() => !fs.existsSync(dead))).toBe(true)
    expect(fs.existsSync(aboutRoot)).toBe(true)
  } finally {
    web.kill()
    await web.exited()
    fs.rmSync(mine, { recursive: true, force: true })
  }
})
