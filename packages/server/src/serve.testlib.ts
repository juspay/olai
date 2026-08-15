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

import { NodeHttpServer, NodeServices } from "@effect/platform-node"
import { Layer } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

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
