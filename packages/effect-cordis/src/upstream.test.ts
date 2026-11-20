import { expect, test } from "bun:test"
import { Context } from "cordis"

const held = (): { readonly wait: Promise<void>; readonly let: () => void } => {
  const { promise, resolve } = Promise.withResolvers<void>()
  return { wait: promise, let: () => { resolve() } }
}

test("the pinned runtime unloads a fiber's disposers concurrently", async () => {
  const order: Array<string> = []
  const waiting = held()
  const ctx = new Context()
  await ctx.plugin({
    name: "two-effects",
    apply: (inner: Context) => {
      inner.effect(() => () => { order.push("the resource released") })
      inner.effect(() => async () => {
        order.push("the waiting disposer entered")
        await waiting.wait
        order.push("the waiting disposer left")
      })
    },
  })
  const unloading = ctx.fiber.dispose()
  await new Promise((resume) => { setTimeout(resume, 20) })
  expect(order).toContain("the waiting disposer entered")
  expect(order).toContain("the resource released")
  expect(order).not.toContain("the waiting disposer left")
  waiting.let()
  await unloading
  expect(order).toContain("the waiting disposer left")
})

test("a provision's disposer is one the pinned runtime pushes into that set", () => {
  const ctx = new Context()
  const before = [...ctx.fiber._disposables]
  const revoke = ctx.provide("a-toy-service", () => ({}))
  const after = [...ctx.fiber._disposables]
  expect(after).toHaveLength(before.length + 1)
  expect(after.includes(revoke as unknown as (typeof after)[number])).toBe(true)
})
