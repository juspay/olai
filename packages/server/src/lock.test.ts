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
 * What the tests are, and each is one property of the refusal:
 *
 *   1. REFUSE THE SECOND. A second olai over a directory another is serving
 *      does not boot — it never binds a port and never opens a store.
 *   2. NAME THE HOLDER. In olai's own words, with the pid, because a raw
 *      `EWOULDBLOCK` tells a person nothing about what to do next.
 *   3. THE SPELLING IS NOT THE VAULT. A symlink to a directory is that
 *      directory, so two olai over the two spellings are two brains over one
 *      set of files. Asked twice: end to end here, and of the path function
 *      alone in the last test, which is what says which spellings were meant.
 *   4. A GRACEFUL STOP FREES IT. The holder is signalled, its finalizers run,
 *      and the next boot succeeds.
 *   5. `kill -9` FREES IT TOO, and this is the one that matters most: SIGKILL
 *      runs no finalizer, writes nothing down and unlinks nothing, so what
 *      releases the vault is the KERNEL closing the descriptors of a process
 *      that no longer exists. Validity lives in the kernel's lock and never in
 *      a file's existence — which is why there is no staleness protocol to get
 *      wrong, and why a machine can never come back from a crash refusing to
 *      serve its own notes. The leftover FILE is swept on the next boot.
 *   5b. A GRACEFUL STOP UNLINKS THE FILE. The next boot's sweep is what a
 *      SIGKILL leftover meets.
 *   6. A STALE PID IN THE NOTE FOOLS NOBODY. The pid in the lock file is
 *      DIAGNOSIS, not validity: with a bogus one written over it, the second
 *      olai is still refused (the kernel decides) and the bogus number is not
 *      read out as fact.
 *   7. THE OTHER REFUSAL IS REAL TOO. When the machine will not answer the
 *      question — a runtime directory that is not a directory, or one other
 *      users can write — olai says `cannot take the one-brain lock` and does
 *      not serve. That branch is a hard boot failure with no escape, which is
 *      what makes it worth pinning rather than what makes it exotic.
 */

import { findLogfmt } from "@olai/log/testlib"
import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { BOOT_TIMEOUT, startWeb, stoppedWithin } from "./child.testlib.ts"
import { lockFor, sweepRuntime } from "./lock.ts"
import { served } from "./serve.testlib.ts"

/** A test may take three boots' worth of waiting before it is a hang. */
const BOUND_MS = BOOT_TIMEOUT * 3

/**
 * A runtime directory this whole file shares — its children, and THIS process,
 * which is the half that is easy to miss.
 *
 * The lock lives in `$XDG_RUNTIME_DIR/olai/`, so the children are pointed at
 * one of ours rather than at the developer's: it keeps a real olai they have
 * running out of these assertions, and keeps this file's lock files out of
 * their session's runtime directory. `process.env` moves with them because two
 * tests below name the lock FILE — `lockFor` reads the variable at call time,
 * precisely so a test can do this, and a test that set it for its children
 * only would be naming a path nobody uses and passing.
 *
 * ONE directory for the file rather than one per test, because what keeps the
 * tests apart is already the VAULT: every one of them serves a fresh `served()`
 * of its own, so their locks are different files inside this directory.
 *
 * The directory is the process's, set once in `scripts/bun-test-preload.ts`
 * and never restored — an afterAll here used to put the real runtime dir
 * back after this file, so every later serving test locked it.
 */
const ours = process.env["XDG_RUNTIME_DIR"]
if (ours === undefined || !ours.includes("olai-test-run-")) {
  throw new Error(
    `lock tests need the process runtime dir from bun-test-preload, got ${ours}`,
  )
}
const env: NodeJS.ProcessEnv = { XDG_RUNTIME_DIR: ours }

test("a second olai over one directory refuses to boot", async () => {
  const root = served()
  const first = startWeb({ root, env })
  try {
    await first.address()

    const second = startWeb({ root, env })
    const code = await second.exited()

    // Refused, and refused BEFORE it could do anything: it never bound a port
    // and never opened a store over files it does not own.
    expect(code).not.toBe(0)
    expect(findLogfmt(second.said(), "serving")).toBeUndefined()
  } finally {
    first.kill()
  }
}, BOUND_MS)

test("the refusal names the olai that holds the vault", async () => {
  // Its own test rather than two more assertions above, because it is its own
  // promise: a pid is what a person ACTS on — what they pass to `ps` to see
  // which vault the other one is serving, and to `kill` if it is a leftover
  // they meant to stop. A refusal that merely said "busy" would leave them
  // hunting.
  const root = served()
  const first = startWeb({ root, env })
  try {
    await first.address()

    const second = startWeb({ root, env })
    await second.exited()
    expect(second.said()).toContain(
      `another olai is serving this directory (pid ${first.child.pid})`,
    )
    expect(second.said()).toContain("one brain per vault")
  } finally {
    first.kill()
  }
}, BOUND_MS)

