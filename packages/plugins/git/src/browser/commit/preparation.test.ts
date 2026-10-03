import { expect, test } from "bun:test"
import { preparation, prepareForRepository, submittedPreparation } from "./preparation.ts"

test("git restart preserves preparation, replacing the repository clears it", () => {
  const first = "/vault/first"
  const release = prepareForRepository(first)
  preparation.typed[1]("ready to commit")
  preparation.dropped[1](new Set(["one.md"]))
  release()
  const again = prepareForRepository(first)
  expect(preparation.typed[0]()).toBe("ready to commit")
  expect(preparation.dropped[0]().has("one.md")).toBe(true)
  again()
  const different = prepareForRepository("/vault/second")
  expect(preparation.typed[0]()).toBe(null)
  expect(preparation.dropped[0]().size).toBe(0)
  different()
})

test("an older successful commit cannot clear newer preparation", () => {
  const release = prepareForRepository("/vault/third")
  preparation.typed[1]("old")
  const done = submittedPreparation()
  preparation.typed[1]("new")
  done()
  expect(preparation.typed[0]()).toBe("new")
  release()
})
