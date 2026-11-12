/**
 * WHERE THE AGENT CLIENT PROTOCOL ENTERS THIS TREE, held as two equalities.
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
 *     name it. `./wire` is the vocabulary a conversation travels in, and the
 *     main entry is the projections over the protocol's payloads; both are
 *     `olai-plugin-chat`'s alone, because it is the package that runs the
 *     subprocess. A plugin growing an import of the main entry is a plugin
 *     reading protocol payloads nobody handed it.
 *   - **Where the SDK RUNS.** `@agentclientprotocol/sdk` imports zod at runtime
 *     (it is a declared peer), and zod is the one validator this tree does not
 *     own. A type-only import erases, so it costs nothing and is left alone;
 *     a RUNTIME import is the protocol's transport, and there may be exactly
 *     one package holding it. The reading is the walk's own — `importsOf`
 *     elides an erased import — so the claim cannot be dodged by spelling.
 *
 * Both are EQUALITIES rather than allow-lists: a package that stops importing
 * is as red as one that starts, because a table nobody has to maintain is a
 * table that stops describing the tree.
 */

import { describe, expect, test } from "bun:test"

import { TREE } from "./tree.testlib.ts"

/** `packages/plugins/chat/src/agent.ts` → `plugins/chat`; `packages/server/…`
 *  → `server`. The tenants nest, so the first segment is not the answer. */
const packageOf = (file: string): string => {
  const parts = file.replace(/^packages\//, "").split("/")
  return parts[0] === "plugins" ? `plugins/${parts[1]}` : (parts[0] ?? "")
}

const byName = (left: readonly [string, unknown], right: readonly [string, unknown]): number =>
  left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0

describe("the protocol enters this tree where the table says", () => {
  test("every package, and which half of @kolu/acp it names", () => {
    const found = new Map<string, Set<string>>()
    for (const source of TREE.sources) {
      if (source.grammar === "css") continue
      for (const spec of TREE.specifiersOf(source.file)) {
        if (spec !== "@kolu/acp" && !spec.startsWith("@kolu/acp/")) continue
        const pkg = packageOf(source.file)
        const held = found.get(pkg) ?? new Set<string>()
        held.add(spec)
        found.set(pkg, held)
      }
    }
    const table = Object.fromEntries([...found].sort(byName).map(([pkg, specs]) => [pkg, [...specs].sort()]))
    expect(table).toEqual({
      "plugin-api": ["@kolu/acp/engine"],
      "plugins/chat": ["@kolu/acp", "@kolu/acp/engine", "@kolu/acp/wire"],
      "plugins/claude": ["@kolu/acp/engine"],
      "plugins/codex": ["@kolu/acp/engine"],
      "plugins/omp": ["@kolu/acp/engine"],
      "plugins/opencode": ["@kolu/acp/engine"],
      "plugins/pi": ["@kolu/acp/engine"],
      server: ["@kolu/acp/engine"],
    })
  })

  test("the SDK runs in one package, and a type-only reach is not running it", () => {
    const running = new Set<string>()
    for (const source of TREE.sources) {
      if (source.grammar === "css") continue
      for (const edge of TREE.importsOf(source.file)) {
        if (!edge.spec.startsWith("@agentclientprotocol/sdk")) continue
        running.add(packageOf(source.file))
      }
    }
    expect([...running].sort()).toEqual(["plugins/chat"])
  })
})
