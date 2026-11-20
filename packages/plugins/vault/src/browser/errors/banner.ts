import {
  type BrokenFile,
  byPath,
  type FileState,
  isClean,
  blamed,
  type Summary,
  summaryOf,
  type Verdict,
} from "@olai/format"

export const BANNER_FILES = 5

export type Trouble =
  | { readonly kind: "files"; readonly face: Summary }
  | { readonly kind: "gone"; readonly face: Summary }

export const troubleIn = (
  broken: ReadonlyMap<string, BrokenFile>,
  verdict: Verdict,
): Trouble | null => {
  if (!isClean(verdict)) {
    const face = summaryOf(blamed(verdict.findings), BANNER_FILES)
    if (face.files.some((one) => one.state === "unreadable")) return { kind: "gone", face }
  }
  if (broken.size === 0) return null
  const files = [...broken.values()].sort((one, other) => byPath(one.file, other.file))
  return { kind: "files", face: summaryOf(files, BANNER_FILES) }
}

export const SAID: Record<FileState, string> = {
  unreadable: "could not be read",
  unparsed: "has lines that can't be read",
  invalid: "conflicts with other outlines",
}
