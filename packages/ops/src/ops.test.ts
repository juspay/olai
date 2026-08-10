/**
 * The ops layer against a real directory: the planner, the write gate and the
 * file system, joined the way the server joins them.
 *
 * {@link ./plan.test.ts} already proves what each op DECIDES, so nothing here
 * re-asserts that. What is only true end to end is what these tests are for:
 * that the bytes on disk are what a reader can read back, that a write racing
 * another writer re-derives instead of losing, that git gets a commit with the
 * message the convention says, and that the MCP tool surface is the same ops
 * with a protocol in front.
 */

import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { NodeServices } from "@effect/platform-node"
import { type OutlineError, type OutlineSet, parseOutline } from "@olai/format"
import * as Store from "@olai/store"
import { describe, expect, test } from "bun:test"
import { Effect, Result, SubscriptionRef } from "effect"

import { codec } from "./codec.ts"
import * as Mcp from "./mcp.ts"
import * as Ops from "./ops.ts"
import type { Applied, Request } from "./request.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
  "",
].join("\n")

interface Fixture {
  readonly ops: Ops.Ops
  readonly store: Store.Store<OutlineSet, ReadonlyArray<OutlineError>>
  readonly root: string
  readonly read: (file: string) => string | null
  readonly write: (file: string, contents: string) => void
  /** The set as it stands, so a test can look at records rather than bytes. */
  readonly set: () => Effect.Effect<OutlineSet>
}

const withOps = <A>(
  files: Readonly<Record<string, string>>,
  use: (fixture: Fixture) => Effect.Effect<A, never>,
  options: { readonly git?: boolean } = {},
): Promise<A> => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-ops-")))
  const write = (file: string, contents: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), contents)
  }
  for (const [file, contents] of Object.entries(files)) write(file, contents)

  if (options.git === true) {
    const git = (...argv: ReadonlyArray<string>) =>
      execFileSync("git", argv, { cwd: root, stdio: "ignore" })
    git("init", "--quiet")
    git("config", "user.email", "test@olai.invalid")
    git("config", "user.name", "olai tests")
    git("add", "-A")
    git("commit", "--quiet", "-m", "fixtures")
  }

  return Effect.gen(function*() {
    const store = yield* Store.make({ root, codec, watch: false, settle: "10 millis" })
    let minted = 0
    const ops = Ops.make({
      store,
      root,
      commit: options.git === true,
      context: { mint: () => `n${++minted}`, today: () => "2026-08-09" },
    })
    return yield* use({
      ops,
      store,
      root,
      write,
      read: (file) => {
        const at = path.join(root, file)
        return fs.existsSync(at) ? fs.readFileSync(at, "utf8") : null
      },
      set: () =>
        Effect.map(SubscriptionRef.get(store.snapshot), (snapshot) => {
          if (snapshot === null) throw new Error("the fixture directory never loaded")
          return snapshot.value
        }),
    })
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.runPromise,
  ).finally(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })
}

/** Run an op, or fail the test with what it refused. */
const run = (
  fixture: Fixture,
  request: Request,
): Effect.Effect<Applied> =>
  Effect.catch(fixture.ops.run(request), (failure) =>
    Effect.die(
      new Error(`\`${request.op}\` was refused: ${failure._tag} — ${failure.message}`),
    ))

const gitLog = (root: string): ReadonlyArray<string> =>
  execFileSync("git", ["log", "--format=%s"], { cwd: root, encoding: "utf8" })
    .trim()
    .split("\n")

// ── the write path ─────────────────────────────────────────────────────

