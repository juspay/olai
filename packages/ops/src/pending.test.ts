/**
 * The manual commit path, against a real repository and a real store.
 *
 * `changes.test.ts` proves what the comparison DECIDES and `message.test.ts`
 * what it is called; nothing here re-asserts either. What is only true end to
 * end is what this file is for:
 *
 *   - that a write lands on disk and WAITS — the whole point of the change;
 *   - that what is waiting is derived from git rather than counted, so an edit
 *     made behind olai's back is in it and a commit made behind olai's back
 *     takes it away;
 *   - that a busy repository refuses instead of committing into a conflict,
 *     which is the hole this feature was built to close;
 *   - that only the served outlines are ever staged.
 */

import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { NodeServices } from "@effect/platform-node"
import type { OutlineError, OutlineSet } from "@olai/format"
import * as Store from "@olai/store"
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"

import { codec } from "./codec.ts"
import { gitIn, repoAt } from "./fixtures.testlib.ts"
import * as Mcp from "./mcp.ts"
import * as Ops from "./ops.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
  "",
].join("\n")

interface Fixture {
  readonly ops: Ops.Ops
  readonly root: string
  readonly git: (...argv: ReadonlyArray<string>) => string
  readonly write: (file: string, contents: string) => void
  /** Re-read the directory, so a change made behind olai's back is part of the
   *  revision the next question is answered against. */
  readonly refresh: Effect.Effect<void>
}

const withRepo = <A>(
  files: Readonly<Record<string, string>>,
  use: (fixture: Fixture) => Effect.Effect<A, never>,
  options: { readonly commits?: "off" | "manual" | "auto" } = {},
): Promise<A> => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-pending-")))
  const write = (file: string, contents: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), contents)
  }
  for (const [file, contents] of Object.entries(files)) write(file, contents)

  const git = gitIn(root)
  repoAt(root)

  return Effect.gen(function*() {
    const store: Store.Store<OutlineSet, ReadonlyArray<OutlineError>> = yield* Store.make({
      root,
      codec,
      watch: false,
      settle: "10 millis",
    })
    const ops = Ops.make({
      store,
      root,
      commits: options.commits ?? "manual",
      context: { mint: () => "minted", today: () => "2026-08-10" },
    })
    return yield* use({ ops, root, git, write, refresh: Effect.orDie(store.refresh) })
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.runPromise,
  ).finally(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })
}

const subjects = (fixture: Fixture): ReadonlyArray<string> =>
  fixture.git("log", "--format=%s").trim().split("\n")

describe("manual is the default", () => {
  test("a write lands on disk and waits, and says what is waiting", () =>
    withRepo({ "house.jsonl": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const applied = yield* Effect.orDie(
          fixture.ops.run({ op: "done", id: "order" }, "chat-agent"),
        )
        // Nothing committed itself, and the op says so rather than claiming a
        // commit that did not happen.
        expect(applied.committed).toBe(false)
        expect(subjects(fixture)).toEqual(["fixtures"])

        const pending = yield* fixture.ops.pending
        expect(pending.repo).toEqual({ _tag: "Ready", branch: "main" })
        expect(pending.changes).toEqual([
          {
            file: "house.jsonl",
            id: "order",
            title: "order the cabinets",
            fields: ["done"],
            sort: "done",
          },
        ])
        // Who asked is a decoration on that, and it is the one thing here that
        // is remembered rather than derived.
        expect(pending.wrote).toEqual([{ writer: "chat-agent", ops: 1 }])
        expect(pending.message).toStartWith("olai: 1 edit to house — order done")
      })))

  test("committing records it, signs it, and empties what was waiting", () =>
    withRepo({ "house.jsonl": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "chat-agent"))
        yield* Effect.orDie(
          fixture.ops.run({ op: "add", parent: "kitchen", title: "paint" }, "chat-agent"),
        )

        const result = yield* fixture.ops.commit(
          { message: "reconcile the kitchen" },
          "chat-agent",
        )
        expect(result._tag).toBe("Committed")
        expect(result._tag === "Committed" ? result.changes : 0).toBe(2)

        expect(subjects(fixture)[0]).toBe("olai: reconcile the kitchen")
        expect(
          fixture.git("log", "--format=%(trailers:key=X-Olai-Writer,valueonly)", "-1").trim(),
        ).toBe("chat-agent")

        const after = yield* fixture.ops.pending
        expect(after.changes).toEqual([])
        expect(after.wrote).toEqual([])
      })))

  test("what was last recorded is answered beside what is waiting", () =>
    withRepo({ "house.jsonl": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        // NEVER, which is not the same as "nothing waiting" and cannot be
        // derived from it: a directory olai has never committed in and one it
        // committed a second ago both have an empty pending list.
        expect((yield* fixture.ops.pending).last).toBe(null)

        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "chat-agent"))
        yield* fixture.ops.commit({ message: "the cabinets are ordered" }, "chat-agent")

        const after = yield* fixture.ops.pending
        expect(after.changes).toEqual([])
        expect(after.last).toMatchObject({
          message: "olai: the cabinets are ordered",
          writer: "chat-agent",
        })

        // A person's own commit on top does not become olai's: the audit view
        // is what this reports on, not the repository's HEAD.
        fixture.write("notes.md", "mine\n")
        fixture.git("add", "-A")
        fixture.git("commit", "--quiet", "-m", "mine, by hand")
        expect((yield* fixture.ops.pending).last).toMatchObject({
          message: "olai: the cabinets are ordered",
        })
      })))

  test("a second commit with nothing waiting is an answer, not a commit", () =>
    withRepo({ "house.jsonl": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        expect((yield* fixture.ops.commit({}, "web"))._tag).toBe("NothingToCommit")
        expect(subjects(fixture)).toEqual(["fixtures"])
      })))

  test("an edit made behind olai's back is pending too, and is swept up", () =>
    withRepo({ "house.jsonl": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        // Somebody in vim. Nothing told olai; the probe found it, and the
        // comparison is against HEAD rather than against anything olai
        // remembers doing.
        fixture.write("house.jsonl", HOUSE.replace("install them", "install the cabinets"))
        yield* fixture.refresh

        const pending = yield* fixture.ops.pending
        expect(pending.changes).toEqual([
          {
            file: "house.jsonl",
            id: "install",
            title: "install the cabinets",
            fields: ["title"],
            sort: "renamed",
          },
        ])
        // And nobody claims to have written it: the counter knows only about
        // ops, which is exactly why it may never be the source of truth.
        expect(pending.wrote).toEqual([])

        expect((yield* fixture.ops.commit({}, "web"))._tag).toBe("Committed")
        expect(yield* fixture.ops.pending).toMatchObject({ changes: [] })
      })))

  test("a commit made in a terminal empties it, with no write in between", () =>
    withRepo({ "house.jsonl": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        expect((yield* fixture.ops.pending).changes).toHaveLength(1)

        fixture.git("commit", "--quiet", "-am", "by hand")
        // No refresh, no write, nothing on the wire: the answer is git's, so
        // asking again is all it takes.
        expect((yield* fixture.ops.pending).changes).toEqual([])
      })))
})

