import { expect, test } from "bun:test"

const shell = (): Promise<string> =>
  Bun.file(new URL("./index.html", import.meta.url)).text()

const policyOf = async (): Promise<string | undefined> =>
  /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(
    await shell(),
  )?.[1]

test("the shell admits https images — the picture's host is the operator's", async () => {
  const policy = await policyOf()
  expect(policy).toBeDefined()
  expect(policy).toContain("img-src")
  expect(policy).toContain("https:")
  expect(policy).toContain("'self'")
  expect(policy).toContain("blob:")
})

test("it is a policy, not a hole — the whole list, in the open", async () => {
  const policy = await policyOf()
  expect((policy ?? "").split(/\s+/)).toEqual([
    "img-src",
    "'self'",
    "blob:",
    "https:",
  ])
})
