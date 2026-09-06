import { expect, test } from "bun:test"
import { createRoot, onCleanup } from "solid-js"
import { createKoluUi, type KoluClient } from "./KoluUi.tsx"

test("one Kolu activation shares its five subscriptions and releases them before a fresh activation", () => {
  let acquired = 0
  let active = 0
  const use = () => {
    acquired++
    active++
    onCleanup(() => {active--})
    return {value:()=>undefined,fold:()=>()=>undefined}
  }
  const client = {cells:{link:{use},pulse:{use},knobs:{use}},collections:{fleet:{use},events:{use}},procedures:{screen:{text:()=>{}}},streams:{terminal:{unenrolled:()=>{}}}} as unknown as KoluClient
  const first = createRoot(dispose => ({dispose,value:createKoluUi({client,now:()=>1})}))
  const left = first.value
  const right = first.value
  expect(left).toBe(right)
  expect(left.terminals().size).toBe(0)
  expect([acquired,active]).toEqual([5,5])
  first.dispose()
  expect(active).toBe(0)
  const second = createRoot(dispose => ({dispose,value:createKoluUi({client,now:()=>2})}))
  expect(second.value).not.toBe(first.value)
  expect([acquired,active]).toEqual([10,5])
  second.dispose()
  expect(active).toBe(0)
})
