import { expect, test } from "bun:test"

import { ACCOUNT, renderConfig, tomlString } from "./config.ts"

test("the rendered file is the shape the pinned binary parses", () => {
  const file = renderConfig({ token: "ya29.fake", address: "you@gmail.com" })
  expect(file).toContain(`[accounts.${ACCOUNT}]`)
  expect(file).toContain("default = true")
  expect(file).toContain('backend = "gmail"')
  expect(file).toContain('email = "you@gmail.com"')
  expect(file).toContain(`[accounts.${ACCOUNT}.gmail]`)
  expect(file).toContain('user-id = "me"')
  expect(file).toContain('auth.token.raw = "ya29.fake"')
})

test("an account with no address yet renders without an email line", () => {
  const file = renderConfig({ token: "ya29.fake", address: null })
  expect(file).not.toContain("email =")
  expect(file).toContain('auth.token.raw = "ya29.fake"')
})

test("a token cannot end the string it is written into", () => {
  expect(tomlString("a\"b\\c\nd\re\tf")).toBe('"a\\"b\\\\c\\nd\\re\\tf"')
  expect(tomlString("a\nb")).not.toMatch(/\n/)
  const injected = renderConfig({ token: "x\"\n[accounts.evil]\ndefault = true", address: null })
  expect(injected.split("\n").filter((line) => line.startsWith("[accounts."))).toEqual([
    "[accounts.olai]",
    "[accounts.olai.gmail]",
  ])
})
