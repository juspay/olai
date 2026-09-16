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
  // The token is the one value here that arrives over the network, and a TOML
  // file assembled by concatenation is a file its own value can change.
  expect(tomlString("a\"b\\c\nd\re\tf")).toBe('"a\\"b\\\\c\\nd\\re\\tf"')
  expect(tomlString("a\nb")).not.toMatch(/\n/)
  const injected = renderConfig({ token: "x\"\n[accounts.evil]\ndefault = true", address: null })
  // The token's own newline is escaped, so it cannot open a section: the file
  // has exactly the lines the template wrote.
  expect(injected.split("\n").filter((line) => line.startsWith("[accounts."))).toEqual([
    "[accounts.olai]",
    "[accounts.olai.gmail]",
  ])
})