test("a stale pid in the note frees nothing, and is not read out as fact", async () => {
  // The pid is DIAGNOSIS and the kernel's lock is VALIDITY, and this is the
  // test that says so. The note is overwritten with a pid that cannot exist —
  // which is what a recycled or half-written one would look like — and the two
  // halves are asserted separately: the second olai is still refused, because
  // nothing reads the file to decide anything; and the number nobody can verify
  // does not appear in the sentence, because a wrong pid sends a person to
  // `kill` a process that is not the one holding their notes.
  const root = served()
  const first = startWeb({ root, env })
  try {
    await first.address()
    // Writing needs no lock — flock is advisory — which is exactly why the
    // contents can never be the thing that decides. The mode is spelled out
    // because it is what the holder creates the file with (`lock.ts`'s
    // `openLock`), so a note this test leaves behind is the note olai would
    // have left — and a scanner reading this line is owed the same answer.
    fs.writeFileSync(lockFor(root), `pid=${IMPOSSIBLE_PID}\n`, { mode: 0o600 })

    const second = startWeb({ root, env })
    expect(await second.exited()).not.toBe(0)
    expect(second.said()).toContain("another olai is serving this directory")
    expect(second.said()).not.toContain(String(IMPOSSIBLE_PID))
  } finally {
    first.kill()
  }
}, BOUND_MS)

/** Above any `pid_max` Linux or darwin will hand out, so it names no process
 *  on any machine this runs on — a stale note, without the flake of reusing a
 *  pid that has just been freed and could be handed to somebody else. */
const IMPOSSIBLE_PID = 2_147_483_646

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

test("the holder is stopped and the directory is free", async () => {
  // The ordinary way a server ends: a signal it handles, finalizers running,
  // the scope closing the descriptor on the way out.
  const root = served()
  const first = startWeb({ root, env })
  await first.address()
  first.kill("SIGINT")
  expect(await stoppedWithin(first.child, BOOT_TIMEOUT)).toBe(true)
  // And the lock FILE is gone: a graceful stop unlinks it.
  expect(fs.existsSync(lockFor(root))).toBe(false)

  const next = startWeb({ root, env })
  try {
    // It BOOTS, and the address is the proof: a server that says where it is
    // serving has a store open over the directory, which it could not have
    // taken while the last one's claim stood.
    expect(await next.address()).toContain("http://127.0.0.1:")
  } finally {
    next.kill("SIGINT")
  }
}, BOUND_MS)

test("`kill -9` frees the directory: nothing was cleaned up, and nothing had to be", async () => {
  // The one that matters most, and the whole argument for an OS lock. SIGKILL
  // runs no finalizer, writes nothing down and unlinks nothing — it is a power
  // cut with a smaller blast radius — and the vault is free the instant the
  // process is gone, because what held it was a descriptor the kernel closed.
  // Anything whose validity came from a FILE EXISTING would refuse to serve
  // here, and a person's notes would be locked out by a crash.
  const root = served()
  const first = startWeb({ root, env })
  await first.address()
  first.kill("SIGKILL")
  expect(await stoppedWithin(first.child, BOOT_TIMEOUT)).toBe(true)
  // The lock FILE is still on disk, untouched and still naming the dead pid.
  // That it is there and the vault is free anyway is the property.
  expect(fs.existsSync(lockFor(root))).toBe(true)

  const next = startWeb({ root, env })
  try {
    expect(await next.address()).toContain("http://127.0.0.1:")
    // The next boot swept the leftover: the file now names THIS process,
    // not the SIGKILLed one. (A different digest's leftover is the unit
    // test below; this is the same-vault half.)
    const note = fs.readFileSync(lockFor(root), "utf8")
    expect(note).toContain(`pid=${next.child.pid}`)
    expect(note).not.toContain(`pid=${first.child.pid}`)
  } finally {
    next.kill("SIGINT")
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

/**
 * The OTHER refusal, which had no test: the machine will not answer the
 * question at all.
 *
 * `LockUnavailable` is a hard boot refusal with no escape, so what it costs to
 * be wrong is a person unable to serve their notes — which makes it the branch
 * most worth pinning, not the least. Both cases below are reachable by hand,
 * and both are reached the way somebody would reach them by accident: a
 * runtime directory that is not a directory, and one left open to other users
 * (`/tmp/olai-$UID` is a fixed path, so who made it first is not always us).
 *
 * What each asserts is the same three things: it exits non-zero, it says
 * `cannot take the one-brain lock` in olai's own words, and it NEVER serves —
 * because the failure mode that would matter is a server that shrugged and
 * came up unprotected.
 */
const refusedWithNoLock = async (runtimeDir: string): Promise<void> => {
  const child = startWeb({
    root: served(),
    env: { XDG_RUNTIME_DIR: runtimeDir },
  })
  try {
    expect(await child.exited()).not.toBe(0)
    expect(child.said()).toContain("cannot take the one-brain lock")
    expect(findLogfmt(child.said(), "serving")).toBeUndefined()
  } finally {
    child.kill()
  }
}

test("a runtime directory that is not a directory refuses the boot", async () => {
  // `mkdirSync` over a plain file throws EEXIST/ENOTDIR, which is the `catch`
  // in `openLock` rather than any predicate of ours.
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "olai-lock-bad-")), "runtime")
  fs.writeFileSync(file, "not a directory\n", { mode: 0o600 })
  await refusedWithNoLock(file)
}, BOUND_MS)

