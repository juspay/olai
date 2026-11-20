import { describe, expect, test } from "bun:test"

import { TREE } from "./tree.testlib.ts"

const packageOf = (file: string): string => {
  const parts = file.replace(/^packages\//, "").split("/")
  return parts[0] === "plugins" ? `plugins/${parts[1]}` : (parts[0] ?? "")
}

const byName = (left: readonly [string, unknown], right: readonly [string, unknown]): number =>
  left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0

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
