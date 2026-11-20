import { Effect, Fiber } from "effect"
import { expect, test } from "bun:test"

import { runLink } from "./link.ts"
import { startOduService, waitUntil } from "./testlib/index.ts"
import type { OduLink } from "./wire/index.ts"

const SINCE = "2026-09-12T00:00:00.000Z"

const bench = async (fleet: string) => {
  const odu = await startOduService(fleet)
  const links: Array<OduLink> = []
  const warned: Array<string> = []
  const fiber = Effect.runFork(
    runLink(
      {
        link: (state) => { links.push(state) },
        face: () => {},
        say: () => {},
        warn: (line) => { warned.push(line) },
      },
      { ODU_WEB_ORIGIN: odu.origin },
      () => SINCE,
    ),
  )
  const settled = async (status: OduLink["status"]): Promise<OduLink> => {
    await waitUntil(
      () => links.some((one) => one.status === status),
      `the link to say ${status}, and it said ${links.map((one) => one.status).join(", ") || "nothing"}`,
    )
    return links.filter((one) => one.status === status)[0] as OduLink
  }
  return {
    odu,
    links,
    warned,
    settled,
    stop: async () => {
      await Effect.runPromise(Fiber.interrupt(fiber))
      odu.stop()
    },
  }
}

test("a daemon serving the runs this build reads is adopted, quietly", async () => {
  const it = await bench("live")
  try {
    const link = await it.settled("connected")
    expect(link.origin).toBe(it.odu.origin)
    expect(link.refusal).toBeNull()
    expect(it.warned).toEqual([])
  } finally {
    await it.stop()
  }
})

test("a daemon whose runs moved a major is refused, in odu's own sentence", async () => {
  const it = await bench("skew")
  try {
    const link = await it.settled("skew")
    expect(link.refusal).toContain("99.0")
    expect(link.refusal).toContain(it.odu.origin)
    expect(it.warned).toContain(`olai: ${link.refusal}`)
    expect(it.links.some((one) => one.status === "connected")).toBe(false)
  } finally {
    await it.stop()
  }
})

test("a row this build never reads may move a major without locking olai out", async () => {
  const it = await bench("cache-ahead")
  try {
    const link = await it.settled("connected")
    expect(link.refusal).toBeNull()
    expect(it.warned).toEqual([])
  } finally {
    await it.stop()
  }
})

test("an interrupted dial does not wait out the ready deadline", async () => {
  const started = Date.now()
  const fiber = Effect.runFork(
    runLink(
      { link: () => {}, face: () => {}, say: () => {}, warn: () => {} },
      { ODU_WEB_ORIGIN: "http://127.0.0.1:1" },
      () => SINCE,
    ),
  )
  await Bun.sleep(30)
  await Effect.runPromise(Fiber.interrupt(fiber))
  expect(Date.now() - started).toBeLessThan(1000)
})
