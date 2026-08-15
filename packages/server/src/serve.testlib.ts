/**
 * What it takes to stand a real server up in a test, spelled once.
 *
 * Three tests in this package start `serve` against a real port —
 * `serve.test.ts` (what an operator is told at boot), `listener.test.ts` (what
 * the listener says about a socket) — and each needs the same two things
 * first: the platform layers the static route and the CLI's own services come
 * from, and a directory with something valid in it to serve. Neither is a
 * fixture with a decision in it; both are "the setup a real server needs", and
 * that is one fact, not one per test file.
 *
 * The precedent is `./child.testlib.ts`, which exists because its question was
 * written twice and the two copies had already drifted onto different events.
 * These two were written twice as well. This is that fix, taken before the
 * drift rather than after it.
 *
 * What is deliberately NOT here is each test's own deadline. `shutdown.test.ts`
 * bounds how long a shutdown may take before it is a hang; `listener.test.ts`
 * bounds how long a socket may go unanswered before it is a refusal. They are
 * the same number today and they are not the same question, so they stay where
 * the sentence explaining each of them is.
 */

import { collector, type Logged } from "@olai/log/testlib"
import { NodeHttpServer, NodeServices } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { serve } from "./serve.ts"

/** The platform a real server needs: the CLI's own services (stdio, terminal,
 *  file system) and the static layer's (the file-response platform and ETags)
 *  — the same pair `main.ts` provides, so a test runs the stack the binary
 *  does. */
export const SERVER_LAYERS = Layer.mergeAll(
  NodeServices.layer,
  NodeHttpServer.layerHttpServices,
)

/** A directory with one valid outline in it, thrown away with the test. Also
 *  stands in for a built client bundle where a test only needs the entry point
 *  not to refuse to start. */
export const served = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-served-"))
  fs.writeFileSync(path.join(root, "a.olai"), `{"id":"a","ord":"a0","title":"a"}\n`)
  return root
}

/**
 * A real `serve` on an OS-chosen port, for the length of `body`, and everything
 * it said.
 *
 * The block this replaces was written four times in this package, and it is
 * exactly the fact this module's header
 * says it exists to hold: the platform layers, a directory with something in
 * it, and the `Effect.scoped` + `runPromise` frame around them are "the setup a
 * real server needs", which is one fact rather than one per test file.
 *
 * `said` is handed to the body because half of what a real server does is only
 * observable there — the URL it bound, the socket it announced — and a test
 * that had to reach into a second collector for that would be composing this
 * helper with the thing it was extracted from.
 *
 * `Logger.layer([])` is NOT the default: a test that asserts on nothing a
 * server said still wants the lines off its terminal, and a test that asserts
 * on them wants the collector. Both are ordinary `Layer`s, so the caller says
 * which, and neither is a flag.
 */
export const withServe = async <A>(
  options: {
    readonly root: string
    /** How writes reach git. `off` unless a test is ABOUT committing — a temp
     *  directory is not a repository, and the tests that do not care should not
     *  spawn git to find that out. */
    readonly commits?: "off" | "manual" | "auto"
  },
  body: (said: ReadonlyArray<Logged>) => Promise<A>,
): Promise<A> => {
  const { layer, said } = collector()
  return Effect.gen(function*() {
    yield* serve({
      root: options.root,
      port: 0,
      host: "127.0.0.1",
      // A directory that exists is all the entry point asks of a bundle it is
      // never going to serve a page out of.
      clientDist: served(),
      allowedOrigins: [],
      commits: options.commits ?? "off",
    })
    return yield* Effect.promise(() => body(said))
  }).pipe(
    Effect.scoped,
    Effect.provide(SERVER_LAYERS),
    Effect.provide(layer),
    Effect.runPromise,
  )
}
