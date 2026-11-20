import { describe, expect, test } from "bun:test"

import { DEFAULT_TYPEFACE, FONT_TOKENS, fontProperty } from "@olai/fonts"

describe("the stylesheet's @theme", () => {
  test("declares the default typeface, token for token", async () => {
    const sheet = await Bun.file(new URL("./tokens.css", import.meta.url)).text()
    const theme = /@theme\s*\{([^}]*)\}/.exec(sheet)?.[1]
    expect(theme).toBeDefined()
    for (const token of FONT_TOKENS) {
      expect(theme).toContain(
        `${fontProperty(token)}: ${DEFAULT_TYPEFACE[token]};`,
      )
    }
  })
})
