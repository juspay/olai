import { expect, test } from "bun:test"

import { TAG_CLASS } from "./tags.ts"

test("a tag is a chip from the palette's own table, not an opacity smear", () => {
  // Finding 7: `#upstream` etc. were square-ish pale smears on warm palettes
  // (`rounded-sm bg-accent/15`). `picked` is accent mixed into the raised
  // surface — opaque, from the table — and `rounded-md` is a pill.
  expect(TAG_CLASS).toContain("bg-picked")
  expect(TAG_CLASS).toContain("rounded-md")
  expect(TAG_CLASS).not.toContain("bg-accent/")
  expect(TAG_CLASS).not.toContain("rounded-sm")
})
