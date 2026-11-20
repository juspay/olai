import * as path from "node:path"

import { expect, test } from "bun:test"

import { codeIn, manifestOf, PACKAGES, sourcesUnder } from "./tree.testlib.ts"

test("sourcesUnder reads one directory, not a sibling whose name begins with it", () => {
  const pi = sourcesUnder(path.join(PACKAGES, "plugins/pi"))
  const pins = sourcesUnder(path.join(PACKAGES, "plugins/pins"))
  expect(pi.length).toBeGreaterThan(0)
  expect(pins.length).toBeGreaterThan(0)
  for (const file of pi) expect([file, file.startsWith(path.join(PACKAGES, "plugins/pi") + path.sep)]).toEqual([file, true])
  expect(pi.filter((file) => file.startsWith(path.join(PACKAGES, "plugins/pins") + path.sep))).toEqual([])
})

test("manifestOf reads a member of the workspace, and nothing that is not a directory", () => {
  expect(manifestOf("plugins/pi")?.name).toBe("olai-plugin-pi")
  expect(manifestOf("package.json")).toBeUndefined()
})

test("codeIn keeps the nix a line-wise stripper would eat, and drops the prose", () => {
  const code = codeIn(
    "a.nix",
    [
      "union = acc.union // contrib;",
      "name = ''${path##*/}'';",
      'url = "https://example.test/#frag";',
      "# a note about files",
      "x = 1; # a trailing note",
      "/* a block note */ y = 2;",
    ].join("\n"),
  )
  expect(code).toContain("acc.union // contrib")
  expect(code).toContain("${path##*/}")
  expect(code).toContain("https://example.test/#frag")
  expect(code).toContain("x = 1;")
  expect(code).toContain("y = 2;")
  expect(code).not.toContain("a note about files")
  expect(code).not.toContain("a trailing note")
  expect(code).not.toContain("a block note")
})

test("codeIn drops a comment-only line of a script a nix string carries", () => {
  const code = codeIn("a.nix", ["script = ''", "  # the generated files are ignored", "  cp $x $out", "'';"].join("\n"))
  expect(code).toContain("cp $x $out")
  expect(code).not.toContain("the generated files are ignored")
})

test("codeIn reads TypeScript with a parser, so a string that looks like a comment survives", () => {
  const code = codeIn("a.ts", ['const url = "http://x/y" // a note', "const page = `", "// a line of prose", "`"].join("\n"))
  expect(code).toContain('"http://x/y"')
  expect(code).not.toContain("a note")
  expect(code).not.toContain("a line of prose")
})
