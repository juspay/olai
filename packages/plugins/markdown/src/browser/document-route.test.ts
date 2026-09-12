import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { DocumentPath, samePageRequest } from "@olai/format"
import { atElement, atFile, atNode } from "olai-plugin-navigation/routes"
import { documentFile, documentRequest } from "./document-route.ts"

test("file fragments request the same document metadata while retaining their landing", () => {
  for (const file of ["notes/beds.md", "notes/second.html", "tables/data.csv", "art/photo.png", "reports/work.pdf"]) {
    const plain = documentRequest(TEST_CLAIMS, atFile(file))!
    const route = atElement(TEST_CLAIMS, file, "beds")
    const fragment = documentRequest(TEST_CLAIMS, route)!
    expect(fragment).toEqual({ kind: "at", address: { kind: "document", path: DocumentPath.make(file) } })
    expect(samePageRequest(plain, fragment)).toBe(true)
    expect(documentFile(TEST_CLAIMS, route)).toBe(DocumentPath.make(file))
    expect(route).toEqual(atElement(TEST_CLAIMS, file, "beds"))
  }
})

test("split panes independently request their files, with headings reserved for navigation", () => {
  const left = documentRequest(TEST_CLAIMS, atElement(TEST_CLAIMS, "notes/left.md", "code"))!
  const right = documentRequest(TEST_CLAIMS, atElement(TEST_CLAIMS, "notes/right.md", "lists"))!
  expect(left.address.path).toBe(DocumentPath.make("notes/left.md"))
  expect(right.address.path).toBe(DocumentPath.make("notes/right.md"))
  expect(samePageRequest(left, right)).toBe(false)
  expect(documentRequest(TEST_CLAIMS, atElement(TEST_CLAIMS, "notes/left.md", "other"))).toEqual(left)
})

test("outline, node and unclaimed addresses do not acquire a document stream", () => {
  for (const route of [atFile("house.olai"), atElement(TEST_CLAIMS, "house.olai", "handles"), atNode("handles"), atFile("unknown.txt"), {kind: "at", address: null} as const]) {
    expect(documentFile(TEST_CLAIMS, route)).toBeUndefined()
    expect(documentRequest(TEST_CLAIMS, route)).toBeNull()
  }
})
