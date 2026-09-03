/**
 * What counts as "kolu is running here", against real subprocesses.
 *
 * The detection is a probe, so the fixtures are executables: a `kolu` written
 * into a directory this test names as the PATH, answering the way a real one
 * would. Nothing here talks to a padi daemon — what is being asserted is the
 * RULE, and the rule is that only an answered read counts.
 *
 * The middle case is the one that matters most, and it is the reason this file
 * exists rather than a version check: a `kolu` that speaks the protocol
 * perfectly and reaches no daemon is exactly what a stale bundled build looks
 * like (juspay/kolu#2146), and it must not become a session's MCP server.
 *
 * ## NOTHING HERE TOUCHES `process.env`, which is new and is the point
 *
 * This file used to replace this process's `PATH` and delete its `PADI_SOCKET`
 * in a `beforeEach`, restore both in an `afterEach`, and say out loud why: the
 * machine it was written on IS running kolu, so the ambient variable silently
 * turned the quiet case into the loud one. The environment is a PARAMETER now
 * ({@link ./probe.ts}), because the probe has to read what a session's own spawn
 * will resolve against and a composition root is the one place a real
 * environment is reached for — so every case here hands over the environment it
 * is a claim about, and a developer running this suite from inside a kolu
 * terminal gets the same answers CI does for a reason a reader can see.
 */

import { spawn } from "node:child_process"
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, test } from "bun:test"
import {
  KOLU_COMMAND,
  KOLU_MCP_ARGS,
  PADI_SOCKET_ENV,
  PROBE_ID,
} from "olai-plugin-kolu/appliance/detect"

import { askOver, type NotHere, probe, type Probed, type StdioServer } from "./probe.ts"

/** A padi somebody's environment names. Its VALUE is never dialed — what these
 *  cases turn on is whether the variable is set at all. */
const SOCKET = "/run/user/1000/padi-abc/padi.sock"

/** Every directory this test made, removed after each case. */
const made: Array<string> = []

/** WHERE THIS CASE'S `kolu` IS — the PATH the probe is handed, and never this
 *  process's own. A machine that really is running kolu (the ordinary one to
 *  develop this on) would otherwise decide half of these cases itself. */
let where = ""

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
  where = ""
})

/**
 * A `kolu` on the probed PATH, in a directory of its own, running the given
 * script under the interpreter this test is itself running under — so the
 * fixture needs nothing on PATH, which is the one thing this test is
 * rearranging.
 */
const koluOnPath = (body: string): string =>
  fileOnPath(`#!${process.execPath}\n${body}`)

/** The same, for the cases that are about the FILE rather than about what it
 *  says — a program this host cannot run is one of the ways a `kolu` on PATH
 *  fails, and it cannot be written as a script this interpreter would take. */
const fileOnPath = (contents: string): string => {
  const bin = join(emptyDir(), "kolu")
  writeFileSync(bin, contents)
  chmodSync(bin, 0o755)
  return bin
}

/** A directory with nothing in it, named as the PATH — which is how "no `kolu`
 *  anywhere" is said without asking anything of the machine underneath. */
const emptyDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "olai-kolu-"))
  made.push(dir)
  where = dir
  return dir
}

/**
 * What the probe has to ask for, spelled HERE rather than imported.
 *
 * These two strings are the guarantee this whole file exists to hold. A real
 * kolu completes `initialize`, lists all its tools and lists its resources with
 * no daemon behind it at all (juspay/kolu#2148) — only READING a cell the
 * daemon owns tells the two apart. So a probe quietly swapped to `tools/list`
 * would be worthless, and the fixtures below refuse to answer anything else:
 * taking these from the prober would move with such a swap and go on passing,
 * which is the opposite of a lock.
 */
const ASKS = "resources/read"
const ABOUT = "surface://cells/identity"

/**
 * A fixture that answers the identity read the way the flag says: with what a
 * live padi has, or with the error a kolu that reached no daemon sends. It
 * answers NOTHING else, so a probe that stopped asking for the daemon's own
 * cell fails these cases rather than passing them.
 *
 * It watches the bytes for those two strings instead of parsing frames, and
 * that is deliberate: parsing would put a fourth copy of ndjson framing in this
 * repo — the suite's fakes share one (`packages/tests/support/ndjson.ts`), and
 * this file cannot import it without this package depending on `@olai/tests`,
 * which is backwards. A substring watch is not a second framing implementation,
 * and it is enough to say what was asked for. The ID is the one thing taken
 * from the prober (an answer carrying a different id is not an answer, but
 * WHICH id is bookkeeping rather than the claim).
 */
