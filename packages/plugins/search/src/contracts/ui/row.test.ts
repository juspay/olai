/** File hits retain their address; only body line hits add a line fragment. */
import { expect, test } from "bun:test"
import { DocumentPath, Slug, type SearchHit } from "@olai/format"
import { hitRow } from "./row.ts"

test("an outline filename hit opens the file without document-only properties", () => {
  const hit: SearchHit = { at: { kind: "document", path: DocumentPath.make("house.olai") }, title: "House", matched: "path" }
  expect(hitRow(hit)).toMatchObject({ place: { file: "house.olai" }, props: [], route: { kind: "at", address: hit.at } })
})
test("a body line hit retains its path, line and query", () => {
  const row = hitRow({ at: { kind: "document", path: DocumentPath.make("notes.md") }, title: "Notes", line: 14 }, " cabinet ")
  expect(row.route).toEqual({ kind: "at", address: { kind: "heading", path: DocumentPath.make("notes.md"), slug: Slug.make("L14") }, filter: " cabinet " })
})