describe("what is committed, and what is not", () => {
  test("only the served outlines — never the other work in the tree", () =>
    withRepo({ "house.jsonl": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        fixture.write("notes.md", "a document, which olai never writes\n")
        fixture.write("script.sh", "somebody else's work\n")
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        yield* fixture.refresh

        expect((yield* fixture.ops.commit({}, "web"))._tag).toBe("Committed")
        // Both untouched files are still untracked, and the outline is in.
        expect(fixture.git("status", "--porcelain").trim().split("\n").sort())
          .toEqual(["?? notes.md", "?? script.sh"])
      })))

  test("an unreadable outline is listed rather than dropped", () =>
    withRepo({ "house.jsonl": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        fixture.write("house.jsonl", "this is not a record\n")
        yield* fixture.refresh

        const pending = yield* fixture.ops.pending
        expect(pending.unreadable).toEqual(["house.jsonl"])
        // Nothing is claimed about what changed in it — the alternative would
        // be reporting every node in it as gone.
        expect(pending.changes).toEqual([])
      })))
})

describe("a repository that cannot take a commit", () => {
  test("says so instead of committing into a conflict", () =>
    withRepo({ "house.jsonl": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        fixture.git("checkout", "--quiet", "-b", "other")
        fixture.write("house.jsonl", HOUSE.replace("install them", "other"))
        fixture.git("commit", "--quiet", "-am", "other")
        fixture.git("checkout", "--quiet", "main")
        fixture.write("house.jsonl", HOUSE.replace("install them", "main"))
        fixture.git("commit", "--quiet", "-am", "main")
        try {
          fixture.git("merge", "other")
        } catch {
          // Expected: the merge conflicts, which is the state under test.
        }
        yield* fixture.refresh

        const result = yield* fixture.ops.commit({}, "web")
        expect(result._tag).toBe("Blocked")
        expect(result._tag === "Blocked" ? result.repo._tag : "").toBe("Blocked")
        // An agent marking a node done mid-conflict used to swallow the
        // resolution; now the resolution is still there to be finished.
        expect(subjects(fixture)[0]).not.toStartWith("olai:")
      })))
})

describe("the agent's door", () => {
  test("`commit` is a tool, and its trailer says which agent asked", () =>
    withRepo({ "house.jsonl": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        const server = Mcp.make({ ops: fixture.ops, writer: "mcp" })
        const call = (name: string, args: Readonly<Record<string, unknown>>) =>
          Effect.map(
            server.handle({
              jsonrpc: "2.0",
              id: 1,
              method: "tools/call",
              params: { name, arguments: args },
            }),
            (reply) =>
              (reply as { result: Record<string, unknown> }).result,
          )

        yield* call("set_done", { id: "order" })
        const answered = yield* call("commit", {
          message: "order the cabinets, at last",
        })
        expect(answered["isError"]).toBeUndefined()
        expect(answered["structuredContent"]).toMatchObject({ _tag: "Committed" })

        expect(subjects(fixture)[0]).toBe("olai: order the cabinets, at last")
        expect(
          fixture.git("log", "--format=%(trailers:key=X-Olai-Writer,valueonly)", "-1").trim(),
        ).toBe("mcp")
      })))
})

describe("--commit=off", () => {
  test("has nothing to say at all", () =>
    withRepo({ "house.jsonl": HOUSE }, (fixture) =>
      Effect.gen(function*() {
        yield* Effect.orDie(fixture.ops.run({ op: "done", id: "order" }, "web"))
        const pending = yield* fixture.ops.pending
        expect(pending.repo).toEqual({ _tag: "Off" })
        expect(pending.changes).toEqual([])
        expect((yield* fixture.ops.commit({}, "web"))._tag).toBe("Blocked")
      }), { commits: "off" }))
})
