import { expect, test } from "bun:test"
import { slotCatalog } from "@olai/plugin-api/slots"
import { slotContracts } from "./slots.ts"

test("outlines declares node contributions at all four row and page seats", () => {
  const catalog = slotCatalog([{ slots: slotContracts }])
  for (const name of [
    "outline.row.aside", "outline.row.fold", "outline.page.head", "outline.page.foot",
  ]) {
    expect(catalog.filter((entry) => entry.name === name)).toEqual([
      { name, keyedBy: "nothing" },
    ])
  }
})
