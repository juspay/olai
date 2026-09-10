import { expect, test } from "bun:test"
import { DocumentPath, samePageRequest } from "@olai/format"
import { atElement, atFile, atNode } from "olai-plugin-navigation/routes"
import { documentFile, documentRequest } from "./document-route.ts"

test("file fragments request the same document metadata while retaining their landing", () => {
  for (const file of ["notes/beds.md", "notes/second.html", "tables/data.csv", "art/photo.png", "reports/work.pdf"]) {
    const plain = documentRequest(atFile(file))!
    const route = atElement(file, "beds")
    const fragment = documentRequest(route)!
    expect(fragment).toEqual({ kind: "at", address: { kind: "document", path: DocumentPath.make(file) } })
    expect(samePageRequest(plain, fragment)).toBe(true)
    expect(documentFile(route)).toBe(DocumentPath.make(file))
    expect(route).toEqual(atElement(file, "beds"))
  }
})

test("split panes independently request their files, with headings reserved for navigation", () => {
  const left = documentRequest(atElement("notes/left.md", "code"))!
  const right = documentRequest(atElement("notes/right.md", "lists"))!
  expect(left.address.path).toBe(DocumentPath.make("notes/left.md"))
  expect(right.address.path).toBe(DocumentPath.make("notes/right.md"))
  expect(samePageRequest(left, right)).toBe(false)
  expect(documentRequest(atElement("notes/left.md", "other"))).toEqual(left)
})

test("outline, node and unclaimed addresses do not acquire a document stream", () => {
  for (const route of [atFile("house.olai"), atElement("house.olai", "handles"), atNode("handles"), atFile("unknown.txt"), {kind: "at", address: null} as const]) {
    expect(documentFile(route)).toBeUndefined()
    expect(documentRequest(route)).toBeNull()
  }
})
