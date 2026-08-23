/**
 * What counts as "kolu is running here", against real subprocesses.
 *
 * The detection is a probe, so the fixtures are executables: a `kolu` written
 * into a directory this test puts on PATH, answering the way a real one would.
 * Nothing here talks to a padi daemon — what is being asserted is the RULE, and
 * the rule is that only an answered read counts.
 *
 * The middle case is the one that matters most, and it is the reason this file
 * exists rather than a version check: a `kolu` that speaks the protocol
 * perfectly and reaches no daemon is exactly what a stale bundled build looks
 * like (juspay/kolu#2146), and it must not become a session's MCP server.
 */

import { spawn } from "node:child_process"
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"

import { afterEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"

import { mcpServersOf } from "./agent.ts"
import {
  askOver,
  detect,
  type Detected,
  missingFrom,
  PROBE_ID,
  type Server,
  serverOf,
} from "./kolu.ts"

/** Everything this test made, undone after each case: the directories it put
 *  on PATH, and PATH itself. */
const made: Array<string> = []
const PATH = process.env["PATH"]
const SOCKET = process.env["PADI_SOCKET"]

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
  process.env["PATH"] = PATH
  if (SOCKET === undefined) delete process.env["PADI_SOCKET"]
  else process.env["PADI_SOCKET"] = SOCKET
})

/**
 * A `kolu` on PATH, in a directory of its own, running the given script under
 * the interpreter this test is itself running under — so the fixture needs
 * nothing on PATH, which is the one thing this test is rearranging.
 *
 * PATH is REPLACED rather than prepended: a machine that really is running kolu
 * (the ordinary one to develop this on) would otherwise decide half of these
 * cases itself.
 */
const koluOnPath = (body: string): string =>
  fileOnPath(`#!${process.execPath}\n${body}`)

/** The same, for the cases that are about the FILE rather than about what it
 *  says — a program this host cannot run is one of the ways a `kolu` on PATH
 *  fails, and it cannot be written as a script this interpreter would take. */
const fileOnPath = (contents: string): string => {
  const dir = mkdtempSync(join(tmpdir(), "olai-kolu-"))
  made.push(dir)
  const bin = join(dir, "kolu")
  writeFileSync(bin, contents)
  chmodSync(bin, 0o755)
  process.env["PATH"] = dir
  return bin
}

/**
 * What the probe has to ask for, spelled HERE rather than imported.
 *
 * These two strings are the guarantee this whole file exists to hold. A real
 * kolu completes `initialize`, lists all its tools and lists its resources with
 * no daemon behind it at all (juspay/kolu#2148) — only READING a cell the
 * daemon owns tells the two apart. So a probe quietly swapped to `tools/list`
 * would be worthless, and the fixtures below refuse to answer anything else:
 * taking these from `kolu.ts` would move with such a swap and go on passing,
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
 * this file cannot import it without `@olai/chat` depending on `@olai/tests`,
 * which is backwards. A substring watch is not a second framing implementation,
 * and it is enough to say what was asked for. The ID is the one thing taken
 * from the prober (an answer under a different id is not an answer, but WHICH
 * id is bookkeeping rather than the claim).
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

const detected = (): Promise<Detected> => Effect.runPromise(detect)

/** The server a session would be handed, which is what every case here used to
 *  assert on directly — the probe now answers with the REASON beside it. */
const server = async (): Promise<Server | null> => serverOf(await detected())

