/**
 * The catalog and the derivation name the same faces.
 *
 * `default.nix` converts a list of nixpkgs files; `catalog.ts` names the files
 * a sheet will ask for. They are two lists in two languages and neither can
 * import the other, so what keeps them one set is this test rather than
 * memory. Without it the drift is silent until the client build's own
 * by-name lookup fails (a face the catalog gained) — or forever (a face the
 * derivation converts and no sheet ever asks for, paid for on every font-set
 * change and downloaded by nobody).
 */

import { expect, test } from "bun:test"

import { HOSTED_FILES } from "./catalog.ts"

const nix = await Bun.file(new URL("../default.nix", import.meta.url)).text()

/** Every font file the derivation names, by basename: the quoted `"…ttf"` /
 *  `"…otf"` argument of a `ttf`/`otf` call, and the whole-path entries that
 *  are spelled out (Lexend's nested directory). */
const converted = [...nix.matchAll(/([\w.-]+\.(?:ttf|otf))"/gi)].map(
  (match) => match[1],
)

test("the derivation converts exactly the files the catalog hosts", () => {
  expect(converted.length).toBeGreaterThan(0)
  expect([...converted].sort()).toEqual(
    HOSTED_FILES.map((file) => file.file).sort(),
  )
})
