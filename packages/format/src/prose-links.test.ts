import { expect, test } from "bun:test"
import { proseLinks } from "./prose-links.ts"

test("code examples contain no prose links but adjacent text does", () => {
  const code = ["`[x](inline.md)`", "``[x](back`tick.md)``", "```md\n[x](fenced.md)\n```", "~~~\n[x](tilde.md)\n~~~", "    [x](indented.md)", "    - [x](indented-list.md)"].join("\n")
  expect(proseLinks(code)).toEqual([])
  expect(proseLinks(`${code}\n[real](real.md)`)).toEqual(["real.md"])
  expect(proseLinks("`unclosed [real](real.md)")).toHaveLength(1)
})

test("list continuation links are prose while code within the list remains literal", () => {
  const text = "- Item\n    [continued](continued.md)\n\n      [code](code.md)\n\nOutside [link](outside.md)"
  expect(proseLinks(text)).toEqual(["continued.md", "outside.md"])
})

test("literal lines in a list fence do not swallow links after its indented closer", () => {
  for (const marker of ["```", "~~~"]) {
    const text = `123. Item\n     ${marker}\n[example](ignored.md)\n- literal list marker\n     ${marker}\n\n[after](after.md)`
    expect(proseLinks(text)).toEqual(["after.md"])
  }
})