test("a runtime directory other users can write refuses the boot", async () => {
  // The threat `isPrivateOwnedDir` is for: `/tmp/olai-$UID` is a fixed path, and
  // a directory somebody else prepared is one they can hold a lock in — olai
  // would then report a stranger's claim as another olai of the reader's own.
  // 0755 is OURS and still open, which is the case `mkdirSync`'s `mode:` cannot
  // catch, because that argument only applies to a directory it CREATES.
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "olai-lock-open-"))
  fs.mkdirSync(path.join(runtime, "olai"), { mode: 0o755 })
  fs.chmodSync(path.join(runtime, "olai"), 0o755)
  await refusedWithNoLock(runtime)
}, BOUND_MS)

/**
 * Leftovers in THIS file's runtime directory. Each test writes a named file
 * and asks {@link sweepRuntime} — no server, because the sweep is a function
 * of the files, not of a boot.
 */
const placed = (name: string, body: string): string => {
  const dir = path.join(ours, "olai")
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  fs.chmodSync(dir, 0o700)
  const file = path.join(dir, name)
  fs.writeFileSync(file, body, { mode: 0o600 })
  return file
}

test("a dead-pid lock is swept", () => {
  const file = placed(
    "deadpiddeadpidde.lock",
    `pid=${IMPOSSIBLE_PID}\nroot=${ours}\n`,
  )
  expect(sweepRuntime()).toBeGreaterThanOrEqual(1)
  expect(fs.existsSync(file)).toBe(false)
})

test("a live lock is not swept", async () => {
  // Pid-and-root in a file anybody wrote is not a live server: the kernel's
  // flock is. A real holder, and a leftover beside it, so the sweep has
  // both answers in one directory.
  const root = served()
  const server = startWeb({ root, env })
  await server.address()
  const leftover = placed(
    "leftoverleftoverl.lock",
    `pid=${IMPOSSIBLE_PID}\nroot=${ours}\n`,
  )
  try {
    expect(sweepRuntime()).toBeGreaterThanOrEqual(1)
    expect(fs.existsSync(leftover)).toBe(false)
    expect(fs.existsSync(lockFor(root))).toBe(true)
  } finally {
    server.kill("SIGINT")
    await stoppedWithin(server.child, BOOT_TIMEOUT)
  }
}, BOUND_MS)

test("a leftover whose recorded root is gone is swept when nothing holds it", () => {
  // Flock-free only: a held lock whose root the host cannot stat is left
  // (the two-brains race). This file has no holder, so the sweep takes
  // the flock and the name goes.
  const file = placed(
    "missingrootmissi.lock",
    `pid=${process.pid}\nroot=/no/such/olai-vault-root\n`,
  )
  expect(sweepRuntime()).toBeGreaterThanOrEqual(1)
  expect(fs.existsSync(file)).toBe(false)
})

test("a lock that is a symlink is not followed", () => {
  const target = path.join(ours, "secret")
  fs.writeFileSync(target, "do not touch\n", { mode: 0o600 })
  const file = placed("symlinksymlinksy.lock", "")
  fs.unlinkSync(file)
  fs.symlinkSync(target, file)
  sweepRuntime()
  expect(fs.readFileSync(target, "utf8")).toBe("do not touch\n")
  expect(fs.lstatSync(file).isSymbolicLink()).toBe(true)
})

test("a leftover rendezvous socket is swept, and surface.sock is not", () => {
  const leftover = placed("0123456789abcdef.sock", "")
  const live = placed("surface.sock", "")
  expect(sweepRuntime()).toBeGreaterThanOrEqual(1)
  expect(fs.existsSync(leftover)).toBe(false)
  expect(fs.existsSync(live)).toBe(true)
  fs.unlinkSync(live)
})


