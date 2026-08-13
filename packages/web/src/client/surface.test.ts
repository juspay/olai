import { expect, test } from "bun:test"

import { BAR, MEASURE } from "./surface.ts"

test("the sheet has a readable measure, not the column's leftover width", () => {
  // Finding 1 of the visual review that killed #134: at real widths the paper
  // stretched to ~1500px and note lines ran 150 characters to the edge. The
  // token is the one number; App.tsx is what applies it.
  expect(MEASURE).toBe("max-w-[var(--width-paper)]")
})

test("the header bar has its own altitude — a shadow and a seam", () => {
  // Finding 6: the bar shared the canvas plane. A card shadow plus a 1px seam
  // is what the mock gave it so content scrolls under something.
  expect(BAR).toContain("--shadow-card")
  expect(BAR).toContain("--color-seam")
})
