import { expect, test } from "bun:test"
import { Effect, Stream } from "effect"
import { authorityAt, RequestAuthority } from "./authority.ts"

test("concurrent callers carry independent authority outside untrusted input", async () => {
  const read = () => Effect.succeed("read")
  const write = () => Effect.andThen(Effect.yieldNow, RequestAuthority)
  const stream = () => Stream.fromEffect(RequestAuthority)
  const bound = { handlers: { read, write, stream }, writes: ["write", "stream"] }
  const alice = { writer: "chat-agent", rule: { _tag: "closed" } } as const
  const bob = { writer: "mcp", rule: { _tag: "open", forbidden: new Map() } } as const
  const asAlice = authorityAt(bound, alice)
  const asBob = authorityAt(bound, bob)
  expect(asAlice.read).toBe(read)
  expect(asBob.read).toBe(read)
  const forged = { writer: "admin", rule: undefined }
  const results = await Promise.all([
    Effect.runPromise(asAlice.write!(forged) as Effect.Effect<unknown>),
    Effect.runPromise(asBob.write!(forged) as Effect.Effect<unknown>),
    Effect.runPromise(Stream.runCollect(asAlice.stream!(forged) as Stream.Stream<unknown>)),
  ])
  expect(results).toEqual([alice, bob, [alice]])
  expect(await Effect.runPromise(RequestAuthority)).toEqual({ writer: "web" })
})
