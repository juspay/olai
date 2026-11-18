/**
 * WHERE THE AGENT CLIENT PROTOCOL ENTERS THIS TREE, held as three equalities.
 *
 * The protocol's VOCABULARY is not olai's any more: `@kolu/acp` owns the ask,
 * diff, usage and terminal words, the pure projections over ACP's own payloads
 * and the engine registration, because the package that speaks a foreign thing
 * owns its words and kolu seats an ACP conversation of its own. olai hydrates
 * it from the kolu pin (`nix/kolu.nix` seeds it), so it arrives in the root
 * `node_modules` where every package can reach it whether it declared it or
 * not — which is precisely why the reach has to be written down.
 *
 * The table used to live in `packages/acp/src/manifest.test.ts` and it left
 * with the package. What it asserted about KOLU's side is kolu's to keep; what
 * it asserted about OLAI's side is here, because the two claims are different
 * and only one of them is about this repository:
 *
 *   - **Who may import which half.** `./engine` is the engine wall — a `Leg`,
 *     an `Adapter` probe, an install sentence — so an engine plugin, the plugin
 *     API that declares the `Agents` tag and the serve that composes them all
 *     name it. `./wire` is the vocabulary a conversation travels in, and it is
 *     `olai-plugin-chat`'s alone. The main entry, the projections over the
 *     protocol's payloads, is named by nobody here any more: the package that
 *     reads payloads is `@kolu/acp-client`, hydrated from the same pin. A
 *     plugin growing an import of the main entry is a plugin reading protocol
 *     payloads nobody handed it.
 *   - **Where the SDK RUNS.** `@agentclientprotocol/sdk` imports zod at runtime
 *     (it is a declared peer), and zod is the one validator this tree does not
 *     own. A type-only import erases, so it costs nothing and is left alone;
 *     a RUNTIME import is the protocol's transport, and there is exactly one
 *     package holding it: `@kolu/acp-client`, which is kolu's. So no package in
 *     this tree runs it, and the one that holds conversations on the client —
 *     chat — is the one that may reach the client. The reading is the walk's
 *     own — `importsOf` elides an erased import — so the claim cannot be
 *     dodged by spelling.
 *   - **And where the CONVERSATION is run.** `@kolu/acp-harness` is one
 *     conversation on that client — the turns, the rows and the bodies held
 *     for one nobody is in — so it is chat's alone for the client's own
 *     reason: a second package reaching it would be a second conversation with
 *     a subprocess under it. It has ONE entry on purpose, so the only
 *     specifier a package can name is the package.
 *
 * All three are EQUALITIES rather than allow-lists: a package that stops importing
 * is as red as one that starts, because a table nobody has to maintain is a
 * table that stops describing the tree.
 */

import { describe, expect, test } from "bun:test"

import { TREE } from "./tree.testlib.ts"

/** `packages/plugins/chat/src/chat.ts` → `plugins/chat`; `packages/server/…`
 *  → `server`. The tenants nest, so the first segment is not the answer. */
const packageOf = (file: string): string => {
  const parts = file.replace(/^packages\//, "").split("/")
  return parts[0] === "plugins" ? `plugins/${parts[1]}` : (parts[0] ?? "")
}

const byName = (left: readonly [string, unknown], right: readonly [string, unknown]): number =>
  left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0

/**
 * ONE WALK, AT MODULE SCOPE, for the same reason `fence.test.ts` builds its
 * door there: the reading is a parse of every source file in the repository,
 * and a whole-tree parse on a TEST's clock is a test that fails for being slow
 * on a loaded machine rather than for being wrong. (It did: 11.7s against the
 * 5s default, on a CI box running two shards and an e2e leg beside them.) Here
 * it is import cost, which bun does not time out, and both claims below are
 * comparisons of two tables.
 *
 * The two questions are different enough to keep apart — WHICH HALF a package
 * names, and WHERE THE SDK RUNS — but they are one walk over one tree, so they
 * are gathered together and asserted separately.
 */
const reach = (() => {
  const halves = new Map<string, Set<string>>()
  const client = new Map<string, Set<string>>()
  const harness = new Map<string, Set<string>>()
  const running = new Set<string>()
  const note = (into: Map<string, Set<string>>, pkg: string, spec: string): void => {
    const held = into.get(pkg) ?? new Set<string>()
    held.add(spec)
    into.set(pkg, held)
  }
  for (const source of TREE.sources) {
    if (source.grammar === "css") continue
    const pkg = packageOf(source.file)
    for (const spec of TREE.specifiersOf(source.file)) {
      if (spec === "@kolu/acp" || spec.startsWith("@kolu/acp/")) note(halves, pkg, spec)
      if (spec === "@kolu/acp-client" || spec.startsWith("@kolu/acp-client/")) note(client, pkg, spec)
      if (spec === "@kolu/acp-harness" || spec.startsWith("@kolu/acp-harness/")) note(harness, pkg, spec)
    }
    for (const edge of TREE.importsOf(source.file)) {
      if (edge.spec.startsWith("@agentclientprotocol/sdk")) running.add(pkg)
    }
  }
  const table = (from: Map<string, Set<string>>) =>
    Object.fromEntries([...from].sort(byName).map(([pkg, specs]) => [pkg, [...specs].sort()]))
  return {
    halves: table(halves),
    client: table(client),
    harness: table(harness),
    running: [...running].sort(),
  }
})()

describe("the protocol enters this tree where the table says", () => {
  test("every package, and which half of @kolu/acp it names", () => {
    expect(reach.halves).toEqual({
      "plugin-api": ["@kolu/acp/engine"],
      "plugins/chat": ["@kolu/acp/engine", "@kolu/acp/wire"],
      "plugins/claude": ["@kolu/acp/engine"],
      "plugins/codex": ["@kolu/acp/engine"],
      "plugins/omp": ["@kolu/acp/engine"],
      "plugins/opencode": ["@kolu/acp/engine"],
      "plugins/pi": ["@kolu/acp/engine"],
      server: ["@kolu/acp/engine"],
    })
  })

  test("the SDK runs in no package here, and only chat reaches the client that runs it", () => {
    expect(reach.running).toEqual([])
    expect(reach.client).toEqual({
      "plugins/chat": ["@kolu/acp-client", "@kolu/acp-client/testlib"],
    })
  })

  test("... and only chat holds a conversation on it", () => {
    expect(reach.harness).toEqual({
      "plugins/chat": ["@kolu/acp-harness"],
    })
  })
})