const script = (reachable: boolean): string =>
  `
const ANSWER = ${
    JSON.stringify(
      reachable
        ? { jsonrpc: "2.0", id: PROBE_ID, result: { contents: [] } }
        : {
          jsonrpc: "2.0",
          id: PROBE_ID,
          error: { code: -32603, message: "padi transport down" },
        },
    )
  }
let heard = ""
process.stdin.on("data", (chunk) => {
  heard += chunk
  if (!heard.includes(${JSON.stringify(ASKS)}) || !heard.includes(${JSON.stringify(ABOUT)})) return
  heard = ""
  process.stdout.write(JSON.stringify(ANSWER) + "\\n")
})
`

/** This case's environment: the PATH its fixture is on, and a padi named or
 *  not. There is no third thing the probe reads. */
const asked = (socket?: string): Promise<Probed> =>
  probe({ PATH: where, ...(socket === undefined ? {} : { [PADI_SOCKET_ENV]: socket }) })

/** The server a session would be handed, which is what every case here used to
 *  assert on directly — the probe answers with the REASON beside it. */
const server = async (socket?: string): Promise<StdioServer | null> =>
  (await asked(socket)).server

describe("detecting kolu", () => {
  test("a kolu whose padi answers is the session's server", async () => {
    const bin = koluOnPath(script(true))

    // THE CONSTANTS, not their spellings. These used to be literals, and the
    // pin was therefore green through any upstream rename — which was the
    // whole finding behind the detect door.
    expect(await server(SOCKET)).toEqual({
      name: KOLU_COMMAND,
      // The path that ANSWERED, absolute — not the word we looked up.
      command: bin,
      args: KOLU_MCP_ARGS,
      env: { [PADI_SOCKET_ENV]: SOCKET },
    })
  })

  // The three ways of being no are three DIFFERENT answers now. They were one
  // silent `false` with the reason thrown away by a `catch`, which is what
  // left "kolu is not installed here" and "the kolu on your PATH is a build
  // that cannot do this" indistinguishable — the second being the one worth
  // saying out loud (juspay/kolu#2146).
  test("a kolu that reached no padi says which refusal that was", async () => {
    const bin = koluOnPath(script(false))

    const found = await asked()
    expect(found.server).toBeNull()
    expect(found.missing).toMatchObject({ where: bin })
    expect(found.missing?.why).toContain("padi transport down")
  })

  test("a binary that is not kolu at all says it never answered", async () => {
    koluOnPath(`process.stdout.write("hello from something else\\n")\n`)

    const found = await asked()
    expect(found.server).toBeNull()
    expect(found.missing).not.toBeNull()
  })

  /**
   * The fourth sentence, and the one that had no case.
   *
   * A wedged server and a server that hung up reach the same closed pipe, and
   * the only thing that tells them apart is the `expired` flag the deadline
   * sets — exactly the sort of thing that rots into the wrong sentence with
   * every other test still green. It used to be untestable through the probe
   * without spending five real seconds per run, so `askOver` takes the deadline
   * and this spends a tenth of one instead.
   *
   * The fixture READS and never answers, which is what a wedge is: a process
   * that is alive and holding its client. A fixture that exited would close the
   * pipe and take the other branch.
   */
  test("a kolu that reads and never answers is a deadline, not a hang-up", async () => {
    const bin = koluOnPath(`process.stdin.on("data", () => {})\n`)
    const child = spawn(bin, ["mcp"], { stdio: ["pipe", "pipe", "ignore"] })

    expect(await askOver(child, 150)).toBe("it did not answer within 0.15s")
  })

  // The lock the fixtures above carry, stated where a reader will look for it:
  // they answer only what a daemon owns, so a probe swapped to `initialize`,
  // `tools/list` or `resources/list` — every one of which a real kolu answers
  // with nothing behind it (juspay/kolu#2148) — stops being answered at all,
  // and the first case in this file goes red instead of quietly passing.
  //
  // The DEADLINE has no case here, and that is a cost decision rather than an
  // oversight: the only way to exercise it is to spend it, and five seconds
  // per lane on every run, forever, is not what that one `setTimeout` is
  // worth. It is exercised in production terms instead — a `kolu` that reads
  // and says nothing is the wedge, and what happens then is the same absence
  // every other refusal produces.

  // ...and this one is the arm that is NOT a reason: nothing went wrong on a
  // host that simply is not running kolu, so there is nothing to report about
  // it, which is exactly the distinction the single `null` could not make.
  test("no kolu on PATH is the ordinary case, not a failure", async () => {
    emptyDir()

    // No socket named, which is the whole of what makes this the quiet case —
    // and it is said by NOT passing one rather than by deleting a variable out
    // from under the process.
    expect(await asked()).toEqual({ server: null, missing: null })
  })

  /**
   * ... unless something already said a padi is expected here.
   *
   * The hole the reviewer found in this file's own definition. "No kolu on
   * PATH" is the ordinary case because olai auto-detects and nothing declares
   * an expectation — but `PADI_SOCKET` IS a declaration: it is set by a kolu
   * terminal for the processes it starts, and by a person who meant it. A
   * server that inherited it and cannot see `kolu` is the original incident
   * with a different PATH, and olai's PATH is not the user's — the home-manager
   * unit passes neither (`nix/home/module.nix`).
   *
   * The narrowness is the point. Without the variable this stays quiet, so a
   * machine that has never heard of kolu never hears about it.
   */
  test("a padi named by the environment with no kolu to reach it is a miss", async () => {
    emptyDir()

    const found = await asked(SOCKET)
    expect(found.server).toBeNull()
    // The variable is NAMED, because it is the thing that made this a fault
    // rather than an absence, and the thing a reader can go and look at.
    expect(found.missing?.why).toContain(PADI_SOCKET_ENV)
    // ... and there is no file to name, which is the finding itself.
    expect(found.missing).toMatchObject({ name: KOLU_COMMAND, where: null })
  })

  test("no PADI_SOCKET forwards nothing, and kolu resolves its own", async () => {
    koluOnPath(script(true))

    expect(await server()).toMatchObject({ env: {} })
  })
})

