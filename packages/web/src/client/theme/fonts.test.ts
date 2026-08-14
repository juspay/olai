/**
 * What this client's own two hand-written files owe the catalog.
 *
 * The table and its generator are `@olai/fonts`, and they are tested there.
 * What is left here is the pair of places a name is spelled by hand and could
 * silently stop matching: the shell's pre-paint boot script, and the `@theme`
 * block Tailwind reads its `--font-*` namespace out of.
 */

import { describe, expect, test } from "bun:test"

import {
  DEFAULT_TYPEFACE,
  FONT_ATTRIBUTE,
  FONT_STORAGE_KEY,
  FONT_TOKENS,
  fontProperty,
} from "@olai/fonts"

describe("the shell's boot script", () => {
  const shell = (): Promise<string> =>
    Bun.file(new URL("../index.html", import.meta.url)).text()

  test("reads the key this table writes, and writes the attribute it keys on", async () => {
    const html = await shell()
    expect(html).toContain(`localStorage.getItem("${FONT_STORAGE_KEY}")`)
    expect(html).toContain(`setAttribute("${FONT_ATTRIBUTE}"`)
  })
})

describe("the stylesheet's @theme", () => {
  test("declares the default typeface, token for token", async () => {
    const sheet = await Bun.file(new URL("../styles.css", import.meta.url)).text()
    const theme = /@theme\s*\{([^}]*)\}/.exec(sheet)?.[1]
    expect(theme).toBeDefined()
    for (const token of FONT_TOKENS) {
      expect(theme).toContain(
        `${fontProperty(token)}: ${DEFAULT_TYPEFACE[token]};`,
      )
    }
  })
})