test("a mark lands on disk as bytes the parser reads back", () =>
  withOps({ "house.jsonl": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* run(fixture, { op: "done", id: "order" })
      expect(applied).toMatchObject({ id: "order", file: "house.jsonl", rev: 2 })

      const text = fixture.read("house.jsonl") ?? ""
      expect(text.endsWith("\n")).toBe(true)
      expect(text.split("\n").filter((line) => line !== "")).toHaveLength(4)

      const parsed = parseOutline("house.jsonl", text)
      expect(Result.isSuccess(parsed)).toBe(true)

      // And the browser sees it: the snapshot moved, without anyone probing.
      const set = yield* fixture.set()
      const order = set.nodes.find((located) => located.node.id === "order")
      expect(order?.node).toMatchObject({ done: "2026-08-09" })
    })))

test("archiving writes both files, and the set stays valid across them", () =>
  withOps({ "house.jsonl": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const applied = yield* run(fixture, { op: "archive", id: "order" })
      expect(applied.file).toBe("Archive.jsonl")

      expect(fixture.read("house.jsonl")).not.toContain(`"order"`)
      const archive = fixture.read("Archive.jsonl") ?? ""
      expect(archive).toContain(`"title":"Kitchen remodel"`)
      expect(archive).toContain(`"id":"order"`)

      // One revision for the pair, not two — the gate renamed both or neither.
      expect(applied.rev).toBe(2)
      const set = yield* fixture.set()
      expect([...set.files].sort()).toEqual(["Archive.jsonl", "house.jsonl"])
    })))

test("a refusal writes nothing and comes back with its structured detail", () =>
  withOps({ "house.jsonl": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      const failure = yield* Effect.orDie(
        Effect.flip(fixture.ops.run({ op: "done", id: "kitchen" })),
      )
      expect(failure._tag).toBe("DerivedFailure")
      expect(fixture.read("house.jsonl")).toBe(HOUSE)
      expect((yield* SubscriptionRef.get(fixture.store.snapshot))?.rev).toBe(1)
    })))

/**
 * The retry, seen from outside: the op is derived from revision 1, somebody
 * else's edit lands first, and the op still succeeds because "mark `order`
 * done" means the same thing against the newer set. A SUCCEEDING retry is
 * invisible by design — there is nothing in the answer that says it happened,
 * and that is what is being asserted.
 */
test("an edit that arrives mid-write is absorbed, not lost", () =>
  withOps({ "house.jsonl": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      // A second outline appears the way a `git pull` would put it there. The
      // store has not probed yet, so the op's first attempt is against a
      // revision the gate's own probe is about to overtake.
      fixture.write("notes.jsonl", `{"id":"idea","ord":"a0","title":"an idea"}\n`)

      const applied = yield* run(fixture, { op: "done", id: "order" })
      const set = yield* fixture.set()
      expect([...set.files].sort()).toEqual(["house.jsonl", "notes.jsonl"])
      expect(
        set.nodes.find((located) => located.node.id === "order")?.node,
      ).toMatchObject({ done: "2026-08-09" })
      // The pulled file is still there: the write re-derived rather than
      // re-sending bytes computed from a set that no longer existed.
      expect(fixture.read("notes.jsonl")).toContain("an idea")
      expect(applied.committed).toBe(false)
    })))

test("concurrent ops all land, each re-derived from the set the last one left", () =>
  withOps({ "house.jsonl": HOUSE }, (fixture) =>
    Effect.gen(function*() {
      yield* Effect.all(
        [
          run(fixture, { op: "done", id: "order" }),
          run(fixture, { op: "add", parent: "kitchen", title: "paint" }),
          run(fixture, { op: "title", id: "install", title: "install the cabinets" }),
        ],
        { concurrency: 3 },
      )

      const set = yield* fixture.set()
      const byId = new Map(set.nodes.map((located) => [located.node.id, located.node]))
      expect(byId.get("order")).toMatchObject({ done: "2026-08-09" })
      expect(byId.get("install")).toMatchObject({ title: "install the cabinets" })
      expect([...byId.values()].some((node) => "title" in node && node.title === "paint"))
        .toBe(true)
    })))

// ── git ────────────────────────────────────────────────────────────────

