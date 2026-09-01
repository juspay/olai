/**
 * THE GENERATED MARK, held to what a pin bump may not quietly change — and,
 * before any of that, the sentence `bun test` cannot otherwise say.
 *
 * `./mark.generated.ts` is written by {@link ../../default.nix} out of the
 * pinned kolu's `packages/client/favicon.svg` and copied into place by
 * `just install`. It has EXACTLY the lifecycle of the vendored `@kolu/*`
 * sources — same pin, same recipe, same absence — so a tree on which
 * `just install` has never run already fails everywhere and this file adds no
 * new way to be broken. What it does add is the one window that is genuinely
 * new: a tree installed BEFORE this change and not re-installed after, where
 * the runtime's own message would be `Cannot find module './mark.generated.ts'`
 * — a path with no cause attached to it.
 *
 * So the guard runs FIRST, before any import of the generated module, and says
 * what `@olai/web`'s font step says when `OLAI_FONTS_DIR` is unset: the named
 * producer, the named input, and the command to run. That is why the import
 * below is a dynamic one inside the test body — this file's own top level has
 * to load even when the module it is about does not exist.
 *
 * ## Why these four claims and not a golden copy of the output
 *
 * A fixture of the emitted body would be a vendored copy of kolu's mark one
 * indirection removed, and it would go red on every pin bump for the ordinary
 * reason that kolu redrew something — which teaches everybody to update the
 * fixture without reading it. What is asserted instead is what must be true of
 * ANY mark this transform emits: a viewBox the nested viewport can use, no
 * `title`/`desc` ids (the two most collision-prone strings a document has),
 * every id tokenised, and every reference pointing at one that is declared. A
 * kolu mark that changes shape in a way this arrangement cannot honour goes red
 * HERE, rather than half-painted in somebody's transcript.
 *
 * The gradient count is the fifth and is the one claim about kolu specifically:
 * the three rainbow steps ARE the logo, and a "mark" that arrived with none of
 * them is a build that succeeded at producing the wrong picture. Whether they
 * reached the live DOM is a question only a browser can answer, and the e2e
 * suite asks it there.
 */

import { existsSync } from "node:fs"
import { expect, test } from "bun:test"

const GENERATED = new URL("./mark.generated.ts", import.meta.url).pathname

const guard = (): void => {
  if (!existsSync(GENERATED)) {
    throw new Error(
      "packages/plugins/olai-plugin-kolu/src/browser/mark.generated.ts is absent. It is GENERATED from " +
        "the pinned kolu's packages/client/favicon.svg by packages/plugins/olai-plugin-kolu/default.nix " +
        "and copied into place by 'just install' — run 'just install'.",
    )
  }
}

/** The generated module, imported only once the guard has had its say. */
const generated = async () => {
  guard()
  return await import("./mark.generated.ts")
}

test("the viewBox is four numbers the nested viewport can fit the artwork into", async () => {
  const { MARK_VIEWBOX } = await generated()
  const parts = MARK_VIEWBOX.trim().split(/\s+/)
  expect(parts).toHaveLength(4)
  for (const part of parts) expect(Number.isFinite(Number(part))).toBe(true)
})

test("the asset's accessible names never enter the page", async () => {
  const { MARK_BODY } = await generated()
  expect(MARK_BODY).not.toContain(`id="title"`)
  expect(MARK_BODY).not.toContain(`id="desc"`)
  expect(MARK_BODY).not.toContain("<title")
  expect(MARK_BODY).not.toContain("<desc")
})

test("every id it declares is tokenised, so the shipped constant is safe at rest", async () => {
  const { MARK_BODY, MARK_TOKEN } = await generated()
  const ids = [...MARK_BODY.matchAll(/\sid\s*=\s*"([^"]*)"/g)].map((found) => found[1] ?? "")
  expect(ids.length).toBeGreaterThan(0)
  for (const id of ids) expect(id.startsWith(MARK_TOKEN)).toBe(true)
})

test("every url(#…) names an id the body declares", async () => {
  const { MARK_BODY } = await generated()
  const declared = new Set(
    [...MARK_BODY.matchAll(/\sid\s*=\s*"([^"]*)"/g)].map((found) => found[1] ?? ""),
  )
  const referenced = [...MARK_BODY.matchAll(/url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/g)].map(
    (found) => found[1] ?? "",
  )
  expect(referenced.length).toBeGreaterThan(0)
  for (const id of referenced) expect(declared.has(id)).toBe(true)
})

test("the three rainbow steps are still three gradients", async () => {
  const { MARK_BODY } = await generated()
  const gradients = [...MARK_BODY.matchAll(/<linearGradient\b/g)]
  expect(gradients.length).toBeGreaterThanOrEqual(3)
})
