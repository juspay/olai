/**
 * One brain per vault, as two processes.
 *
 * The claim is not a property of a function, it is a property of the MACHINE:
 * a second olai over a directory another olai is already serving must not boot.
 * So every test here is two real processes over one real directory, spawned the
 * way a person's shell spawns them — there is nothing an in-process test could
 * say about this, because the thing being excluded is another process.
 *
 * Why the exclusion exists at all (ratified 2026-08-15): two stores over one
 * directory have no cross-process protection. Writes are whole-file and
 * last-writer-wins, so one brain's edit erases the other's wholesale;
 * validation is per-brain, so duplicate ids and after-cycles that neither brain
 * would allow on its own reach the disk; and two commit paths sweep one git
 * repository against each other.
 *
 * Three of the four are that, and they are the three things the refusal has to
 * be. The fourth is the same keying question asked of the path function alone,
 * in milliseconds rather than in three boots — the end-to-end tests are what
 * make it true, and that one is what says which spellings were meant.
 *
 *   1. A REFUSAL, in olai's own words, naming the process that holds the
 *      directory — not a raw `EWOULDBLOCK` from the kernel, which tells a
 *      person nothing about what to do next.
 *   2. Keyed on the DIRECTORY rather than on how it was spelled: a symlink to
 *      a vault is that vault, and two olai over the two spellings are two
 *      brains over one set of files.
 *   3. Released BY THE KERNEL. The holder here is killed with SIGKILL, which
 *      runs no finalizer, writes no file and gets no chance to clean up
 *      anything — and the next boot still succeeds. That is the whole reason
 *      the lock is an OS advisory lock and not a lockfile with a pid in it:
 *      there is no staleness protocol to get wrong, because there is no
 *      staleness.
 */

import { findLogfmt } from "@olai/log/testlib"
import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { BOOT_TIMEOUT, startWeb, stoppedWithin } from "./child.testlib.ts"
import { lockFor } from "./lock.ts"
import { served } from "./serve.testlib.ts"

/** A test may take three boots' worth of waiting before it is a hang. */
const BOUND_MS = BOOT_TIMEOUT * 3

/**
 * A runtime directory of this test's own, shared by the children it spawns.
 *
 * The lock lives in `$XDG_RUNTIME_DIR/olai/`, so the two processes here are
 * pointed at one of ours rather than at the developer's — which keeps a real
 * olai they have running out of these assertions, and keeps this test's lock
 * files out of their session's runtime directory.
 */
const runtime = (): NodeJS.ProcessEnv => ({
  XDG_RUNTIME_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "olai-lock-run-")),
})

test("a second olai over one directory refuses, and names the one that holds it", async () => {
  const root = served()
  const env = runtime()
  const first = startWeb({ root, env })
  try {
    await first.address()

    const second = startWeb({ root, env })
    const code = await second.exited()

    // Refused, and refused BEFORE it could do anything: it never bound a port
    // and never opened a store over files it does not own.
    expect(code).not.toBe(0)
    expect(findLogfmt(second.said(), "serving")).toBeUndefined()
    // olai's words, and the holder by name. A pid is what a person acts on —
    // it is what they pass to `ps` to see which vault the other one is serving,
    // and to `kill` if it is a leftover they meant to stop.
    expect(second.said()).toContain(
      `another olai is serving this directory (pid ${first.child.pid})`,
    )
    expect(second.said()).toContain("one brain per vault")
  } finally {
    first.kill()
  }
}, BOUND_MS)

test("a symlinked spelling of the vault is the same vault", async () => {
  // The seam #175 named and deferred, spelled out: the rendezvous socket
  // canonicalised with `realpath` and the store with `resolve`, and the two
  // answer differently for exactly this. A person types `olai web ~/notes` in
  // one terminal and `olai web .` from inside a symlink to it in another, and
  // if the lock keys on the spelling they get two brains over one vault.
  const root = fs.realpathSync(served())
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), "olai-lock-link-"))
  const link = path.join(elsewhere, "notes")
  fs.symlinkSync(root, link)

  const env = runtime()
  const first = startWeb({ root, env })
  try {
    await first.address()

    const second = startWeb({ root: link, env })
    expect(await second.exited()).not.toBe(0)
    expect(second.said()).toContain(
      `another olai is serving this directory (pid ${first.child.pid})`,
    )
  } finally {
    first.kill()
  }
}, BOUND_MS)

test("the holder dies and the directory is free", async () => {
  const root = served()
  const env = runtime()
  const first = startWeb({ root, env })
  await first.address()

  // SIGKILL, deliberately: no finalizer runs, nothing is unlinked, nothing is
  // written down. Whatever releases the directory here is the kernel closing
  // the descriptors of a process that no longer exists.
  first.kill("SIGKILL")
  expect(await stoppedWithin(first.child, BOOT_TIMEOUT)).toBe(true)

  const next = startWeb({ root, env })
  try {
    // It BOOTS, and the address is the proof: a server that says where it is
    // serving has a store open over the directory, which it could not have
    // taken while the dead one's claim stood.
    expect(await next.address()).toContain("http://127.0.0.1:")
  } finally {
    next.kill()
  }
}, BOUND_MS)

test("the lock is the directory's, however the directory was spelled", () => {
  // The same three spellings the two-process test above proves end to end,
  // pinned here in milliseconds — and the third one is the half a symlink test
  // alone would not catch: two vaults must be two locks, or a person with
  // notes and work open could only ever serve one of them.
  const root = fs.realpathSync(served())
  const elsewhere = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-lock-key-")))
  const link = path.join(elsewhere, "notes")
  fs.symlinkSync(root, link)

  expect(lockFor(link)).toBe(lockFor(root))
  expect(lockFor(`${root}/.`)).toBe(lockFor(root))
  expect(lockFor(elsewhere)).not.toBe(lockFor(root))
})