describe("the auto-commit", () => {
  test("commits each write with racket's message convention", () =>
    withOps({ "house.jsonl": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        expect((yield* run(fixture, { op: "done", id: "order" })).committed).toBe(true)
        expect((yield* run(fixture, { op: "add", parent: "kitchen", title: "paint" }))
          .committed).toBe(true)
        expect((yield* run(fixture, { op: "archive", id: "install" })).committed).toBe(true)

        expect(gitLog(fixture.root).slice(0, 3)).toEqual([
          "archive: install them",
          "capture: paint",
          "done: order the cabinets",
        ])
        // Both files of the archive landed in ONE commit.
        expect(
          execFileSync("git", ["show", "--name-only", "--format=", "HEAD"], {
            cwd: fixture.root,
            encoding: "utf8",
          }).trim().split("\n").sort(),
        ).toEqual(["Archive.jsonl", "house.jsonl"])
      }), { git: true }))

  test("a directory that is not a work tree is written anyway, and says so", () =>
    withOps({ "house.jsonl": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        // `commit: true`, but there is no repository here.
        const ops = Ops.make({ store: fixture.store, root: fixture.root, commit: true })
        const applied = yield* Effect.orDie(ops.run({ op: "done", id: "order" }))
        expect(applied.committed).toBe(false)
        expect(fixture.read("house.jsonl")).toContain(`"done"`)
      })))

  test("the opt-out writes without committing", () =>
    withOps({ "house.jsonl": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const ops = Ops.make({ store: fixture.store, root: fixture.root, commit: false })
        expect((yield* Effect.orDie(ops.run({ op: "done", id: "order" }))).committed)
          .toBe(false)
        expect(gitLog(fixture.root)).toEqual(["fixtures"])
      }), { git: true }))
})

// ── the MCP tool surface ───────────────────────────────────────────────

