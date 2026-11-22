/**
 * WHAT A DECODE TELLS THE SERVER'S LOG reaches it as lines: a text the parser
 * threw on, named by file and text with what it threw, and a slow file, named
 * with how long it took. The codec's half — that it calls these — is
 * `@olai/ops`'s `codec.test.ts`.
 */
import { expect, test } from "bun:test"

import { emitter } from "@olai/log"
import { collector } from "@olai/log/testlib"
import { SLOW_DECODE_MS } from "@olai/ops"
import { Effect } from "effect"

import { heardBy } from "./heard.ts"

test("a text the parser threw on and a slow file are each a log line naming the file", async () => {
  const log = collector()
  await Effect.runPromise(Effect.gen(function*() {
    const heard = heardBy(yield* emitter)
    heard.unread("notes/porch.md", { where: "prose", refusal: { kind: "failed", cause: new Error("a wikilink token holds no wikilink") } })
    heard.unread("house.olai", { where: "kitchen title", refusal: { kind: "depth" } })
    heard.slow("notes/garden.md", 812.4)
    // The emitter forks each line; let them run.
    yield* Effect.sleep("10 millis")
  }).pipe(Effect.provide(log.layer)))

  expect(log.said.map((line) => [line.level, line.annotations["file"], line.annotations["text"] ?? null])).toEqual([
    ["Error", "notes/porch.md", "prose"],
    ["Error", "house.olai", "kitchen title"],
    ["Warn", "notes/garden.md", null],
  ])
  expect(log.said[0]?.message).toContain("failed on a text")
  expect(String(log.said[0]?.annotations["cause"])).toContain("a wikilink token holds no wikilink")
  expect(log.said[1]?.message).toContain("ran out of stack")
  expect(log.said[1]?.annotations["cause"]).toBeUndefined()
  expect([log.said[2]?.message, log.said[2]?.annotations["ms"]]).toEqual([
    "a file was slow to read; the server answered nobody while it was read",
    812,
  ])
  expect(heardBy(() => undefined).slowAfter).toBe(SLOW_DECODE_MS)
})
