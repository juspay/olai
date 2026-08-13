/**
 * The GATE, on its own — what olai will accept and what it says when it will
 * not.
 *
 * The chunking arithmetic that used to be tested here is
 * `@kolu/surface/frame-chunking`'s now, and its properties are pinned where the
 * derivation is (kolu's `frameChunking.test.ts` measures the chunk against the
 * cap it has to fit under). Re-asserting them here would be the copy coming
 * back as a test.
 *
 * What is left is what no framework can decide: which extensions this app
 * hands an agent, and the sentence a refused person reads.
 */

import { isPicture, PICTURE_EXTENSIONS } from "@olai/format"
import { FRAME_CHUNK_BYTES } from "@kolu/surface/frame-chunking"
import { expect, test } from "bun:test"

import {
  ATTACHMENT_EXTENSIONS,
  attachmentRejection,
  DOCUMENT_EXTENSIONS,
  isAttachable,
  MAX_ATTACHMENT_BYTES,
} from "./attach.ts"

// The one relation between olai's number and the framework's, and the reason
// they are two numbers: a POLICY cap on a file that was smaller than one frame
// would mean the chunking never ran, and the failure of that is a closed socket
// rather than a refused upload.
test("the cap on a file is a different number from the size of a frame", () => {
  expect(MAX_ATTACHMENT_BYTES).toBeGreaterThan(FRAME_CHUNK_BYTES)
})

test("the gate takes what can be looked at AND what can be read", () => {
  // Pictures, as before — the format package's own allowlist, and case is not
  // part of the question.
  expect(attachmentRejection("shot.png", 1024)).toBeNull()
  expect(attachmentRejection("shot.PNG", 1024)).toBeNull()

  // ... and the documents an agent opens from a path rather than looks at. A
  // PDF is the one a person reaches for first; the rest is text.
  for (const name of ["Type 04-C.pdf", "notes.txt", "README.md", "rows.csv", "tsconfig.json"]) {
    expect(attachmentRejection(name, 1024)).toBeNull()
  }
})

test("the gate names the two ways an attachment is refused", () => {
  // The sentence names the WHOLE list, because the list is what the person
  // reading it is asking about. It said "is not a picture" when pictures were
  // all this took, which was true until a PDF was allowed through.
  const refused = attachmentRejection("archive.zip", 10)
  expect(refused).toMatch(/cannot be attached/)
  expect(refused).toContain(".pdf")
  expect(refused).toContain(".png")

  // An SVG is a document that can script, so it is in neither list: not a
  // picture this app will paint, and not text it will pass on. The one
  // absence worth a test of its own.
  expect(attachmentRejection("logo.svg", 10)).toMatch(/cannot be attached/)

  // The cap is unmoved, and it is about the FILE rather than about its kind:
  // a PDF over it is refused for the same reason a picture is.
  expect(attachmentRejection("shot.png", MAX_ATTACHMENT_BYTES + 1)).toMatch(
    /over the 50 MB limit/,
  )
  expect(attachmentRejection("huge.pdf", MAX_ATTACHMENT_BYTES + 1)).toMatch(
    /over the 50 MB limit/,
  )
})

test("what may be ATTACHED and what may be PAINTED are two lists that meet once", () => {
  // The widening must not have reached `@olai/format`: a relative `![](x.pdf)`
  // in a note is still not a picture, and `/media` still guards the same set.
  expect(isPicture("Type 04-C.pdf")).toBe(false)
  expect(isPicture("notes.txt")).toBe(false)
  expect(isAttachable("Type 04-C.pdf")).toBe(true)
  // Every picture is attachable; the reverse is what is new.
  for (const extension of PICTURE_EXTENSIONS) expect(isAttachable(`shot${extension}`)).toBe(true)
  expect(ATTACHMENT_EXTENSIONS).toEqual([...PICTURE_EXTENSIONS, ...DOCUMENT_EXTENSIONS])
})