describe("the internal MCP server", () => {
  const withMcp = <A>(
    use: (
      call: (method: string, params?: unknown) => Effect.Effect<Record<string, unknown>>,
      fixture: Fixture,
      refusals: Array<string>,
    ) => Effect.Effect<A, never>,
  ) =>
    withOps({ "house.jsonl": HOUSE }, (fixture) => {
      const refusals: Array<string> = []
      const server = Mcp.make({
        ops: fixture.ops,
        store: fixture.store,
        onRefusal: (tool, failure) =>
          Effect.sync(() => {
            refusals.push(`${tool}: ${failure._tag}`)
          }),
      })
      let id = 0
      const call = (method: string, params?: unknown) =>
        Effect.map(
          server.handle({ jsonrpc: "2.0", id: ++id, method, params }),
          (reply) => {
            if (reply === null) throw new Error(`\`${method}\` answered nothing`)
            return reply as Record<string, unknown>
          },
        )
      return use(call, fixture, refusals)
    })

  const resultOf = (reply: Record<string, unknown>): Record<string, unknown> => {
    if ("error" in reply) throw new Error(`JSON-RPC error: ${JSON.stringify(reply["error"])}`)
    return reply["result"] as Record<string, unknown>
  }

  const structured = (reply: Record<string, unknown>): Record<string, unknown> =>
    resultOf(reply)["structuredContent"] as Record<string, unknown>

  test("initialize answers a protocol version and a tools capability", () =>
    withMcp((call) =>
      Effect.gen(function*() {
        const answer = resultOf(yield* call("initialize", { protocolVersion: "2025-06-18" }))
        expect(answer["protocolVersion"]).toBe("2025-06-18")
        expect(answer["capabilities"]).toMatchObject({ tools: {} })
      })))

  test("a notification is not answered", () =>
    withOps({ "house.jsonl": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const server = Mcp.make({ ops: fixture.ops, store: fixture.store })
        expect(yield* server.handle({ jsonrpc: "2.0", method: "notifications/initialized" }))
          .toBeNull()
      })))

  test("the tool list is reads and writes, and no file access at all", () =>
    withMcp((call) =>
      Effect.gen(function*() {
        const tools = resultOf(yield* call("tools/list"))["tools"] as ReadonlyArray<
          { name: string; inputSchema: { properties: Record<string, unknown> } }
        >
        // The whole surface, spelled out — because what is NOT here is the
        // design: no file read, no file write, no shell, no grep.
        expect(tools.map((tool) => tool.name).sort()).toEqual([
          "add_node",
          "archive_node",
          "list_outlines",
          "move_node",
          "read_node",
          "read_subtree",
          "search_nodes",
          "set_date",
          "set_desc",
          "set_doing",
          "set_done",
          "set_title",
        ])

        // The discriminator the tool NAME already decides is not a field the
        // agent has to fill in.
        const done = tools.find((tool) => tool.name === "set_done")
        expect(Object.keys(done?.inputSchema.properties ?? {})).toEqual(["id", "undo"])
      })))

  test("a read answers over parsed nodes, with file:line and derived status", () =>
    withMcp((call) =>
      Effect.gen(function*() {
        const hits = structured(
          yield* call("tools/call", {
            name: "search_nodes",
            arguments: { text: "cabinets" },
          }),
        )
        expect(hits["total"]).toBe(1)
        expect((hits["hits"] as ReadonlyArray<unknown>)[0]).toMatchObject({
          id: "order",
          file: "house.jsonl",
          line: 3,
          status: "open",
          path: ["Kitchen remodel"],
        })

        // The parent's status is DERIVED — it is not in the file, and this is
        // the only way an agent can learn it.
        const kitchen = structured(
          yield* call("tools/call", { name: "read_node", arguments: { id: "kitchen" } }),
        )
        expect(kitchen["status"]).toBe("doing")
      })))

  test("a write through a tool changes the directory", () =>
    withMcp((call, fixture) =>
      Effect.gen(function*() {
        const answer = structured(
          yield* call("tools/call", { name: "set_done", arguments: { id: "order" } }),
        )
        expect(answer).toMatchObject({ did: "set_done", id: "order" })
        expect(fixture.read("house.jsonl")).toContain(`"done":"2026-08-09"`)
      })))

  /**
   * The refusal, all the way through: the agent gets an `isError` result whose
   * structured half carries the unfinished children, and whoever is watching
   * gets told so the panel can draw them. Two audiences, one refusal, no prose
   * to parse on either side.
   */
  test("a refused write is an isError result with the children as data", () =>
    withMcp((call, fixture, refusals) =>
      Effect.gen(function*() {
        const reply = resultOf(
          yield* call("tools/call", { name: "set_done", arguments: { id: "kitchen" } }),
        )
        expect(reply["isError"]).toBe(true)
        const detail = reply["structuredContent"] as Record<string, unknown>
        expect(detail["kind"]).toBe("derived")
        expect(detail["children"]).toEqual([
          { id: "order", title: "order the cabinets", status: "open" },
          { id: "install", title: "install them", status: "open" },
        ])
        expect(refusals).toEqual(["set_done: DerivedFailure"])
        expect(fixture.read("house.jsonl")).toBe(HOUSE)
      })))

  test("arguments that do not fit the tool are refused before any planning", () =>
    withMcp((call, fixture) =>
      Effect.gen(function*() {
        const reply = resultOf(
          yield* call("tools/call", { name: "set_done", arguments: { nope: 1 } }),
        )
        expect(reply["isError"]).toBe(true)
        expect(fixture.read("house.jsonl")).toBe(HOUSE)
      })))

  test("a tool that does not exist is a JSON-RPC error, not a refusal", () =>
    withMcp((call) =>
      Effect.gen(function*() {
        const reply = yield* call("tools/call", { name: "read_file", arguments: {} })
        expect(reply["error"]).toMatchObject({ code: -32602 })
      })))
})
