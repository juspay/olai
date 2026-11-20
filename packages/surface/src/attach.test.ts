import { TEST_CLAIMS } from "@olai/format/testlib"
const PICTURE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".ico"]
import { isPicture } from "@olai/format"
import { FRAME_CHUNK_BYTES } from "@kolu/surface/frame-chunking"
import { expect, test } from "bun:test"

import {
  ATTACHMENT_EXTENSIONS,
  ATTACHMENT_ACCEPT,
  isAttachmentVideo,
  MAX_VIDEO_ATTACHMENT_BYTES,
  attachmentRejection,
  DOCUMENT_EXTENSIONS,
  isAttachable,
  isAttachmentPicture,
  MAX_ATTACHMENT_BYTES,
  VIDEO_EXTENSIONS,
} from "./attach.ts"

test("the cap on a file is a different number from the size of a frame", () => {
  expect(MAX_ATTACHMENT_BYTES).toBeGreaterThan(FRAME_CHUNK_BYTES)
})

test("the gate takes what can be looked at AND what can be read", () => {
  expect(attachmentRejection("shot.png", 1024)).toBeNull()
  expect(attachmentRejection("shot.PNG", 1024)).toBeNull()

  for (const name of ["Type 04-C.pdf", "notes.txt", "README.md", "rows.csv", "tsconfig.json"]) {
    expect(attachmentRejection(name, 1024)).toBeNull()
  }

  for (const name of ["ScreenRecording_09-12-2026 23-01-06_1.mp4", "clip.MOV", "take.webm", "a.m4v", "b.mkv"]) {
    expect(attachmentRejection(name, 1024)).toBeNull()
  }
})

test("the gate names the two ways an attachment is refused", () => {
  const refused = attachmentRejection("archive.zip", 10)
  expect(refused).toMatch(/cannot be attached/)
  expect(refused).toContain(".pdf")
  expect(refused).toContain(".png")

  expect(attachmentRejection("logo.svg", 10)).toMatch(/cannot be attached/)

  expect(attachmentRejection("shot.png", MAX_ATTACHMENT_BYTES + 1)).toMatch(
    /over the 50 MB limit/,
  )
  expect(attachmentRejection("huge.pdf", MAX_ATTACHMENT_BYTES + 1)).toMatch(
    /over the 50 MB limit/,
  )
})

test("what may be ATTACHED and what may be PAINTED are two lists that meet once", () => {
  expect(isPicture(TEST_CLAIMS, "Type 04-C.pdf")).toBe(false)
  expect(isPicture(TEST_CLAIMS, "notes.txt")).toBe(false)
  expect(isAttachable("Type 04-C.pdf")).toBe(true)
  for (const extension of PICTURE_EXTENSIONS) expect(isAttachable(`shot${extension}`)).toBe(true)
  expect(ATTACHMENT_EXTENSIONS).toEqual([...PICTURE_EXTENSIONS, ...DOCUMENT_EXTENSIONS, ...VIDEO_EXTENSIONS])
})

test("a video is attachable and is not a picture", () => {
  for (const extension of VIDEO_EXTENSIONS) {
    expect(isAttachable(`clip${extension}`)).toBe(true)
    expect(isAttachmentPicture(`clip${extension}`)).toBe(false)
  }
  expect(attachmentRejection("long.mp4", MAX_ATTACHMENT_BYTES + 1)).toBeNull()
  expect(attachmentRejection("long.MOV", MAX_VIDEO_ATTACHMENT_BYTES)).toBeNull()
  expect(attachmentRejection("long.mp4", MAX_VIDEO_ATTACHMENT_BYTES + 1)).toMatch(/over the 200 MB limit/)
  expect(isAttachmentVideo("clip.MOV")).toBe(true)
  expect(isAttachmentVideo("notes.txt")).toBe(false)
  expect(ATTACHMENT_ACCEPT.split(",")).toEqual([...ATTACHMENT_EXTENSIONS, "image/*", "video/*"])
})

test("a transport stream is .m2ts, and a TypeScript file is not a video", () => {
  expect(isAttachable("broadcast.m2ts")).toBe(true)
  expect(isAttachable("server.ts")).toBe(false)
  expect(isAttachable("module.mts")).toBe(false)
})

test("picture attachments use the filename even when the blob has no MIME type", () => {
  const file = new File([new Uint8Array([1, 2, 3])], "shot.PNG")
  expect(file.type).toBe("")
  expect(isAttachmentPicture(file.name)).toBe(true)
  expect(isAttachmentPicture("logo.svg")).toBe(false)
  expect(isAttachmentPicture("report.pdf")).toBe(false)
})
