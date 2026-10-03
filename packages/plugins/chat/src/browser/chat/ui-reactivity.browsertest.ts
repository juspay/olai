import { expect, test } from "bun:test"
import { createEffect, createRoot } from "solid-js"
import { createFolds } from "./folds.ts"
import { createMessageDraft, createMessageMemory } from "./message-draft.ts"

test("opening one tool detail does not notify other tool rows", () => {
  const counts = [0, 0, 0]
  const owned = createRoot(dispose => {
    const folds = createFolds()
    for (let i = 0; i < 3; i++) createEffect(() => { folds.isUnfolded(String(i)); counts[i]!++ })
    return { ...folds, dispose }
  })
  expect(counts).toEqual([1, 1, 1])
  owned.toggleFold("1")
  expect(counts).toEqual([1, 2, 1])
  owned.dispose()
})

test("caret movement does not notify readers of unsent words", () => {
  let textReads = 0
  const owned = createRoot(dispose => {
    const draft = createMessageDraft(() => "session", createMessageMemory())
    createEffect(() => { draft.draft(); textReads++ })
    return { ...draft, dispose }
  })
  owned.setDraft("words")
  const before = textReads
  owned.setCaret(2)
  owned.setDismissed("completion")
  expect(textReads).toBe(before)
  expect(owned.draft()).toBe("words")
  owned.dispose()
})
