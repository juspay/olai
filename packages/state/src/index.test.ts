/**
 * The two claims this leaf makes, and neither is testable through a consumer.
 *
 * WHICH FILE a directory gets is what two processes have to agree on — a lock
 * and a remembered policy over one vault — and the interesting half of it is
 * the realpath: a person types `olai web ~/notes` in one terminal and
 * `olai web .` from inside a symlink to it in another. `@olai/server`'s
 * `gitPolicy.test.ts` and `@olai/chat`'s exercise the read/write pair as their
 * own records; what is here is the naming, and the guard that keeps one
 * directory's file from being read as another's.
 */

import { expect, test } from "bun:test"
import { Effect } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import {
  canonical,
  digestOf,
  fileFor,
  readHeld,
  runtimeHome,
  stateHome,
  writeHeld,
} from "./index.ts"

/** A temp directory, and the environment put back afterwards — both homes are
 *  read at call time so a test may point them anywhere, which is the whole
 *  reason they are functions. */
const withState = async (use: (dirs: {
  readonly root: string
  readonly home: string
}) => Promise<void>): Promise<void> => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-state-root-")))
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-state-home-")))
  const before = process.env["XDG_STATE_HOME"]
  process.env["XDG_STATE_HOME"] = home
  try {
    await use({ root, home })
  } finally {
    if (before === undefined) delete process.env["XDG_STATE_HOME"]
    else process.env["XDG_STATE_HOME"] = before
    for (const at of [root, home]) fs.rmSync(at, { recursive: true, force: true })
  }
}

test("both homes are read at call time, so a process can be pointed anywhere", () => {
  const before = { state: process.env["XDG_STATE_HOME"], run: process.env["XDG_RUNTIME_DIR"] }
  try {
    process.env["XDG_STATE_HOME"] = "/somewhere/state"
    process.env["XDG_RUNTIME_DIR"] = "/somewhere/run"
    expect(stateHome()).toBe("/somewhere/state/olai")
    expect(runtimeHome()).toBe("/somewhere/run/olai")
    // No runtime directory is the fixed per-user `/tmp` path rather than
    // `os.tmpdir()`, which differs by launch context — a systemd-started olai
    // and one a person typed would otherwise lock two different files.
    delete process.env["XDG_RUNTIME_DIR"]
    expect(runtimeHome()).toStartWith("/tmp/olai-")
  } finally {
    if (before.state === undefined) delete process.env["XDG_STATE_HOME"]
    else process.env["XDG_STATE_HOME"] = before.state
    if (before.run === undefined) delete process.env["XDG_RUNTIME_DIR"]
    else process.env["XDG_RUNTIME_DIR"] = before.run
  }
})

/**
 * THE REALPATH, which is the load-bearing half.
 *
 * Two spellings of one directory must be one file, or a vault reached through a
 * symlink is a second brain and a second remembered policy.
 */
test("one directory is one name, however it was spelled", () =>
  withState(async ({ root }) => {
    const link = `${root}-link`
    fs.symlinkSync(root, link)
    try {
      // The resolving is `canonical`'s; `digestOf` names whatever it is handed,
      // so one `realpath` serves the file's name and the guard inside it.
      expect(canonical(link)).toBe(root)
      expect(canonical(`${root}/`)).toBe(root)
      expect(digestOf(canonical(link))).toBe(digestOf(canonical(root)))
      // ... and two DIFFERENT directories are two names.
      expect(digestOf(root)).not.toBe(digestOf(`${root}-other`))
    } finally {
      fs.unlinkSync(link)
    }
  }))

/** A path that does not exist has no realpath and falls back to the resolved
 *  spelling: a caller is about to fail on the missing directory anyway, and
 *  this must not be what tells them so. */
test("a directory that is not there still has a name", () => {
  expect(canonical("/no/such/place")).toBe("/no/such/place")
  expect(digestOf(canonical("/no/such/place"))).toHaveLength(16)
})

test("a kind is a subdirectory of the state home, and the digest names the file", () =>
  withState(async ({ root, home }) => {
    expect(fileFor("git", root)).toBe(
      path.join(home, "olai", "git", `${digestOf(root)}.json`),
    )
    // A second kind is a sibling directory rather than a second naming scheme.
    expect(path.dirname(fileFor("chat", root))).toBe(path.join(home, "olai", "chat"))
  }))

test("nothing written down is `null` rather than a failure", () =>
  withState(async ({ root }) => {
    expect(await Effect.runPromise(readHeld(fileFor("git", root), root))).toBeNull()
  }))

test("what is written comes back, under a home that did not exist", () =>
  withState(async ({ root }) => {
    const at = fileFor("git", root)
    await Effect.runPromise(writeHeld(at, { cwd: root, commit: "auto" }))
    expect(await Effect.runPromise(readHeld(at, root)))
      .toMatchObject({ cwd: root, commit: "auto" })
    // Owner-only, both the home and the file: this is somebody's state
    // directory, not a shared one.
    expect(fs.statSync(at).mode & 0o777).toBe(0o600)
    expect(fs.statSync(path.dirname(at)).mode & 0o777).toBe(0o700)
    // ... and nothing is left staged beside it.
    expect(fs.readdirSync(path.dirname(at))).toEqual([path.basename(at)])
  }))

/** A file about some OTHER directory is not this one's. Not damage either — a
 *  digest collision, or a state home somebody copied — so the honest answer is
 *  that nothing here says. */
test("a record about another directory is answered as nothing", () =>
  withState(async ({ root }) => {
    const at = fileFor("git", root)
    await Effect.runPromise(writeHeld(at, { cwd: "/somewhere/else", commit: "auto" }))
    expect(await Effect.runPromise(readHeld(at, root))).toBeNull()
  }))

/** Bytes that are not JSON ARE damage, and come out the error channel with the
 *  path on them — a caller renders it and carries on. */
test("a record that will not parse is news", () =>
  withState(async ({ root }) => {
    const at = fileFor("git", root)
    await Effect.runPromise(writeHeld(at, { cwd: root }))
    fs.writeFileSync(at, "{ not json")
    const outcome = await Effect.runPromise(Effect.result(readHeld(at, root)))
    expect(outcome._tag).toBe("Failure")
    if (outcome._tag === "Failure") {
      expect(outcome.failure.message).toContain(at)
      expect(outcome.failure.message).toContain("JSON")
    }
  }))
