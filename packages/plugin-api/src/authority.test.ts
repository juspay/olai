import { expect, test } from "bun:test"
import { Effect, Stream } from "effect"
import { authorityAt, RequestAuthority } from "./authority.ts"

test("concurrent callers carry independent authority outside untrusted input", async () => {
  const read = () => Effect.succeed("read")
  const write = () => Effect.andThen(Effect.yieldNow, RequestAuthority)
  const stream = () => Stream.fromEffect(RequestAuthority)
  const bound = { handlers: { read, write, stream }, writes: ["write", "stream"] }
  const alice = authorityAt(bound, { writer: "alice", rule: "session-a" })
  const bob = authorityAt(bound, { writer: "bob", rule: "session-b" })
  expect(alice.read).toBe(read)
  expect(bob.read).toBe(read)
  const forged = { writer: "admin", rule: undefined }
  const results = await Promise.all([
    Effect.runPromise(alice.write!(forged) as Effect.Effect<unknown>),
    Effect.runPromise(bob.write!(forged) as Effect.Effect<unknown>),
    Effect.runPromise(Stream.runCollect(alice.stream!(forged) as Stream.Stream<unknown>)),
  ])
  expect(results).toEqual([
    { writer: "alice", rule: "session-a" },
    { writer: "bob", rule: "session-b" },
    [{ writer: "alice", rule: "session-a" }],
  ])
  expect(await Effect.runPromise(RequestAuthority)).toEqual({ writer: "web" })
})
