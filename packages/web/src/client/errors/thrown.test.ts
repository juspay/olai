import { expect, test } from "bun:test"

import { thrownText } from "./thrown.ts"

test("an error is its stack, which already carries its message", () => {
  const thrown = new TypeError("cannot read x of undefined")
  thrown.stack = "TypeError: cannot read x of undefined\n    at Tree (bundle.js:1:2)"
  expect(thrownText(thrown)).toBe(thrown.stack)
})

// Safari's stacks are frames only, and so is any stack copied onto a re-thrown
// error. The message is the one thing the card must not lose.
test("a stack that has lost the message gets it back", () => {
  const thrown = new RangeError("Maximum call stack size exceeded")
  thrown.stack = "render@bundle.js:1:2"
  expect(thrownText(thrown)).toBe(
    "RangeError: Maximum call stack size exceeded\nrender@bundle.js:1:2",
  )
})

test("an error with no stack at all is still named", () => {
  const thrown = new Error("no")
  thrown.stack = undefined
  expect(thrownText(thrown)).toBe("Error: no")
})

// A render may throw anything: `throw "nope"` is legal, and so is a rejected
// value that was never an Error.
test("a thrown value that is not an error is said as it is", () => {
  expect(thrownText("nope")).toBe("nope")
  expect(thrownText(undefined)).toBe("undefined")
  expect(thrownText({ code: 7 })).toBe("[object Object]")
})

// The one answer a fault card may not give is nothing at all: a blank card is
// the white tab this whole surface exists to replace.
test("a thrown value that says nothing still says something", () => {
  expect(thrownText("")).toBe("the page threw a value that says nothing about itself")
})
