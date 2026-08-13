/**
 * The one thing about the embedder that is worth pinning: WHEN THIS PROCESS
 * IS ALLOWED TO DIAL.
 *
 * There is no test of `detectOllama` itself — a test of "is there an Ollama
 * on this machine" is a test of the machine — and that absence is the point
 * of the seam. What IS tested is the resolution in front of it, because the
 * brief's rule (and kolu-ci-1's) is that no test or CI path reaches a live
 * model, and a probe that merely tends to find nothing does not make that
 * rule true: it makes it depend on whether whoever ran the suite happens to
 * have a model server up.
 *
 * `fetch` is replaced for the duration of each test, so these prove the wiring
 * without any network either way — including the one that proves the switch is
 * LOAD-BEARING, which has to show a dial happening when the switch is off.
 */

import { expect, test } from "bun:test"
import { Effect } from "effect"

import { EMBED_ENV, EMBED_OFF, embedderFrom } from "./embedder.ts"

/** Run `use` with `fetch` replaced by something that records and refuses, so
 *  a dial is observable and can never leave this process. */
const withoutNetwork = async <A>(
  use: (dialled: ReadonlyArray<string>) => Promise<A>,
): Promise<A> => {
  const dialled: Array<string> = []
  const real = globalThis.fetch
  globalThis.fetch = ((input: string | URL | Request) => {
    dialled.push(String(input))
    return Promise.reject(new Error("no network in a unit test"))
  }) as typeof fetch
  try {
    return await use(dialled)
  } finally {
    globalThis.fetch = real
  }
}

test("PIN: the test lane itself is switched off — the preload said so", () => {
  // `scripts/bun-test-preload.ts` sets this for EVERY test in the workspace,
  // which is what keeps `serve.test.ts` and `mcp/serve.test.ts` — real
  // composition roots, real boots — from probing. If that line is ever
  // dropped, this is what says so, rather than a suite that quietly starts
  // behaving differently on a machine with a model pulled.
  expect(process.env[EMBED_ENV]).toBe(EMBED_OFF)
})

test("PIN: with the switch off, resolution answers `null` and never dials", async () => {
  await withoutNetwork(async (dialled) => {
    const embedder = await Effect.runPromise(
      embedderFrom({ [EMBED_ENV]: EMBED_OFF, OLLAMA_HOST: "127.0.0.1:11434" }),
    )
    expect(embedder).toBeNull()
    // The whole claim, in one assertion: not "the probe found nothing", but
    // "no request left this process".
    expect(dialled).toEqual([])
  })
})

test("the switch is load-bearing: unset, resolution DOES probe the host", async () => {
  // Without this, the pin above would pass just as happily if `embedderFrom`
  // had been broken to answer `null` unconditionally — and the feature would
  // be off for everybody with every test still green.
  await withoutNetwork(async (dialled) => {
    const embedder = await Effect.runPromise(
      embedderFrom({ OLLAMA_HOST: "127.0.0.1:65535" }),
    )
    // The dial was refused by the stub, so detection answers its ordinary
    // "nothing here" — but it HAPPENED, at the address the env named.
    expect(embedder).toBeNull()
    expect(dialled).toEqual(["http://127.0.0.1:65535/api/tags"])
  })
})

test("anything other than `off` is not off — a typo cannot disable a feature", async () => {
  await withoutNetwork(async (dialled) => {
    await Effect.runPromise(
      embedderFrom({ [EMBED_ENV]: "OFF ", OLLAMA_HOST: "127.0.0.1:65535" }),
    )
    expect(dialled).toHaveLength(1)
  })
})
