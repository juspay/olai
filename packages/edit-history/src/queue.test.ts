import { expect, test } from "bun:test"

import { serial } from "./queue.ts"

const counting = (underKey: boolean) => {
  let open = 0
  return {
    open: () => open,
    counter: {
      held: () => {
        if (!underKey) return undefined
        open += 1
        let dropped = false
        return () => {
          if (dropped) return
          dropped = true
          open -= 1
        }
      },
    },
  }
}

const settled = async () => {
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve()
}

test("each step waits for the one before it, however it ended", async () => {
  const said: Array<string> = []
  const enqueue = serial()

  enqueue(async () => {
    await Promise.resolve()
    said.push("first")
  })
  enqueue(() => {
    said.push("threw")
    throw new Error("refused")
  })
  enqueue(() => {
    said.push("after the throw")
  })

  await settled()
  expect(said).toEqual(["first", "threw", "after the throw"])
})

test("a key's step is counted from the moment it is enqueued", async () => {
  const { open, counter } = counting(true)
  const enqueue = serial(counter)

  let land = () => {}
  const first = new Promise<void>((ok) => (land = ok))
  enqueue(() => first)
  enqueue(async () => {})
  expect(open()).toBe(2)

  await settled()
  expect(open()).toBe(2)

  land()
  await settled()
  expect(open()).toBe(0)
})

test("a step that was REFUSED lets go, and so does one that threw", async () => {
  const { open, counter } = counting(true)
  const enqueue = serial(counter)

  enqueue(() => Promise.reject(new Error("the wire went")))
  enqueue(() => {
    throw new Error("a bug in a step")
  })
  expect(open()).toBe(2)

  await settled()
  expect(open()).toBe(0)
})

test("a pointer's write goes on the same queue and is counted by nobody", async () => {
  const { open, counter } = counting(false)
  const enqueue = serial(counter)

  enqueue(async () => {})
  expect(open()).toBe(0)
  await settled()
  expect(open()).toBe(0)
})
