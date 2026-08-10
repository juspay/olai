/**
 * The framing, and nothing else.
 *
 * The dispatch behind it has its own tests (`@olai/ops`'s `ops.test.ts` drives
 * the same `handle` against a real directory), so the server here is a stub
 * that says what it was asked. What is left is what a transport is: where one
 * message ends and the next begins, and what happens at the two edges — a line
 * that is not a message, and a pipe that has gone away.
 *
 * A chunk boundary is deliberately NOT a message boundary in these fixtures.
 * Three messages arriving in one read and one message arriving in three is the
 * ordinary behaviour of a pipe, and a transport that only ever saw whole lines
 * in tests is a transport whose buffer has never been exercised.
 */

import { expect, test } from "bun:test"
import { Effect } from "effect"

import { pump } from "./stdio.ts"

/** The bytes a client would have written, cut wherever the caller says. */
const piped = (chunks: ReadonlyArray<string>): AsyncIterable<Uint8Array> => ({
  async *[Symbol.asyncIterator]() {
    for (const chunk of chunks) yield new TextEncoder().encode(chunk)
  },
})

/** A server that answers every request by echoing its method back, and
 *  answers a notification — no `id` — with silence, as the dispatch does. */
const echo = {
  handle: (message: unknown) =>
    Effect.succeed(
      (message as { id?: unknown; method?: unknown }).id === undefined
        ? null
        : {
          jsonrpc: "2.0",
          id: (message as { id: unknown }).id,
          result: { said: (message as { method: unknown }).method },
        },
    ),
}

/** Run the transport over those chunks and collect what came out, exactly as
 *  it was written — frames, not parsed messages, because the newline IS the
 *  thing under test. */
const spoken = (
  chunks: ReadonlyArray<string>,
  options: { readonly write?: (frame: string) => void } = {},
): Promise<ReadonlyArray<string>> => {
  const written: Array<string> = []
  return Effect.runPromise(
    pump({
      server: echo,
      input: piped(chunks),
      write: (frame) => {
        written.push(frame)
        options.write?.(frame)
      },
    }),
  ).then(() => written)
}

test("messages are answered whatever the chunks did to them", async () => {
  const written = await spoken([
    // Two whole messages in one read…
    `{"jsonrpc":"2.0","id":1,"method":"one"}\n{"jsonrpc":"2.0","id":2,"method":"two"}\n`,
    // …and a third split across three, the last one carrying its newline.
    `{"jsonrpc":"2.0",`,
    `"id":3,"method":"th`,
    `ree"}\n`,
  ])

  expect(written.map((frame) => JSON.parse(frame).result.said)).toEqual([
    "one",
    "two",
    "three",
  ])
})

test("every frame is exactly one line", async () => {
  // The reply carries a newline INSIDE a string, which is the case that would
  // break a client's parser if `JSON.stringify` did not escape it — a refusal
  // message is prose, and prose has newlines in it.
  const written = await spoken([`{"jsonrpc":"2.0","id":1,"method":"a\\nb"}\n`])

  expect(written).toHaveLength(1)
  expect(written[0]).toEndWith("\n")
  expect(written[0]!.slice(0, -1)).not.toInclude("\n")
  expect(JSON.parse(written[0]!).result.said).toBe("a\nb")
})

test("a notification is answered with silence", async () => {
  const written = await spoken([
    `{"jsonrpc":"2.0","method":"notifications/initialized"}\n`,
    `{"jsonrpc":"2.0","id":1,"method":"ping"}\n`,
  ])

  // One frame, and it is the answer to the request — not to the notification
  // before it, which would have been a frame with no id for the client to
  // match.
  expect(written).toHaveLength(1)
  expect(JSON.parse(written[0]!).id).toBe(1)
})

test("blank lines are framing, not messages", async () => {
  const written = await spoken(["\n", "\r\n", `{"jsonrpc":"2.0","id":1,"method":"ping"}\n`])

  expect(written).toHaveLength(1)
})

test("a line that is not JSON is a parse error, not a crash", async () => {
  const written = await spoken([
    "half a message\n",
    `{"jsonrpc":"2.0","id":1,"method":"ping"}\n`,
  ])

  // It answers -32700 with a null id — the id was inside the thing that would
  // not parse — and then goes on serving, which is the half that matters: one
  // bad line does not end the conversation.
  expect(JSON.parse(written[0]!)).toEqual({
    jsonrpc: "2.0",
    id: null,
    error: { code: -32700, message: "the line is not JSON" },
  })
  expect(JSON.parse(written[1]!).id).toBe(1)
})

test("a client that stopped reading ends the conversation", async () => {
  // A pipe whose far end is gone throws EPIPE on write. There is nowhere to
  // report that — the only channels we have are the client's own — so it ends
  // the pump rather than dying: the process shuts down through its scope
  // finalizers, releasing the store's watcher, instead of on a defect.
  const written = await spoken(
    [
      `{"jsonrpc":"2.0","id":1,"method":"ping"}\n`,
      `{"jsonrpc":"2.0","id":2,"method":"ping"}\n`,
    ],
    {
      write: () => {
        throw new Error("EPIPE: broken pipe, write")
      },
    },
  )

  // It stopped at the first write rather than trying the second.
  expect(written).toHaveLength(1)
})
