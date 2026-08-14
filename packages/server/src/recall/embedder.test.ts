/**
 * How an embedder is FOUND — the half of {@link ./embedder.ts} that runs
 * without a model server.
 *
 * Nothing here spawns anything, and that is the point twice over: detection is
 * supposed to be paths rather than a probe (the whole reason the feature could
 * come back), and a unit lane must not start a llama-server. What the real
 * embedder does once it is found is proved end to end by the e2e suite against
 * the packaged binary, which is the only build that has one.
 */

import { NodeServices } from "@effect/platform-node"
import { expect, test } from "bun:test"
import { Effect, FileSystem, Path, type Scope } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { detectPackaged, MODEL_ENV_VAR, SERVER_ENV_VAR, sweepOrphans } from "./embedder.ts"

const run = <A>(
  effect: Effect.Effect<A, never, Scope.Scope | FileSystem.FileSystem | Path.Path>,
): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

/** Set the two variables for the length of one call, and put back exactly what
 *  was there — including "was not set at all", which is a third state. */
const withEnv = async <A>(
  env: Readonly<Record<string, string | undefined>>,
  body: () => Promise<A>,
): Promise<A> => {
  const before = new Map(
    Object.keys(env).map((name) => [name, process.env[name]] as const),
  )
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  try {
    return await body()
  } finally {
    for (const [name, value] of before) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

/** A temp directory of this test's own, thrown away at the end of it. */
const scratch = (prefix: string): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), prefix))

test("no baked paths means no embedder — `null`, which is how a source checkout runs", async () => {
  const found = await withEnv(
    { [SERVER_ENV_VAR]: undefined, [MODEL_ENV_VAR]: undefined },
    () => run(detectPackaged("/tmp/served")),
  )
  expect(found).toBeNull()
})

test("the empty string is the deliberate off switch, on either half", async () => {
  // `makeWrapper --set-default` emits `${VAR-default}`, which substitutes only
  // when the variable is UNSET — so an empty value is somebody saying no, and
  // it has to mean no here too (scripts/embedder.sh argues the same rule).
  for (const env of [
    { [SERVER_ENV_VAR]: "", [MODEL_ENV_VAR]: "/nowhere/model.gguf" },
    { [SERVER_ENV_VAR]: "/nowhere/llama-server", [MODEL_ENV_VAR]: "" },
  ]) {
    expect(await withEnv(env, () => run(detectPackaged("/tmp/served")))).toBeNull()
  }
})

test("a baked path that does not exist is `null` too — said out loud, but still not an error", async () => {
  const found = await withEnv(
    {
      [SERVER_ENV_VAR]: "/nowhere/llama-server",
      [MODEL_ENV_VAR]: "/nowhere/model.gguf",
    },
    () => run(detectPackaged("/tmp/served")),
  )
  expect(found).toBeNull()
})

test("both paths present: an embedder is returned, and NOTHING has been spawned", async () => {
  // The laziness is the property under test. `detectPackaged` may not start a
  // model server — a serve whose cache is warm and whose reader never searches
  // by meaning is entitled to pay nothing — so two files that are not a
  // llama-server and not a model are enough to be found.
  const dir = scratch("olai-embedder-")
  const server = path.join(dir, "llama-server")
  const model = path.join(dir, "bge-small-en-v1.5-q8_0.gguf")
  fs.writeFileSync(server, "#!/bin/sh\nexit 1\n", { mode: 0o755 })
  fs.writeFileSync(model, "not a model")
  try {
    const found = await withEnv(
      { [SERVER_ENV_VAR]: server, [MODEL_ENV_VAR]: model },
      () => run(detectPackaged(path.join(dir, "served"))),
    )
    expect(found).not.toBeNull()
    // The id names the VECTOR SPACE, which is what the cache is stamped with:
    // the model's file name, plus a digest of its path so two store paths with
    // the same basename are two spaces.
    expect(found?.id).toStartWith("llama-cpp/bge-small-en-v1.5-q8_0.gguf#")
    // And it declares the floor of that space. Pinned to the measurement
    // rather than to "some number": the junk ceiling observed on this model
    // was 0.599, so a floor that drifted under it would start letting a bread
    // recipe answer a question about page loads.
    expect(found?.floor).toBe(0.62)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

// ── reaping what a `kill -9` left behind ───────────────────────────────

/** The sweep needs the FileSystem and Path services the caller already holds,
 *  so a test hands it the same ones the server does. */
const sweepIn = (dir: string): Promise<void> =>
  withEnv({ XDG_RUNTIME_DIR: dir }, () =>
    Effect.runPromise(
      Effect.gen(function*() {
        yield* sweepOrphans(yield* FileSystem.FileSystem, yield* Path.Path)
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    ))



test("a dead olai's leftovers are cleared away", async () => {
  const dir = scratch("olai-sweep-")
  const socket = path.join(dir, "olai-embed-deadbeefdeadbeef.sock")
  fs.writeFileSync(socket, "")
  // A pid that cannot be alive, so the owner is unambiguously gone. Nothing is
  // listening on that socket either, so nothing is signalled — only the two
  // files go.
  fs.writeFileSync(`${socket}.owner`, "2147483646\n2147483645\n")
  try {
    await sweepIn(dir)
    expect(fs.existsSync(socket)).toBe(false)
    expect(fs.existsSync(`${socket}.owner`)).toBe(false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("a LIVING olai's embedder is never touched — a sibling serve is not a leftover", async () => {
  // The guard that matters: two olai processes may serve two directories at
  // once, and a sweep that reaped by socket name alone would kill the other
  // one's model server halfway through somebody's search.
  const dir = scratch("olai-sweep-")
  const socket = path.join(dir, "olai-embed-0123456789abcdef.sock")
  fs.writeFileSync(socket, "")
  fs.writeFileSync(`${socket}.owner`, `${process.pid}\n${process.pid}\n`)
  try {
    await sweepIn(dir)
    expect(fs.existsSync(socket)).toBe(true)
    expect(fs.existsSync(`${socket}.owner`)).toBe(true)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test("the sweep reads only its own leavings", async () => {
  const dir = scratch("olai-sweep-")
  const stranger = path.join(dir, "something-else.sock")
  fs.writeFileSync(stranger, "")
  fs.writeFileSync(`${stranger}.owner`, "2147483646\n2147483645\n")
  try {
    await sweepIn(dir)
    expect(fs.existsSync(stranger)).toBe(true)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
