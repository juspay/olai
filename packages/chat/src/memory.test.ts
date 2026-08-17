/**
 * What the panel remembers about which conversation is its own.
 *
 * The bug this is the test for: a restart adopted the newest session in the
 * served directory, so anything that touched a session more recently than you
 * did — a terminal `claude`, a `/clear` sibling, a stale timestamp — took the
 * panel over. Remembering costs one small file, and the three things a small
 * file has to get right are here: it comes back, it belongs to ONE directory,
 * and every way it can fail says so rather than reading as "nothing was
 * remembered".
 *
 * `XDG_STATE_HOME` is pointed at a temp directory per test, which is also the
 * assertion that the variable is honoured at all: a memory written to the
 * developer's own `~/.local/state` while these run would pass every line below
 * and pollute their machine.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { Effect, Result } from "effect"
import { chmodSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { forDirectory, type Held } from "./memory.ts"

let state = ""
const was = process.env["XDG_STATE_HOME"]

beforeEach(() => {
  state = mkdtempSync(join(tmpdir(), "olai-memory-"))
  process.env["XDG_STATE_HOME"] = state
})

afterEach(() => {
  if (was === undefined) delete process.env["XDG_STATE_HOME"]
  else process.env["XDG_STATE_HOME"] = was
  rmSync(state, { recursive: true, force: true })
})

/** Where a memory lands, spelled once for every test that looks in it. */
const home = (): string => join(state, "olai", "chat")

/** What is in there, whatever the files are called — and nothing, before
 *  anything has been remembered at all. */
const files = (): ReadonlyArray<string> => {
  try {
    return readdirSync(home())
  } catch {
    return []
  }
}

/** The one file that has been written, by name. Throws when there is none,
 *  which is the honest failure for a test that is about to damage it: writing
 *  some other file instead would pass for the wrong reason. */
const only = (): string => {
  const [name, ...rest] = files()
  if (name === undefined || rest.length > 0) {
    throw new Error(`expected exactly one memory in ${home()}, found ${files().length}`)
  }
  return join(home(), name)
}

/** Run one, and answer with the value or the refusal — the same shape
 *  `attachments.test.ts` reads its own verbs through. */
const outcome = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.result(effect))

const HERE = "/tmp/olai-somewhere"
const ELSEWHERE = "/tmp/olai-somewhere-else"

/** A conversation with nothing said about its model, which is what ENTERING one
 *  writes: the model is learned afterwards, from the agent, or never. */
const IN = (session: string): Held => ({ session, model: null })

describe("the panel's own conversation, across a restart", () => {
  test("a directory that has never been served remembers nothing", async () => {
    const memory = forDirectory(HERE)
    expect(await Effect.runPromise(memory.recall)).toBe(null)
  })

  test("what was entered is what comes back", async () => {
    await Effect.runPromise(forDirectory(HERE).remember(IN("session-a")))
    // A SECOND memory over the same directory: the point is the disk, not the
    // closure — the next boot is a different process.
    expect(await Effect.runPromise(forDirectory(HERE).recall)).toEqual(IN("session-a"))
  })

  test("the last conversation entered is the one remembered", async () => {
    const memory = forDirectory(HERE)
    await Effect.runPromise(memory.remember(IN("session-a")))
    await Effect.runPromise(memory.remember(IN("session-b")))
    expect(await Effect.runPromise(forDirectory(HERE).recall)).toEqual(IN("session-b"))
  })

  test("a trailing slash is the same directory, not a second one", async () => {
    await Effect.runPromise(forDirectory(HERE).remember(IN("session-a")))
    expect(await Effect.runPromise(forDirectory(`${HERE}/`).recall)).toEqual(IN("session-a"))
    // ... and one file rather than two, which is the fact behind it.
    expect(files().length).toBe(1)
  })

  test("another directory's panel is not this one's", async () => {
    await Effect.runPromise(forDirectory(HERE).remember(IN("session-a")))
    expect(await Effect.runPromise(forDirectory(ELSEWHERE).recall)).toBe(null)
  })

  test("nothing is written under the served directory", async () => {
    const served = mkdtempSync(join(tmpdir(), "olai-served-"))
    try {
      await Effect.runPromise(forDirectory(served).remember(IN("session-a")))
      // The served directory is somebody's outline set — the store probes it
      // and a commit would commit it. The memory goes to the state home.
      expect(readdirSync(served)).toEqual([])
      expect(files().length).toBe(1)
    } finally {
      rmSync(served, { recursive: true, force: true })
    }
  })
})