describe("detecting kolu", () => {
  test("a kolu whose padi answers is the session's server", async () => {
    const bin = koluOnPath(script(true))
    process.env["PADI_SOCKET"] = "/run/user/1000/padi-abc/padi.sock"

    expect(await server()).toEqual({
      name: "kolu",
      // The path that ANSWERED, absolute — not the word we looked up.
      command: bin,
      args: ["mcp"],
      env: { PADI_SOCKET: "/run/user/1000/padi-abc/padi.sock" },
    })
  })

  // The three ways of being no are three DIFFERENT answers now. They were one
  // silent `false` with the reason thrown away by a `catch`, which is what
  // left "kolu is not installed here" and "the kolu on your PATH is a build
  // that cannot do this" indistinguishable — the second being the one worth
  // saying out loud (juspay/kolu#2146).
  test("a kolu that reached no padi says which refusal that was", async () => {
    const bin = koluOnPath(script(false))

    const found = await detected()
    expect(found).toMatchObject({ _tag: "silent", kolu: bin })
    expect(found._tag === "silent" && found.why).toContain("padi transport down")
    expect(serverOf(found)).toBeNull()
  })

  test("a binary that is not kolu at all says it never answered", async () => {
    koluOnPath(`process.stdout.write("hello from something else\\n")\n`)

    const found = await detected()
    expect(found).toMatchObject({ _tag: "silent" })
    expect(serverOf(found)).toBeNull()
  })

  /**
   * The fourth sentence, and the one that had no case.
   *
   * A wedged server and a server that hung up reach the same closed pipe, and
   * the only thing that tells them apart is the `expired` flag the deadline
   * sets — exactly the sort of thing that rots into the wrong sentence with
   * every other test still green. It used to be untestable through `detect`
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
  // and says nothing is the wedge, and what happens then is the same `null`
  // every other refusal produces.

  // ...and this one is the arm that is NOT a reason: nothing went wrong on a
  // host that simply is not running kolu, so there is nothing to report about
  // it, which is exactly the distinction the single `null` could not make.
  test("no kolu on PATH is the ordinary case, not a failure", async () => {
    const dir = mkdtempSync(join(tmpdir(), "olai-kolu-"))
    made.push(dir)
    process.env["PATH"] = dir
    // Said rather than inherited: with the variable set this is a DIFFERENT
    // case (below), so a developer running this suite from inside a kolu
    // terminal must not get a different answer than CI does.
    delete process.env["PADI_SOCKET"]

    expect(await detected()).toEqual({ _tag: "none" })
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
    const dir = mkdtempSync(join(tmpdir(), "olai-kolu-"))
    made.push(dir)
    process.env["PATH"] = dir
    process.env["PADI_SOCKET"] = "/run/user/1000/padi-abc/padi.sock"

    const found = await detected()
    expect(found).toMatchObject({ _tag: "silent", kolu: null })
    // The variable is NAMED, because it is the thing that made this a fault
    // rather than an absence, and the thing a reader can go and look at.
    expect(found._tag === "silent" && found.why).toContain("PADI_SOCKET")
    // ... and there is no file to name, which is the finding itself.
    expect(missingFrom(found)).toMatchObject({ name: "kolu", where: null })
  })

  test("no PADI_SOCKET forwards nothing, and kolu resolves its own", async () => {
    koluOnPath(script(true))
    delete process.env["PADI_SOCKET"]

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
 * gave any, and a sentence about the file where it could not.
 *
 * The deadline still has no case, for the reason stated above: the only way to
 * exercise it is to spend it.
 */
describe("what a session that did not get kolu can be told", () => {
  const missing = async () => missingFrom(await detected())

  test("a refusal carries the words the server refused in", async () => {
    const bin = koluOnPath(script(false))

    expect(await missing()).toEqual({
      name: "kolu",
      where: bin,
      standing: "missing",
      why: "it refused to read the daemon's identity: padi transport down",
    })
  })

  test("a binary that hangs up says so, and names no refusal it never made", async () => {
    const bin = koluOnPath(`process.exit(0)\n`)

    expect(await missing()).toEqual({
      name: "kolu",
      where: bin,
      standing: "missing",
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
    expect(found).toMatchObject({ name: "kolu", where: bin })
    expect(found?.why).toStartWith("it could not be started:")
    // ... and NOT the fifth sentence. `talking to it failed: …` is what
    // `askOver` comes back with when our own write loses to a stdin the failed
    // exec destroyed, and it is what the un-raced version of this file said —
    // a fact about our end of a pipe, on a screen where the file's name
    // belongs. Asserting the sentence that must not appear is what makes this
    // case about the RACE rather than about the words that won it.
    expect(found?.why).not.toContain("stream was destroyed")
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
    const dir = mkdtempSync(join(tmpdir(), "olai-kolu-"))
    made.push(dir)
    process.env["PATH"] = dir
    // Explicit, and this is the line that caught it: the machine this was
    // written on IS running kolu, so the ambient variable was set and the
    // quiet case silently became the loud one. A claim about the ordinary
    // host has to say which host it means.
    delete process.env["PADI_SOCKET"]

    expect(await missing()).toBeNull()
  })

  // ... and the sentence a person gets when the environment says otherwise.
  // Its own case here as well as in `detect`'s block, because what is asserted
  // is the RENDERED fact — a name, no path, and a reason that names the
  // variable somebody can go and look at.
  test("a padi named with nothing to reach it says so, and names no file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "olai-kolu-"))
    made.push(dir)
    process.env["PATH"] = dir
    process.env["PADI_SOCKET"] = "/run/user/1000/padi-abc/padi.sock"

    expect(await missing()).toEqual({
      name: "kolu",
      where: null,
      standing: "missing",
      why: "PADI_SOCKET names a padi on this host, but no `kolu` is on the PATH "
        + "this server was started with — so there is nothing here to reach it through",
    })
  })
})

describe("what the session is handed", () => {
  const tools = { name: "olai", url: "http://127.0.0.1:7714/mcp", token: "secret" }
  const kolu: Server = {
    name: "kolu",
    command: "/nix/store/x/bin/kolu",
    args: ["mcp"],
    env: { PADI_SOCKET: "/run/padi.sock" },
  }

  test("kolu rides beside olai's own, as stdio beside http", () => {
    expect(mcpServersOf(tools, kolu)).toEqual([
      {
        type: "http",
        name: "olai",
        url: "http://127.0.0.1:7714/mcp",
        headers: [{ name: "Authorization", value: "Bearer secret" }],
      },
      {
        name: "kolu",
        command: "/nix/store/x/bin/kolu",
        args: ["mcp"],
        env: [{ name: "PADI_SOCKET", value: "/run/padi.sock" }],
      },
    ])
  })

  test("no kolu leaves the list exactly as it was", () => {
    expect(mcpServersOf(tools, null)).toHaveLength(1)
  })
})
