import * as fs from "node:fs"
import * as path from "node:path"

export const replaceBehindTheStamps = (
  root: string,
  file: string,
  contents: string,
): void => {
  const at = path.join(root, file)
  const stamp = fs.statSync(at)
  if (stamp.size !== Buffer.byteLength(contents)) {
    throw new Error(
      `${file}: a replacement of ${Buffer.byteLength(contents)} bytes over ` +
        `${stamp.size} is visible to the stamps — this helper only hides ` +
        `same-length ones`,
    )
  }
  fs.writeFileSync(at, contents)
  fs.utimesSync(at, stamp.atime, stamp.mtime)
}