describe("the model that conversation was on", () => {
  // The bug (`chat-model-reverts-on-restart`): a `/model` chosen in the panel
  // did not survive a restart, because the agent's own boot re-asserts a
  // container's `settings.json` pin over the conversation's own model. Putting
  // it back is `agent.ts`'s (`restore`); HAVING it to put back is this file's,
  // and it is the half a restart cannot fake — the process is gone, and what is
  // on disk is the whole of what the next one knows.

  test("the model comes back with the conversation it was on", async () => {
    await Effect.runPromise(
      forDirectory(HERE).remember({ session: "session-a", model: "claude-fable-5" }),
    )
    expect(await Effect.runPromise(forDirectory(HERE).recall)).toEqual({
      session: "session-a",
      model: "claude-fable-5",
    })
  })

  test("a conversation entered says nothing about a model", async () => {
    // Which is not the same as saying it is on the default: it is the panel
    // having heard nothing yet, and the agent's own answer standing.
    await Effect.runPromise(
      forDirectory(HERE).remember({ session: "session-a", model: "claude-fable-5" }),
    )
    await Effect.runPromise(forDirectory(HERE).remember(IN("session-b")))
    expect(await Effect.runPromise(forDirectory(HERE).recall)).toEqual(IN("session-b"))
  })

  test("a memory written before olai remembered models still opens", async () => {
    // The file olai 0.1 wrote, and the shape every state directory in the world
    // has right now: a conversation and no model. It must read as "nothing says
    // which model" rather than as damage — the conversation is the load-bearing
    // half and it is right there.
    await Effect.runPromise(forDirectory(HERE).remember(IN("session-a")))
    writeFileSync(only(), `{"cwd":"${HERE}","session":"session-a"}\n`)
    expect(await Effect.runPromise(forDirectory(HERE).recall)).toEqual(IN("session-a"))
  })

  test("a model that is not a name is nothing said, not a refusal", async () => {
    // The lenient half of the read, and the reason for it: a strange `model`
    // costs a restart on the agent's own model, while refusing the whole file
    // over one would cost the conversation too.
    await Effect.runPromise(forDirectory(HERE).remember(IN("session-a")))
    writeFileSync(only(), `{"cwd":"${HERE}","session":"session-a","model":7}\n`)
    expect(await Effect.runPromise(forDirectory(HERE).recall)).toEqual(IN("session-a"))
  })
})

describe("a memory that cannot be trusted", () => {
  /** The one file that was written, with something else in it. */
  const damage = (text: string): void => {
    writeFileSync(only(), text)
  }

  test("a file that is not JSON is a reason, not a shrug", async () => {
    await Effect.runPromise(forDirectory(HERE).remember(IN("session-a")))
    damage("{ half a fi")
    const answer = await outcome(forDirectory(HERE).recall)
    expect(Result.isFailure(answer)).toBe(true)
    if (!Result.isFailure(answer)) return
    // The path, because that is the thing somebody can go and look at.
    expect(answer.failure.why).toContain(state)
  })

  test("JSON that names no conversation is a reason too", async () => {
    await Effect.runPromise(forDirectory(HERE).remember(IN("session-a")))
    damage(`{"cwd":"${HERE}"}`)
    expect(Result.isFailure(await outcome(forDirectory(HERE).recall))).toBe(true)
  })

  test("a note about another directory is not this panel's memory", async () => {
    // The `cwd` inside the file is what makes a state directory readable, and
    // it is read back as a guard: whatever put this file here, it is not about
    // us, so the honest answer is that nothing says — never a refusal, and
    // never somebody else's conversation.
    await Effect.runPromise(forDirectory(HERE).remember(IN("session-a")))
    damage(`{"cwd":"${ELSEWHERE}","session":"session-b"}`)
    expect(await Effect.runPromise(forDirectory(HERE).recall)).toBe(null)
  })

  test("a state directory that will not take a write refuses out loud", async () => {
    // Refusing is the whole point: the panel goes on working, and a person is
    // told their conversation will not come back. Root can write into a 0500
    // directory, so the assertion is skipped there rather than inverted.
    if (typeof process.getuid === "function" && process.getuid() === 0) return
    chmodSync(state, 0o500)
    try {
      expect(Result.isFailure(await outcome(forDirectory(HERE).remember(IN("session-a")))))
        .toBe(true)
    } finally {
      chmodSync(state, 0o700)
    }
  })
})
