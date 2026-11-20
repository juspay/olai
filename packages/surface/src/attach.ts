const PICTURE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".ico"]

export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024
export const MAX_VIDEO_ATTACHMENT_BYTES = 200 * 1024 * 1024

export const DOCUMENT_EXTENSIONS: ReadonlyArray<string> = [
  ".pdf",
  ".txt",
  ".md",
  ".csv",
  ".json",
]

export const VIDEO_EXTENSIONS: ReadonlyArray<string> = [
  ".mp4",
  ".m4v",
  ".mov",
  ".webm",
  ".mkv",
  ".avi",
  ".wmv",
  ".flv",
  ".mpg",
  ".mpeg",
  ".3gp",
  ".3g2",
  ".ogv",
  ".m2ts",
]

export const ATTACHMENT_EXTENSIONS: ReadonlyArray<string> = [
  ...PICTURE_EXTENSIONS,
  ...DOCUMENT_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
]

export const ATTACHMENT_ACCEPT = [...ATTACHMENT_EXTENSIONS, "image/*", "video/*"].join(",")

export const isAttachmentVideo = (name: string): boolean =>
  VIDEO_EXTENSIONS.some(extension => name.toLowerCase().endsWith(extension))

export const isAttachable = (name: string): boolean => {
  const lower = name.toLowerCase()
  return ATTACHMENT_EXTENSIONS.some((extension) => lower.endsWith(extension))
}

export const attachmentRejection = (name: string, bytes: number): string | null => {
  if (!isAttachable(name)) {
    return `"${name}" cannot be attached — attachments are ${ATTACHMENT_EXTENSIONS.join(", ")}`
  }
  const cap = isAttachmentVideo(name) ? MAX_VIDEO_ATTACHMENT_BYTES : MAX_ATTACHMENT_BYTES
  if (bytes > cap) {
    const mb = (n: number) => (n / (1024 * 1024)).toFixed(0)
    return `"${name}" is ${mb(bytes)} MB, over the ${mb(cap)} MB limit`
  }
  return null
}

export const isAttachmentPicture = (path: string): boolean => PICTURE_EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext))
