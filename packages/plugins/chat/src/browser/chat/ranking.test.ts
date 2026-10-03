import { expect, test } from "bun:test"
import { createRanking } from "./ranking.ts"

test("the newest candidate follows appends, answers, reorders and removals", () => {
  const ranked = createRanking<string>()
  const entries = new Map<string, { seq: number; position: number; value: string }>()
  const check = () => expect(ranked.top()).toBe([...entries.values()].sort((a, b) => b.seq - a.seq || b.position - a.position)[0]?.value)
  const put = (key: string, seq: number, position: number) => {
    entries.set(key, { seq, position, value: key })
    ranked.put(key, seq, position, key)
    check()
  }
  const drop = (key: string) => { entries.delete(key); ranked.drop(key); check() }
  for (let i = 0; i < 100; i++) put(String(i), i % 7, i)
  for (let i = 0; i < 100; i += 3) put(String(i), i % 11, 100 - i)
  for (let i = 0; i < 100; i += 2) drop(String(i))
  for (let i = 99; i >= 0; i--) drop(String(i))
})
