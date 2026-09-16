import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect, Schema } from "effect"
import { openMailbox } from "./mailbox.ts"
import { makeTools } from "./tools.ts"
import { mailAnswer } from "./appliance/testlib/fake-himalaya.ts"
import { MAIL_UNCONNECTED, MailRefusal, type Account } from "./wire.ts"
import type { Himalaya, Run } from "./himalaya/run.ts"

export const connected: Account = { ...MAIL_UNCONNECTED, status: "connected", address: "you@gmail.com", reason: null }
export const harness = <A>(use: (h: {
  call: (name: string, args?: unknown) => Effect.Effect<unknown, unknown>
  calls: Run[]
  state: (next: Account, live?: boolean) => void
  root: string
}) => Effect.Effect<A, unknown>, stale = false) => Effect.scoped(Effect.gen(function*() {
  const root = yield* Effect.acquireRelease(Effect.promise(() => mkdtemp(join(tmpdir(), "mail-test-"))), root => Effect.promise(() => rm(root, { recursive: true, force: true })))
  let state = connected
  let live = true
  const calls: Run[] = []
  const runner: Himalaya = {
    binary: "/fake", useToken: () => Effect.void, close: async () => {},
    run: call => Effect.sync(() => { calls.push(call); return mailAnswer(call.verb, call.args ?? [], root, stale) }).pipe(Effect.flatMap(answer => answer.code ? Effect.fail(new MailRefusal({ reason: JSON.parse(answer.stdout).error })) : Effect.succeed(JSON.parse(answer.stdout)))),
  }
  const tools = yield* makeTools(yield* openMailbox(runner, { current: () => state, usable: () => live }, root))
  return yield* use({
    root, calls, state: (next, usable = next.status === "connected") => { state = next; live = usable },
    call: (name, args = {}) => {
      const tool = tools.find(t => t.name === name)
      if (!tool || tool.kind !== "surface") throw new Error(`no tool ${name}`)
      return Schema.decodeUnknownEffect(tool.schema as unknown as Schema.Codec<unknown>)(args).pipe(Effect.flatMap(args => tool.call(undefined as never, args as never)))
    },
  })
}))
