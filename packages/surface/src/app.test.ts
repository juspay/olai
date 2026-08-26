import { expect, test } from "bun:test"

import { appName } from "./app.ts"

// The one shape every face of the app draws — brackets, because the word and
// the box are two things a reader must not confuse ("olai desk" reads as one
// long name; `olai [desk]` reads as the app, on desk).
test("the app names itself with the machine in brackets", () => {
  expect(appName("desk")).toBe("olai [desk]")
})