/**
 * The failure SHAPES, as the panel gets to draw them (`mcp-fail-visible`).
 *
 * One case per way a `kolu` on PATH can fail to be this host's, and each asserts
 * the sentence rather than the fact that there is one: a strip that said "kolu
 * did not attach" four times would be the debug log line on screen, which is
 * precisely what the incident these cases come from was debugged around. What
 * is being locked is that the reason SURVIVES — the server's own words where it
 * gave any, and a sentence about the file where it could not — and that it
 * survives WHOLE. Core displays what is asserted below and composes none of it,
 * which is why these strings are pinned in this package and nowhere else.
 *
 * The deadline still has no case, for the reason stated above: the only way to
 * exercise it is to spend it.
 */
describe("what a session that did not get kolu can be told", () => {
  const missing = async (socket?: string): Promise<NotHere | null> =>
    (await asked(socket)).missing

  test("a refusal carries the words the server refused in", async () => {
    const bin = koluOnPath(script(false))

    expect(await missing()).toEqual({
      name: KOLU_COMMAND,
      where: bin,
      why: "it refused to read the daemon's identity: padi transport down",
    })
  })

  test("a binary that hangs up says so, and names no refusal it never made", async () => {
    const bin = koluOnPath(`process.exit(0)\n`)

    expect(await missing()).toEqual({
      name: KOLU_COMMAND,
      where: bin,
      why: "it closed the connection without answering",
    })
  })

  // The one that does not arrive through the pipes at all. Under Bun an exec
  // failure is an `error` EVENT on a child that has already been returned, so
  // this case is also the regression test for the listener that catches it:
  // without one the event is an uncaught exception, and a file on somebody's
  // PATH takes olai's server down. It would report the broken pipe that
  // followed, too — "Cannot call write after a stream was destroyed", which is
  // a sentence about our own write and says nothing about the file.
  test("a file that will not run is named as one, not as a broken pipe", async () => {
    const bin = fileOnPath("#!/nonexistent/interpreter\nnot a program\n")

    const found = await missing()
    expect(found).toMatchObject({ name: KOLU_COMMAND, where: bin })
    const why = found?.why ?? null
    expect(why).toStartWith("it could not be started:")
    // ... and NOT the fifth sentence. `talking to it failed: …` is what
    // `askOver` comes back with when our own write loses to a stdin the failed
    // exec destroyed, and it is what the un-raced version of this file said —
    // a fact about our end of a pipe, on a screen where the file's name
    // belongs. Asserting the sentence that must not appear is what makes this
    // case about the RACE rather than about the words that won it.
    expect(why).not.toContain("stream was destroyed")
  })

  test("a kolu that answered is nothing to report", async () => {
    koluOnPath(script(true))

    expect(await missing()).toBeNull()
  })

  // The distinction the whole member exists to keep: NOTHING WENT WRONG on a
  // host that is not running kolu, and a panel that reported that absence as a
  // fault would carry a permanent complaint on every machine that has never
  // heard of kolu — which is the same as saying nothing, reached from the other
  // side.
  test("no kolu on PATH is not a missing server", async () => {
    emptyDir()

    expect(await missing()).toBeNull()
  })

  // ... and the sentence a person gets when the environment says otherwise.
  // Its own case here as well as in the block above, because what is asserted
  // is the RENDERED fact — a name, no path, and a reason that names the
  // variable somebody can go and look at.
  test("a padi named with nothing to reach it says so, and names no file", async () => {
    emptyDir()

    expect(await missing(SOCKET)).toEqual({
      name: KOLU_COMMAND,
      where: null,
      why: "PADI_SOCKET names a padi on this host, but no `kolu` is on the PATH "
        + "this server was started with — so there is nothing here to reach it through",
    })
  })
})
